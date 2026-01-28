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
  ChevronRight,
  Calendar,
  Trash2,
  Send,
  Edit,
  X,
  History,
  Plus
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

interface ScheduledRun {
  id: string;
  name: string;
  scheduleType: string;
  runTime: string;
  daysOfWeek: number[];
  status: string;
  nextRunAt: string;
  lastRunAt: string | null;
  totalRuns: number;
  totalProspectsFound: number;
}

interface EmailDraft {
  id: string;
  subject: string;
  body: string;
  qualityScore: number;
  status: string;
  createdAt: string;
  prospect?: {
    firstName: string;
    lastName: string;
    email: string;
    company: string;
    title: string;
  };
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

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AutonomousProspecting() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'engine' | 'schedule' | 'approvals' | 'history'>('engine');
  const [config, setConfig] = useState({
    prospectsPerCycle: 10,
    learningEnabled: true,
    autoApprove: false,
    maxCyclesPerDay: 5
  });
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    name: 'Morning Prospecting',
    scheduleType: 'daily',
    runTime: '09:00',
    daysOfWeek: [0, 1, 2, 3, 4]
  });
  const [selectedDraft, setSelectedDraft] = useState<EmailDraft | null>(null);

  // Queries
  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['autonomous-status'],
    queryFn: api.getAutonomousProspectingStatus,
    refetchInterval: 5000
  });

  const { data: sources } = useQuery({
    queryKey: ['competitor-sources'],
    queryFn: api.getCompetitorSources
  });

  const { data: learnings } = useQuery({
    queryKey: ['autonomous-learnings'],
    queryFn: () => api.getLearnings(10)
  });

  const { data: schedules } = useQuery({
    queryKey: ['scheduled-runs'],
    queryFn: api.getScheduledRuns
  });

  const { data: pendingApprovals } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: api.getPendingApprovals
  });

  const { data: runHistory } = useQuery({
    queryKey: ['run-history'],
    queryFn: () => api.getRunHistory(20)
  });

  const session = statusData?.activeSession as AutonomousSession | null;
  const activities = (statusData?.recentActivity || []) as Activity[];
  const isRunning = statusData?.isRunning || false;

  // Mutations
  const startMutation = useMutation({
    mutationFn: () => api.startAutonomousProspecting(config),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['autonomous-status'] })
  });

  const stopMutation = useMutation({
    mutationFn: api.stopAutonomousProspecting,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['autonomous-status'] })
  });

  const discoveryMutation = useMutation({
    mutationFn: (params: { count?: number }) => api.runDiscoveryLoop(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-status'] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    }
  });

  const researchMutation = useMutation({
    mutationFn: (params: { count?: number }) => api.runResearchLoop(params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['autonomous-status'] })
  });

  const outreachMutation = useMutation({
    mutationFn: (params: { count?: number }) => api.runOutreachLoop(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-status'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    }
  });

  const learningMutation = useMutation({
    mutationFn: () => api.runLearningLoop({}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-status'] });
      queryClient.invalidateQueries({ queryKey: ['autonomous-learnings'] });
    }
  });

  const createScheduleMutation = useMutation({
    mutationFn: (data: any) => api.createScheduledRun(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-runs'] });
      setShowScheduleForm(false);
    }
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (id: string) => api.deleteScheduledRun(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduled-runs'] })
  });

  const runNowMutation = useMutation({
    mutationFn: (id: string) => api.runScheduleNow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autonomous-status'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-runs'] });
    }
  });

  const approveMutation = useMutation({
    mutationFn: ({ draftId, action }: { draftId: string; action: string }) => 
      api.approveEmailDraft(draftId, { action }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pending-approvals'] })
  });

  const sendEmailMutation = useMutation({
    mutationFn: ({ draftId, provider }: { draftId: string; provider: string }) =>
      api.sendApprovedEmail(draftId, { provider }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pending-approvals'] })
  });

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString([], { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="autonomous-prospecting-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-500" />
            Autonomous Prospecting
          </h1>
          <p className="text-gray-500 mt-1">
            Meta-Cognitive AI: DECOMPOSE → SOLVE → VERIFY → SYNTHESIZE → REFLECT
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
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                </div>
                <div>
                  <p className="font-semibold">Engine Running</p>
                  <p className="text-sm text-gray-500">
                    Started {formatTime(session.startedAt)} • Last activity {formatTime(session.lastActivityAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${phaseColors[session.currentPhase] || phaseColors.initializing}`}>
                  {(() => {
                    const Icon = phaseIcons[session.currentPhase] || RefreshCw;
                    return <Icon className="w-3 h-3 mr-1" />;
                  })()}
                  {session.currentPhase}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Users className="w-8 h-8 text-blue-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{session?.stats.prospectsFound || 0}</p>
                <p className="text-xs text-gray-500">Prospects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Building2 className="w-8 h-8 text-amber-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{session?.stats.companiesResearched || 0}</p>
                <p className="text-xs text-gray-500">Researched</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Mail className="w-8 h-8 text-green-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{session?.stats.emailsDrafted || 0}</p>
                <p className="text-xs text-gray-500">Drafts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Lightbulb className="w-8 h-8 text-purple-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{session?.stats.techniquesLearned || 0}</p>
                <p className="text-xs text-gray-500">Techniques</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <TrendingUp className="w-8 h-8 text-emerald-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{session?.stats.cyclesCompleted || 0}</p>
                <p className="text-xs text-gray-500">Cycles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {[
          { id: 'engine', label: 'Engine', icon: Zap },
          { id: 'schedule', label: 'Schedules', icon: Calendar },
          { id: 'approvals', label: 'Approvals', icon: CheckCircle2, count: (pendingApprovals as EmailDraft[] || []).length },
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
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-red-500 text-white">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'engine' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Engine Configuration
              </CardTitle>
              <CardDescription>Configure autonomous behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Prospects per Cycle</label>
                <Input
                  type="number"
                  value={config.prospectsPerCycle}
                  onChange={(e) => setConfig(c => ({ ...c, prospectsPerCycle: parseInt(e.target.value) || 10 }))}
                  min={5}
                  max={50}
                  disabled={isRunning}
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
                  disabled={isRunning}
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-sm">Continuous Learning</p>
                  <p className="text-xs text-gray-500">Learn from competitor platforms</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.learningEnabled}
                  onChange={(e) => setConfig(c => ({ ...c, learningEnabled: e.target.checked }))}
                  disabled={isRunning}
                  className="w-4 h-4"
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-sm">Auto-Approve Emails</p>
                  <p className="text-xs text-gray-500">Send without manual review</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.autoApprove}
                  onChange={(e) => setConfig(c => ({ ...c, autoApprove: e.target.checked }))}
                  disabled={isRunning}
                  className="w-4 h-4"
                />
              </div>
            </CardContent>
          </Card>

          {/* Manual Loop Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-500" />
                Manual Loop Control
              </CardTitle>
              <CardDescription>Run individual automation loops</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full justify-between"
                variant="outline"
                onClick={() => discoveryMutation.mutate({ count: 10 })}
                disabled={discoveryMutation.isPending || isRunning}
                data-testid="discovery-loop-btn"
              >
                <span className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Discovery Loop
                </span>
                {discoveryMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
              <Button 
                className="w-full justify-between"
                variant="outline"
                onClick={() => researchMutation.mutate({ count: 5 })}
                disabled={researchMutation.isPending || isRunning}
                data-testid="research-loop-btn"
              >
                <span className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Research Loop
                </span>
                {researchMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
              <Button 
                className="w-full justify-between"
                variant="outline"
                onClick={() => outreachMutation.mutate({ count: 5 })}
                disabled={outreachMutation.isPending || isRunning}
                data-testid="outreach-loop-btn"
              >
                <span className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Outreach Loop
                </span>
                {outreachMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
              <Button 
                className="w-full justify-between"
                variant="outline"
                onClick={() => learningMutation.mutate()}
                disabled={learningMutation.isPending || isRunning}
                data-testid="learning-loop-btn"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Learning Loop
                </span>
                {learningMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-500" />
                Activity Feed
              </CardTitle>
              <CardDescription>Recent autonomous actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[280px] overflow-y-auto">
                {activities.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No activity yet</p>
                ) : (
                  activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-2 rounded border">
                      {activity.type === 'error' ? (
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      ) : activity.type === 'cycle_complete' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <Zap className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{activity.message}</p>
                        <p className="text-xs text-gray-500">{formatDate(activity.createdAt)} {formatTime(activity.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="space-y-6">
          {/* Schedule Form */}
          {showScheduleForm ? (
            <Card>
              <CardHeader>
                <CardTitle>Create New Schedule</CardTitle>
                <CardDescription>Set up automated prospecting runs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Schedule Name</label>
                    <Input
                      value={scheduleForm.name}
                      onChange={(e) => setScheduleForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Morning Prospecting"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Run Time</label>
                    <Input
                      type="time"
                      value={scheduleForm.runTime}
                      onChange={(e) => setScheduleForm(f => ({ ...f, runTime: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Frequency</label>
                  <div className="flex gap-2">
                    {['daily', 'weekly', 'hourly'].map(type => (
                      <button
                        key={type}
                        onClick={() => setScheduleForm(f => ({ ...f, scheduleType: type }))}
                        className={`px-4 py-2 rounded border ${
                          scheduleForm.scheduleType === type
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                {scheduleForm.scheduleType === 'weekly' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Days of Week</label>
                    <div className="flex gap-2">
                      {dayNames.map((day, i) => (
                        <button
                          key={day}
                          onClick={() => {
                            const days = scheduleForm.daysOfWeek.includes(i)
                              ? scheduleForm.daysOfWeek.filter(d => d !== i)
                              : [...scheduleForm.daysOfWeek, i];
                            setScheduleForm(f => ({ ...f, daysOfWeek: days }));
                          }}
                          className={`w-10 h-10 rounded-full border ${
                            scheduleForm.daysOfWeek.includes(i)
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => createScheduleMutation.mutate({
                      ...scheduleForm,
                      config: config
                    })}
                    disabled={createScheduleMutation.isPending}
                  >
                    {createScheduleMutation.isPending ? 'Creating...' : 'Create Schedule'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowScheduleForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button onClick={() => setShowScheduleForm(true)} data-testid="add-schedule-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add Schedule
            </Button>
          )}

          {/* Schedules List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(schedules as ScheduledRun[] || []).map(schedule => (
              <Card key={schedule.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{schedule.name}</h3>
                      <p className="text-sm text-gray-500">
                        {schedule.scheduleType} at {schedule.runTime}
                      </p>
                      {schedule.scheduleType === 'weekly' && (
                        <p className="text-xs text-gray-400 mt-1">
                          {schedule.daysOfWeek.map(d => dayNames[d]).join(', ')}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      schedule.status === 'active' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                      {schedule.status}
                    </span>
                  </div>
                  <div className="mt-4 pt-4 border-t flex items-center justify-between">
                    <div className="text-sm">
                      <p className="text-gray-500">Next run: {schedule.nextRunAt ? formatDateTime(schedule.nextRunAt) : 'N/A'}</p>
                      <p className="text-gray-500">Total runs: {schedule.totalRuns}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runNowMutation.mutate(schedule.id)}
                        disabled={runNowMutation.isPending || isRunning}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Run Now
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(schedules as ScheduledRun[] || []).length === 0 && (
              <Card className="col-span-2">
                <CardContent className="py-8 text-center text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No schedules yet. Create one to automate prospecting.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {(pendingApprovals as EmailDraft[] || []).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No emails pending approval</p>
                <p className="text-sm mt-2">Run an Outreach Loop to generate email drafts</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {(pendingApprovals as EmailDraft[]).map(draft => (
                <Card key={draft.id} className={selectedDraft?.id === draft.id ? 'ring-2 ring-primary' : ''}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {draft.prospect && (
                            <span className="font-semibold">
                              {draft.prospect.firstName} {draft.prospect.lastName}
                            </span>
                          )}
                          <span className="text-sm text-gray-500">
                            {draft.prospect?.company}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            draft.qualityScore >= 80 ? 'bg-green-100 text-green-700' :
                            draft.qualityScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            Score: {draft.qualityScore}
                          </span>
                        </div>
                        <p className="font-medium">{draft.subject}</p>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{draft.body}</p>
                        <p className="text-xs text-gray-400 mt-2">
                          To: {draft.prospect?.email || 'Unknown'} • Created {formatDateTime(draft.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => approveMutation.mutate({ draftId: draft.id, action: 'approve' })}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedDraft(draft)}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => approveMutation.mutate({ draftId: draft.id, action: 'reject' })}
                      >
                        <X className="w-3 h-3 mr-1" />
                        Reject
                      </Button>
                      {draft.status === 'approved' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendEmailMutation.mutate({ draftId: draft.id, provider: 'gmail' })}
                          disabled={sendEmailMutation.isPending}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Send via Gmail
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {(runHistory as AutonomousSession[] || []).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No run history yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {(runHistory as AutonomousSession[]).map(run => (
                <Card key={run.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          run.status === 'running' ? 'bg-blue-100 text-blue-700' :
                          run.status === 'complete' ? 'bg-green-100 text-green-700' :
                          run.status === 'stopped' ? 'bg-gray-100 text-gray-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {run.status}
                        </span>
                        <span className="text-sm">{formatDateTime(run.startedAt)}</span>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <span><Users className="w-4 h-4 inline mr-1" />{run.stats.prospectsFound}</span>
                        <span><Building2 className="w-4 h-4 inline mr-1" />{run.stats.companiesResearched}</span>
                        <span><Mail className="w-4 h-4 inline mr-1" />{run.stats.emailsDrafted}</span>
                        <span><TrendingUp className="w-4 h-4 inline mr-1" />{run.stats.cyclesCompleted} cycles</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Learning Sources - Always visible at bottom */}
      {activeTab === 'engine' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
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
                  <div key={source.id} className="p-3 rounded-lg border">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-bold">{source.name[0]}</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{source.name}</p>
                        <p className="text-xs text-gray-500">{source.domain}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {source.learn_topics.slice(0, 2).map((topic, i) => (
                        <span key={i} className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                          {topic.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                Recent Learnings
              </CardTitle>
              <CardDescription>Insights from autonomous learning</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[280px] overflow-y-auto">
                {(learnings as Learning[] || []).length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No learnings yet. Run a learning loop to get started.
                  </p>
                ) : (
                  (learnings as Learning[]).map((learning) => (
                    <div key={learning.id} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                          {learning.loopType}
                        </span>
                        <span className="text-xs text-gray-500">{formatDate(learning.createdAt)}</span>
                      </div>
                      {learning.learnings?.recommendations && (
                        <ul className="text-sm space-y-1">
                          {(learning.learnings.recommendations.immediate_actions || []).slice(0, 2).map((action: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-gray-600">
                              <CheckCircle2 className="w-3 h-3 text-green-500 mt-1 flex-shrink-0" />
                              <span className="text-xs">{action}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {learning.effectiveness > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full"
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
      )}
    </div>
  );
}
