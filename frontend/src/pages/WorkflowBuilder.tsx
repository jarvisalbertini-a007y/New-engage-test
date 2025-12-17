import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';

export default function WorkflowBuilder() {
  const [nlpInput, setNlpInput] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [generatedWorkflow, setGeneratedWorkflow] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ['workflowTemplates'],
    queryFn: () => api.getWorkflowTemplates()
  });

  const { data: approvals = [] } = useQuery<any[]>({
    queryKey: ['pendingApprovals'],
    queryFn: () => api.getPendingApprovals()
  });

  const generateMutation = useMutation({
    mutationFn: (description: string) => api.generateWorkflowFromNlp(description),
    onSuccess: (data) => {
      if (data.success) {
        setGeneratedWorkflow(data.workflow);
      }
    }
  });

  const cloneMutation = useMutation({
    mutationFn: ({ templateId, name }: { templateId: string; name: string }) =>
      api.cloneWorkflowTemplate(templateId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setSelectedTemplate(null);
    }
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.respondToApproval(id, { action }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
    }
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Workflow Builder</h1>
        <p className="text-gray-500 mt-1">
          Create workflows with AI or use prebuilt templates
        </p>
      </div>

      {/* Pending Approvals */}
      {approvals && approvals.length > 0 && (
        <Card className="mb-8 border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800">⏳ Pending Approvals ({approvals.length})</CardTitle>
            <CardDescription className="text-amber-700">Actions waiting for your review</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {approvals.map((approval: any) => (
                <div key={approval.id} className="p-4 bg-white rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{approval.title}</h4>
                      <p className="text-sm text-gray-500">{approval.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approveMutation.mutate({ id: approval.id, action: 'reject' })}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate({ id: approval.id, action: 'approve' })}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* NLP Workflow Generator */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>✨ AI Workflow Generator</CardTitle>
          <CardDescription>
            Describe your workflow in plain English and AI will build it
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Input
                value={nlpInput}
                onChange={(e) => setNlpInput(e.target.value)}
                placeholder="e.g., 'Create a 5-step sequence for CFOs that starts with LinkedIn, waits 2 days, then sends personalized email'"
                className="pr-24"
              />
              <Button
                onClick={() => generateMutation.mutate(nlpInput)}
                disabled={!nlpInput.trim() || generateMutation.isPending}
                className="absolute right-1 top-1 h-8"
                size="sm"
              >
                {generateMutation.isPending ? 'Generating...' : 'Generate'}
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-500">Try:</span>
              {[
                'Follow up webinar no-shows',
                'Nurture cold leads over 2 weeks',
                'Multi-channel outreach for enterprise'
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => setNlpInput(example)}
                  className="text-sm px-3 py-1 bg-violet-100 text-violet-700 rounded-full hover:bg-violet-200"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Generated Workflow Preview */}
          {generatedWorkflow && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Generated Workflow: {generatedWorkflow.name}</h4>
              <p className="text-sm text-gray-600 mb-4">{generatedWorkflow.description}</p>
              
              {/* Visual node representation */}
              <div className="flex items-center gap-2 overflow-x-auto pb-4">
                {generatedWorkflow.nodes?.map((node: any, idx: number) => (
                  <div key={node.id} className="flex items-center">
                    <div className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
                      node.type === 'trigger' ? 'bg-green-100 text-green-800' :
                      node.type === 'email' ? 'bg-blue-100 text-blue-800' :
                      node.type === 'wait' ? 'bg-gray-100 text-gray-800' :
                      node.type === 'approval' ? 'bg-amber-100 text-amber-800' :
                      node.type === 'branch' ? 'bg-purple-100 text-purple-800' :
                      node.type === 'end' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100'
                    }`}>
                      {node.label}
                    </div>
                    {idx < generatedWorkflow.nodes.length - 1 && (
                      <span className="mx-2 text-gray-400">→</span>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2 mt-4">
                <Button size="sm">Save Workflow</Button>
                <Button size="sm" variant="outline" onClick={() => setGeneratedWorkflow(null)}>
                  Discard
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prebuilt Templates */}
      <Card>
        <CardHeader>
          <CardTitle>📚 Prebuilt Templates</CardTitle>
          <CardDescription>
            Start with battle-tested workflows and customize them
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates?.map((template: any) => (
              <div
                key={template.id}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedTemplate?.id === template.id
                    ? 'border-violet-500 bg-violet-50'
                    : 'hover:border-gray-300'
                }`}
                onClick={() => setSelectedTemplate(template)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    template.complexity === 'simple' ? 'bg-green-100 text-green-700' :
                    template.complexity === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {template.complexity}
                  </span>
                  <span className="text-xs text-gray-500">{template.estimatedTime}</span>
                </div>
                <h4 className="font-medium mb-1">{template.name}</h4>
                <p className="text-sm text-gray-500 mb-3">{template.description}</p>
                
                <div className="flex flex-wrap gap-1">
                  {template.tags?.slice(0, 3).map((tag: string) => (
                    <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
                
                {template.approvalPoints?.length > 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ {template.approvalPoints.length} approval point(s)
                  </p>
                )}
              </div>
            ))}
          </div>

          {selectedTemplate && (
            <div className="mt-6 p-4 bg-violet-50 rounded-lg border border-violet-200">
              <h4 className="font-medium mb-2">Use "{selectedTemplate.name}"</h4>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter workflow name"
                  defaultValue={`My ${selectedTemplate.name}`}
                  id="workflowName"
                />
                <Button
                  onClick={() => {
                    const input = document.getElementById('workflowName') as HTMLInputElement;
                    cloneMutation.mutate({
                      templateId: selectedTemplate.id,
                      name: input?.value || selectedTemplate.name
                    });
                  }}
                  disabled={cloneMutation.isPending}
                >
                  {cloneMutation.isPending ? 'Creating...' : 'Create from Template'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
