/**
 * Analysis Orchestrator
 *
 * Coordinates the analysis workflow by managing:
 * - User authentication and creation
 * - Usage tracking and limits
 * - Session management
 * - File processing
 * - RAG document loading
 * - AI API calls with retry logic
 * - Database operations
 * - Email notifications
 */

import { clerkClient } from '@clerk/nextjs/server';
import OpenAI from 'openai';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import {
  getActiveRegulatoryDocuments,
  buildRegulatoryContext,
  getRecommendedDocuments,
} from '@/lib/regulatory-documents';
import { sendEmail } from '@/lib/resend';
import { generateAnalysisResultEmail } from '@/lib/email-templates';
import { preprocessImage } from '@/lib/image-processing';
import { createSession, addIteration } from '@/lib/session-helpers';
import { processPdfForAnalysis } from '@/lib/pdf-helpers';
import { isUserAdmin } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';
import type { AnalysisResult, Recommendation, RegulatoryDocument, Analysis } from '@/types';

export interface UserInfo {
  id: string;
  email: string;
}

export interface UsageInfo {
  analyses_used: number;
  analyses_limit: number;
}

export interface SessionInfo {
  id: string;
  title: string | null;
}

export interface ProcessedFile {
  isPdf: boolean;
  base64Data?: string;
  pdfTextContent?: string;
  mediaType: 'image/jpeg' | 'image/png';
  contentType: 'image' | 'document' | 'text';
}

export interface DocumentLoadResult {
  regulatoryDocuments: RegulatoryDocument[];
  regulatoryContext: string;
  ragInfo: {
    preClassifiedCategory: string | null;
    documentCount: number;
    totalCount: number;
  } | null;
}

/**
 * Get user from database or create if not exists
 */
export async function getUserWithFallback(userId: string): Promise<UserInfo> {
  // Use admin client to bypass RLS when looking up user
  let user = await supabaseAdmin
    .from('users')
    .select('id, email')
    .eq('clerk_user_id', userId)
    .maybeSingle()
    .then((res) => res.data);

  // If user doesn't exist in Supabase, create them (fallback for webhook issues)
  if (!user) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      const userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress || '';

      if (!userEmail) {
        logger.error('No email found for Clerk user', { userId });
        throw new Error('User email not found');
      }

      // Use admin client to bypass RLS when creating user
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          clerk_user_id: userId,
          email: userEmail,
        })
        .select('id, email')
        .single();

      if (createError) {
        logger.error('Failed to create user in Supabase', { error: createError, userId });
        throw new Error(`Failed to create user record: ${createError.message}`);
      }

      if (!newUser) {
        logger.error('User creation returned no data', { userId });
        throw new Error('Failed to create user record');
      }

      user = newUser;
      logger.info('User created successfully', { userId, userInternalId: newUser.id });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Exception creating user', { error, userId });
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  return user;
}

/**
 * Check usage limits and return current usage info
 */
