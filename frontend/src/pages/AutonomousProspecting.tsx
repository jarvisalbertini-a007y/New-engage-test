import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { 
  Brain, 
  Play, 
  Square, 
  Target, 
  Search, 
  Mail, 
  BookOpen,
  Zap,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  Lightbulb,
  Users,
  Building2,
  ChevronRight
} from 'lucide-react';

interface AutonomousSession {
  id: string;
  status: string;
  config: {
    prospectsPerCycle: number;
    learningEnabled: boolean;
    autoApprove: boolean;
    maxCyclesPerDay: number;
  };
  stats: {
    cyclesCompleted: number;
    prospectsFound: number;
    companiesResearched: number;
    emailsDrafted: number;
    techniquesLearned: number;
  };
  currentPhase: string;
  startedAt: string;
  lastActivityAt: string;
}

interface Activity {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

interface Learning {
  id: string;
  loopType: string;
  learnings: any;
  effectiveness: number;
  createdAt: string;
}

interface CompetitorSource {
  id: string;
  name: string;
  domain: string;
  type: string;
  learn_topics: string[];
}

const phaseIcons: Record<string, any> = {
  learning: BookOpen,
  discovery: Search,
  research: Building2,
  outreach: Mail,
  complete: CheckCircle2,
  initializing: RefreshCw
};

const phaseColors: Record<string, string> = {
  learning: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  discovery: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  research: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  outreach: 'bg-green-500/20 text-green-400 border-green-500/30',
  complete: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  initializing: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
};

export default function AutonomousProspecting() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState({
    prospectsPerCycle: 10,
    learningEnabled: true,
    autoApprove: false,
    maxCyclesPerDay: 5
  });

