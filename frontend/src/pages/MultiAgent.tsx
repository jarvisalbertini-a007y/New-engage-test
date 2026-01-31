import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { 
  Users, 
  Brain,
  Search,
  Mail,
  TrendingUp,
  Lightbulb,
  Play,
  RefreshCw,
  CheckCircle2,
  Clock,
  MessageSquare,
  Zap,
  Plus,
  ChevronRight,
  Send,
  History
} from 'lucide-react';

interface AgentType {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  icon: string;
  color: string;
}

interface MultiAgentTask {
  id: string;
  goal: string;
  status: string;
  subtasks: Array<{
    id: string;
    agentType: string;
    description: string;
    priority: number;
  }>;
  results: Record<string, any>;
  synthesis: {
    summary?: string;
    keyFindings?: string[];
    recommendations?: string[];
    nextSteps?: string[];
    confidence?: number;
  } | null;
  createdAt: string;
  completedAt?: string;
}

interface CustomTeam {
  id: string;
  name: string;
  description: string;
  agents: string[];
  executionCount: number;
  createdAt: string;
}

const iconMap: Record<string, any> = {
  search: Search,
  mail: Mail,
  'trending-up': TrendingUp,
  brain: Brain,
  users: Users
};

export default function MultiAgent() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'execute' | 'teams' | 'chat' | 'history'>('execute');
  const [goal, setGoal] = useState('');
  const [selectedTask, setSelectedTask] = useState<MultiAgentTask | null>(null);
  const [chatAgent, setChatAgent] = useState('coordinator');
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [teamForm, setTeamForm] = useState({
    name: '',
    description: '',
    agents: [] as string[]
  });

  // Queries
  const { data: agentTypes } = useQuery({
    queryKey: ['agent-types'],
    queryFn: () => api.getAgentTypes()
  });

  const { data: tasks } = useQuery({
    queryKey: ['multi-agent-tasks'],
    queryFn: () => api.listMultiAgentTasks()
  });

  const { data: teams } = useQuery({
    queryKey: ['custom-teams'],
    queryFn: () => api.getCustomTeams()
  });

  const { data: executionHistory } = useQuery({
    queryKey: ['agent-execution-history'],
    queryFn: () => api.getAgentExecutionHistory()
  });

  // Mutations
  const executeMutation = useMutation({
    mutationFn: (taskGoal: string) => api.executeMultiAgentTask({ goal: taskGoal }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['multi-agent-tasks'] });
      setGoal('');
      if (data.taskId) {
        pollTaskStatus(data.taskId);
      }
    }
  });

  const chatMutation = useMutation({
    mutationFn: (data: { agentType: string; message: string; sessionId?: string }) =>
      api.agentChat(data),
    onSuccess: (data) => {
      setChatHistory(prev => [
        ...prev,
        { role: 'agent', content: data.response }
      ]);
      if (data.sessionId) {
        setChatSessionId(data.sessionId);
      }
    }
  });

  const createTeamMutation = useMutation({
    mutationFn: (data: typeof teamForm) => api.createCustomAgentTeam(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-teams'] });
      setShowTeamForm(false);
      setTeamForm({ name: '', description: '', agents: [] });
    }
  });

  const executeTeamMutation = useMutation({
    mutationFn: ({ teamId, teamGoal }: { teamId: string; teamGoal: string }) =>
      api.executeAgentTeam(teamId, { goal: teamGoal }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['multi-agent-tasks'] });
    }
  });

  const pollTaskStatus = async (taskId: string) => {
    const poll = async () => {
      const task = await api.getMultiAgentTask(taskId);
      setSelectedTask(task);
      if (task.status !== 'complete' && task.status !== 'failed') {
        setTimeout(poll, 2000);
      } else {
        queryClient.invalidateQueries({ queryKey: ['multi-agent-tasks'] });
      }
    };
    poll();
  };

  const handleSendChat = () => {
    if (!chatMessage.trim()) return;
    
    setChatHistory(prev => [
      ...prev,
      { role: 'user', content: chatMessage }
    ]);
    
    chatMutation.mutate({
      agentType: chatAgent,
      message: chatMessage,
      sessionId: chatSessionId || undefined
    });
    
    setChatMessage('');
  };

  const toggleTeamAgent = (agentId: string) => {
    setTeamForm(f => ({
      ...f,
      agents: f.agents.includes(agentId)
        ? f.agents.filter(a => a !== agentId)
        : [...f.agents, agentId]
    }));
  };

  const agents = (agentTypes || []) as AgentType[];
  const tasksList = (tasks || []) as MultiAgentTask[];
  const teamsList = (teams || []) as CustomTeam[];

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString([], { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'running': 
      case 'executing':
      case 'decomposing':
      case 'synthesizing': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'failed': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="multi-agent-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Users className="w-8 h-8 text-pink-500" />
            Multi-Agent Architecture
          </h1>
          <p className="text-gray-500 mt-1">
            Specialized AI agents collaborating on complex sales tasks
          </p>
        </div>
      </div>

      {/* Agent Types Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {agents.map(agent => {
          const Icon = iconMap[agent.icon] || Brain;
          return (
            <Card 
              key={agent.id} 
              className="cursor-pointer hover:ring-2 hover:ring-primary transition"
              onClick={() => {
                setChatAgent(agent.id);
                setActiveTab('chat');
              }}
            >
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${agent.color}20` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: agent.color }} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{agent.name}</p>
                    <p className="text-xs text-gray-500">{agent.capabilities.length} capabilities</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {[
          { id: 'execute', label: 'Execute Task', icon: Zap },
          { id: 'teams', label: 'Agent Teams', icon: Users },
          { id: 'chat', label: 'Chat with Agent', icon: MessageSquare },
          { id: 'history', label: 'History', icon: History }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition ${
              activeTab === tab.id 
                ? 'bg-primary text-primary-foreground' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'execute' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Execute Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Execute Multi-Agent Task
              </CardTitle>
              <CardDescription>
                Describe your goal and agents will collaborate to achieve it
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Goal Description</label>
                <textarea
                  className="w-full min-h-[120px] p-3 rounded-md border bg-background"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Example: Research 10 fintech companies in San Francisco and generate personalized outreach emails for their VP of Sales..."
                />
              </div>
              <div className="p-3 rounded-lg border bg-gray-50 dark:bg-gray-800">
                <p className="text-sm font-medium mb-2">How it works:</p>
                <ol className="text-sm text-gray-600 space-y-1">
                  <li>1. Coordinator breaks down your goal into subtasks</li>
                  <li>2. Specialist agents execute their parts</li>
                  <li>3. Results are synthesized into actionable output</li>
                </ol>
              </div>
              <Button
                onClick={() => executeMutation.mutate(goal)}
                disabled={executeMutation.isPending || !goal.trim()}
                className="w-full"
                data-testid="execute-multi-agent-btn"
              >
                {executeMutation.isPending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Starting...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" /> Execute with Multiple Agents</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Task Result */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Task Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedTask ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded text-xs ${getStatusColor(selectedTask.status)}`}>
                      {selectedTask.status}
                    </span>
                    <span className="text-xs text-gray-500">{formatDate(selectedTask.createdAt)}</span>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium mb-2">Goal</p>
                    <p className="text-sm text-gray-600">{selectedTask.goal.substring(0, 200)}...</p>
                  </div>

                  {selectedTask.subtasks.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Subtasks ({selectedTask.subtasks.length})</p>
                      <div className="space-y-2">
                        {selectedTask.subtasks.map(st => (
                          <div key={st.id} className="flex items-center gap-2 text-sm p-2 rounded border">
                            <span className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800">
                              {st.agentType}
                            </span>
                            <span className="text-gray-600 truncate">{st.description}</span>
                            {selectedTask.results[st.id] && (
                              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTask.synthesis && (
                    <div>
                      <p className="text-sm font-medium mb-2">Synthesis</p>
                      <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20">
                        <p className="text-sm">{selectedTask.synthesis.summary}</p>
                        {selectedTask.synthesis.keyFindings && (
                          <div className="mt-2">
                            <p className="text-xs font-medium">Key Findings:</p>
                            <ul className="text-xs text-gray-600 mt-1">
                              {selectedTask.synthesis.keyFindings.slice(0, 3).map((f, i) => (
                                <li key={i}>• {f}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Execute a task to see progress</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Tasks */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                Recent Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasksList.length === 0 ? (
                <p className="text-center py-4 text-gray-500">No tasks executed yet</p>
              ) : (
                <div className="space-y-2">
                  {tasksList.slice(0, 5).map(task => (
                    <div 
                      key={task.id} 
                      className="flex items-center justify-between p-3 rounded border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => setSelectedTask(task)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.goal}</p>
                        <p className="text-xs text-gray-500">{formatDate(task.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="space-y-6">
          {/* Create Team Form */}
          {showTeamForm ? (
            <Card>
              <CardHeader>
                <CardTitle>Create Agent Team</CardTitle>
                <CardDescription>Build a custom team for recurring workflows</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Team Name</label>
                    <Input
                      value={teamForm.name}
                      onChange={(e) => setTeamForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Sales Research Team"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Input
                      value={teamForm.description}
                      onChange={(e) => setTeamForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Researches and qualifies leads"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Agents</label>
                  <div className="flex flex-wrap gap-2">
                    {agents.map(agent => {
                      const Icon = iconMap[agent.icon] || Brain;
                      const isSelected = teamForm.agents.includes(agent.id);
                      return (
                        <button
                          key={agent.id}
                          onClick={() => toggleTeamAgent(agent.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition ${
                            isSelected 
                              ? 'bg-primary text-primary-foreground border-primary' 
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {agent.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => createTeamMutation.mutate(teamForm)}
                    disabled={createTeamMutation.isPending || !teamForm.name || teamForm.agents.length === 0}
                  >
                    Create Team
                  </Button>
                  <Button variant="outline" onClick={() => setShowTeamForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button onClick={() => setShowTeamForm(true)} data-testid="create-team-btn">
              <Plus className="w-4 h-4 mr-2" />
              Create Agent Team
            </Button>
          )}

          {/* Teams List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {teamsList.map(team => (
              <Card key={team.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{team.name}</h3>
                      <p className="text-sm text-gray-500">{team.description}</p>
                    </div>
                    <span className="text-xs text-gray-500">{team.executionCount} runs</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-4">
                    {team.agents.map(agentId => {
                      const agent = agents.find(a => a.id === agentId);
                      const Icon = agent ? iconMap[agent.icon] : Brain;
                      return (
                        <span 
                          key={agentId}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-800"
                        >
                          <Icon className="w-3 h-3" />
                          {agent?.name || agentId}
                        </span>
                      );
                    })}
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      const teamGoal = prompt('Enter goal for this team:');
                      if (teamGoal) {
                        executeTeamMutation.mutate({ teamId: team.id, teamGoal });
                      }
                    }}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Run Team
                  </Button>
                </CardContent>
              </Card>
            ))}
            {teamsList.length === 0 && (
              <Card className="col-span-2">
                <CardContent className="py-8 text-center text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No custom teams yet</p>
                  <p className="text-sm mt-2">Create a team for recurring multi-agent workflows</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Agent</CardTitle>
              <CardDescription>Choose which specialist to chat with</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {agents.map(agent => {
                  const Icon = iconMap[agent.icon] || Brain;
                  return (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setChatAgent(agent.id);
                        setChatHistory([]);
                        setChatSessionId(null);
                      }}
                      className={`w-full flex items-start gap-3 p-3 rounded-lg border transition ${
                        chatAgent === agent.id
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <div 
                        className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${agent.color}20` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: agent.color }} />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-sm">{agent.name}</p>
                        <p className="text-xs text-gray-500 line-clamp-2">{agent.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Chat Interface */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Chat with {agents.find(a => a.id === chatAgent)?.name || 'Agent'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col h-[400px]">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                  {chatHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Start a conversation with the agent</p>
                      <p className="text-sm mt-2">Ask questions about sales, research, or strategy</p>
                    </div>
                  ) : (
                    chatHistory.map((msg, i) => (
                      <div 
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] p-3 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-gray-100 dark:bg-gray-800'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                  {chatMutation.isPending && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="flex gap-2">
                  <Input
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type your message..."
                    onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                    disabled={chatMutation.isPending}
                  />
                  <Button 
                    onClick={handleSendChat}
                    disabled={chatMutation.isPending || !chatMessage.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {(executionHistory as any[] || []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No execution history yet</p>
              </CardContent>
            </Card>
          ) : (
            (executionHistory as any[]).map(exec => {
              const agent = agents.find(a => a.id === exec.agentType);
              const Icon = agent ? iconMap[agent.icon] : Brain;
              return (
                <Card key={exec.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <div 
                        className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: agent ? `${agent.color}20` : '#gray' }}
                      >
                        <Icon className="w-4 h-4" style={{ color: agent?.color || '#666' }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{agent?.name || exec.agentType}</span>
                          <span className="text-xs text-gray-500">{formatDate(exec.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{exec.task}</p>
                        {exec.result && (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-blue-600">View result</summary>
                            <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                              {typeof exec.result === 'string' 
                                ? exec.result.substring(0, 500) 
                                : JSON.stringify(exec.result, null, 2).substring(0, 500)}...
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