export async function checkUsageLimits(userId: string, userInternalId: string): Promise<UsageInfo> {
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Use admin client for usage tracking (bypass RLS)
  const { data: usage } = await supabaseAdmin
    .from('usage_tracking')
    .select('*')
    .eq('user_id', userInternalId)
    .eq('month', currentMonth)
    .maybeSingle();

  if (!usage) {
    // Use admin client for subscription lookup (bypass RLS)
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('plan_tier, status')
      .eq('user_id', userInternalId)
      .eq('status', 'active')
      .maybeSingle();

    const limits: Record<string, number> = {
      starter: 10,
      professional: 50,
      business: 200,
    };

    // Map database plan_tier format (basic/pro/enterprise) to limits format
    const planTierMap: Record<string, string> = {
      basic: 'starter',
      pro: 'professional',
      enterprise: 'business',
      starter: 'starter',
      professional: 'professional',
      business: 'business',
    };

    const dbPlanTier = subscription?.plan_tier || 'starter';
    const mappedPlanTier = planTierMap[dbPlanTier] || 'starter';
    const limit = limits[mappedPlanTier] || 10;

    // Use admin client to create usage tracking (bypass RLS)
    // Note: This creates a NEW month record with usage reset to 0
    // This is use-it-or-lose-it monthly - unused analyses don't carry over
    // The limit is set to just the subscription plan limit (no trial bonus)
    const { error: usageError } = await supabaseAdmin.from('usage_tracking').insert({
      user_id: userInternalId,
      month: currentMonth,
      analyses_used: 0, // Reset to 0 each month (use-it-or-lose-it)
      analyses_limit: limit, // Just subscription limit (no trial bonus in new months)
    });

    if (usageError) {
      logger.error('Failed to create usage tracking', {
        error: usageError,
        userId,
        userInternalId,
      });
    }
  }

  // Use admin client for usage lookup (bypass RLS)
  const { data: currentUsage } = await supabaseAdmin
    .from('usage_tracking')
    .select('*')
    .eq('user_id', userInternalId)
    .eq('month', currentMonth)
    .maybeSingle();

  if (!currentUsage) {
    throw new Error('Failed to track usage');
  }

  // Check if user is an admin - admins have unlimited access
  const isAdmin = await isUserAdmin(userId);

  // Check trial expiration for free trial users
  if (!isAdmin) {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('trial_start_date')
      .eq('id', userInternalId)
      .maybeSingle();

    // Check if user has active subscription
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('status')
      .eq('user_id', userInternalId)
      .eq('status', 'active')
      .maybeSingle();

    // If no subscription and has trial_start_date, check expiration
    if (!subscription && user?.trial_start_date) {
      const trialStart = new Date(user.trial_start_date);
      const now = new Date();
      const daysSinceStart = Math.floor(
        (now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceStart > 14) {
        throw new Error(
          'Your free trial has expired. Please upgrade to continue analyzing labels.'
        );
      }
    }
  }

  // Check for bundle credits if subscription limit is reached
  if (
    !isAdmin &&
    currentUsage.analyses_limit !== -1 &&
    currentUsage.analyses_used >= currentUsage.analyses_limit
  ) {
    // Check if user has bundle credits available
    const { data: bundles } = await supabaseAdmin
      .from('bundle_purchases')
      .select('id, analyses_remaining')
      .eq('user_id', userInternalId)
      .gt('analyses_remaining', 0)
      .order('purchased_at', { ascending: true }); // Use oldest bundles first

    const totalBundleCredits = bundles?.reduce((sum, b) => sum + b.analyses_remaining, 0) || 0;

    if (totalBundleCredits === 0) {
      throw new Error(
        'Monthly analysis limit reached. Purchase an analysis bundle or upgrade your plan.'
      );
    }

    // User has bundle credits, allow the analysis
    // Bundle credits will be consumed in updateUsage
  }

  return currentUsage;
}

/**
 * Handle session creation or retrieval
 */
export async function handleSession(
  userInternalId: string,
  existingSessionId: string | null,
  imageFile: File
): Promise<{ sessionId: string | null; session: SessionInfo | null }> {
  let sessionId = existingSessionId;
  let session = null;

  if (!sessionId) {
    // Create a new session for this analysis
    const productHint = imageFile.name.replace(/\.[^/.]+$/, ''); // Remove extension
    const { data: newSession, error: sessionError } = await createSession(
      userInternalId,
      `Analysis: ${productHint}`,
      true // use admin
    );

    if (sessionError || !newSession) {
      logger.error('Failed to create session', { error: sessionError, userInternalId });
      // Don't fail the analysis if session creation fails
      // The analysis will work without a session (backward compatible)
    } else {
      session = newSession;
      sessionId = newSession.id;
      logger.info('Session created successfully', { sessionId, userInternalId });
    }
  }

  return { sessionId, session };
}

/**
 * Process uploaded file (image or PDF)
 */
export async function processFile(imageFile: File): Promise<ProcessedFile> {
  logger.debug('Processing uploaded file', {
    fileName: imageFile.name,
    fileType: imageFile.type,
    fileSize: imageFile.size,
  });
  const bytes = await imageFile.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Detect if this is a PDF or image
  const isPdf = imageFile.type === 'application/pdf';
  let base64Data: string | undefined;
  let pdfTextContent: string | undefined;
  let mediaType: 'image/jpeg' | 'image/png' = 'image/jpeg'; // Default
  let contentType: 'image' | 'document' | 'text';

  if (isPdf) {
    // Hybrid PDF processing: text extraction first, CloudConvert fallback
    const pdfResult = await processPdfForAnalysis(buffer);

    if (pdfResult.type === 'text') {
      // Text extraction successful
      pdfTextContent = pdfResult.content as string;
      contentType = 'text';
      logger.info('Using extracted PDF text', { textLength: pdfTextContent.length });
    } else {
      // CloudConvert converted PDF to image
      const imageBuffer = pdfResult.content as Buffer;
      base64Data = imageBuffer.toString('base64');
      mediaType = 'image/jpeg';
      contentType = 'document';
      logger.info('Using CloudConvert PDF conversion');
    }
  } else {
    // For images, preprocess to improve readability
    logger.debug('Preprocessing image file');
    const processedBuffer = await preprocessImage(buffer);
    base64Data = processedBuffer.toString('base64');
    mediaType = 'image/jpeg';
    contentType = 'image';
    logger.debug('Image preprocessing completed');
  }

  return {
    isPdf,
    base64Data,
    pdfTextContent,
    mediaType,
    contentType,
  };
}

/**
 * Extract text from image for RAG lite filtering
 */
export async function extractTextForRag(
  openai: OpenAI,
  base64Data: string,
  mediaType: 'image/jpeg' | 'image/png'
): Promise<string | undefined> {
  try {
    logger.debug('Extracting text from image for RAG lite pre-classification');
    const quickOcrResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract the key text from this label image. Focus on: panel type (Supplement Facts vs Nutrition Facts), product name, product type, and any prominent keywords. Keep it brief (max 500 characters).',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mediaType};base64,${base64Data}`,
                detail: 'low', // Use low detail for speed
              },
            },
          ],
        },
      ],
      max_completion_tokens: 200,
      temperature: 0,
    });

    const extractedText = quickOcrResponse.choices[0]?.message?.content || '';
    logger.debug('Text extracted for RAG lite', { textLength: extractedText.length });
    return extractedText;
  } catch (ocrError) {
    logger.warn('Quick OCR failed, will use all documents', { error: ocrError });
    return undefined;
  }
}

