import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';

export default function Agents() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: categories } = useQuery({
    queryKey: ['agentCategories'],
    queryFn: api.getAgentCategories,
  });

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['agentTemplates', selectedCategory, searchQuery],
    queryFn: () => api.getAgentTemplates({ 
      category: selectedCategory || undefined, 
      search: searchQuery || undefined 
    }),
  });

  const { data: myAgents, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.getAgents(),
  });

  const createAgentMutation = useMutation({
    mutationFn: (template: any) => api.createAgent({
      name: template.name,
      templateId: template.id,
      description: template.description,
      category: template.domain,
      tier: template.tier,
      systemPrompt: template.systemPrompt,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Agent Library</h1>
        <p className="text-gray-500 mt-1">
          Browse and deploy AI agents for your sales processes.
        </p>
      </div>

      {/* My Agents */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>My Agents</CardTitle>
          <CardDescription>Agents you've deployed</CardDescription>
        </CardHeader>
        <CardContent>
          {agentsLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : myAgents && myAgents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {myAgents.map((agent: any) => (
                <div key={agent.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{agent.name}</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      agent.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {agent.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mb-3">{agent.description}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1">
                      Configure
                    </Button>
                    <Button size="sm" className="flex-1">
                      Run
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No agents deployed yet. Browse the catalog below to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Catalog */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Catalog</CardTitle>
          <CardDescription>1000+ agents across all sales functions</CardDescription>
          <div className="flex flex-col md:flex-row gap-4 mt-4">
            <Input
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="md:w-64"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                All
              </Button>
              {categories?.map((cat: any) => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.slug ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.slug)}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {templatesLoading ? (
            <div className="text-center py-8 text-gray-500">Loading templates...</div>
          ) : templates && templates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template: any) => (
                <div key={template.id} className="p-4 border rounded-lg hover:border-primary transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 text-xs rounded capitalize ${
                      template.tier === 'leader' ? 'bg-purple-100 text-purple-700' :
                      template.tier === 'specialist' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {template.tier}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">{template.domain}</span>
                  </div>
                  <h3 className="font-medium mb-1">{template.name}</h3>
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{template.description}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {template.tags?.slice(0, 3).map((tag: string) => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => createAgentMutation.mutate(template)}
                    disabled={createAgentMutation.isPending}
                  >
                    Deploy Agent
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No templates found. Try adjusting your filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
