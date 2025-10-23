import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getActiveRegulatoryDocuments, buildRegulatoryContext } from '@/lib/regulatory-documents';
import { sendEmail } from '@/lib/resend';
import { generateAnalysisResultEmail } from '@/lib/email-templates';
import { preprocessImage } from '@/lib/image-processing';
import { createSession, addIteration } from '@/lib/session-helpers';
import { checkGRASCompliance } from '@/lib/gras-helpers';
import { processPdfForAnalysis } from '@/lib/pdf-helpers';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let user = await supabase
      .from('users')
      .select('id, email')
      .eq('clerk_user_id', userId)
      .maybeSingle()
      .then(res => res.data);

    // If user doesn't exist in Supabase, create them (fallback for webhook issues)
    if (!user) {
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        const userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress || '';

        if (!userEmail) {
          console.error('No email found for Clerk user:', userId);
          return NextResponse.json({ error: 'User email not found' }, { status: 400 });
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
          console.error('Error creating user in Supabase:', createError);
          return NextResponse.json({
            error: `Failed to create user record: ${createError.message}`
          }, { status: 500 });
        }

        if (!newUser) {
          console.error('User creation returned no data');
          return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 });
        }

        user = newUser;
        console.log('Successfully created user:', newUser.id);
      } catch (err: any) {
        console.error('Exception creating user:', err);
        return NextResponse.json({
          error: `Failed to create user: ${err.message}`
        }, { status: 500 });
      }
    }

    const currentMonth = new Date().toISOString().slice(0, 7);

    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .maybeSingle();

    if (!usage) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan_tier, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      const limits: Record<string, number> = {
        basic: 10,
        pro: 100,
        enterprise: -1,
      };

      const planTier = subscription?.plan_tier || 'basic';
      const limit = limits[planTier] || 5;

      const { error: usageError } = await supabase.from('usage_tracking').insert({
        user_id: user.id,
        month: currentMonth,
        analyses_used: 0,
        analyses_limit: limit,
      });

      if (usageError) {
        console.error('Error creating usage tracking:', usageError);
      }
    }

    const { data: currentUsage } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .maybeSingle();

    if (!currentUsage) {
      return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 });
    }

    // Check if user is an admin - admins have unlimited access
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const isAdmin = clerkUser?.publicMetadata?.role === 'admin';

    // Only enforce limits for non-admin users
    if (
      !isAdmin &&
      currentUsage.analyses_limit !== -1 &&
      currentUsage.analyses_used >= currentUsage.analyses_limit
    ) {
      return NextResponse.json(
        { error: 'Monthly analysis limit reached. Please upgrade your plan.' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const existingSessionId = formData.get('sessionId') as string | null;

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Handle session creation or use existing session
    let sessionId = existingSessionId;
    let session = null;

    if (!sessionId) {
      // Create a new session for this analysis
      const productHint = imageFile.name.replace(/\.[^/.]+$/, ''); // Remove extension
      const { data: newSession, error: sessionError } = await createSession(
        user.id,
        `Analysis: ${productHint}`,
        true // use admin
      );

      if (sessionError || !newSession) {
        console.error('Error creating session:', sessionError);
        // Don't fail the analysis if session creation fails
        // The analysis will work without a session (backward compatible)
      } else {
        session = newSession;
        sessionId = newSession.id;
        console.log('Created new session:', sessionId);
      }
    }

    console.log('📥 Processing image file...');
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
        console.log(`✅ Using extracted text (${pdfTextContent.length} characters)`);
      } else {
        // CloudConvert converted PDF to image
        const imageBuffer = pdfResult.content as Buffer;
        base64Data = imageBuffer.toString('base64');
        mediaType = 'image/jpeg';
        contentType = 'document';
        console.log('✅ Using CloudConvert image conversion');
      }
    } else {
      console.log('🖼️ Preprocessing image...');
      // For images, preprocess to improve readability
      const processedBuffer = await preprocessImage(buffer);
      base64Data = processedBuffer.toString('base64');
      mediaType = 'image/jpeg';
      contentType = 'image';
      console.log('✅ Image preprocessed');
    }

    console.log('📚 Fetching regulatory documents...');
    const regulatoryDocuments = await getActiveRegulatoryDocuments();
    console.log(`✅ Fetched ${regulatoryDocuments.length} regulatory documents`);
    const regulatoryContext = buildRegulatoryContext(regulatoryDocuments);

    // Separate cached context from dynamic prompt
    const analysisInstructions = `You are a labeling regulatory compliance expert. Analyze this label ${isPdf ? 'PDF document' : 'image'} and provide a comprehensive evaluation of its compliance with FDA and USDA labeling requirements based on the regulatory documents provided above.

**STEP 1: PRODUCT CATEGORY CLASSIFICATION**

Before performing the detailed compliance analysis, you MUST first determine which regulatory category this product falls into. This is CRITICAL because different product categories have entirely different regulatory requirements.

Classify the product into ONE of these four categories based on the following criteria:

1. **DIETARY_SUPPLEMENT** - Select this if ANY of these are true:
   - Label explicitly states "dietary supplement" or "supplement facts"
   - Contains vitamins, minerals, herbs, botanicals, amino acids, or other dietary ingredients intended to supplement the diet
   - Has a "Supplement Facts" panel (NOT "Nutrition Facts")
   - Makes structure/function claims (e.g., "supports immune health", "promotes joint function")
   - Contains ingredients like: multivitamins, probiotics, protein powder, herbal extracts, omega-3, CoQ10, etc.
   - **EXCEPTION:** Fortified foods with added vitamins are NOT supplements unless labeled as such

2. **ALCOHOLIC_BEVERAGE** - Select this if ANY of these are true:
   - Contains alcohol ≥0.5% ABV (alcohol by volume)
   - Label shows "% ALC BY VOL" or "PROOF"
   - Has TTB (Alcohol and Tobacco Tax and Trade Bureau) approval number or statement
   - Is beer, wine, spirits, hard seltzer, malt beverage, or alcoholic kombucha
   - Contains government warning about alcohol consumption and pregnancy
   - **EDGE CASE:** Non-alcoholic beer (<0.5% ABV) = NON_ALCOHOLIC_BEVERAGE
   - **EDGE CASE:** Kombucha 0.5-2% ABV = ALCOHOLIC_BEVERAGE (TTB regulated)

3. **NON_ALCOHOLIC_BEVERAGE** - Select this if ALL of these are true:
   - Ready-to-drink liquid marketed as a BEVERAGE for refreshment/hydration
   - Statement of identity includes: "beverage," "drink," "juice," "soda," "tea," "energy drink," "sports drink," "soft drink"
   - Contains <0.5% alcohol OR no alcohol
   - NOT a dietary supplement (no "supplement facts")
   - **PRIMARY PURPOSE:** Refreshment, hydration, or enjoyment (NOT meal replacement)
   - **IMPORTANT:** Serving size typically in fl oz

   **Examples:** Coca-Cola, orange juice, Red Bull, Gatorade, bottled tea, bottled coffee drinks
   **NOT beverages:** Milk, drinkable yogurt, soup, broth, meal replacement shakes (these are FOOD)

4. **CONVENTIONAL_FOOD** - Select this if NONE of the above apply:
   - Standard packaged foods (snacks, cereals, baked goods, frozen meals, etc.)
   - Condiments, sauces, seasonings
   - Fresh or processed meats, poultry, seafood
   - **ALL DAIRY PRODUCTS:** Milk, cheese, yogurt, butter, cream, ice cream, drinkable yogurt, chocolate milk
   - Soups, broths, bouillon (even though liquid)
   - Infant formula and baby food
   - Coffee beans, ground coffee, tea leaves (not ready-to-drink)
   - Any food product that doesn't fit the other three categories

   **KEY DISTINCTION - Food vs Beverage:**
   - Dairy liquids (milk, drinkable yogurt) = FOOD (even though drinkable)
   - Soups/broths = FOOD (nutritional purpose, not refreshment)
   - Meal replacement liquids = FOOD or SUPPLEMENT (depends on Supplement Facts panel)
   - The differentiator is MARKETING/PURPOSE: refreshment vs nutrition/meal

**CRITICAL CLASSIFICATION EDGE CASES:**

- **Protein bars/shakes:** If has Supplement Facts = DIETARY_SUPPLEMENT, if Nutrition Facts = CONVENTIONAL_FOOD
- **Fortified beverages:** If ready-to-drink + marketed as beverage = NON_ALCOHOLIC_BEVERAGE (even with added vitamins)
- **Drinkable yogurt/kefir:** Always CONVENTIONAL_FOOD (dairy product, not beverage)
- **Kombucha:** Check ABV - if ≥0.5% = ALCOHOLIC_BEVERAGE, if <0.5% = NON_ALCOHOLIC_BEVERAGE
- **Energy shots:** If Supplement Facts = DIETARY_SUPPLEMENT, if Nutrition Facts = NON_ALCOHOLIC_BEVERAGE
- **Herbal tea (ready-to-drink):** NON_ALCOHOLIC_BEVERAGE (unless supplement facts)
- **Herbal tea (dry leaves):** CONVENTIONAL_FOOD (unless supplement facts)

**STEP 2: CLASSIFICATION CONFIDENCE & AMBIGUITY DETECTION**

After determining the category, evaluate your confidence and check for ambiguity:

**A. CONFIDENCE LEVEL:**
- **HIGH (90-100%):** Multiple clear indicators, no conflicting evidence
  - Example: Label states "Dietary Supplement" + has Supplement Facts + makes structure/function claim
  - Example: Shows 5% ABV + government warning + TTB number
- **MEDIUM (60-89%):** Some indicators present but missing key elements OR minor conflicts
  - Example: Contains vitamins/protein but has Nutrition Facts (could be food OR supplement)
  - Example: Ready-to-drink liquid but unclear if beverage or meal replacement
- **LOW (<60%):** Conflicting indicators or insufficient information
  - Example: Has Supplement Facts panel but no "dietary supplement" statement
  - Example: Makes health claims but labeled as conventional food

**B. AMBIGUITY CHECK - Could this product fit ANOTHER category?**

Check if the product could reasonably be classified differently:

**Common Ambiguous Products:**
1. **Protein bars:** Could be FOOD or SUPPLEMENT depending on panel type and claims
2. **Protein shakes:** Could be FOOD (meal replacement) or SUPPLEMENT or BEVERAGE depending on positioning
3. **Fortified beverages:** Could be BEVERAGE or SUPPLEMENT depending on claim types
4. **Functional beverages:** Energy drinks, wellness shots - could be BEVERAGE or SUPPLEMENT
5. **Herbal products:** Could be FOOD (tea) or SUPPLEMENT depending on format and claims

**If ambiguous, you MUST:**
1. Set "is_ambiguous: true"
2. List "alternative_categories" with rationale for each
3. Identify any "label_conflicts" (e.g., food claims but supplement panel)
4. Provide guidance for EACH viable category option

**STEP 3: CATEGORY OPTIONS & GUIDANCE** (Required if ambiguous OR confidence < HIGH)

For EACH viable category (detected + alternatives), provide:

1. **Current Label Compliance:** Is the current label configuration compliant for this category?
2. **Required Changes:** What MUST change to be compliant in this category?
3. **Allowed Claims:** What can the manufacturer say/claim in this category?
4. **Prohibited Claims:** What is NOT allowed in this category?
5. **Pros & Cons:** Trade-offs of choosing this category
6. **Recommendation:** Which category makes most sense given current label and likely manufacturer intent?

${isPdf ? `IMPORTANT INSTRUCTIONS FOR READING THE PDF:
This is a PDF of a label design mockup. READ THE TEXT from this PDF carefully and analyze it for compliance. The PDF may have complex design elements:
- Text in various orientations (rotated, vertical, sideways, upside-down)
- Small fonts (ingredient lists, fine print, legal text)
- Text on complex backgrounds or with overlays
- Multiple colors and fonts with varying contrast
- Poor contrast or faded text
- Text wrapping around design elements
- Decorative fonts that may be harder to read

Extract all visible text from the PDF and analyze for regulatory compliance. Take your time to examine every section of the label design thoroughly, including any rotated or vertically-oriented text.` : `IMPORTANT INSTRUCTIONS FOR READING THE IMAGE:
- The text on this label may be very small, difficult to read, or have poor contrast
- Text may be oriented vertically, sideways, or even upside-down
- If you encounter rotated text, mentally rotate the image to read it correctly
- Look very carefully at all text, including fine print and small ingredient lists
- If text is blurry or unclear, use context clues from surrounding text to decipher it
- Pay special attention to ingredient lists which are often in very small font
- Some labels may have text on dark backgrounds or vice versa - adjust your reading accordingly
- Take your time to examine every section of the label thoroughly
- If certain information is genuinely illegible, note that in your analysis`}

ANALYSIS STRUCTURE REQUIREMENTS:

Your analysis must follow this exact structure and evaluate each regulatory category:

1. **General Labeling Requirements**: Evaluate the label against basic FDA/USDA requirements
   - Statement of Identity (Name of Food): Is the product name clear, prominent, and on the principal display panel?
   - Net Quantity of Contents: Is it properly declared in both US Customary and metric units? Is it in the bottom 30% of the display panel?
   - Name and Address of Manufacturer/Distributor: Is the manufacturer or distributor clearly listed with complete address? Are qualifying phrases like "distributed by" used correctly?

2. **Ingredient Labeling**: Review ingredient declaration compliance
   - List and Order: Are ingredients listed in descending order of predominance by weight?
   - Flavor Declaration: Are artificial flavors, natural flavors, and spices properly declared?
   - Specific Ingredient Requirements: Are colors specifically named? Are preservatives listed with their function?

3. **Food Allergen Labeling Requirements (FALCPA/FASTER Act)**: Critical compliance check
   - Major Food Allergens (MFAs): The nine major allergens are: Milk, Egg, Fish, Crustacean shellfish, Tree nuts, Wheat, Peanuts, Soybeans, and Sesame
   - Allergen Declaration Requirement: Is there a "Contains" statement OR are allergens declared parenthetically in the ingredient list?
   - Evaluation of Ingredients: Analyze each ingredient (especially flavors, additives) for potential MFA content
   - **CRITICAL**: Use conditional language - "IF ingredient X contains [allergen], THEN declaration is required"
   - Determine if the label is compliant or potentially non-compliant based on missing allergen declarations

4. **Nutrition Labeling and Claims**: Assess nutrition facts panel requirements and exemptions
   - Mandatory Nutrition Labeling: Is a Nutrition Facts panel required for this product type?
   - **Exemptions**: Does this product qualify for exemption (e.g., coffee, spices, foods of no nutritional significance)?
   - Evaluation of Claims: Are there any nutrient content claims (NCCs) or health claims that would trigger mandatory nutrition labeling?
   - **Important**: Consider exemptions for foods with insignificant amounts of all required nutrients
   - If nutrition panel is missing but product qualifies for exemption, mark as COMPLIANT with explanation

5. **Additional Regulatory Considerations**: Evaluate any other applicable requirements
   - Fortification Policy: Are essential nutrients added? Are there fortification claims?
   - Special Labeling: Date labeling, caffeine disclosure, organic claims, etc.
   - Product-Specific Requirements: Based on product type (beverage, coffee, meat, etc.)

6. **Summary Compliance Table**: Provide a structured summary

Return your response as a JSON object with the following structure:
{
  "product_name": "Name of the product from the label",
  "product_type": "Type of product (e.g., 'Coffee', 'Snack Food', 'Beverage', 'Packaged Meal')",
  "product_category": "MUST be one of: DIETARY_SUPPLEMENT | ALCOHOLIC_BEVERAGE | NON_ALCOHOLIC_BEVERAGE | CONVENTIONAL_FOOD (determined from STEP 1)",
  "category_rationale": "Brief explanation of why this category was selected (2-3 sentences citing specific label elements)",
  "category_confidence": "high|medium|low (from STEP 2)",
  "category_ambiguity": {
    "is_ambiguous": true|false,
    "alternative_categories": ["Array of other viable categories if ambiguous"],
    "ambiguity_reason": "Explanation of why multiple categories could apply",
    "label_conflicts": [
      {
        "severity": "critical|high|medium|low",
        "conflict": "Description of the conflict",
        "current_category": "Category as detected",
        "violation": "What regulation is violated"
      }
    ]
  },
  "category_options": {
    "DETECTED_CATEGORY_NAME": {
      "current_label_compliant": true|false,
      "required_changes": ["List of changes needed for compliance"],
      "allowed_claims": ["What claims/statements are permitted"],
      "prohibited_claims": ["What claims/statements are NOT allowed"],
      "regulatory_requirements": ["Key regulatory requirements for this category"],
      "pros": ["Advantages of choosing this category"],
      "cons": ["Disadvantages/restrictions of this category"]
    },
    "ALTERNATIVE_CATEGORY_NAME": {
      "...": "Same structure for each alternative category"
    }
  },
  "recommendation": {
    "suggested_category": "CATEGORY_NAME",
    "confidence": "high|medium|low",
    "reasoning": "Detailed explanation of recommendation",
    "key_decision_factors": ["Factor 1", "Factor 2", "Factor 3"]
  },
  "general_labeling": {
    "statement_of_identity": {
      "status": "compliant|non_compliant|not_applicable",
      "details": "Detailed explanation of findings",
      "regulation_citation": "Specific regulation (e.g., '21 CFR 101.3')"
    },
    "net_quantity": {
      "status": "compliant|non_compliant|not_applicable",
      "details": "Detailed explanation",
      "regulation_citation": "Specific regulation"
    },
    "manufacturer_address": {
      "status": "compliant|non_compliant|not_applicable",
      "details": "Detailed explanation",
      "regulation_citation": "Specific regulation"
    }
  },
  "ingredient_labeling": {
    "status": "compliant|non_compliant|not_applicable",
    "ingredients_list": ["ingredient1", "ingredient2", ...],
    "details": "Analysis of ingredient declaration compliance including order, naming, sub-ingredients",
    "regulation_citation": "21 CFR 101.4"
  },
  "allergen_labeling": {
    "status": "compliant|potentially_non_compliant|not_applicable",
    "details": "Detailed analysis with conditional statements about potential allergen-containing ingredients",
    "potential_allergens": ["List of ingredients that may contain MFAs"],
    "has_contains_statement": true|false,
    "risk_level": "low|medium|high",
    "regulation_citation": "FALCPA Section 403(w), FASTER Act"
  },
  "nutrition_labeling": {
    "status": "compliant|non_compliant|not_applicable",
    "panel_present": true|false,
    "exemption_applicable": true|false,
    "exemption_reason": "Explanation if exemption applies (e.g., 'Foods of no nutritional significance')",
    "details": "Full explanation of nutrition labeling compliance or exemption",
    "regulation_citation": "21 CFR 101.9"
  },
  "additional_requirements": {
    "fortification": {
      "status": "compliant|non_compliant|not_applicable",
      "details": "Analysis of fortification compliance"
    },
    "other_requirements": [
      {
        "requirement": "Name of requirement (e.g., 'Caffeine Disclosure')",
        "status": "compliant|non_compliant|not_applicable",
        "details": "Explanation"
      }
    ]
  },
  "overall_assessment": {
    "primary_compliance_status": "compliant|likely_compliant|potentially_non_compliant|non_compliant",
    "confidence_level": "high|medium|low",
    "summary": "2-3 sentence overall summary of compliance status",
    "key_findings": ["Finding 1", "Finding 2", "Finding 3"]
  },
  "compliance_table": [
    {
      "element": "Labeling Element Name",
      "status": "Compliant|Potentially Non-compliant|Non-compliant|Not Applicable",
      "rationale": "Brief rationale or condition for compliance"
    }
  ],
  "recommendations": [
    {
      "priority": "critical|high|medium|low",
      "recommendation": "Specific actionable recommendation",
      "regulation": "Relevant regulation citation"
    }
  ]
}

**CRITICAL REQUIREMENTS**:
1. Use conditional language for potential violations (e.g., "IF artificial cream flavor contains milk protein, THEN...")
2. Always consider exemptions before marking nutrition labeling as non-compliant
3. Provide specific regulation citations (CFR sections, act names) for every finding
4. Distinguish between "non-compliant" (definite violation) and "potentially non-compliant" (conditional on information not visible)
5. For coffee, spices, and similar products: they are typically EXEMPT from Nutrition Facts panels
6. Base compliance status on visible information; use "potentially non-compliant" when ingredient composition is unknown
7. In the compliance_table, provide a clear summary similar to the NotebookLM format`;

    // Helper function to call OpenAI API with retry logic for rate limits
    const callOpenAIWithRetry = async (maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`🤖 Calling OpenAI GPT-5 mini (attempt ${attempt}/${maxRetries})...`);
        try {
          // Construct the message content based on content type
          let userMessage: any;

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
            model: 'gpt-5-mini',
            max_tokens: 8192,
            messages: [userMessage],
            response_format: { type: 'json_object' },
          });
        } catch (error: any) {
          // Check if it's a rate limit error
          if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
            console.log(`Rate limit hit, attempt ${attempt}/${maxRetries}`);

            if (attempt === maxRetries) {
              // On final attempt, throw a user-friendly error
              throw new Error('API rate limit reached. Please wait 60 seconds and try again. If this persists, you may need to upgrade your OpenAI API plan at https://platform.openai.com/settings');
            }

            // Exponential backoff: wait 5s, 10s, 20s
            const waitTime = 5000 * Math.pow(2, attempt - 1);
            console.log(`Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }

          // If not a rate limit error, throw immediately
          throw error;
        }
      }

      throw new Error('Failed to get response from API after retries');
    };

    // Call OpenAI API
    const completion = await callOpenAIWithRetry();

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No text response from AI');
    }

    console.log('=== AI Response (first 500 chars) ===');
    console.log(responseText.substring(0, 500));
    console.log('=== End preview ===');

    // Parse JSON response
    // OpenAI's JSON mode should return clean JSON, but we'll add error handling
    let analysisData: any;
    try {
      analysisData = JSON.parse(responseText);
      console.log('✅ Successfully parsed analysis data');
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw response (first 1000 chars):', responseText.substring(0, 1000));
      throw new Error('Failed to parse AI response');
    }

    // GRAS Compliance Checking
    // Check if ingredients are present and validate against GRAS database
    if (analysisData.ingredient_labeling?.ingredients_list &&
        Array.isArray(analysisData.ingredient_labeling.ingredients_list) &&
        analysisData.ingredient_labeling.ingredients_list.length > 0) {

      console.log('Checking GRAS compliance for ingredients:', analysisData.ingredient_labeling.ingredients_list);

      try {
        const grasCompliance = await checkGRASCompliance(analysisData.ingredient_labeling.ingredients_list);

        console.log('GRAS compliance check complete:', {
          total: grasCompliance.totalIngredients,
          compliant: grasCompliance.grasCompliant,
          nonGRAS: grasCompliance.nonGRASIngredients,
        });

        // Add GRAS compliance info to analysis data
        analysisData.gras_compliance = {
          status: grasCompliance.overallCompliant ? 'compliant' : 'non_compliant',
          total_ingredients: grasCompliance.totalIngredients,
          gras_compliant_count: grasCompliance.grasCompliant,
          non_gras_ingredients: grasCompliance.nonGRASIngredients,
          gras_ingredients: grasCompliance.grasIngredients,
          detailed_results: grasCompliance.detailedResults,
        };

        // If non-GRAS ingredients found, add critical recommendations
        if (!grasCompliance.overallCompliant && grasCompliance.nonGRASIngredients.length > 0) {
          console.log('CRITICAL: Non-GRAS ingredients detected:', grasCompliance.nonGRASIngredients);

          // Initialize recommendations array if it doesn't exist
          if (!analysisData.recommendations) {
            analysisData.recommendations = [];
          }

          // Add critical recommendations for each non-GRAS ingredient
          grasCompliance.nonGRASIngredients.forEach((ingredient) => {
            analysisData.recommendations.unshift({
              priority: 'critical',
              recommendation: `CRITICAL: Ingredient "${ingredient}" is NOT found in the FDA GRAS (Generally Recognized as Safe) database. This ingredient may require FDA pre-market approval (food additive petition), could be a prohibited substance, or may need special GRAS determination. Remove this ingredient or obtain proper FDA approval before marketing this product.`,
              regulation: '21 CFR 170.3 (Definitions), 21 CFR 170.30 (GRAS determination)',
            });
          });

          // Update overall compliance status to reflect GRAS violations
          if (analysisData.overall_assessment) {
            analysisData.overall_assessment.primary_compliance_status = 'non_compliant';

            // Add GRAS violation to key findings
            if (!analysisData.overall_assessment.key_findings) {
              analysisData.overall_assessment.key_findings = [];
            }
            analysisData.overall_assessment.key_findings.unshift(
              `CRITICAL: ${grasCompliance.nonGRASIngredients.length} ingredient(s) not in FDA GRAS database: ${grasCompliance.nonGRASIngredients.join(', ')}`
            );
          }

          // Add to compliance table
          if (!analysisData.compliance_table) {
            analysisData.compliance_table = [];
          }
          analysisData.compliance_table.unshift({
            element: 'GRAS Ingredient Compliance',
            status: 'Non-compliant',
            rationale: `${grasCompliance.nonGRASIngredients.length} ingredient(s) not in FDA GRAS database: ${grasCompliance.nonGRASIngredients.join(', ')}. Requires FDA approval.`,
          });
        } else {
          // All ingredients are GRAS-compliant
          console.log('All ingredients are GRAS-compliant');

          if (!analysisData.compliance_table) {
            analysisData.compliance_table = [];
          }
          analysisData.compliance_table.push({
            element: 'GRAS Ingredient Compliance',
            status: 'Compliant',
            rationale: `All ${grasCompliance.totalIngredients} ingredients found in FDA GRAS database`,
          });
        }
      } catch (grasError) {
        console.error('Error checking GRAS compliance:', grasError);
        // Don't fail the analysis if GRAS check fails, just log the error
        // The analysis will continue without GRAS compliance info
      }
    } else {
      console.log('No ingredients found in analysis - skipping GRAS check');
    }

    // Determine compliance status from the new analysis structure
    const complianceStatus = analysisData.overall_assessment?.primary_compliance_status || 'unknown';
    const dbComplianceStatus =
      complianceStatus === 'compliant' || complianceStatus === 'likely_compliant' ? 'compliant' :
      complianceStatus === 'potentially_non_compliant' ? 'minor_issues' :
      'major_violations';

    const { data: analysis, error: insertError} = await supabase
      .from('analyses')
      .insert({
        user_id: user.id,
        image_url: base64Data
          ? `data:${mediaType};base64,${base64Data.substring(0, 100)}...`
          : `text/plain;preview,${pdfTextContent?.substring(0, 100) || ''}...`,
        image_name: imageFile.name,
        analysis_result: analysisData,
        compliance_status: dbComplianceStatus,
        issues_found: analysisData.recommendations?.filter((r: any) => r.priority === 'critical' || r.priority === 'high')?.length || 0,
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
      console.error('Error saving analysis:', insertError);
      return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 });
    }

    const { error: usageUpdateError } = await supabase
      .from('usage_tracking')
      .update({ analyses_used: currentUsage.analyses_used + 1 })
      .eq('user_id', user.id)
      .eq('month', currentMonth);

    if (usageUpdateError) {
      console.error('Error updating usage:', usageUpdateError);
    }

    // Create iteration record if this is part of a session
    if (sessionId) {
      const { error: iterationError } = await addIteration(
        sessionId,
        'image_analysis',
        {
          image_name: imageFile.name,
          file_size: imageFile.size,
          media_type: mediaType,
        },
        analysisData,
        analysis.id,
        undefined,
        true // use admin
      );

      if (iterationError) {
        console.error('Error creating iteration:', iterationError);
        // Don't fail the analysis if iteration creation fails
      } else {
        console.log('Created iteration for session:', sessionId);
      }
    }

    try {
      const emailHtml = generateAnalysisResultEmail({
        productName: analysisData.product_name || 'Unknown Product',
        summary: analysisData.overall_assessment?.summary || 'Analysis completed successfully.',
        healthScore: 0, // No longer using health score
        complianceStatus: analysis.compliance_status,
        recommendations: analysisData.recommendations?.map((r: any) =>
          `[${r.priority.toUpperCase()}] ${r.recommendation} (${r.regulation})`
        ) || [],
        analyzedAt: analysis.created_at,
      });

      await sendEmail({
        to: user.email,
        subject: `Label Analysis Complete: ${analysisData.product_name || 'Your Product'}`,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
    }

    // Determine if category selector should be shown
    const showCategorySelector =
      analysisData.category_confidence !== 'high' ||
      analysisData.category_ambiguity?.is_ambiguous ||
      (analysisData.category_ambiguity?.label_conflicts &&
       analysisData.category_ambiguity.label_conflicts.length > 0);

    return NextResponse.json({
      id: analysis.id,
      image_name: analysis.image_name,
      compliance_status: analysis.compliance_status,
      issues_found: analysis.issues_found,
      created_at: analysis.created_at,
      ...analysisData,
      show_category_selector: showCategorySelector,
      usage: {
        used: currentUsage.analyses_used + 1,
        limit: currentUsage.analyses_limit,
      },
      session: sessionId ? {
        id: sessionId,
        title: session?.title || null,
      } : null,
    });
  } catch (error: any) {
    console.error('Error analyzing image:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze image' },
      { status: 500 }
    );
  }
}