/**
 * Load regulatory documents with RAG lite filtering
 */
export async function loadRegulatoryDocuments(
  pdfTextContent?: string,
  extractedTextForRag?: string
): Promise<DocumentLoadResult> {
  logger.debug('Fetching regulatory documents for RAG');

  // Use RAG lite for both PDFs and images (if text extraction succeeded)
  const textForRag = pdfTextContent || extractedTextForRag;

  if (textForRag) {
    // RAG lite - filter by pre-classified category
    const { documents, preClassifiedCategory, documentCount, totalCount } =
      await getRecommendedDocuments(textForRag);
    logger.debug('Regulatory documents loaded via RAG lite', {
      documentCount,
      totalCount,
      preClassifiedCategory,
    });

    return {
      regulatoryDocuments: documents,
      regulatoryContext: buildRegulatoryContext(documents),
      ragInfo: { preClassifiedCategory, documentCount, totalCount },
    };
  } else {
    // Fallback - load all documents if text extraction failed
    const documents = await getActiveRegulatoryDocuments();
    logger.debug('Regulatory documents loaded in fallback mode', {
      documentCount: documents.length,
    });

    return {
      regulatoryDocuments: documents,
      regulatoryContext: buildRegulatoryContext(documents),
      ragInfo: null,
    };
  }
}

/**
 * Call OpenAI API with retry logic for rate limits
 */
