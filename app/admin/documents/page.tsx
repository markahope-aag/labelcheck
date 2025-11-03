'use client';

import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  FileText,
  Calendar,
  CheckCircle,
  XCircle,
  Upload,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { RegulatoryDocument } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProductCategory } from '@/lib/supabase';

export default function AdminDocumentsPage() {
  const { userId } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [documents, setDocuments] = useState<RegulatoryDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<RegulatoryDocument | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    document_type: 'guideline',
    jurisdiction: 'United States',
    source: '',
    source_url: '',
    effective_date: '',
    version: '',
    is_active: true,
  });

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isProcessingPDF, setIsProcessingPDF] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const [showCategories, setShowCategories] = useState(false);
  const [documentCategories, setDocumentCategories] = useState<
    Map<string, { categories: ProductCategory[]; isCore: boolean }>
  >(new Map());
  const [loadingCategories, setLoadingCategories] = useState(false);

  const isAdmin = user?.publicMetadata?.role === 'admin';

  useEffect(() => {
    if (!userId) {
      router.push('/sign-in');
      return;
    }
    if (!isAdmin && user) {
      router.push('/dashboard');
      return;
    }
    if (isAdmin) {
      loadDocuments();
    }
  }, [userId, isAdmin, user]);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/documents');
      if (!response.ok) {
        throw new Error('Failed to load documents');
      }
      const data = await response.json();
      setDocuments(data);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const response = await fetch('/api/admin/documents/categories');
      if (!response.ok) {
        throw new Error('Failed to load categories');
      }
      const data = await response.json();

      // Convert array to Map for easy lookup
      // data structure: Array<{ document: RegulatoryDocument; categories: string[]; isCore: boolean }>
      const categoryMap = new Map();
      data.forEach(
        (item: { document: RegulatoryDocument; categories: string[]; isCore: boolean }) => {
          categoryMap.set(item.document.id, {
            categories: item.categories,
            isCore: item.isCore,
          });
        }
      );

      setDocumentCategories(categoryMap);
      setShowCategories(true);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const url = editingDoc ? `/api/admin/documents/${editingDoc.id}` : '/api/admin/documents';
      const method = editingDoc ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to save document');
      }

      setIsDialogOpen(false);
      setEditingDoc(null);
      resetForm();
      loadDocuments();
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
    }
  };

  const handleEdit = (doc: RegulatoryDocument) => {
    setEditingDoc(doc);
    setFormData({
      title: doc.title,
      description: doc.description || '',
      content: doc.content,
      document_type: doc.document_type,
      jurisdiction: doc.jurisdiction || 'United States',
      source: doc.source || '',
      source_url: doc.source_url || '',
      effective_date: doc.effective_date || '',
      version: doc.version || '',
      is_active: doc.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleDeactivate = async (id: string) => {
    if (
      !confirm('Are you sure you want to permanently delete this document? This cannot be undone.')
    )
      return;

    try {
      const response = await fetch(`/api/admin/documents/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to deactivate document');
      }

      loadDocuments();
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      content: '',
      document_type: 'guideline',
      jurisdiction: 'United States',
      source: '',
      source_url: '',
      effective_date: '',
      version: '',
      is_active: true,
    });
    setPdfFile(null);
    setPdfError('');
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setPdfError('Please upload a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      setPdfError('PDF file must be less than 10MB');
      return;
    }

    setPdfFile(file);
    setPdfError('');
    setIsProcessingPDF(true);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch('/api/admin/documents/extract-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to extract text from PDF');
      }

      const data = await response.json();

      // Auto-fill form with extracted data (preserve user-entered title)
      setFormData((prev) => ({
        ...prev,
        title: prev.title || data.metadata.title || file.name.replace('.pdf', ''),
        content: data.text,
        source: prev.source || data.metadata.author || '',
      }));
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      setPdfError(error.message);
    } finally {
      setIsProcessingPDF(false);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || doc.document_type === filterType;
    return matchesSearch && matchesType;
  });

  if (!userId) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">Regulatory Documents</h1>
              <p className="text-slate-600">Manage rules and regulations for label analysis</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  if (showCategories) {
                    setShowCategories(false);
                  } else if (documentCategories.size > 0) {
                    setShowCategories(true);
                  } else {
                    loadCategories();
                  }
                }}
                disabled={loadingCategories}
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                <Eye className="h-4 w-4 mr-2" />
                {loadingCategories
                  ? 'Loading...'
                  : showCategories
                    ? 'Hide Categories'
                    : 'Preview RAG Categories'}
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      setEditingDoc(null);
                      resetForm();
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Document
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingDoc ? 'Edit Document' : 'Add New Document'}</DialogTitle>
                    <DialogDescription>
                      {editingDoc ? 'Update regulatory document' : 'Add a new regulatory document'}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Brief description of this regulation"
                      />
                    </div>

                    <div className="border-t border-b border-slate-200 py-4 my-4">
                      <Label htmlFor="pdf-upload" className="text-base font-semibold mb-2 block">
                        Upload PDF (Optional)
                      </Label>
                      <p className="text-sm text-slate-600 mb-3">
                        Upload a PDF to automatically extract the regulatory text, or manually enter
                        content below.
                      </p>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="relative"
                          disabled={isProcessingPDF}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {isProcessingPDF
                            ? 'Processing...'
                            : pdfFile
                              ? 'Change PDF'
                              : 'Choose PDF'}
                          <input
                            id="pdf-upload"
                            type="file"
                            accept="application/pdf"
                            onChange={handlePDFUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={isProcessingPDF}
                          />
                        </Button>
                        {pdfFile && (
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            <span className="text-sm text-slate-700">{pdfFile.name}</span>
                          </div>
                        )}
                      </div>
                      {pdfError && <p className="text-sm text-red-600 mt-2">{pdfError}</p>}
                    </div>

                    <div>
                      <Label htmlFor="content">Content *</Label>
                      <p className="text-sm text-slate-600 mb-2">
                        {pdfFile
                          ? 'Review and edit the extracted text below:'
                          : 'Enter regulatory text manually:'}
                      </p>
                      <Textarea
                        id="content"
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        rows={8}
                        required
                        className="font-mono text-sm"
                        placeholder="Paste or type regulatory requirements here..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="document_type">Document Type</Label>
                        <Select
                          value={formData.document_type}
                          onValueChange={(value) =>
                            setFormData({ ...formData, document_type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="federal_law">Federal Law</SelectItem>
                            <SelectItem value="state_regulation">State Regulation</SelectItem>
                            <SelectItem value="guideline">Guideline</SelectItem>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="policy">Policy</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="jurisdiction">Jurisdiction</Label>
                        <Input
                          id="jurisdiction"
                          value={formData.jurisdiction}
                          onChange={(e) =>
                            setFormData({ ...formData, jurisdiction: e.target.value })
                          }
                          placeholder="e.g., United States, California"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="source">Source</Label>
                        <Input
                          id="source"
                          value={formData.source}
                          onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                          placeholder="e.g., FDA 21 CFR 101.9"
                        />
                      </div>
                      <div>
                        <Label htmlFor="version">Version</Label>
                        <Input
                          id="version"
                          value={formData.version}
                          onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                          placeholder="e.g., 2024.1"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="effective_date">Effective Date</Label>
                        <Input
                          id="effective_date"
                          type="date"
                          value={formData.effective_date}
                          onChange={(e) =>
                            setFormData({ ...formData, effective_date: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="source_url">Source URL (Optional)</Label>
                        <Input
                          id="source_url"
                          value={formData.source_url}
                          onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                          placeholder="e.g., https://www.fda.gov/..."
                          type="url"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor="is_active">Active (used in analysis)</Label>
                    </div>
                    <div className="flex gap-4 pt-4">
                      <Button
                        type="submit"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {editingDoc ? 'Update Document' : 'Create Document'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsDialogOpen(false);
                          setEditingDoc(null);
                          resetForm();
                        }}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Card className="border-slate-200 mb-6">
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-48">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="federal_law">Federal Law</SelectItem>
                    <SelectItem value="state_regulation">State Regulation</SelectItem>
                    <SelectItem value="guideline">Guideline</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="policy">Policy</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <Card className="border-slate-200">
              <CardContent className="py-12 text-center text-slate-600">
                Loading documents...
              </CardContent>
            </Card>
          ) : filteredDocuments.length === 0 ? (
            <Card className="border-slate-200">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600">No documents found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredDocuments.map((doc) => (
                <Card key={doc.id} className="border-slate-200 hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CardTitle className="text-xl font-semibold text-slate-900">
                            {doc.title}
                          </CardTitle>
                          {doc.is_active ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                              <XCircle className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                          <Badge variant="outline" className="capitalize">
                            {doc.document_type?.replace('_', ' ') || 'Unknown'}
                          </Badge>
                        </div>
                        {doc.description && <CardDescription>{doc.description}</CardDescription>}
                        {showCategories && documentCategories.has(doc.id) && (
                          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="text-sm font-semibold text-blue-900 mb-2">
                              📚 RAG Lite Categories
                              {documentCategories.get(doc.id)?.isCore && (
                                <span className="ml-2 text-xs font-normal text-blue-700">
                                  (Core document - applies to all categories)
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {documentCategories.get(doc.id)?.categories.map((category) => {
                                const categoryColors: Record<ProductCategory, string> = {
                                  CONVENTIONAL_FOOD: 'bg-amber-100 text-amber-800 border-amber-300',
                                  DIETARY_SUPPLEMENT:
                                    'bg-purple-100 text-purple-800 border-purple-300',
                                  ALCOHOLIC_BEVERAGE: 'bg-rose-100 text-rose-800 border-rose-300',
                                  NON_ALCOHOLIC_BEVERAGE:
                                    'bg-cyan-100 text-cyan-800 border-cyan-300',
                                };
                                return (
                                  <Badge
                                    key={category}
                                    className={`${categoryColors[category]} text-xs`}
                                  >
                                    {category.replace(/_/g, ' ')}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-3 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            {doc.jurisdiction}
                          </div>
                          {doc.source && <div>{doc.source}</div>}
                          {doc.effective_date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {new Date(doc.effective_date).toLocaleDateString()}
                            </div>
                          )}
                          {doc.version && <div>v{doc.version}</div>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(doc)}
                          className="border-slate-300 hover:bg-slate-50"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeactivate(doc.id)}
                          className="border-red-300 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <p className="text-sm text-slate-700 line-clamp-3">{doc.content}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
