import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  Send, 
  Bot, 
  User, 
  CheckCircle2, 
  XCircle, 
  Play, 
  Pause,
  ChevronRight,
  ChevronLeft,
  Settings,
  History,
  Zap,
  Brain,
  Search,
  Mail,
  Target,
  TrendingUp,
  Lightbulb,
  BookOpen,
  GitBranch,
  RefreshCw,
  AlertCircle,
  Clock,
  Sparkles,
  Menu,
  Plus,
  Trash2,
  MessageSquare,
  Mic,
  MicOff,
  Upload,
  FileText,
  Bell,
  BarChart3
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parsed?: {
    type: 'plan' | 'clarification' | 'execution' | 'suggestion' | 'response';
    message: string;
    plan?: {
      summary: string;
      steps: Array<{
        id: string;
        agent: string;
        task: string;
        estimatedTime: string;
      }>;
      estimatedTotalTime: string;
      requiresApproval: boolean;
    };
    planId?: string;
    clarifyingQuestions?: string[];
    suggestedActions?: string[];
    agentActivity?: any[];
  };
  timestamp: string;
}

interface AgentActivity {
  type: string;
  planId?: string;
  stepId?: string;
  agent?: string;
  task?: string;
  progress?: number;
  message?: string;
  result?: any;
  timestamp: string;
}

const agentIcons: Record<string, any> = {
  orchestrator: Brain,
  research: Search,
  outreach: Mail,
  optimization: TrendingUp,
  intelligence: Lightbulb,
  knowledge: BookOpen,
  workflow: GitBranch,
  qualification: Target,
};

const agentColors: Record<string, string> = {
  orchestrator: '#EC4899',
  research: '#3B82F6',
  outreach: '#10B981',
  optimization: '#F59E0B',
  intelligence: '#8B5CF6',
  knowledge: '#06B6D4',
  workflow: '#F472B6',
  qualification: '#EF4444',
};

export default function AICommandCenter() {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(() => `session-${Date.now()}`);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'activity' | 'history' | 'approvals' | 'settings'>('activity');
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch available agents
  const { data: agents } = useQuery({
    queryKey: ['ai-agents'],
    queryFn: () => api.getAIAgents?.() || Promise.resolve([])
  });

  // Fetch pending plans
  const { data: pendingPlans } = useQuery({
    queryKey: ['pending-plans'],
    queryFn: () => api.getPendingPlans?.() || Promise.resolve([])
  });

  // Fetch unified approvals (plans, workflows, emails)
  const { data: unifiedApprovals, refetch: refetchApprovals } = useQuery({
    queryKey: ['unified-approvals'],
    queryFn: () => api.getUnifiedApprovals?.() || Promise.resolve([])
  });

  // Fetch conversation history
  const { data: conversationHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['conversation-history'],
    queryFn: () => api.listConversationSessions?.(20) || Promise.resolve([])
  });

  // Fetch AI stats
  const { data: aiStats } = useQuery({
    queryKey: ['ai-stats'],
    queryFn: () => api.getAIStats?.() || Promise.resolve({})
  });

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Decode user ID from token (simple JWT decode)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userId = payload.sub;
      
      const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ai/ws/${userId}`;
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'activity') {
            setActivities(prev => [data.data, ...prev].slice(0, 50));
            
            // If it's a plan completion, invalidate queries
            if (data.data.type === 'plan_completed') {
              queryClient.invalidateQueries({ queryKey: ['pending-plans'] });
            }
          }
        } catch (e) {
          console.error('WS message parse error:', e);
        }
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
      };
      
      wsRef.current = ws;
      
      // Keep-alive ping
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 30000);
      
      return () => {
        clearInterval(pingInterval);
        ws.close();
      };
    } catch (e) {
      console.error('WebSocket setup error:', e);
    }
  }, [queryClient]);

  // Initialize with welcome message
  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: '',
      parsed: {
        type: 'response',
        message: `Welcome to SalesFlow AI! I'm your autonomous sales assistant.