export async function callAIWithRetry(
  openai: OpenAI,
  regulatoryContext: string,
  analysisInstructions: string,
  pdfTextContent: string | undefined,
  base64Data: string | undefined,
  mediaType: 'image/jpeg' | 'image/png',
  maxRetries = 3
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    logger.debug('Calling OpenAI API', { attempt, maxRetries });
    try {
      // Construct the message content based on content type
      let userMessage:
        | OpenAI.Chat.Completions.ChatCompletionUserMessageParam
        | OpenAI.Chat.Completions.ChatCompletionMessageParam;

      if (pdfTextContent) {
        // Text-only mode (PDF with extractable text)
        userMessage = {
          role: 'user' as const,
          content:
            regulatoryContext +
            '\n\n' +
            analysisInstructions +
            '\n\n## Extracted PDF Text:\n\n' +
            pdfTextContent,
        };
      } else if (base64Data) {
        // Image mode (regular images or CloudConvert-converted PDFs)
        userMessage = {
          role: 'user' as const,
          content: [
            {
              type: 'text' as const,
              text: regulatoryContext + '\n\n' + analysisInstructions,
            },
            {
              type: 'image_url' as const,
              image_url: {
                url: `data:${mediaType};base64,${base64Data}`,
                detail: 'high' as const,
              },
            },
          ],
        };
      } else {
        throw new Error('No content available for analysis');
      }

      return await openai.chat.completions.create({
        model: 'gpt-4o',
        max_completion_tokens: 8192,
        messages: [userMessage],
        response_format: { type: 'json_object' },
      });
    } catch (err: unknown) {
      // Type guard for OpenAI API errors
      const error = err as { status?: number; error?: { type?: string } };

      // Check if it's a rate limit error
      if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
        logger.warn('OpenAI rate limit exceeded', { attempt, maxRetries });

        if (attempt === maxRetries) {
          // On final attempt, throw a user-friendly error
          throw new Error(
            'API rate limit reached. Please wait 60 seconds and try again. If this persists, you may need to upgrade your OpenAI API plan at https://platform.openai.com/settings'
          );
        }

        // Exponential backoff: wait 5s, 10s, 20s
        const waitTime = 5000 * Math.pow(2, attempt - 1);
        logger.debug('Waiting before retry', { waitTime, attempt, maxRetries });
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        continue;
      }

      // If not a rate limit error, throw immediately
      throw error;
    }
  }

  throw new Error('Failed to get response from API after retries');
}

/**
 * Save analysis to database
 */
export async function saveAnalysis(
  userInternalId: string,
  imageFile: File,
  labelName: string | null,
  analysisData: AnalysisResult,
  base64Data: string | undefined,
  pdfTextContent: string | undefined,
  mediaType: 'image/jpeg' | 'image/png',
  sessionId: string | null
): Promise<Analysis> {
  // Determine compliance status from the new analysis structure
  const complianceStatus = analysisData.overall_assessment?.primary_compliance_status || 'unknown';
  const dbComplianceStatus =
    complianceStatus === 'compliant' || complianceStatus === 'likely_compliant'
      ? 'compliant'
      : complianceStatus === 'potentially_non_compliant'
        ? 'minor_issues'
        : 'major_violations';

  const { data: analysis, error: insertError } = await supabaseAdmin
    .from('analyses')
    .insert({
      user_id: userInternalId,
      image_url: base64Data
        ? `data:${mediaType};base64,${base64Data.substring(0, 100)}...`
        : `text/plain;preview,${pdfTextContent?.substring(0, 100) || ''}...`,
      image_name: imageFile.name,
      label_name: labelName || null,
      analysis_result: analysisData,
      compliance_status: dbComplianceStatus,
      issues_found:
        analysisData.recommendations?.filter(
          (r: Recommendation) => r.priority === 'critical' || r.priority === 'high'
        )?.length || 0,
      session_id: sessionId || null,
      product_category: analysisData.product_category || null,
      category_rationale: analysisData.category_rationale || null,
      category_confidence: analysisData.category_confidence || null,
      is_category_ambiguous: analysisData.category_ambiguity?.is_ambiguous || false,
      alternative_categories: analysisData.category_ambiguity?.alternative_categories || null,
      // user_selected_category, category_selection_reason, compared_categories remain NULL initially
      // These are set when user makes a selection in the Category Selector UI
    })
    .select()
    .single();

  if (insertError) {
    logger.error('Failed to save analysis', { error: insertError, userInternalId });
    throw new Error('Failed to save analysis');
  }

  return analysis;
}

