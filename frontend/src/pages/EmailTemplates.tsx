import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { 
  FileText, 
  Plus,
  Sparkles,
  Mail,
  RefreshCw,
  Calendar,
  Star,
  Users,
  X,
  Copy,
  Wand2,
  Edit,
  Trash2,
  ChevronRight,
  Check,
  Eye
} from 'lucide-react';

interface Template {
  id: string;
  category: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  variables: string[];
  bestFor: string[];
  isCustom?: boolean;
  avgOpenRate?: number;
  avgReplyRate?: number;
}

interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const iconMap: Record<string, any> = {
  mail: Mail,
  refresh: RefreshCw,
  calendar: Calendar,
  star: Star,
  users: Users,
  x: X
};

export default function EmailTemplates() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});
  
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    category: 'cold_outreach',
    subject: '',
    body: '',
    bestFor: ''
  });
  
  const [generateForm, setGenerateForm] = useState({
    description: '',
    category: 'cold_outreach',
    tone: 'professional',
    targetAudience: '',
    goal: 'book meeting'
  });

  // Queries
  const { data: categories } = useQuery({
    queryKey: ['template-categories'],
    queryFn: api.getTemplateCategories
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates', selectedCategory],
    queryFn: () => api.getTemplates(selectedCategory || undefined)
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) => api.createTemplate({
      ...data,
      bestFor: data.bestFor.split(',').map(s => s.trim()).filter(Boolean)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setShowCreateForm(false);
      setCreateForm({
        name: '',
        description: '',
        category: 'cold_outreach',
        subject: '',
        body: '',
        bestFor: ''
      });
    }
  });

  const generateMutation = useMutation({
    mutationFn: (data: typeof generateForm) => api.generateTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setShowGenerateForm(false);
      setGenerateForm({
        description: '',
        category: 'cold_outreach',
        tone: 'professional',
        targetAudience: '',
        goal: 'book meeting'
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (templateId: string) => api.deleteTemplate(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setSelectedTemplate(null);
    }
  });

  const personalizeMutation = useMutation({
    mutationFn: ({ templateId, variables }: { templateId: string; variables: Record<string, string> }) =>
      api.personalizeTemplate(templateId, { variables })
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const applyPreviewVariables = (text: string) => {
    let result = text;
    for (const [key, value] of Object.entries(previewVariables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `{{${key}}}`);
    }
    return result;
  };

  const categoriesData = categories as Category[] || [];
  const templatesData = templates as Template[] || [];

  return (
    <div className="p-6 space-y-6" data-testid="email-templates-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-500" />
            Email Template Library
          </h1>
          <p className="text-gray-500 mt-1">
            Pre-built and custom templates with AI personalization
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowGenerateForm(true)} data-testid="generate-template-btn">
            <Wand2 className="w-4 h-4 mr-2" />
            AI Generate
          </Button>
          <Button onClick={() => setShowCreateForm(true)} data-testid="create-template-btn">
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Generate Form Modal */}
      {showGenerateForm && (
        <Card className="border-purple-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-purple-500" />
              Generate Template with AI
            </CardTitle>
            <CardDescription>Describe what you need and AI will create a template</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">What kind of email do you need?</label>
              <textarea
                className="w-full min-h-[80px] p-3 rounded-md border bg-background"
                value={generateForm.description}
                onChange={(e) => setGenerateForm(f => ({ ...f, description: e.target.value }))}
                placeholder="E.g., A follow-up email for prospects who downloaded our whitepaper but haven't responded to my first outreach..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <select
                  className="w-full p-2 rounded-md border bg-background"
                  value={generateForm.category}
                  onChange={(e) => setGenerateForm(f => ({ ...f, category: e.target.value }))}
                >
                  {categoriesData.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tone</label>
                <select
                  className="w-full p-2 rounded-md border bg-background"
                  value={generateForm.tone}
                  onChange={(e) => setGenerateForm(f => ({ ...f, tone: e.target.value }))}
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="friendly">Friendly</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Audience</label>
                <Input
                  value={generateForm.targetAudience}
                  onChange={(e) => setGenerateForm(f => ({ ...f, targetAudience: e.target.value }))}
                  placeholder="VP Sales at mid-market SaaS"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Goal</label>
                <select
                  className="w-full p-2 rounded-md border bg-background"
                  value={generateForm.goal}
                  onChange={(e) => setGenerateForm(f => ({ ...f, goal: e.target.value }))}
                >
                  <option value="book meeting">Book a Meeting</option>
                  <option value="get reply">Get a Reply</option>
                  <option value="share resource">Share a Resource</option>
                  <option value="build relationship">Build Relationship</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => generateMutation.mutate(generateForm)}
                disabled={generateMutation.isPending || !generateForm.description}
              >
                {generateMutation.isPending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate Template</>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowGenerateForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Custom Template</CardTitle>
            <CardDescription>Use {'{{variable}}'} syntax for personalization placeholders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Template Name</label>
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="My Custom Template"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <select
                  className="w-full p-2 rounded-md border bg-background"
                  value={createForm.category}
                  onChange={(e) => setCreateForm(f => ({ ...f, category: e.target.value }))}
                >
                  {categoriesData.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={createForm.description}
                onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of when to use this template"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject Line</label>
              <Input
                value={createForm.subject}
                onChange={(e) => setCreateForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Quick question, {{firstName}}"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Body</label>
              <textarea
                className="w-full min-h-[150px] p-3 rounded-md border bg-background font-mono text-sm"
                value={createForm.body}
                onChange={(e) => setCreateForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Hi {{firstName}},&#10;&#10;I noticed {{company}} is..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Best For (comma-separated)</label>
              <Input
                value={createForm.bestFor}
                onChange={(e) => setCreateForm(f => ({ ...f, bestFor: e.target.value }))}
                placeholder="VP/Director level, Mid-market companies"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => createMutation.mutate(createForm)}
                disabled={createMutation.isPending || !createForm.name || !createForm.subject || !createForm.body}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Template'}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Categories Sidebar */}
        <div className="space-y-2">
          <h3 className="font-semibold mb-3">Categories</h3>
          <button
            onClick={() => setSelectedCategory(null)}
            className={`w-full text-left p-3 rounded-lg border transition ${
              !selectedCategory ? 'bg-primary text-primary-foreground' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <span className="font-medium">All Templates</span>
            <span className="text-sm block opacity-70">{templatesData.length} templates</span>
          </button>
          {categoriesData.map(category => {
            const Icon = iconMap[category.icon] || FileText;
            const count = templatesData.filter(t => t.category === category.id).length;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`w-full text-left p-3 rounded-lg border transition ${
                  selectedCategory === category.id ? 'bg-primary text-primary-foreground' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{category.name}</span>
                </div>
                <span className="text-sm block opacity-70">{count} templates</span>
              </button>
            );
          })}
        </div>

        {/* Templates Grid */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-semibold">
            {selectedCategory 
              ? categoriesData.find(c => c.id === selectedCategory)?.name || 'Templates'
              : 'All Templates'}
          </h3>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : templatesData.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No templates in this category</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {templatesData.map(template => (
                <Card 
                  key={template.id}
                  className={`cursor-pointer transition hover:border-blue-500/50 ${
                    selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => {
                    setSelectedTemplate(template);
                    setPreviewVariables({});
                  }}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{template.name}</h4>
                          {template.isCustom && (
                            <span className="px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                              Custom
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-1">{template.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          {template.avgOpenRate !== undefined && (
                            <span>{template.avgOpenRate}% open rate</span>
                          )}
                          {template.avgReplyRate !== undefined && (
                            <span>{template.avgReplyRate}% reply rate</span>
                          )}
                          <span>{template.variables?.length || 0} variables</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Template Preview */}
        <div className="space-y-4">
          <h3 className="font-semibold">Preview</h3>
          {selectedTemplate ? (
            <Card>
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{selectedTemplate.name}</h4>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(selectedTemplate.subject + '\n\n' + selectedTemplate.body)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    {selectedTemplate.isCustom && (
                      <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(selectedTemplate.id)}>
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Variables Input */}
                {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preview Variables</label>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedTemplate.variables.slice(0, 6).map(variable => (
                        <Input
                          key={variable}
                          placeholder={variable}
                          value={previewVariables[variable] || ''}
                          onChange={(e) => setPreviewVariables(v => ({ ...v, [variable]: e.target.value }))}
                          className="text-xs h-8"
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Subject Preview */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Subject</label>
                  <div className="p-2 rounded border bg-gray-50 dark:bg-gray-800 text-sm">
                    {applyPreviewVariables(selectedTemplate.subject)}
                  </div>
                </div>
                
                {/* Body Preview */}
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Body</label>
                  <div className="p-2 rounded border bg-gray-50 dark:bg-gray-800 text-sm whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                    {applyPreviewVariables(selectedTemplate.body)}
                  </div>
                </div>
                
                {/* Best For */}
                {selectedTemplate.bestFor && selectedTemplate.bestFor.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Best For</label>
                    <div className="flex flex-wrap gap-1">
                      {selectedTemplate.bestFor.map((item, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-800">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Actions */}
                <div className="pt-2 flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => {
                    // Navigate to optimization page with this template
                    window.location.href = `/email-optimization?subject=${encodeURIComponent(selectedTemplate.subject)}&body=${encodeURIComponent(selectedTemplate.body)}`;
                  }}>
                    <Sparkles className="w-3 h-3 mr-1" />
                    Optimize
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a template to preview</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
