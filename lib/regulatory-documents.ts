import { supabase } from './supabase';

export interface RegulatoryDocument {
  id: string;
  title: string;
  description?: string;
  content: string;
  document_type: 'federal_law' | 'state_regulation' | 'guideline' | 'standard' | 'policy' | 'other';
  jurisdiction?: string;
  source?: string;
  effective_date?: string;
  version?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string;
}

export interface DocumentCategory {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export async function getActiveRegulatoryDocuments(): Promise<RegulatoryDocument[]> {
  const { data, error } = await supabase
    .from('regulatory_documents')
    .select('id, title, content')
    .eq('is_active', true)
    .limit(10);

  if (error) {
    console.error('Error fetching regulatory documents:', error);
    return [];
  }

  return data || [];
}

export async function getRegulatoryDocumentsByCategory(categoryName: string): Promise<RegulatoryDocument[]> {
  const { data, error } = await supabase
    .from('regulatory_documents')
    .select('id, title, content')
    .eq('is_active', true)
    .limit(10);

  if (error) {
    console.error('Error fetching documents by category:', error);
    return [];
  }

  return data || [];
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

  return { data, error };
}

export async function deactivateDocument(id: string): Promise<{ error: any }> {
  const { error } = await supabase
    .from('regulatory_documents')
    .update({ is_active: false })
    .eq('id', id);

  return { error };
}

export async function searchDocuments(query: string): Promise<RegulatoryDocument[]> {
  const { data, error } = await supabase
    .from('regulatory_documents')
    .select('id, title, content')
    .eq('is_active', true)
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .limit(10);

  if (error) {
    console.error('Error searching documents:', error);
    return [];
  }

  return data || [];
}

export function buildRegulatoryContext(documents: RegulatoryDocument[]): string {
  if (!documents || documents.length === 0) {
    return 'No specific regulatory documents provided. Use general FDA food labeling knowledge.';
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

  return `Use the following regulatory documents and requirements to evaluate this food label:\n\n${context}`;
}