/**
 * Update usage counter
 */
export async function updateUsage(
  userInternalId: string,
  currentMonth: string,
  currentUsed: number
): Promise<void> {
  // Always increment usage count (tracks total analyses consumed)
  const { error: usageUpdateError } = await supabaseAdmin
    .from('usage_tracking')
    .update({ analyses_used: currentUsed + 1 })
    .eq('user_id', userInternalId)
    .eq('month', currentMonth);

  if (usageUpdateError) {
    logger.error('Failed to update usage tracking', {
      error: usageUpdateError,
      userInternalId,
    });
    return;
  }

  // Get current usage to check if we need to consume bundle credits
  const { data: usage } = await supabaseAdmin
    .from('usage_tracking')
    .select('analyses_used, analyses_limit')
    .eq('user_id', userInternalId)
    .eq('month', currentMonth)
    .maybeSingle();

  // If subscription limit is exceeded, consume from bundle credits
  if (usage && usage.analyses_limit !== -1 && usage.analyses_used > usage.analyses_limit) {
    // Get bundles with remaining credits (oldest first)
    const { data: bundles } = await supabaseAdmin
      .from('bundle_purchases')
      .select('id, analyses_remaining')
      .eq('user_id', userInternalId)
      .gt('analyses_remaining', 0)
      .order('purchased_at', { ascending: true });

    if (bundles && bundles.length > 0) {
      // Consume from the oldest bundle first
      const bundleToConsume = bundles[0];
      const newRemaining = bundleToConsume.analyses_remaining - 1;

      const { error: bundleUpdateError } = await supabaseAdmin
        .from('bundle_purchases')
        .update({ analyses_remaining: newRemaining })
        .eq('id', bundleToConsume.id);

      if (bundleUpdateError) {
        logger.error('Failed to update bundle purchase', {
          error: bundleUpdateError,
          bundleId: bundleToConsume.id,
        });
      } else {
        logger.debug('Consumed bundle credit', {
          bundleId: bundleToConsume.id,
          remaining: newRemaining,
        });
      }
    }
  }
}

/**
 * Save iteration record for analysis session
 */
export async function saveIteration(
  sessionId: string,
  imageFile: File,
  analysisData: AnalysisResult,
  analysisId: string,
  mediaType: 'image/jpeg' | 'image/png'
): Promise<void> {
  const { error: iterationError } = await addIteration(
    sessionId,
    'image_analysis',
    {
      image_name: imageFile.name,
      file_size: imageFile.size,
      media_type: mediaType,
    },
    analysisData,
    analysisId,
    undefined,
    true // use admin
  );

  if (iterationError) {
    logger.error('Failed to create iteration', {
      error: iterationError,
      sessionId,
      analysisId,
    });
    // Don't fail the analysis if iteration creation fails
  } else {
    logger.debug('Iteration created successfully', { sessionId, analysisId });
  }
}

/**
 * Send email notification to user
 */
export async function sendNotificationEmail(
  userEmail: string,
  analysisData: AnalysisResult,
  analysis: Analysis
): Promise<void> {
  try {
    const emailHtml = generateAnalysisResultEmail({
      productName: analysisData.product_name || 'Unknown Product',
      summary: analysisData.overall_assessment?.summary || 'Analysis completed successfully.',
      healthScore: 0, // No longer using health score
      complianceStatus: analysis.compliance_status,
      recommendations:
        analysisData.recommendations?.map(
          (r: Recommendation) =>
            `[${r.priority.toUpperCase()}] ${r.recommendation} (${r.regulation})`
        ) || [],
      analyzedAt: analysis.created_at,
    });

    await sendEmail({
      to: userEmail,
      subject: `Label Analysis Complete: ${analysisData.product_name || 'Your Product'}`,
      html: emailHtml,
    });
  } catch (emailError) {
    logger.error('Failed to send email notification', {
      error: emailError,
      userEmail,
      analysisId: analysis.id,
    });
    // Don't fail the analysis if email fails
  }
}
