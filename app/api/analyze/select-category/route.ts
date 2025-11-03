import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger, createRequestLogger } from '@/lib/logger';
import {
  handleApiError,
  ValidationError,
  AuthenticationError,
  handleSupabaseError,
} from '@/lib/error-handler';

export async function POST(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/analyze/select-category' });

  try {
    const { userId } = await auth();

    if (!userId) {
      requestLogger.warn('Unauthorized category selection request');
      throw new AuthenticationError();
    }

    requestLogger.info('Category selection request started', { userId });

    const body = await request.json();
    const { analysisId, selectedCategory, selectionReason } = body;

    if (!selectedCategory) {
      throw new ValidationError('Category is required', { field: 'category' });
    }

    // Validate category value
    const validCategories = [
      'CONVENTIONAL_FOOD',
      'DIETARY_SUPPLEMENT',
      'ALCOHOLIC_BEVERAGE',
      'NON_ALCOHOLIC_BEVERAGE',
    ];

    if (!validCategories.includes(selectedCategory)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    // Update the analysis with user's category selection
    const { data, error } = await supabaseAdmin
      .from('analyses')
      .update({
        user_selected_category: selectedCategory,
        category_selection_reason: selectionReason || null,
      })
      .eq('id', analysisId)
      .select()
      .single();

    if (error) {
      throw handleSupabaseError(error, 'update category selection');
    }

    requestLogger.info('Category selection saved', {
      userId,
      analysisId,
      selectedCategory,
    });

    return NextResponse.json({
      success: true,
      analysis: data,
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
