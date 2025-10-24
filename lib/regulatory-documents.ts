import { supabase } from './supabase';

import { RegulatoryDocument, ProductCategory } from './supabase';
import { getCachedRegulatoryDocuments, invalidateDocumentCache } from './regulatory-cache';

export interface DocumentCategory {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

/**
 * Keyword mappings for automatic document categorization (RAG lite)
 * Documents are matched to product categories based on keywords in title/content
 */
const CATEGORY_KEYWORDS: Record<ProductCategory, string[]> = {
  CONVENTIONAL_FOOD: [
    'nutrition facts',
    'conventional food',
    'packaged food',
    'food labeling',
    '101.9',
    'fortification',
    'fortified',
    'enriched',
    'GRAS',
    'generally recognized as safe',
    'food additive',
    'ingredient list',
    'allergen labeling',
    'FALCPA',
    'FASTER Act',
    'net quantity',
    'statement of identity',
  ],
  DIETARY_SUPPLEMENT: [
    'dietary supplement',
    'supplement facts',
    'DSHEA',
    '101.36',
    'dietary ingredient',
    'NDI',
    'new dietary ingredient',
    'old dietary ingredient',
    'structure function claim',
    'qualified health claim',
    'supplement labeling',
    'vitamin',
    'mineral supplement',
    'herbal supplement',
    'botanical',
    'amino acid',
    'probiotic',
  ],
  ALCOHOLIC_BEVERAGE: [
    'TTB',
    'alcohol',
    'alcoholic beverage',
    'beer',
    'wine',
    'spirits',
    'liquor',
    'COLA',
    'certificate of label approval',
    'ABV',
    'alcohol by volume',
    '27 CFR',
    'Treasury',
    'Alcohol and Tobacco Tax',
  ],
  NON_ALCOHOLIC_BEVERAGE: [
    'beverage',
    'drink',
    'soft drink',
    'juice',
    'energy drink',
    'sports drink',
    'water',
    'carbonated',
    'non-alcoholic',
    'ready-to-drink',
    'RTD',
  ],
};

/**
 * Core regulatory documents that apply to ALL product categories
 * These are always included regardless of product type
 */
const CORE_DOCUMENT_KEYWORDS = [
  'general labeling',
  'misbranding',
  'false or misleading',
  'principal display panel',
  'information panel',
  'label format',
  'font size',
  'prominence',
  'conspicuous',
];

/**
 * Detect which product categories a regulatory document applies to
 * based on keyword matching in title and content
 */
export function detectDocumentCategories(doc: RegulatoryDocument): ProductCategory[] {
  const searchText = `${doc.title} ${doc.description || ''} ${doc.content}`.toLowerCase();
  const applicableCategories: ProductCategory[] = [];

  // Check if document is a core document (applies to all categories)
  const isCore = CORE_DOCUMENT_KEYWORDS.some(keyword => searchText.includes(keyword.toLowerCase()));
  if (isCore) {
    return ['CONVENTIONAL_FOOD', 'DIETARY_SUPPLEMENT', 'ALCOHOLIC_BEVERAGE', 'NON_ALCOHOLIC_BEVERAGE'];
  }

  // Check each category's keywords
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matchCount = keywords.filter(keyword =>
      searchText.includes(keyword.toLowerCase())
    ).length;

    // If at least 2 keywords match, or 1 highly specific keyword (like CFR section)
    const hasStrongMatch = keywords.some(kw =>
      kw.match(/^\d+\.\d+$/) && searchText.includes(kw) // CFR section number
    );

    if (matchCount >= 2 || (matchCount >= 1 && hasStrongMatch)) {
      applicableCategories.push(category as ProductCategory);
    }
  }

  // If no specific matches found, it might be a general document - include for all categories
  if (applicableCategories.length === 0) {
    return ['CONVENTIONAL_FOOD', 'DIETARY_SUPPLEMENT', 'ALCOHOLIC_BEVERAGE', 'NON_ALCOHOLIC_BEVERAGE'];
  }

  return applicableCategories;
}

export async function getActiveRegulatoryDocuments(): Promise<RegulatoryDocument[]> {
  // Use cached version for 2-3 second performance improvement
  return await getCachedRegulatoryDocuments();
}

/**
 * Get regulatory documents filtered by product category using smart keyword matching
 * This is the core of "RAG lite" - only loads relevant documents for the product type
 */
export async function getRegulatoryDocumentsByCategory(
  productCategory: ProductCategory
): Promise<RegulatoryDocument[]> {
  // First, get all active documents
  const allDocs = await getActiveRegulatoryDocuments();

  // Filter documents that apply to this product category
  const filteredDocs = allDocs.filter(doc => {
    const applicableCategories = detectDocumentCategories(doc);
    return applicableCategories.includes(productCategory);
  });

  console.log(`📚 RAG Lite: Filtered ${filteredDocs.length} of ${allDocs.length} documents for ${productCategory}`);

  return filteredDocs;
}

/**
 * Get all documents with their detected categories (for admin preview)
 */
export async function getDocumentsWithCategories(): Promise<Array<{
  document: RegulatoryDocument;
  categories: ProductCategory[];
  isCore: boolean;
}>> {
  const allDocs = await getActiveRegulatoryDocuments();

  return allDocs.map(doc => {
    const categories = detectDocumentCategories(doc);
    const isCore = categories.length === 4; // Core docs apply to all 4 categories

    return {
      document: doc,
      categories,
      isCore,
    };
  });
}

