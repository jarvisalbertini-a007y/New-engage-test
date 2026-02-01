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
  BarChart3,
  Terminal,
  Activity,
  StopCircle,
  RotateCcw,
  Loader2,
  CircleDot,
  PanelRightOpen,
  PanelRightClose,
  Users,
  Flame,
  FlaskConical,
  Award,
  Percent,
  ThumbsUp,
  ThumbsDown,
  Sliders,
  Trophy,
  BarChart2,
  PieChart,
  TrendingDown,
  Beaker
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  parsed?: {
    type: 'plan' | 'clarification' | 'execution' | 'suggestion' | 'response';
    message: string | { text?: string };
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
    clarifyingQuestions?: Array<string | { text?: string }>;
    suggestedActions?: Array<string | { label?: string; text?: string }>;
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
  const [showConsole, setShowConsole] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'activity' | 'history' | 'approvals' | 'settings'>('activity');
  const [consoleTab, setConsoleTab] = useState<'jobs' | 'teams' | 'scoring' | 'tests' | 'learn'>('jobs');
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [nlpCustomizeInput, setNlpCustomizeInput] = useState('');
  const [selectedTeamTemplate, setSelectedTeamTemplate] = useState<string>('');
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

  // Fetch autonomous jobs
  const { data: activeJobs, refetch: refetchJobs } = useQuery({
    queryKey: ['active-jobs'],
    queryFn: () => api.getJobs?.('running', undefined, 10) || Promise.resolve([]),
    refetchInterval: 3000 // Poll every 3 seconds for running jobs
  });

  // Fetch all recent jobs
  const { data: recentJobs } = useQuery({
    queryKey: ['recent-jobs'],
    queryFn: () => api.getJobs?.(undefined, undefined, 20) || Promise.resolve([])
  });

  // Fetch autonomy preferences
  const { data: autonomyPrefs, refetch: refetchAutonomy } = useQuery({
    queryKey: ['autonomy-preferences'],
    queryFn: () => api.getAutonomyPreferences?.() || Promise.resolve({})
  });

  // Fetch job analytics
  const { data: jobAnalytics } = useQuery({
    queryKey: ['job-analytics'],
    queryFn: () => api.getJobAnalytics?.() || Promise.resolve({})
  });

  // Fetch learning summary
  const { data: learningSummary } = useQuery({
    queryKey: ['learning-summary'],
    queryFn: () => api.getLearningSummary?.() || Promise.resolve({})
  });

  // Fetch learning history
  const { data: learningHistory } = useQuery({
    queryKey: ['learning-history'],
    queryFn: () => api.getLearningHistory?.() || Promise.resolve([])
  });

  // Fetch agent customization
  const { data: agentCustomization, refetch: refetchCustomization } = useQuery({
    queryKey: ['agent-customization'],
    queryFn: () => api.getAgentCustomization?.() || Promise.resolve({})
  });

  // ============== TEAMS QUERIES ==============
  const { data: teamTemplates } = useQuery({
    queryKey: ['team-templates'],
    queryFn: () => api.getTeamTemplates?.() || Promise.resolve([])
  });

  const { data: userTeams, refetch: refetchTeams } = useQuery({
    queryKey: ['user-teams'],
    queryFn: () => api.getTeams?.() || Promise.resolve([])
  });

  const { data: teamsAnalytics } = useQuery({
    queryKey: ['teams-analytics'],
    queryFn: () => api.getTeamsAnalytics?.() || Promise.resolve({})
  });

  // ============== LEAD SCORING QUERIES ==============
  const { data: scoreDistribution, refetch: refetchScoreDistribution } = useQuery({
    queryKey: ['score-distribution'],
    queryFn: () => api.getScoreDistribution?.() || Promise.resolve({})
  });

  const { data: topLeads } = useQuery({
    queryKey: ['top-leads'],
    queryFn: () => api.getTopLeads?.(5, 60) || Promise.resolve({})
  });

  const { data: scoringConfig, refetch: refetchScoringConfig } = useQuery({
    queryKey: ['scoring-config'],
    queryFn: () => api.getScoringConfig?.() || Promise.resolve({})
  });

  const { data: scoringRecommendations } = useQuery({
    queryKey: ['scoring-recommendations'],
    queryFn: () => api.getScoringRecommendations?.() || Promise.resolve({})
  });

  // ============== A/B TESTING QUERIES ==============
  const { data: abTests, refetch: refetchABTests } = useQuery({
    queryKey: ['ab-tests'],
    queryFn: () => api.getABTests?.(undefined, undefined, 10) || Promise.resolve([])
  });

  const { data: abTestAnalytics } = useQuery({
    queryKey: ['ab-test-analytics'],
    queryFn: () => api.getABTestingAnalytics?.() || Promise.resolve({})
  });

  const { data: abTestSuggestions } = useQuery({
    queryKey: ['ab-test-suggestions'],
    queryFn: () => api.suggestABTest?.({ goal: 'all' }) || Promise.resolve({})
  });

  // Job mutations
  const startJobMutation = useMutation({
    mutationFn: (jobId: string) => api.startJob?.(jobId) || Promise.resolve({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['recent-jobs'] });
    }
  });

  const pauseJobMutation = useMutation({
    mutationFn: (jobId: string) => api.pauseJob?.(jobId) || Promise.resolve({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['recent-jobs'] });
    }
  });

  const cancelJobMutation = useMutation({
    mutationFn: (jobId: string) => api.cancelJob?.(jobId) || Promise.resolve({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['recent-jobs'] });
    }
  });

  const updateAutonomyMutation = useMutation({
    mutationFn: (data: any) => api.updateAutonomyPreferences?.(data) || Promise.resolve({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomy-preferences'] });
    }
  });

  // Team mutations
  const createTeamMutation = useMutation({
    mutationFn: (data: any) => api.createTeam?.(data) || Promise.resolve({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-teams'] });
      queryClient.invalidateQueries({ queryKey: ['teams-analytics'] });
    }
  });

  const executeTeamMutation = useMutation({
    mutationFn: ({ teamId, task }: { teamId: string; task: string }) => 
      api.executeTeamParallel?.(teamId, { task }) || Promise.resolve({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-teams'] });
    }
  });

  // Scoring mutations
  const updateFactorWeightMutation = useMutation({
    mutationFn: ({ factor, weight }: { factor: string; weight: number }) => 
      api.updateFactorWeight?.(factor, weight) || Promise.resolve({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoring-config'] });
    }
  });

  const scoreProspectsMutation = useMutation({
    mutationFn: () => api.scoreProspectsBatch?.({}) || Promise.resolve({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['score-distribution'] });
      queryClient.invalidateQueries({ queryKey: ['top-leads'] });
    }
  });

  // A/B Test mutations
  const createABTestMutation = useMutation({
    mutationFn: (data: any) => api.quickCreateABTest?.(data) || Promise.resolve({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ab-tests'] });
      queryClient.invalidateQueries({ queryKey: ['ab-test-analytics'] });
    }
  });

  const startABTestMutation = useMutation({
    mutationFn: (testId: string) => api.startABTest?.(testId) || Promise.resolve({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ab-tests'] });
    }
  });

  const completeABTestMutation = useMutation({
    mutationFn: (testId: string) => api.completeABTest?.(testId) || Promise.resolve({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ab-tests'] });
      queryClient.invalidateQueries({ queryKey: ['ab-test-analytics'] });
    }
  });

  // NLP Customization mutation
  const nlpCustomizeMutation = useMutation({
    mutationFn: (data: { instruction: string; agentType?: string }) => 
      api.customizeAgentNLP?.(data) || Promise.resolve({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-customization'] });
      setNlpCustomizeInput('');
    }
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
          
          // Handle job updates
          if (data.type === 'job_update') {
            queryClient.invalidateQueries({ queryKey: ['active-jobs'] });
            queryClient.invalidateQueries({ queryKey: ['recent-jobs'] });
            
            // Add to activity feed
            setActivities(prev => [{
              type: data.data?.type || 'job_update',
              message: data.data?.message || 'Job updated',
              timestamp: data.timestamp || new Date().toISOString(),
              ...data.data
            }, ...prev].slice(0, 50));
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

  // Voice recording toggle
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      // Start real audio recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        
        mediaRecorder.onstop = async () => {
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
          
          // Create audio blob
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Convert to base64
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            
            setIsTranscribing(true);
            try {
              const result = await api.transcribeVoice?.({ audio: base64Audio });
              if (result?.success && result.transcription) {
                setInput(prev => (prev + ' ' + result.transcription).trim());
              } else if (result?.error) {
                console.error('Transcription error:', result.error);
              }
            } catch (err) {
              console.error('Voice transcription failed:', err);
            } finally {
              setIsTranscribing(false);
            }
          };
          reader.readAsDataURL(audioBlob);
        };
        
        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Microphone access denied:', err);
        alert('Please allow microphone access to use voice input');
      }
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
      {/* Main Chat Area */}
      <div className={`flex flex-col flex-1 transition-all duration-300 ${showSidebar ? 'mr-96' : ''} ${showConsole ? 'mr-80' : ''}`}>
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
            {/* Running Jobs Indicator */}
            {(activeJobs as any[])?.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 rounded-lg border border-emerald-400/30">
                <Activity className="w-4 h-4 text-emerald-300 animate-pulse" />
                <span className="text-sm text-emerald-100">{(activeJobs as any[]).length} jobs running</span>
              </div>
            )}
            {activities.length > 0 && activities[0].type?.includes('executing') && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/20 rounded-lg">
                <RefreshCw className="w-4 h-4 text-white animate-spin" />
                <span className="text-sm text-white">Agents working...</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConsole(!showConsole)}
              className="text-white hover:bg-white/20"
              title={showConsole ? "Hide Console" : "Show Console"}
            >
              {showConsole ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
            </Button>
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
                        : (typeof message.parsed.message === 'object' 
                            ? ((message.parsed.message as any)?.text || JSON.stringify(message.parsed.message))
                            : message.content)}
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

      {/* Agent Console Panel - Replit Style */}
      {showConsole && (
        <div className="fixed right-0 top-0 h-full w-80 border-l bg-gray-900 text-gray-100 flex flex-col z-40" data-testid="agent-console">
          {/* Console Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-sm">Agent Console</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => refetchJobs()}
                className="p-1.5 hover:bg-gray-700 rounded"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowConsole(false)}
                className="p-1.5 hover:bg-gray-700 rounded"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Console Tabs */}
          <div className="flex border-b border-gray-700 overflow-x-auto">
            {(['jobs', 'teams', 'scoring', 'tests', 'learn'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setConsoleTab(tab)}
                className={`flex-1 px-2 py-2 text-xs font-medium transition whitespace-nowrap ${
                  consoleTab === tab
                    ? 'text-emerald-400 border-b-2 border-emerald-400 bg-gray-800'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab === 'jobs' ? 'Jobs' : tab === 'teams' ? 'Teams' : tab === 'scoring' ? 'Score' : tab === 'tests' ? 'A/B' : 'Learn'}
              </button>
            ))}
          </div>

          {/* Console Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Jobs Tab */}
            {consoleTab === 'jobs' && (
              <div className="p-3 space-y-3">
                {/* Running Jobs */}
                {(activeJobs as any[])?.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                      <Activity className="w-3 h-3 animate-pulse" />
                      RUNNING ({(activeJobs as any[]).length})
                    </div>
                    {(activeJobs as any[]).map((job: any) => (
                      <div key={job.id} className="p-2.5 bg-gray-800 rounded-lg border border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-emerald-400 uppercase">
                            {job.jobType?.replace(/_/g, ' ')}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => pauseJobMutation.mutate(job.id)}
                              className="p-1 hover:bg-gray-700 rounded"
                              title="Pause"
                            >
                              <Pause className="w-3 h-3 text-yellow-400" />
                            </button>
                            <button
                              onClick={() => cancelJobMutation.mutate(job.id)}
                              className="p-1 hover:bg-gray-700 rounded"
                              title="Cancel"
                            >
                              <StopCircle className="w-3 h-3 text-red-400" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-300 mb-2 truncate">
                          {job.currentStep || job.config?.goal || 'Processing...'}
                        </p>
                        {job.progress !== undefined && (
                          <div className="space-y-1">
                            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${job.progress || 0}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500">{job.progress || 0}%</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Recent Jobs */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                    <History className="w-3 h-3" />
                    RECENT
                  </div>
                  {!recentJobs || (recentJobs as any[]).length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <Terminal className="w-6 h-6 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No jobs yet</p>
                      <p className="text-xs mt-1">Jobs will appear here</p>
                    </div>
                  ) : (
                    (recentJobs as any[]).slice(0, 10).map((job: any) => (
                      <div key={job.id} className="p-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {job.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                            {job.status === 'failed' && <XCircle className="w-3 h-3 text-red-400" />}
                            {job.status === 'running' && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
                            {job.status === 'pending' && <Clock className="w-3 h-3 text-yellow-400" />}
                            {job.status === 'paused' && <Pause className="w-3 h-3 text-yellow-400" />}
                            {job.status === 'cancelled' && <StopCircle className="w-3 h-3 text-gray-400" />}
                            <span className="text-xs font-medium">{job.jobType?.replace(/_/g, ' ')}</span>
                          </div>
                          {job.status === 'pending' && (
                            <button
                              onClick={() => startJobMutation.mutate(job.id)}
                              className="p-1 hover:bg-gray-700 rounded"
                              title="Start"
                            >
                              <Play className="w-3 h-3 text-emerald-400" />
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(job.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Autonomy Tab */}
            {consoleTab === 'autonomy' && (
              <div className="p-3 space-y-4">
                <div className="text-xs text-gray-400 mb-3">
                  Configure how autonomous agents work for you
                </div>
                
                {/* Default Autonomy Level */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-300">Default Level</label>
                  <select
                    className="w-full p-2 bg-gray-800 border border-gray-700 rounded text-xs"
                    value={(autonomyPrefs as any)?.default || 'approval'}
                    onChange={(e) => updateAutonomyMutation.mutate({ 
                      default: e.target.value,
                      preferences: (autonomyPrefs as any)?.preferences || {},
                      notifications: (autonomyPrefs as any)?.notifications || { inApp: true, email: false }
                    })}
                  >
                    <option value="full_auto">Full Auto - Execute immediately</option>
                    <option value="approval">Approval Required - Wait for confirmation</option>
                    <option value="notify">Notify Only - Execute & notify</option>
                    <option value="manual">Manual - Don't auto-execute</option>
                  </select>
                </div>

                {/* Per-Type Settings */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-300">Per Task Type</label>
                  {['research', 'outreach', 'follow_up', 'lead_monitor', 'data_enrich'].map((type) => (
                    <div key={type} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                      <span className="text-xs capitalize">{type.replace(/_/g, ' ')}</span>
                      <select
                        className="p-1 bg-gray-700 border-0 rounded text-xs"
                        value={(autonomyPrefs as any)?.preferences?.[type] || (autonomyPrefs as any)?.default || 'approval'}
                        onChange={(e) => updateAutonomyMutation.mutate({
                          default: (autonomyPrefs as any)?.default,
                          preferences: {
                            ...(autonomyPrefs as any)?.preferences,
                            [type]: e.target.value
                          },
                          notifications: (autonomyPrefs as any)?.notifications
                        })}
                      >
                        <option value="full_auto">Auto</option>
                        <option value="approval">Approval</option>
                        <option value="notify">Notify</option>
                        <option value="manual">Manual</option>
                      </select>
                    </div>
                  ))}
                </div>

                {/* Notifications */}
                <div className="space-y-2 pt-3 border-t border-gray-700">
                  <label className="text-xs font-medium text-gray-300">Notifications</label>
                  <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                    <span className="text-xs">In-App Notifications</span>
                    <input
                      type="checkbox"
                      checked={(autonomyPrefs as any)?.notifications?.inApp !== false}
                      onChange={(e) => updateAutonomyMutation.mutate({
                        ...(autonomyPrefs as any),
                        notifications: {
                          ...(autonomyPrefs as any)?.notifications,
                          inApp: e.target.checked
                        }
                      })}
                      className="rounded bg-gray-700 border-gray-600"
                    />
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                    <span className="text-xs">Email Notifications</span>
                    <input
                      type="checkbox"
                      checked={(autonomyPrefs as any)?.notifications?.email === true}
                      onChange={(e) => updateAutonomyMutation.mutate({
                        ...(autonomyPrefs as any),
                        notifications: {
                          ...(autonomyPrefs as any)?.notifications,
                          email: e.target.checked
                        }
                      })}
                      className="rounded bg-gray-700 border-gray-600"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Teams Tab */}
            {consoleTab === 'teams' && (
              <div className="p-3 space-y-4">
                {/* Quick Team Creation */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-300">Quick Create Team</label>
                  <select
                    value={selectedTeamTemplate}
                    onChange={(e) => setSelectedTeamTemplate(e.target.value)}
                    className="w-full p-2 text-xs bg-gray-800 border border-gray-700 rounded"
                  >
                    <option value="">Select a template...</option>
                    {(teamTemplates as any[])?.map((template: any) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (selectedTeamTemplate) {
                        createTeamMutation.mutate({ 
                          name: `My ${(teamTemplates as any[])?.find((t: any) => t.id === selectedTeamTemplate)?.name || 'Team'}`,
                          templateId: selectedTeamTemplate 
                        });
                        setSelectedTeamTemplate('');
                      }
                    }}
                    disabled={!selectedTeamTemplate || createTeamMutation.isPending}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-xs"
                  >
                    {createTeamMutation.isPending ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Creating...</>
                    ) : (
                      <><Users className="w-3 h-3 mr-1" /> Create Team</>
                    )}
                  </Button>
                </div>

                {/* Team Stats */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-700">
                  <div className="p-2 bg-gray-800 rounded-lg text-center">
                    <p className="text-lg font-bold text-emerald-400">{(teamsAnalytics as any)?.totalTeams || 0}</p>
                    <p className="text-xs text-gray-500">Teams</p>
                  </div>
                  <div className="p-2 bg-gray-800 rounded-lg text-center">
                    <p className="text-lg font-bold text-blue-400">{(teamsAnalytics as any)?.totalExecutions || 0}</p>
                    <p className="text-xs text-gray-500">Executions</p>
                  </div>
                </div>

                {/* User Teams */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-300">Your Teams</label>
                  {!(userTeams as any[])?.length ? (
                    <p className="text-xs text-gray-500 italic">No teams yet. Create one above!</p>
                  ) : (
                    (userTeams as any[])?.slice(0, 5).map((team: any) => (
                      <div key={team.id} className="p-2 bg-gray-800 rounded flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-gray-300">{team.name}</p>
                          <p className="text-xs text-gray-500">{team.agents?.length || 0} agents</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setInput(`Run ${team.name} team on my prospects`)}
                          className="text-xs text-emerald-400 hover:text-emerald-300"
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Scoring Tab */}
            {consoleTab === 'scoring' && (
              <div className="p-3 space-y-4">
                {/* Score Distribution */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-300">Lead Distribution</label>
                  <div className="grid grid-cols-4 gap-1">
                    <div className="p-2 bg-gradient-to-b from-red-500/20 to-transparent rounded text-center">
                      <Flame className="w-4 h-4 mx-auto text-red-400" />
                      <p className="text-sm font-bold text-red-400">{(scoreDistribution as any)?.distribution?.hot?.count || 0}</p>
                      <p className="text-xs text-gray-500">Hot</p>
                    </div>
                    <div className="p-2 bg-gradient-to-b from-orange-500/20 to-transparent rounded text-center">
                      <TrendingUp className="w-4 h-4 mx-auto text-orange-400" />
                      <p className="text-sm font-bold text-orange-400">{(scoreDistribution as any)?.distribution?.warm?.count || 0}</p>
                      <p className="text-xs text-gray-500">Warm</p>
                    </div>
                    <div className="p-2 bg-gradient-to-b from-yellow-500/20 to-transparent rounded text-center">
                      <Clock className="w-4 h-4 mx-auto text-yellow-400" />
                      <p className="text-sm font-bold text-yellow-400">{(scoreDistribution as any)?.distribution?.nurture?.count || 0}</p>
                      <p className="text-xs text-gray-500">Nurture</p>
                    </div>
                    <div className="p-2 bg-gradient-to-b from-blue-500/20 to-transparent rounded text-center">
                      <TrendingDown className="w-4 h-4 mx-auto text-blue-400" />
                      <p className="text-sm font-bold text-blue-400">{(scoreDistribution as any)?.distribution?.cold?.count || 0}</p>
                      <p className="text-xs text-gray-500">Cold</p>
                    </div>
                  </div>
                </div>

                {/* Quick Score All */}
                <Button
                  size="sm"
                  onClick={() => scoreProspectsMutation.mutate()}
                  disabled={scoreProspectsMutation.isPending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-xs"
                >
                  {scoreProspectsMutation.isPending ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Scoring...</>
                  ) : (
                    <><Target className="w-3 h-3 mr-1" /> Score All Unscored</>
                  )}
                </Button>

                {/* Top Hot Leads */}
                <div className="space-y-2 pt-3 border-t border-gray-700">
                  <label className="text-xs font-medium text-gray-300 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-red-400" /> Hot Leads
                  </label>
                  {!(topLeads as any)?.topLeads?.length ? (
                    <p className="text-xs text-gray-500 italic">No hot leads yet</p>
                  ) : (
                    (topLeads as any)?.topLeads?.slice(0, 4).map((lead: any) => (
                      <div key={lead.id} className="p-2 bg-gray-800 rounded flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-gray-300">{lead.firstName} {lead.lastName}</p>
                          <p className="text-xs text-gray-500">{lead.company}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-emerald-400">{lead.leadScore}</span>
                          <Award className="w-3 h-3 text-yellow-400" />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Factor Weights Quick Adjust */}
                <div className="space-y-2 pt-3 border-t border-gray-700">
                  <label className="text-xs font-medium text-gray-300 flex items-center gap-1">
                    <Sliders className="w-3 h-3" /> Factor Weights
                  </label>
                  {['engagement_score', 'industry_fit', 'job_title'].map((factor) => (
                    <div key={factor} className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 capitalize">{factor.replace(/_/g, ' ')}</span>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={(scoringConfig as any)?.factors?.[factor]?.weight || 20}
                        onChange={(e) => updateFactorWeightMutation.mutate({ factor, weight: parseInt(e.target.value) })}
                        className="w-20 h-1 accent-emerald-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* A/B Tests Tab */}
            {consoleTab === 'tests' && (
              <div className="p-3 space-y-4">
                {/* Test Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 bg-gray-800 rounded-lg text-center">
                    <p className="text-lg font-bold text-emerald-400">{(abTestAnalytics as any)?.totalTests || 0}</p>
                    <p className="text-xs text-gray-500">Tests</p>
                  </div>
                  <div className="p-2 bg-gray-800 rounded-lg text-center">
                    <p className="text-lg font-bold text-blue-400">{(abTestAnalytics as any)?.runningTests || 0}</p>
                    <p className="text-xs text-gray-500">Running</p>
                  </div>
                  <div className="p-2 bg-gray-800 rounded-lg text-center">
                    <p className="text-lg font-bold text-violet-400">{(abTestAnalytics as any)?.avgImprovement || 0}%</p>
                    <p className="text-xs text-gray-500">Avg Lift</p>
                  </div>
                </div>

                {/* Quick Create Test */}
                <div className="space-y-2 pt-3 border-t border-gray-700">
                  <label className="text-xs font-medium text-gray-300">Quick Start Test</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => createABTestMutation.mutate({ suggestionType: 'subject_line', autoApplyWinner: true })}
                      disabled={createABTestMutation.isPending}
                      className="text-xs bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      <Mail className="w-3 h-3 mr-1" />
                      Subject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => createABTestMutation.mutate({ suggestionType: 'send_time', autoApplyWinner: true })}
                      disabled={createABTestMutation.isPending}
                      className="text-xs bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      Timing
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => createABTestMutation.mutate({ suggestionType: 'cta', autoApplyWinner: true })}
                      disabled={createABTestMutation.isPending}
                      className="text-xs bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      <Target className="w-3 h-3 mr-1" />
                      CTA
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => createABTestMutation.mutate({ suggestionType: 'channel', autoApplyWinner: true })}
                      disabled={createABTestMutation.isPending}
                      className="text-xs bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      <GitBranch className="w-3 h-3 mr-1" />
                      Channel
                    </Button>
                  </div>
                </div>

                {/* Active Tests */}
                <div className="space-y-2 pt-3 border-t border-gray-700">
                  <label className="text-xs font-medium text-gray-300">Recent Tests</label>
                  {!(abTests as any[])?.length ? (
                    <p className="text-xs text-gray-500 italic">No tests yet</p>
                  ) : (
                    (abTests as any[])?.slice(0, 4).map((test: any) => (
                      <div key={test.id} className="p-2 bg-gray-800 rounded">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-gray-300 truncate">{test.name}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            test.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                            test.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {test.status}
                          </span>
                        </div>
                        {test.winner && (
                          <div className="flex items-center gap-1 text-xs">
                            <Trophy className="w-3 h-3 text-yellow-400" />
                            <span className="text-emerald-400">Winner: Variant {test.winner}</span>
                          </div>
                        )}
                        {test.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startABTestMutation.mutate(test.id)}
                            className="w-full mt-1 text-xs text-emerald-400"
                          >
                            <Play className="w-3 h-3 mr-1" /> Start
                          </Button>
                        )}
                        {test.status === 'running' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => completeABTestMutation.mutate(test.id)}
                            className="w-full mt-1 text-xs text-violet-400"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Learn Tab (Agent Learning & NLP Customization) */}
            {consoleTab === 'learn' && (
              <div className="p-3 space-y-4">
                {/* NLP Customization Input */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-300">Customize Agents with NLP</label>
                  <div className="space-y-2">
                    <textarea
                      value={nlpCustomizeInput}
                      onChange={(e) => setNlpCustomizeInput(e.target.value)}
                      placeholder="Tell agents how to behave...&#10;e.g., 'Make outreach more casual' or 'Be more thorough in research'"
                      className="w-full p-2 text-xs bg-gray-800 border border-gray-700 rounded resize-none h-16"
                    />
                    <Button
                      size="sm"
                      onClick={() => nlpCustomizeMutation.mutate({ instruction: nlpCustomizeInput })}
                      disabled={!nlpCustomizeInput.trim() || nlpCustomizeMutation.isPending}
                      className="w-full bg-violet-600 hover:bg-violet-700 text-xs"
                    >
                      {nlpCustomizeMutation.isPending ? (
                        <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Applying...</>
                      ) : (
                        <><Brain className="w-3 h-3 mr-1" /> Apply Changes</>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Learning Summary */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-700">
                  <div className="p-2 bg-gray-800 rounded-lg text-center">
                    <p className="text-lg font-bold text-emerald-400">{(learningSummary as any)?.total || 0}</p>
                    <p className="text-xs text-gray-500">Learnings</p>
                  </div>
                  <div className="p-2 bg-gray-800 rounded-lg text-center">
                    <p className="text-lg font-bold text-violet-400">{(abTestAnalytics as any)?.testsWithWinner || 0}</p>
                    <p className="text-xs text-gray-500">Test Wins</p>
                  </div>
                </div>

                {/* Current Agent Settings */}
                <div className="space-y-2 pt-3 border-t border-gray-700">
                  <label className="text-xs font-medium text-gray-300">Agent Settings</label>
                  {Object.entries((agentCustomization as any)?.agents || {}).slice(0, 3).map(([agent, settings]) => (
                    <div key={agent} className="p-2 bg-gray-800 rounded">
                      <p className="text-xs font-medium capitalize text-gray-300">{agent}</p>
                      <div className="mt-1 text-xs text-gray-500">
                        {Object.entries(settings as Record<string, any>).slice(0, 2).map(([key, value]) => (
                          <span key={key} className="mr-2">
                            {key}: <span className="text-emerald-400">{String(value)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Console Footer - Quick Actions */}
          <div className="p-3 border-t border-gray-700 bg-gray-800">
            <p className="text-xs text-gray-500 mb-2">Quick Start</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700"
                onClick={() => setInput('Find new prospects for my ICP')}
              >
                <Search className="w-3 h-3 mr-1" />
                Research
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs bg-transparent border-gray-600 text-gray-300 hover:bg-gray-700"
                onClick={() => setInput('Create follow-up emails for prospects not contacted in 3 days')}
              >
                <Mail className="w-3 h-3 mr-1" />
                Follow Up
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
