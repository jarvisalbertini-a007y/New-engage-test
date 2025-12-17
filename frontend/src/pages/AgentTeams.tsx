import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';

interface AgentTeam {
  id: string;
  name: string;
  description: string;
  agents: TeamAgent[];
  handoffRules: HandoffRule[];
  status: 'active' | 'paused' | 'draft';
}

interface TeamAgent {
  id: string;
  role: string;
  agentType: string;
  name: string;
  priority: number;
}

interface HandoffRule {
  id: string;
  fromAgent: string;
  toAgent: string;
  trigger: string;
  condition: string;
}

// Sample team templates
const TEAM_TEMPLATES = [
  {
    id: 'outbound-team',
    name: 'Outbound Sales Team',
    description: 'Full-stack outbound team with research, personalization, and outreach',
    agents: [
      { role: 'Lead Researcher', agentType: 'research', priority: 1 },
      { role: 'ICP Scorer', agentType: 'qualification', priority: 2 },
      { role: 'Email Writer', agentType: 'content', priority: 3 },
      { role: 'Sequence Manager', agentType: 'outreach', priority: 4 }
    ],
    handoffFlow: 'Research → Score → Write → Send'
  },
  {
    id: 'inbound-team',
    name: 'Inbound Response Team',
    description: 'Rapid response team for inbound leads',
    agents: [
      { role: 'Intent Classifier', agentType: 'analysis', priority: 1 },
      { role: 'Lead Qualifier', agentType: 'qualification', priority: 2 },
      { role: 'Meeting Booker', agentType: 'scheduling', priority: 3 }
    ],
    handoffFlow: 'Classify → Qualify → Book'
  },
  {
    id: 'nurture-team',
    name: 'Nurture Campaign Team',
    description: 'Long-term nurture with personalized content',
    agents: [
      { role: 'Engagement Tracker', agentType: 'analysis', priority: 1 },
      { role: 'Content Recommender', agentType: 'content', priority: 2 },
      { role: 'Timing Optimizer', agentType: 'scheduling', priority: 3 }
    ],
    handoffFlow: 'Track → Recommend → Optimize'
  }
];

export default function AgentTeams() {
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [teamName, setTeamName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const queryClient = useQueryClient();

  // In production, this would fetch from API
  const { data: teams = [], isLoading } = useQuery<AgentTeam[]>({
    queryKey: ['agentTeams'],
    queryFn: async () => {
      // Simulated teams - in production would call api.getAgentTeams()
      return [
        {
          id: 'team-1',
          name: 'My Outbound Team',
          description: 'Custom outbound team',
          agents: [
            { id: 'a1', role: 'Researcher', agentType: 'research', name: 'Research Agent', priority: 1 },
            { id: 'a2', role: 'Writer', agentType: 'content', name: 'Email Agent', priority: 2 }
          ],
          handoffRules: [],
          status: 'active'
        }
      ];
    }
  });

  const createTeamMutation = useMutation({
    mutationFn: async (template: any) => {
      // In production: await api.createAgentTeam({ ...template, name: teamName })
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agentTeams'] });
      setShowCreateForm(false);
      setSelectedTemplate(null);
      setTeamName('');
    }
  });

  const getAgentIcon = (type: string) => {
    const icons: Record<string, string> = {
      'research': '🔍',
      'qualification': '✅',
      'content': '✍️',
      'outreach': '📤',
      'analysis': '📊',
      'scheduling': '📅',
      'default': '🤖'
    };
    return icons[type] || icons.default;
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agent Teams</h1>
          <p className="text-gray-500 mt-1">
            Create multi-agent teams with automated handoffs
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          + Create Team
        </Button>
      </div>

      {/* Create Team Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Create Agent Team</CardTitle>
              <CardDescription>Select a template or build a custom team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Team Templates */}
              <div>
                <h4 className="font-medium mb-3">Team Templates</h4>
                <div className="grid gap-3">
                  {TEAM_TEMPLATES.map(template => (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedTemplate?.id === template.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h5 className="font-medium">{template.name}</h5>
                          <p className="text-sm text-gray-500">{template.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            {template.agents.map((agent, idx) => (
                              <span key={idx} className="text-xl" title={agent.role}>
                                {getAgentIcon(agent.agentType)}
                              </span>
                            ))}
                          </div>
                          <p className="text-xs text-gray-400 mt-2">
                            Flow: {template.handoffFlow}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded ${
                          selectedTemplate?.id === template.id
                            ? 'bg-primary text-white'
                            : 'bg-gray-100'
                        }`}>
                          {template.agents.length} agents
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedTemplate && (
                <div>
                  <label className="text-sm font-medium">Team Name</label>
                  <Input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder={`My ${selectedTemplate.name}`}
                    className="mt-1"
                  />
                </div>
              )}

              {/* Selected Template Preview */}
              {selectedTemplate && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-3">Team Structure</h4>
                  <div className="flex items-center gap-2">
                    {selectedTemplate.agents.map((agent: any, idx: number) => (
                      <React.Fragment key={idx}>
                        <div className="flex flex-col items-center p-3 bg-white rounded-lg shadow-sm">
                          <span className="text-2xl mb-1">{getAgentIcon(agent.agentType)}</span>
                          <span className="text-xs font-medium">{agent.role}</span>
                        </div>
                        {idx < selectedTemplate.agents.length - 1 && (
                          <span className="text-gray-400">→</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createTeamMutation.mutate(selectedTemplate)}
                  disabled={!selectedTemplate || !teamName}
                >
                  Create Team
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Existing Teams */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map(team => (
          <Card key={team.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{team.name}</CardTitle>
                <span className={`px-2 py-0.5 text-xs rounded ${
                  team.status === 'active' ? 'bg-green-100 text-green-700' :
                  team.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {team.status}
                </span>
              </div>
              <CardDescription>{team.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {team.agents.map((agent, idx) => (
                    <React.Fragment key={agent.id}>
                      <div className="flex flex-col items-center" title={agent.role}>
                        <span className="text-xl">{getAgentIcon(agent.agentType)}</span>
                        <span className="text-xs text-gray-500">{agent.role}</span>
                      </div>
                      {idx < team.agents.length - 1 && (
                        <span className="text-gray-300">→</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    Configure
                  </Button>
                  <Button size="sm" className="flex-1">
                    {team.status === 'active' ? 'Pause' : 'Activate'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Empty State */}
        {teams.length === 0 && !isLoading && (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <p className="text-4xl mb-4">🤖🤖🤖</p>
              <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
              <p className="text-gray-500 mb-4">
                Create your first agent team to automate complex workflows
              </p>
              <Button onClick={() => setShowCreateForm(true)}>
                Create Your First Team
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
