import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/switch';
import { 
  Brain, 
  TrendingUp, 
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Target,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  Zap,
  Play,
  History,
  Settings,
  BarChart3,
  ArrowRight
} from 'lucide-react';

interface Rule {
  id: string;
  type: string;
  rule: string;
  target?: number;
  tolerance?: number;
  priority: string;
  basedOn: string;
  active: boolean;
  appliedCount: number;
}

interface LearningSession {
  id: string;
  type: string;
  rulesGenerated: number;
  createdAt: string;
  performance?: {
    totalEmails: number;
    highPerformers: number;
    replyRate: number;
  };
  patterns?: {
    subjectPatterns: Array<{ pattern: string; percentage: number }>;
    openingPatterns: Array<{ pattern: string; percentage: number }>;
  };
}

interface Phrases {
  subject_phrases?: Array<{ phrase: string; effectiveness_score: number; usage_tip: string }>;
  opening_phrases?: Array<{ phrase: string; effectiveness_score: number; usage_tip: string }>;
  cta_phrases?: Array<{ phrase: string; effectiveness_score: number; usage_tip: string }>;
}

export default function SelfImprovement() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'phrases' | 'apply'>('overview');
  const [emailToImprove, setEmailToImprove] = useState({ subject: '', body: '' });
  const [improvedEmail, setImprovedEmail] = useState<{ subject: string; body: string; changes: string[] } | null>(null);

  // Queries
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['self-improvement-status'],
    queryFn: () => api.getSelfImprovementStatus()
  });

  const { data: phrases } = useQuery({
    queryKey: ['winning-phrases'],
    queryFn: () => api.getWinningPhrases()
  });

  const { data: history } = useQuery({
    queryKey: ['improvement-history'],
    queryFn: () => api.getImprovementHistory(20)
  });

  // Mutations
  const analyzeMutation = useMutation({
    mutationFn: () => api.runPerformanceAnalysis(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['self-improvement-status'] });
      queryClient.invalidateQueries({ queryKey: ['winning-phrases'] });
    }
  });

  const applyMutation = useMutation({
    mutationFn: (data: { subject: string; body: string }) => api.applyLearningsToEmail(data),
    onSuccess: (data) => {
      setImprovedEmail(data.improved ? {
        subject: data.improved.subject,
        body: data.improved.body,
        changes: data.changes || []
      } : null);
      queryClient.invalidateQueries({ queryKey: ['improvement-history'] });
    }
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ ruleId, active }: { ruleId: string; active: boolean }) =>
      api.updateImprovementRule(ruleId, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['self-improvement-status'] })
  });

  const rules = (status?.rules || []) as Rule[];
  const sessions = (status?.recentSessions || []) as LearningSession[];
  const metrics = status?.metrics || { totalEmailsAnalyzed: 0, patternsIdentified: 0, rulesGenerated: 0, improvementApplied: 0 };
  const phrasesData = (phrases?.phrases || {}) as Phrases;
  const historyData = history as any;

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="self-improvement-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Brain className="w-8 h-8 text-purple-500" />
            Self-Improvement Engine
          </h1>
          <p className="text-gray-500 mt-1">
            AI learns from your successful emails and automatically improves future drafts
          </p>
        </div>
        <Button
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
          data-testid="run-analysis-btn"
        >
          {analyzeMutation.isPending ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
          ) : (
            <><Play className="w-4 h-4 mr-2" /> Run Analysis</>
          )}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <BarChart3 className="w-8 h-8 text-blue-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{metrics.totalEmailsAnalyzed}</p>
                <p className="text-xs text-gray-500">Emails Analyzed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Target className="w-8 h-8 text-amber-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{metrics.patternsIdentified}</p>
                <p className="text-xs text-gray-500">Patterns Found</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Settings className="w-8 h-8 text-green-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{rules.filter(r => r.active).length}</p>
                <p className="text-xs text-gray-500">Active Rules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Sparkles className="w-8 h-8 text-purple-500" />
              <div className="text-right">
                <p className="text-2xl font-bold">{metrics.improvementApplied}</p>
                <p className="text-xs text-gray-500">Improvements Applied</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {[
          { id: 'overview', label: 'Overview', icon: TrendingUp },
          { id: 'rules', label: 'Rules', icon: Settings, count: rules.length },
          { id: 'phrases', label: 'Winning Phrases', icon: Lightbulb },
          { id: 'apply', label: 'Apply to Email', icon: Sparkles }
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
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Analysis Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-500" />
                Recent Analysis Sessions
              </CardTitle>
              <CardDescription>Learning sessions and their results</CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No analysis sessions yet</p>
                  <p className="text-sm mt-2">Click "Run Analysis" to start learning</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map(session => (
                    <div key={session.id} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{session.type.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-gray-500">{formatDate(session.createdAt)}</span>
                      </div>
                      {session.performance && (
                        <div className="flex items-center gap-4 text-sm">
                          <span>{session.performance.totalEmails} emails</span>
                          <span className="text-green-600">{session.performance.highPerformers} successful</span>
                          <span>{session.performance.replyRate.toFixed(1)}% reply rate</span>
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                          {session.rulesGenerated} rules created
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Patterns */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-500" />
                What's Working
              </CardTitle>
              <CardDescription>Patterns from your successful emails</CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length > 0 && sessions[0].patterns ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Subject Line Patterns</p>
                    {sessions[0].patterns.subjectPatterns?.slice(0, 4).map((p, i) => (
                      <div key={i} className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${p.percentage}%` }}
                          />
                        </div>
                        <span className="text-sm w-24 capitalize">{p.pattern}</span>
                        <span className="text-sm text-gray-500">{p.percentage}%</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Opening Styles</p>
                    {sessions[0].patterns.openingPatterns?.slice(0, 4).map((p, i) => (
                      <div key={i} className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${p.percentage}%` }}
                          />
                        </div>
                        <span className="text-sm w-24 capitalize">{p.pattern}</span>
                        <span className="text-sm text-gray-500">{p.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center py-8 text-gray-500">Run analysis to see patterns</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="space-y-4">
          {rules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No improvement rules yet</p>
                <p className="text-sm mt-2">Run analysis to generate rules from your successful emails</p>
              </CardContent>
            </Card>
          ) : (
            rules.map(rule => (
              <Card key={rule.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          rule.priority === 'high' ? 'bg-red-100 text-red-700' :
                          rule.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {rule.priority} priority
                        </span>
                        <span className="text-xs text-gray-500">{rule.type.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="font-medium">{rule.rule}</p>
                      <p className="text-sm text-gray-500 mt-1">{rule.basedOn}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        {rule.target && <span>Target: {rule.target}</span>}
                        <span>Applied {rule.appliedCount} times</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">{rule.active ? 'Active' : 'Inactive'}</span>
                      <Switch
                        checked={rule.active}
                        onCheckedChange={(checked) => 
                          toggleRuleMutation.mutate({ ruleId: rule.id, active: checked })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'phrases' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(phrasesData).length === 0 ? (
            <Card className="col-span-2">
              <CardContent className="py-12 text-center text-gray-500">
                <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No winning phrases learned yet</p>
                <p className="text-sm mt-2">Get more replies to build your phrase library</p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(phrasesData).map(([category, phraseList]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="capitalize">{category.replace(/_/g, ' ')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(phraseList as Array<{ phrase: string; effectiveness_score: number; usage_tip: string }>)?.slice(0, 5).map((p, i) => (
                      <div key={i} className="p-3 rounded border">
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-medium text-sm">"{p.phrase}"</p>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            p.effectiveness_score >= 8 ? 'bg-green-100 text-green-700' :
                            p.effectiveness_score >= 6 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {p.effectiveness_score}/10
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{p.usage_tip}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'apply' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Your Email
              </CardTitle>
              <CardDescription>Paste your email to apply learned improvements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject Line</label>
                <Input
                  value={emailToImprove.subject}
                  onChange={(e) => setEmailToImprove(s => ({ ...s, subject: e.target.value }))}
                  placeholder="Your email subject..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Body</label>
                <textarea
                  className="w-full min-h-[200px] p-3 rounded-md border bg-background"
                  value={emailToImprove.body}
                  onChange={(e) => setEmailToImprove(s => ({ ...s, body: e.target.value }))}
                  placeholder="Your email body..."
                />
              </div>
              <Button
                onClick={() => applyMutation.mutate(emailToImprove)}
                disabled={applyMutation.isPending || !emailToImprove.subject || !emailToImprove.body}
                className="w-full"
                data-testid="apply-learnings-btn"
              >
                {applyMutation.isPending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Applying...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Apply Learnings</>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Improved Version
              </CardTitle>
              <CardDescription>Your email with learned patterns applied</CardDescription>
            </CardHeader>
            <CardContent>
              {improvedEmail ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Improved Subject</label>
                    <div className="p-3 rounded-md border bg-green-50 dark:bg-green-900/20">
                      {improvedEmail.subject}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Improved Body</label>
                    <div className="p-3 rounded-md border bg-green-50 dark:bg-green-900/20 whitespace-pre-wrap text-sm max-h-[200px] overflow-y-auto">
                      {improvedEmail.body}
                    </div>
                  </div>
                  {improvedEmail.changes.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Changes Applied</label>
                      <ul className="space-y-1">
                        {improvedEmail.changes.map((change, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <ArrowRight className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{typeof change === 'string' ? change : JSON.stringify(change)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Enter your email and click "Apply Learnings"</p>
                  <p className="text-sm mt-2">AI will apply {rules.filter(r => r.active).length} active rules</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
