import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';

interface KnowledgeDoc {
  id: string;
  name: string;
  filename: string;
  fileType: string;
  fileSize: number;
  category: string;
  description: string;
  extractedData: any;
  status: string;
  createdAt: string;
}

export default function KnowledgeBase() {
  const [searchQuery, setSearchQuery] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [uploadForm, setUploadForm] = useState({ name: '', category: 'general', description: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery<KnowledgeDoc[]>({
    queryKey: ['knowledge', selectedCategory],
    queryFn: () => api.listKnowledge(selectedCategory || undefined)
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', uploadForm.name || file.name);
      formData.append('category', uploadForm.category);
      formData.append('description', uploadForm.description);
      return api.uploadKnowledge(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      setUploadForm({ name: '', category: 'general', description: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  });

  const queryMutation = useMutation({
    mutationFn: (query: string) => api.queryKnowledge(query, selectedCategory ? [selectedCategory] : undefined),
    onSuccess: (data) => setQueryResult(data)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteKnowledge?.(id) || Promise.resolve(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge'] })
  });

  const categories = [
    { value: 'general', label: 'General', icon: '📄' },
    { value: 'company_info', label: 'Company Info', icon: '🏢' },
    { value: 'icp', label: 'ICP', icon: '🎯' },
    { value: 'competitors', label: 'Competitors', icon: '⚔️' },
    { value: 'messaging', label: 'Messaging', icon: '💬' },
    { value: 'case_studies', label: 'Case Studies', icon: '📊' },
    { value: 'product', label: 'Product', icon: '📦' }
  ];

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Knowledge Base</h1>
        <p className="text-gray-500 mt-1">
          Upload documents and query your knowledge with AI
        </p>
      </div>

      {/* RAG Query Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🔍</span> Ask Your Knowledge Base
          </CardTitle>
          <CardDescription>
            Query your documents using natural language - AI will find relevant information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="e.g., 'What are our main competitors' weaknesses?' or 'Summarize our ICP'"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && queryInput && queryMutation.mutate(queryInput)}
            />
            <Button
              onClick={() => queryMutation.mutate(queryInput)}
              disabled={!queryInput || queryMutation.isPending}
            >
              {queryMutation.isPending ? 'Searching...' : 'Query'}
            </Button>
          </div>

          {queryResult && (
            <div className="mt-4 p-4 bg-violet-50 rounded-lg">
              <h4 className="font-medium text-violet-900 mb-2">AI Response</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{queryResult.answer}</p>
              {queryResult.sources && queryResult.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-violet-200">
                  <p className="text-xs text-violet-600 mb-1">Sources:</p>
                  <div className="flex flex-wrap gap-2">
                    {queryResult.sources.map((source: any) => (
                      <span key={source.id} className="text-xs px-2 py-1 bg-white rounded">
                        {source.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upload Section */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upload Document</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Document Name</label>
                <Input
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Enter document name"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <select
                  value={uploadForm.category}
                  onChange={(e) => setUploadForm(f => ({ ...f, category: e.target.value }))}
                  className="mt-1 w-full p-2 border rounded-lg"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description of the document"
                  className="mt-1 w-full p-2 border rounded-lg text-sm"
                  rows={2}
                />
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept=".txt,.md,.csv,.pdf,.docx,.json,.xml"
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                  className="w-full"
                >
                  {uploadMutation.isPending ? 'Uploading...' : 'Select & Upload File'}
                </Button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Supports: TXT, MD, CSV, PDF, DOCX, JSON, XML
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Category Filter */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedCategory === null ? 'bg-primary text-white' : 'hover:bg-gray-100'
                  }`}
                >
                  All Documents
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedCategory === cat.value ? 'bg-primary text-white' : 'hover:bg-gray-100'
                    }`}
                  >
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Documents List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Documents ({documents.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-4xl mb-2">📚</p>
                  <p>No documents yet. Upload your first document!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 border rounded-lg hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{doc.name}</h4>
                          <p className="text-sm text-gray-500 mt-1">{doc.description || doc.filename}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                              {categories.find(c => c.value === doc.category)?.label || doc.category}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatFileSize(doc.fileSize)}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMutation.mutate(doc.id)}
                        >
                          Delete
                        </Button>
                      </div>

                      {/* Extracted Data Preview */}
                      {doc.extractedData && Object.keys(doc.extractedData).length > 0 && (
                        <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                          <p className="text-xs font-medium text-gray-600 mb-1">AI Extracted:</p>
                          <p className="text-gray-700 line-clamp-2">
                            {doc.extractedData.summary || JSON.stringify(doc.extractedData).slice(0, 200)}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