/**
 * Pre-classify product category from extracted text (before AI analysis)
 * This enables RAG lite by loading only relevant documents
 *
 * Priority order:
 * 1. Panel type (Supplement Facts vs Nutrition Facts) - definitive indicator
 * 2. Strong regulatory keywords (TTB, COLA, DSHEA)
 * 3. Product type keywords (supplement, beverage, etc.)
 *
 * Returns best guess or null if ambiguous
 */
export function preClassifyProductCategory(extractedText: string): ProductCategory | null {
  const text = extractedText.toLowerCase();

  // PRIORITY 1: Panel type is the definitive indicator
  if (text.includes('supplement facts')) {
    return 'DIETARY_SUPPLEMENT';
  }

  // PRIORITY 2: Strong regulatory indicators
  if (text.includes('ttb') || text.includes('cola approval') || text.includes('27 cfr')) {
    return 'ALCOHOLIC_BEVERAGE';
  }

  if (text.includes('dshea') || text.includes('dietary ingredient') || text.includes('ndi notification')) {
    return 'DIETARY_SUPPLEMENT';
  }

  // PRIORITY 3: Product type keywords (weaker signals)
  const supplementKeywords = ['supplement', 'capsule', 'tablet', 'softgel', 'dietary', 'vitamin', 'probiotic', 'herbal'];
  const beverageKeywords = ['beverage', 'drink', 'juice', 'soda', 'energy drink', 'sports drink'];
  const alcoholKeywords = ['beer', 'wine', 'spirits', 'vodka', 'whiskey', 'rum', 'gin', 'liquor', 'ale', 'lager'];

  const supplementMatches = supplementKeywords.filter(kw => text.includes(kw)).length;
  const beverageMatches = beverageKeywords.filter(kw => text.includes(kw)).length;
  const alcoholMatches = alcoholKeywords.filter(kw => text.includes(kw)).length;

  // Check for Nutrition Facts + beverage keywords
  if (text.includes('nutrition facts')) {
    if (beverageMatches >= 2) {
      return 'NON_ALCOHOLIC_BEVERAGE';
    }
    // Otherwise assume conventional food
    return 'CONVENTIONAL_FOOD';
  }

  // Use match counts (require at least 2 matches for confidence)
  if (alcoholMatches >= 2) return 'ALCOHOLIC_BEVERAGE';
  if (supplementMatches >= 2) return 'DIETARY_SUPPLEMENT';
  if (beverageMatches >= 2) return 'NON_ALCOHOLIC_BEVERAGE';

  // Default to conventional food (most common case)
  // This is a safe fallback that will load food-related regulations
  return 'CONVENTIONAL_FOOD';
}

/**
 * Get recommended regulatory documents for analysis based on pre-classification
 * Falls back to all documents if pre-classification is uncertain
 */
export async function getRecommendedDocuments(extractedText: string): Promise<{
  documents: RegulatoryDocument[];
  preClassifiedCategory: ProductCategory | null;
  documentCount: number;
  totalCount: number;
}> {
  const preClassifiedCategory = preClassifyProductCategory(extractedText);

  if (preClassifiedCategory) {
    const filteredDocs = await getRegulatoryDocumentsByCategory(preClassifiedCategory);
    const allDocs = await getActiveRegulatoryDocuments();

    console.log(`🎯 Pre-classified as ${preClassifiedCategory}, loading ${filteredDocs.length}/${allDocs.length} documents`);

    return {
      documents: filteredDocs,
      preClassifiedCategory,
      documentCount: filteredDocs.length,
      totalCount: allDocs.length,
    };
  }

  // Fallback: load all documents if uncertain
  const allDocs = await getActiveRegulatoryDocuments();
  console.log(`⚠️  Could not pre-classify, loading all ${allDocs.length} documents`);

  return {
    documents: allDocs,
    preClassifiedCategory: null,
    documentCount: allDocs.length,
    totalCount: allDocs.length,
  };
}

export async function getDocumentCategories(): Promise<DocumentCategory[]> {
  const { data, error } = await supabase
    .from('document_categories')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  return data || [];
}

export async function createRegulatoryDocument(
  document: Omit<RegulatoryDocument, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data: RegulatoryDocument | null; error: any }> {
  const { data, error } = await supabase
    .from('regulatory_documents')
    .insert(document)
    .select()
    .single();

  // Invalidate cache when documents are created
  if (!error) {
    invalidateDocumentCache();
  }

  return { data, error };
}

export async function updateRegulatoryDocument(
  id: string,
  updates: Partial<RegulatoryDocument>
): Promise<{ data: RegulatoryDocument | null; error: any }> {
  const { data, error } = await supabase
    .from('regulatory_documents')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  // Invalidate cache when documents are updated
  if (!error) {
    invalidateDocumentCache();
  }

  return { data, error };
}

export async function deactivateDocument(id: string): Promise<{ error: any }> {
  const { error } = await supabase
    .from('regulatory_documents')
    .update({ is_active: false })
    .eq('id', id);

  // Invalidate cache when documents are deactivated
  if (!error) {
    invalidateDocumentCache();
  }

  return { error };
}

export async function searchDocuments(query: string): Promise<RegulatoryDocument[]> {
  const { data, error } = await supabase
    .from('regulatory_documents')
    .select('*')
    .eq('is_active', true)
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .limit(50);

  if (error) {
    console.error('Error searching documents:', error);
    return [];
  }

  return data || [];
}

export function buildRegulatoryContext(documents: RegulatoryDocument[]): string {
  if (!documents || documents.length === 0) {
    return 'No specific regulatory documents provided. Use general FDA labeling knowledge.';
  }

  const context = documents
    .map((doc) => {
      return `
## ${doc.title}

**Requirements:**
${doc.content}
`;
    })
    .join('\n\n---\n\n');

  return `Use the following regulatory documents and requirements to evaluate this label:\n\n${context}`;
}