  // Fetch autonomous status
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['autonomous-status'],
    queryFn: api.getAutonomousProspectingStatus,
    refetchInterval: 5000 // Poll every 5 seconds when running
  });

  // Fetch competitor sources
  const { data: sources } = useQuery({
    queryKey: ['competitor-sources'],
    queryFn: api.getCompetitorSources
  });

  // Fetch learnings
  const { data: learnings } = useQuery({
    queryKey: ['autonomous-learnings'],
    queryFn: () => api.getLearnings(10)
  });

  const session = statusData?.activeSession as AutonomousSession | null;
  const activities = (statusData?.recentActivity || []) as Activity[];
  const isRunning = statusData?.isRunning || false;

  // Start mutation
  const startMutation = useMutation({
    mutationFn: () => api.startAutonomousProspecting(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-status'] });
    }
  });

  // Stop mutation
  const stopMutation = useMutation({
    mutationFn: api.stopAutonomousProspecting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-status'] });
    }
  });

  // Individual loop mutations
  const discoveryMutation = useMutation({
    mutationFn: (params: { count?: number }) => api.runDiscoveryLoop(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-status'] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    }
  });

  const researchMutation = useMutation({
    mutationFn: (params: { count?: number }) => api.runResearchLoop(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-status'] });
    }
  });

  const outreachMutation = useMutation({
    mutationFn: (params: { count?: number }) => api.runOutreachLoop(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-status'] });
    }
  });

  const learningMutation = useMutation({
    mutationFn: () => api.runLearningLoop({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-status'] });
      queryClient.invalidateQueries({ queryKey: ['autonomous-learnings'] });
    }
  });

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="autonomous-prospecting-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-500" />
            Autonomous Prospecting
          </h1>
          <p className="text-gray-400 mt-1">
            Meta-Cognitive AI Engine: DECOMPOSE → SOLVE → VERIFY → SYNTHESIZE → REFLECT
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isRunning ? (
            <Button 
              variant="destructive" 
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              data-testid="stop-autonomous-btn"
            >
              <Square className="w-4 h-4 mr-2" />
              {stopMutation.isPending ? 'Stopping...' : 'Stop Engine'}
            </Button>
          ) : (
            <Button 
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              data-testid="start-autonomous-btn"
            >
              <Play className="w-4 h-4 mr-2" />
              {startMutation.isPending ? 'Starting...' : 'Start Engine'}
            </Button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      {isRunning && session && (
        <Card className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-purple-500/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping" />
                </div>
                <div>
                  <p className="font-semibold">Engine Running</p>
                  <p className="text-sm text-gray-400">
                    Started {formatTime(session.startedAt)} • Last activity {formatTime(session.lastActivityAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <Badge className={phaseColors[session.currentPhase] || phaseColors.initializing}>
                  {(() => {
                    const Icon = phaseIcons[session.currentPhase] || RefreshCw;
                    return <Icon className="w-3 h-3 mr-1" />;
                  })()}
                  {session.currentPhase}
                </Badge>
                <div className="text-right">
                  <p className="text-2xl font-bold">{session.stats.cyclesCompleted}</p>
                  <p className="text-xs text-gray-400">Cycles</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Users className="w-8 h-8 text-blue-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{session?.stats.prospectsFound || 0}</p>
                <p className="text-xs text-gray-400">Prospects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Building2 className="w-8 h-8 text-amber-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{session?.stats.companiesResearched || 0}</p>
                <p className="text-xs text-gray-400">Researched</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Mail className="w-8 h-8 text-green-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{session?.stats.emailsDrafted || 0}</p>
                <p className="text-xs text-gray-400">Drafts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Lightbulb className="w-8 h-8 text-purple-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{session?.stats.techniquesLearned || 0}</p>
                <p className="text-xs text-gray-400">Techniques</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <TrendingUp className="w-8 h-8 text-emerald-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{session?.stats.cyclesCompleted || 0}</p>
                <p className="text-xs text-gray-400">Cycles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Engine Configuration
            </CardTitle>
            <CardDescription>Configure autonomous behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Prospects per Cycle</label>
              <Input
                type="number"
                value={config.prospectsPerCycle}
                onChange={(e) => setConfig(c => ({ ...c, prospectsPerCycle: parseInt(e.target.value) || 10 }))}
                min={5}
                max={50}
                step={5}
                disabled={isRunning}
                className="bg-gray-800 border-gray-700"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Max Cycles per Day</label>
              <Input
                type="number"
                value={config.maxCyclesPerDay}
                onChange={(e) => setConfig(c => ({ ...c, maxCyclesPerDay: parseInt(e.target.value) || 5 }))}
                min={1}
                max={20}
                step={1}
                disabled={isRunning}
                className="bg-gray-800 border-gray-700"
              />
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">Continuous Learning</p>
                <p className="text-sm text-gray-400">Learn from competitor platforms</p>
              </div>
              <input
                type="checkbox"
                checked={config.learningEnabled}
                onChange={(e) => setConfig(c => ({ ...c, learningEnabled: e.target.checked }))}
                disabled={isRunning}
                className="w-5 h-5 rounded bg-gray-800 border-gray-600"
              />
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">Auto-Approve Emails</p>
                <p className="text-sm text-gray-400">Send without manual review</p>
              </div>
              <input
                type="checkbox"
                checked={config.autoApprove}
                onChange={(e) => setConfig(c => ({ ...c, autoApprove: e.target.checked }))}
                disabled={isRunning}
                className="w-5 h-5 rounded bg-gray-800 border-gray-600"
              />
            </div>
          </CardContent>
        </Card>

        {/* Manual Loop Controls */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              Manual Loop Control
            </CardTitle>
            <CardDescription>Run individual automation loops</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              className="w-full justify-between bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30"
              onClick={() => discoveryMutation.mutate({ count: 10 })}
              disabled={discoveryMutation.isPending || isRunning}
              data-testid="discovery-loop-btn"
            >
              <span className="flex items-center gap-2">
                <Search className="w-4 h-4" />
                Discovery Loop
              </span>
              {discoveryMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
            
            <Button 
              className="w-full justify-between bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30"
              onClick={() => researchMutation.mutate({ count: 5 })}
              disabled={researchMutation.isPending || isRunning}
              data-testid="research-loop-btn"
            >
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Research Loop
              </span>
              {researchMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
            
            <Button 
              className="w-full justify-between bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30"
              onClick={() => outreachMutation.mutate({ count: 5 })}
              disabled={outreachMutation.isPending || isRunning}
              data-testid="outreach-loop-btn"
            >
              <span className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Outreach Loop
              </span>
              {outreachMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
            
            <Button 
              className="w-full justify-between bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30"
              onClick={() => learningMutation.mutate()}
              disabled={learningMutation.isPending || isRunning}
              data-testid="learning-loop-btn"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Learning Loop
              </span>
              {learningMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Activity Feed */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400" />
              Activity Feed
            </CardTitle>
            <CardDescription>Recent autonomous actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {activities.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No activity yet</p>
              ) : (
                activities.map((activity) => (
                  <div 
                    key={activity.id}
                    className="flex items-start gap-3 p-2 rounded bg-gray-800/50"
                  >
                    {activity.type === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    ) : activity.type === 'cycle_complete' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    ) : (
                      <Zap className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{activity.message}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(activity.createdAt)} {formatTime(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Learning Sources & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Competitor Sources */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-500" />
              Learning Sources
            </CardTitle>
            <CardDescription>Competitor platforms for continuous learning</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {(sources as CompetitorSource[] || []).map((source) => (
                <div 
                  key={source.id}
                  className="p-3 rounded-lg bg-gray-800/50 border border-gray-700"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                      <span className="text-xs font-bold">{source.name[0]}</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{source.name}</p>
                      <p className="text-xs text-gray-500">{source.domain}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {source.learn_topics.slice(0, 2).map((topic, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {topic.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Learnings */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              Recent Learnings
            </CardTitle>
            <CardDescription>Insights from autonomous learning</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {(learnings as Learning[] || []).length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No learnings yet. Run a learning loop to get started.
                </p>
              ) : (
                (learnings as Learning[]).map((learning) => (
                  <div 
                    key={learning.id}
                    className="p-3 rounded-lg bg-gray-800/50 border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">
                        {learning.loopType}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {formatDate(learning.createdAt)}
                      </span>
                    </div>
                    {learning.learnings?.recommendations && (
                      <ul className="text-sm space-y-1">
                        {(learning.learnings.recommendations.immediate_actions || []).slice(0, 2).map((action: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-gray-400">
                            <CheckCircle2 className="w-3 h-3 text-green-500 mt-1 flex-shrink-0" />
                            <span className="text-xs">{action}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {learning.effectiveness > 0 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full"
                            style={{ width: `${learning.effectiveness}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{learning.effectiveness}%</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
