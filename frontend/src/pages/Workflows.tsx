import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';

export default function Workflows() {
  const [showCreate, setShowCreate] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const queryClient = useQueryClient();

  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.getWorkflows(),
  });

  const createMutation = useMutation({
    mutationFn: () => api.createWorkflow({
      name: workflowName,
      description: workflowDescription,
      nodes: [],
      edges: [],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setShowCreate(false);
      setWorkflowName('');
      setWorkflowDescription('');
    },
  });

  const generateMutation = useMutation({
    mutationFn: (description: string) => api.generateWorkflow(description),
    onSuccess: (data) => {
      setWorkflowName(data.name);
      setWorkflowDescription(data.description);
    },
  });

  const executeMutation = useMutation({
    mutationFn: (id: string) => api.executeWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Workflows</h1>
          <p className="text-gray-500 mt-1">
            Create and manage automated sales workflows.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          + Create Workflow
        </Button>
      </div>

      {showCreate && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Create New Workflow</CardTitle>
            <CardDescription>
              Describe your workflow in natural language, and AI will generate it for you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Workflow Name
              </label>
              <Input
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="e.g., Lead Qualification Pipeline"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (AI will generate workflow from this)
              </label>
              <textarea
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                placeholder="Describe what you want this workflow to do. e.g., 'When a new lead comes in, research their company, score them against our ICP, and if they score above 70, send a personalized email.'"
                className="w-full h-32 px-3 py-2 border rounded-md text-sm"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => generateMutation.mutate(workflowDescription)}
                disabled={!workflowDescription || generateMutation.isPending}
              >
                {generateMutation.isPending ? 'Generating...' : '✨ Generate with AI'}
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!workflowName || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Workflow'}
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>My Workflows</CardTitle>
          <CardDescription>Manage your automated sales workflows</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : workflows && workflows.length > 0 ? (
            <div className="space-y-4">
              {workflows.map((workflow: any) => (
                <div key={workflow.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{workflow.name}</h3>
                      <p className="text-sm text-gray-500">{workflow.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span>Category: {workflow.category}</span>
                        <span>Nodes: {workflow.nodes?.length || 0}</span>
                        <span className={`px-2 py-0.5 rounded ${
                          workflow.status === 'active' ? 'bg-green-100 text-green-700' :
                          workflow.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {workflow.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => executeMutation.mutate(workflow.id)}
                        disabled={executeMutation.isPending}
                      >
                        Run
                      </Button>
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No workflows yet. Create your first workflow above.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