Just tell me what you want to accomplish in plain English:
• "Find 50 VPs of Sales at Series B fintech companies"
• "Research Acme Corp before my call tomorrow"
• "Create an outreach sequence for CFOs in healthcare"
• "Analyze why my open rates dropped last week"

I'll create a plan, show you what I'm going to do, and wait for your approval before executing. What would you like to accomplish today?`,
        suggestedActions: [
          'Find new prospects',
          'Research a company',
          'Create outreach sequence',
          'Analyze my performance'
        ]
      },
      timestamp: new Date().toISOString()
    }]);
  }, []);

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: (data: { message?: string; approvePlanId?: string; rejectPlanId?: string }) => 
      api.aiChat?.({ ...data, sessionId }) || Promise.resolve({ response: { message: 'AI not available' } }),
    onSuccess: (data) => {
      if (data.response) {
        setMessages(prev => [...prev, {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.response.message || '',
          parsed: data.response,
          timestamp: new Date().toISOString()
        }]);
      }
      queryClient.invalidateQueries({ queryKey: ['pending-plans'] });
      refetchHistory();
    }
  });

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: (id: string) => api.deleteSession?.(id) || Promise.resolve(),
    onSuccess: () => refetchHistory()
  });

  // Load session mutation
  const loadSessionMutation = useMutation({
    mutationFn: (id: string) => api.getSessionMessages?.(id) || Promise.resolve({ messages: [] }),
    onSuccess: (data: any) => {
      if (data.messages) {
        setSessionId(data.sessionId);
        setMessages(data.messages.map((m: any, i: number) => ({
          id: `loaded-${i}`,
          role: m.role,
          content: m.content,
          parsed: m.parsed,
          timestamp: m.timestamp
        })));
      }
    }
  });

  // Unified approval mutation
  const approvalMutation = useMutation({
    mutationFn: ({ itemId, type, action }: { itemId: string; type: string; action: string }) =>
      api.approveUnifiedItem?.(itemId, { type, action }) || Promise.resolve(),
    onSuccess: () => {
      refetchApprovals();
      queryClient.invalidateQueries({ queryKey: ['pending-plans'] });
    }
  });

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: (data: { content: string; filename: string; name: string; category: string }) =>
      api.uploadKnowledgeDocument?.(data) || Promise.resolve({ success: false }),
    onSuccess: (data: any) => {
      if (data.success) {
        setMessages(prev => [...prev, {
          id: `system-${Date.now()}`,
          role: 'assistant',
          content: '',
          parsed: {
            type: 'response',
            message: `Document "${data.name}" has been added to the knowledge base. ${data.extractedData?.summary ? `\n\nSummary: ${data.extractedData.summary}` : ''}`,
            suggestedActions: ['Ask about this document', 'Upload another']
          },
          timestamp: new Date().toISOString()
        }]);
      }
      setShowUpload(false);
    }
  });

  // Handle file selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      uploadMutation.mutate({
        content,
        filename: file.name,
        name: file.name,
        category: 'general'
      });
    };
    reader.readAsText(file);
  };

  // Voice recording toggle (placeholder)
  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      // In production, stop recording and transcribe
    } else {
      setIsRecording(true);
      // In production, start recording
      // For now, show a message
      setTimeout(() => {
        setIsRecording(false);
        setInput(input + " [Voice input requires speech-to-text integration]");
      }, 2000);
    }
  };

  // Create new session
  const startNewSession = () => {
    const newId = `session-${Date.now()}`;
    setSessionId(newId);
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: '',
      parsed: {
        type: 'response',
        message: `Starting a new conversation. What would you like to accomplish?`,
        suggestedActions: [
          'Find new prospects',
          'Research a company',
          'Create outreach sequence',
          'Analyze my performance'
        ]
      },
      timestamp: new Date().toISOString()
    }]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    // Add user message
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    }]);

    chatMutation.mutate({ message: input });
    setInput('');
  };

  const handleSuggestionClick = (action: string) => {
    setInput(action);
  };

  const handleApprovePlan = (planId: string) => {
    chatMutation.mutate({ approvePlanId: planId });
  };

  const handleRejectPlan = (planId: string) => {
    chatMutation.mutate({ rejectPlanId: planId });
  };

  const formatTimestamp = (ts: string) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getAgentIcon = (agentId: string) => {
    const Icon = agentIcons[agentId] || Bot;
    return Icon;
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900" data-testid="ai-command-center">
      {/* Main Chat Area - Full Screen by Default */}
      <div className={`flex flex-col flex-1 transition-all duration-300 ${showSidebar ? 'mr-96' : ''}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-violet-600 to-indigo-600">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">SalesFlow AI</h1>
              <p className="text-sm text-violet-100">Your autonomous sales assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activities.length > 0 && activities[0].type?.includes('executing') && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/20 rounded-lg">
                <RefreshCw className="w-4 h-4 text-white animate-spin" />
                <span className="text-sm text-white">Agents working...</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-white hover:bg-white/20"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] ${
                  message.role === 'user'
                    ? 'bg-violet-600 text-white rounded-2xl rounded-br-md px-5 py-3'
                    : 'bg-white dark:bg-gray-800 rounded-2xl rounded-bl-md px-5 py-4 shadow-sm border'
                }`}
              >
                {message.role === 'assistant' && message.parsed ? (
                  <div className="space-y-4">
                    {/* Message Text */}
                    <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                      {typeof message.parsed.message === 'string' 
                        ? message.parsed.message 
                        : (message.parsed.message?.text || message.content || JSON.stringify(message.parsed.message))}
                    </p>

                    {/* Plan Display */}
                    {message.parsed.type === 'plan' && message.parsed.plan && (
                      <div className="mt-4 p-4 bg-violet-50 dark:bg-violet-900/20 rounded-xl border border-violet-200 dark:border-violet-800">
                        <div className="flex items-center gap-2 mb-3">
                          <Zap className="w-5 h-5 text-violet-600" />
                          <span className="font-semibold text-violet-900 dark:text-violet-100">
                            Proposed Plan
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                          {message.parsed.plan.summary}
                        </p>
                        
                        {/* Steps */}
                        <div className="space-y-2 mb-4">
                          {message.parsed.plan.steps.map((step, idx) => {
                            const AgentIcon = getAgentIcon(step.agent);
                            return (
                              <div key={step.id || idx} className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded-lg">
                                <div 
                                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                                  style={{ backgroundColor: `${agentColors[step.agent] || '#6366F1'}20` }}
                                >
                                  <AgentIcon 
                                    className="w-4 h-4" 
                                    style={{ color: agentColors[step.agent] || '#6366F1' }} 
                                  />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium capitalize">{step.agent} Agent</p>
                                  <p className="text-xs text-gray-500">{step.task}</p>
                                </div>
                                <span className="text-xs text-gray-400">{step.estimatedTime}</span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-violet-200 dark:border-violet-700">
                          <span className="text-sm text-gray-500">
                            Estimated time: {message.parsed.plan.estimatedTotalTime}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => message.parsed?.planId && handleRejectPlan(message.parsed.planId)}
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => message.parsed?.planId && handleApprovePlan(message.parsed.planId)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Approve & Execute
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Clarifying Questions */}
                    {message.parsed.clarifyingQuestions && message.parsed.clarifyingQuestions.length > 0 && (
                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                          Before I proceed, I have a few questions:
                        </p>
                        <ul className="space-y-1">
                          {message.parsed.clarifyingQuestions.map((q: any, i: number) => (
                            <li key={i} className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                              <span className="text-amber-500">{i + 1}.</span>
                              {typeof q === 'string' ? q : (q?.text || JSON.stringify(q))}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Suggested Actions */}
                    {message.parsed.suggestedActions && message.parsed.suggestedActions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {message.parsed.suggestedActions.map((action: any, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => handleSuggestionClick(typeof action === 'string' ? action : (action?.label || action?.text || ''))}
                            className="px-3 py-1.5 text-sm bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
                          >
                            {typeof action === 'string' ? action : (action?.label || action?.text || JSON.stringify(action))}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}

                <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-violet-200' : 'text-gray-400'}`}>
                  {formatTimestamp(message.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-bl-md px-5 py-4 shadow-sm border">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                  <span className="text-sm text-gray-500">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t bg-white dark:bg-gray-800">
          {/* Upload area */}
          {showUpload && (
            <div className="mb-4 p-4 border-2 border-dashed border-violet-300 rounded-lg bg-violet-50 dark:bg-violet-900/10">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".txt,.md,.json,.csv,.pdf"
                className="hidden"
              />
              <div className="text-center">
                <FileText className="w-8 h-8 mx-auto mb-2 text-violet-500" />
                <p className="text-sm font-medium text-violet-700 dark:text-violet-300">
                  Drop a file or click to upload
                </p>
                <p className="text-xs text-violet-500 mt-1">
                  Supports: .txt, .md, .json, .csv
                </p>
                <div className="flex gap-2 justify-center mt-3">
                  <Button
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? 'Uploading...' : 'Choose File'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowUpload(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="flex gap-2">
            {/* Voice button */}
            <Button
              type="button"
              variant="outline"
              onClick={toggleRecording}
              className={`h-12 w-12 ${isRecording ? 'bg-red-100 border-red-300 text-red-500' : ''}`}
              title={isRecording ? "Stop recording" : "Voice input"}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
            
            {/* Upload button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowUpload(!showUpload)}
              className="h-12 w-12"
              title="Upload document"
            >
              <Upload className="w-5 h-5" />
            </Button>
            
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell me what you want to accomplish..."
              className="flex-1 h-12 text-base"
              disabled={chatMutation.isPending}
            />
            <Button
              type="submit"
              disabled={!input.trim() || chatMutation.isPending}
              className="h-12 px-6 bg-violet-600 hover:bg-violet-700"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              <span>AI will create a plan and ask for your approval before executing</span>
            </div>
            {aiStats && (
              <div className="flex items-center gap-3">
                <span>{(aiStats as any).completedPlans || 0} plans completed</span>
                <span>{(aiStats as any).knowledgeDocuments || 0} docs</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar - Split Screen */}
      {showSidebar && (
        <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-800 border-l shadow-xl z-50">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex gap-1 overflow-x-auto">
              {[
                { id: 'activity', label: 'Activity', icon: Zap },
                { id: 'approvals', label: 'Approvals', icon: Bell, count: (unifiedApprovals as any[] || []).length },
                { id: 'history', label: 'History', icon: History },
                { id: 'settings', label: 'Settings', icon: Settings },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSidebarTab(tab.id as any)}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition whitespace-nowrap ${
                    sidebarTab === tab.id
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-red-500 text-white">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowSidebar(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="h-[calc(100%-64px)] overflow-y-auto">
            {sidebarTab === 'activity' && (
              <div className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-500 uppercase">Live Agent Activity</h3>
                {activities.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recent activity</p>
                    <p className="text-xs mt-1">Agent activity will appear here</p>
                  </div>
                ) : (
                  activities.map((activity, idx) => {
                    const AgentIcon = activity.agent ? getAgentIcon(activity.agent) : Zap;
                    return (
                      <div key={idx} className="p-3 rounded-lg border bg-gray-50 dark:bg-gray-700/50">
                        <div className="flex items-start gap-3">
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: activity.agent ? `${agentColors[activity.agent]}20` : '#6366F120' }}
                          >
                            <AgentIcon 
                              className="w-4 h-4" 
                              style={{ color: activity.agent ? agentColors[activity.agent] : '#6366F1' }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              {activity.message || activity.type?.replace(/_/g, ' ')}
                            </p>
                            {activity.task && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{activity.task}</p>
                            )}
                            {activity.progress !== undefined && (
                              <div className="mt-2">
                                <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-violet-500 rounded-full transition-all"
                                    style={{ width: `${activity.progress}%` }}
                                  />
                                </div>
                                <p className="text-xs text-gray-400 mt-1">{activity.progress.toFixed(0)}% complete</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">{formatTimestamp(activity.timestamp)}</p>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {sidebarTab === 'approvals' && (
              <div className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-500 uppercase">Pending Approvals</h3>
                
                {!unifiedApprovals || (unifiedApprovals as any[]).length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No pending approvals</p>
                    <p className="text-xs mt-1">All caught up!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(unifiedApprovals as any[]).map((item: any) => (
                      <div key={item.id} className="p-3 rounded-lg border bg-gray-50 dark:bg-gray-700/50">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              item.type === 'plan' ? 'bg-violet-100 text-violet-700' :
                              item.type === 'email' ? 'bg-green-100 text-green-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {item.type}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {item.createdAt ? formatTimestamp(item.createdAt) : ''}
                          </span>
                        </div>
                        <p className="text-sm font-medium mb-1">{item.title}</p>
                        <p className="text-xs text-gray-500 mb-3">{item.description}</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => approvalMutation.mutate({ itemId: item.id, type: item.type, action: 'approve' })}
                            disabled={approvalMutation.isPending}
                            className="flex-1 bg-green-600 hover:bg-green-700 h-8"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approvalMutation.mutate({ itemId: item.id, type: item.type, action: 'reject' })}
                            disabled={approvalMutation.isPending}
                            className="flex-1 text-red-600 border-red-200 hover:bg-red-50 h-8"
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {sidebarTab === 'history' && (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase">Conversation History</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={startNewSession}
                    className="h-8"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    New
                  </Button>
                </div>
                
                {!conversationHistory || (conversationHistory as any[]).length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No conversations yet</p>
                    <p className="text-xs mt-1">Start chatting to create history</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(conversationHistory as any[]).map((session: any) => (
                      <div 
                        key={session.id}
                        className={`p-3 rounded-lg border cursor-pointer transition ${
                          sessionId === session.id 
                            ? 'bg-violet-50 border-violet-200 dark:bg-violet-900/20 dark:border-violet-800' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => loadSessionMutation.mutate(session.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{session.title || 'Untitled'}</p>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{session.preview || 'No preview'}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Delete this conversation?')) {
                                deleteSessionMutation.mutate(session.id);
                              }
                            }}
                            className="p-1 ml-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <MessageSquare className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-400">{session.messageCount || 0} messages</span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-400">
                            {session.updatedAt ? new Date(session.updatedAt).toLocaleDateString() : 'Unknown'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {sidebarTab === 'settings' && (
              <div className="p-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase">Quick Settings</h3>
                
                <div className="space-y-3">
                  <div className="p-3 rounded-lg border">
                    <p className="text-sm font-medium">Auto-approve low-risk actions</p>
                    <p className="text-xs text-gray-500 mt-1">Skip approval for simple tasks</p>
                  </div>
                  
                  <div className="p-3 rounded-lg border">
                    <p className="text-sm font-medium">Notification preferences</p>
                    <p className="text-xs text-gray-500 mt-1">Configure how you receive updates</p>
                  </div>
                  
                  <div className="p-3 rounded-lg border">
                    <p className="text-sm font-medium">Agent preferences</p>
                    <p className="text-xs text-gray-500 mt-1">Customize agent behavior</p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold text-gray-500 mb-3">Available Agents</h4>
                  <div className="space-y-2">
                    {Object.entries(agentIcons).map(([id, Icon]) => (
                      <div key={id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${agentColors[id]}20` }}
                        >
                          <Icon className="w-4 h-4" style={{ color: agentColors[id] }} />
                        </div>
                        <span className="text-sm capitalize">{id} Agent</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
