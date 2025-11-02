import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { analysisId, selectedCategory, selectionReason } = body;

    if (!analysisId || !selectedCategory) {
      return NextResponse.json(
        { error: 'Missing required fields: analysisId and selectedCategory' },
        { status: 400 }
      );
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
      console.error('Error updating category selection:', error);
      return NextResponse.json({ error: 'Failed to save category selection' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      analysis: data,
    });
  } catch (error: any) {
    console.error('Error in select-category endpoint:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
