import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { 
  Sparkles, 
  BarChart3, 
  FlaskConical,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  Mail,
  MousePointer,
  MessageSquare,
  Trophy,
  Target,
  Zap,
  ArrowRight,
  Copy,
  Play,
  History
} from 'lucide-react';

interface ABTest {
  id: string;
  name: string;
  testType: string;
  status: string;
  variations: Array<{
    id: string;
    name: string;
    subject: string;
    body: string;
    isControl: boolean;
  }>;
  winnerId: string | null;
  stats: {
    totalSent: number;
    totalOpens: number;
    totalClicks: number;
    totalReplies: number;
  };
  createdAt: string;
  completedAt: string | null;
  results?: Array<{
    variationId: string;
    variationName: string;
    sent: number;
    opens: number;
    clicks: number;
    replies: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
  }>;
}

interface Optimization {
  original: { subject: string; body: string };
  optimized: { subject: string; body: string };
  changes: string[];
  predictedImprovement: number;
  confidence: number;
}

interface Insights {
  performance: {
    totalSent: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
    insights: string[];
  };
  successfulPatterns: {
    patterns: Array<{ type: string; count: number; percentage: number }>;
    avgSubjectLength: number;
    avgBodyLength: number;
  };
  abTestLearnings: Array<{
    testType: string;
    winnerApproach: string;
    testDate: string;
  }>;
  recommendations: Array<{
    type: string;
    priority: string;
    recommendation: string;
    action: string;
  }>;
}

export default function EmailOptimization() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'optimize' | 'ab-tests' | 'insights' | 'history'>('optimize');
  const [emailToOptimize, setEmailToOptimize] = useState({
    subject: '',
    body: '',
    industry: '',
    title: ''
  });
  const [optimization, setOptimization] = useState<Optimization | null>(null);
  const [newTestForm, setNewTestForm] = useState({
    name: 'Email A/B Test',
    testType: 'subject',
    subject: '',
    body: '',
    variationCount: 3
  });
  const [showTestForm, setShowTestForm] = useState(false);
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);

  // Queries
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['email-insights'],
    queryFn: api.getOptimizationInsights
  });

  const { data: abTests } = useQuery({
    queryKey: ['ab-tests'],
    queryFn: () => api.listABTests()
  });

  const { data: optimizationHistory } = useQuery({
    queryKey: ['optimization-history'],
    queryFn: () => api.getOptimizationHistory(20)
  });

  // Mutations
  const optimizeMutation = useMutation({
    mutationFn: (data: typeof emailToOptimize) => api.optimizeEmail(data),
    onSuccess: (data) => {
      setOptimization(data);
      queryClient.invalidateQueries({ queryKey: ['optimization-history'] });
    }
  });

  const createTestMutation = useMutation({
    mutationFn: (data: typeof newTestForm) => api.createABTest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ab-tests'] });
      setShowTestForm(false);
      setNewTestForm({
        name: 'Email A/B Test',
        testType: 'subject',
        subject: '',
        body: '',
        variationCount: 3
      });
    }
  });

  const selectWinnerMutation = useMutation({
    mutationFn: ({ testId, winnerId }: { testId: string; winnerId?: string }) =>
      api.selectABTestWinner(testId, winnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ab-tests'] });
      setSelectedTest(null);
    }
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const insightsData = insights as Insights | undefined;
  const testsData = abTests as ABTest[] | undefined;
  const historyData = optimizationHistory as any[] | undefined;

  return (
    <div className="p-6 space-y-6" data-testid="email-optimization-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-yellow-500" />
            Email Optimization & A/B Testing
          </h1>
          <p className="text-gray-500 mt-1">
            AI-powered email optimization that learns from your results
          </p>
        </div>
      </div>

      {/* Performance Summary Cards */}
      {insightsData?.performance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <Mail className="w-8 h-8 text-blue-500" />
                <div className="text-right">
                  <p className="text-2xl font-bold">{insightsData.performance.totalSent}</p>
                  <p className="text-xs text-gray-500">Emails Sent</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <MousePointer className="w-8 h-8 text-green-500" />
                <div className="text-right">
                  <p className="text-2xl font-bold">{insightsData.performance.openRate}%</p>
                  <p className="text-xs text-gray-500">Open Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <Target className="w-8 h-8 text-amber-500" />
                <div className="text-right">
                  <p className="text-2xl font-bold">{insightsData.performance.clickRate}%</p>
                  <p className="text-xs text-gray-500">Click Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <MessageSquare className="w-8 h-8 text-purple-500" />
                <div className="text-right">
                  <p className="text-2xl font-bold">{insightsData.performance.replyRate}%</p>
                  <p className="text-xs text-gray-500">Reply Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {[
          { id: 'optimize', label: 'Optimize Email', icon: Sparkles },
          { id: 'ab-tests', label: 'A/B Tests', icon: FlaskConical, count: (testsData || []).filter(t => t.status === 'running').length },
          { id: 'insights', label: 'Insights', icon: Lightbulb },
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
              <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-blue-500 text-white">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'optimize' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                Optimize Your Email
              </CardTitle>
              <CardDescription>Enter your email content to get AI-powered optimization suggestions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject Line</label>
                <Input
                  value={emailToOptimize.subject}
                  onChange={(e) => setEmailToOptimize(s => ({ ...s, subject: e.target.value }))}
                  placeholder="Quick question about {{company}}"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Body</label>
                <textarea
                  className="w-full min-h-[150px] p-3 rounded-md border bg-background"
                  value={emailToOptimize.body}
                  onChange={(e) => setEmailToOptimize(s => ({ ...s, body: e.target.value }))}
                  placeholder="Hi {{firstName}}, I noticed that {{company}} is..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prospect Industry (optional)</label>
                  <Input
                    value={emailToOptimize.industry}
                    onChange={(e) => setEmailToOptimize(s => ({ ...s, industry: e.target.value }))}
                    placeholder="SaaS, Healthcare, etc."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Prospect Title (optional)</label>
                  <Input
                    value={emailToOptimize.title}
                    onChange={(e) => setEmailToOptimize(s => ({ ...s, title: e.target.value }))}
                    placeholder="VP Sales, CEO, etc."
                  />
                </div>
              </div>
              <Button
                onClick={() => optimizeMutation.mutate(emailToOptimize)}
                disabled={optimizeMutation.isPending || !emailToOptimize.subject || !emailToOptimize.body}
                className="w-full"
                data-testid="optimize-email-btn"
              >
                {optimizeMutation.isPending ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Optimizing...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Optimize Email</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Optimization Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Optimized Version
              </CardTitle>
              <CardDescription>
                {optimization ? (
                  <span className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      optimization.confidence >= 70 ? 'bg-green-100 text-green-700' :
                      optimization.confidence >= 50 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {optimization.confidence}% confidence
                    </span>
                    <span>Predicted +{optimization.predictedImprovement}% improvement</span>
                  </span>
                ) : 'Enter your email to see optimized version'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {optimization ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Optimized Subject</label>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(optimization.optimized.subject)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="p-3 rounded-md border bg-green-50 dark:bg-green-900/20">
                      {optimization.optimized.subject}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Optimized Body</label>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(optimization.optimized.body)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="p-3 rounded-md border bg-green-50 dark:bg-green-900/20 whitespace-pre-wrap text-sm">
                      {optimization.optimized.body}
                    </div>
                  </div>
                  {optimization.changes.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Changes Made</label>
                      <ul className="space-y-1">
                        {optimization.changes.map((change, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{typeof change === 'string' ? change : (change as any).change || JSON.stringify(change)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setNewTestForm({
                        ...newTestForm,
                        subject: optimization.optimized.subject,
                        body: optimization.optimized.body
                      });
                      setShowTestForm(true);
                      setActiveTab('ab-tests');
                    }}
                  >
                    <FlaskConical className="w-4 h-4 mr-2" />
                    Create A/B Test with This
                  </Button>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Enter your email content and click "Optimize Email"</p>
                  <p className="text-sm mt-2">AI will analyze patterns from your successful emails</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'ab-tests' && (
        <div className="space-y-6">
          {/* Create Test Form */}
          {showTestForm ? (
            <Card>
              <CardHeader>
                <CardTitle>Create A/B Test</CardTitle>
                <CardDescription>Test different email variations to find what works best</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Test Name</label>
                    <Input
                      value={newTestForm.name}
                      onChange={(e) => setNewTestForm(f => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Variations</label>
                    <Input
                      type="number"
                      value={newTestForm.variationCount}
                      onChange={(e) => setNewTestForm(f => ({ ...f, variationCount: parseInt(e.target.value) || 3 }))}
                      min={2}
                      max={5}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Test Type</label>
                  <div className="flex gap-2">
                    {['subject', 'body', 'cta', 'full'].map(type => (
                      <button
                        key={type}
                        onClick={() => setNewTestForm(f => ({ ...f, testType: type }))}
                        className={`px-4 py-2 rounded border ${
                          newTestForm.testType === type
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Base Subject Line</label>
                  <Input
                    value={newTestForm.subject}
                    onChange={(e) => setNewTestForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="Quick question about {{company}}"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Base Email Body</label>
                  <textarea
                    className="w-full min-h-[100px] p-3 rounded-md border bg-background"
                    value={newTestForm.body}
                    onChange={(e) => setNewTestForm(f => ({ ...f, body: e.target.value }))}
                    placeholder="Hi {{firstName}}..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => createTestMutation.mutate(newTestForm)}
                    disabled={createTestMutation.isPending || !newTestForm.subject || !newTestForm.body}
                  >
                    {createTestMutation.isPending ? 'Creating...' : 'Create A/B Test'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowTestForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Button onClick={() => setShowTestForm(true)} data-testid="create-ab-test-btn">
              <FlaskConical className="w-4 h-4 mr-2" />
              Create A/B Test
            </Button>
          )}

          {/* Test List */}
          <div className="grid gap-4">
            {(testsData || []).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No A/B tests yet</p>
                  <p className="text-sm mt-2">Create a test to find your best-performing emails</p>
                </CardContent>
              </Card>
            ) : (
              (testsData || []).map(test => (
                <Card key={test.id} className={selectedTest?.id === test.id ? 'ring-2 ring-primary' : ''}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{test.name}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            test.status === 'running' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                            test.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {test.status}
                          </span>
                          <span className="text-xs text-gray-500">{test.testType} test</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {test.variations.length} variations • Created {formatDate(test.createdAt)}
                        </p>
                      </div>
                      {test.winnerId && (
                        <div className="flex items-center gap-1 text-green-600">
                          <Trophy className="w-4 h-4" />
                          <span className="text-sm font-medium">Winner selected</span>
                        </div>
                      )}
                    </div>

                    {/* Variations with Results */}
                    {test.results && test.results.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {test.results.map(result => (
                          <div 
                            key={result.variationId}
                            className={`p-3 rounded border ${
                              test.winnerId === result.variationId ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {test.winnerId === result.variationId && (
                                  <Trophy className="w-4 h-4 text-green-500" />
                                )}
                                <span className="font-medium text-sm">{result.variationName}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span title="Sent">{result.sent} sent</span>
                                <span title="Open Rate" className="text-green-600">{result.openRate}% opens</span>
                                <span title="Click Rate" className="text-amber-600">{result.clickRate}% clicks</span>
                                <span title="Reply Rate" className="text-purple-600">{result.replyRate}% replies</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-4 pt-4 border-t flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const fullTest = await api.getABTest(test.id);
                          setSelectedTest(fullTest);
                        }}
                      >
                        View Details
                      </Button>
                      {test.status === 'running' && (
                        <Button
                          size="sm"
                          onClick={() => selectWinnerMutation.mutate({ testId: test.id })}
                          disabled={selectWinnerMutation.isPending}
                        >
                          <Trophy className="w-3 h-3 mr-1" />
                          Auto-Select Winner
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                AI Recommendations
              </CardTitle>
              <CardDescription>Personalized suggestions based on your data</CardDescription>
            </CardHeader>
            <CardContent>
              {insightsLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : insightsData?.recommendations && insightsData.recommendations.length > 0 ? (
                <div className="space-y-4">
                  {insightsData.recommendations.map((rec, i) => (
                    <div key={i} className="p-4 rounded-lg border">
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                          rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {rec.priority}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{rec.recommendation}</p>
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" />
                            {rec.action}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-gray-500">
                  Send more emails to get personalized recommendations
                </p>
              )}
            </CardContent>
          </Card>

          {/* Successful Patterns */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                What's Working
              </CardTitle>
              <CardDescription>Patterns from your successful emails</CardDescription>
            </CardHeader>
            <CardContent>
              {insightsData?.successfulPatterns ? (
                <div className="space-y-4">
                  {insightsData.successfulPatterns.patterns.length > 0 ? (
                    <>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Opening Styles That Get Replies</p>
                        {insightsData.successfulPatterns.patterns.map((pattern, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${pattern.percentage}%` }}
                              />
                            </div>
                            <span className="text-sm w-32">{pattern.type}</span>
                            <span className="text-sm text-gray-500">{pattern.percentage}%</span>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div className="text-center p-3 rounded bg-gray-50 dark:bg-gray-800">
                          <p className="text-2xl font-bold">{insightsData.successfulPatterns.avgSubjectLength}</p>
                          <p className="text-xs text-gray-500">Avg Subject Length (chars)</p>
                        </div>
                        <div className="text-center p-3 rounded bg-gray-50 dark:bg-gray-800">
                          <p className="text-2xl font-bold">{insightsData.successfulPatterns.avgBodyLength}</p>
                          <p className="text-xs text-gray-500">Avg Body Length (words)</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-center py-8 text-gray-500">
                      Get more replies to see pattern analysis
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-center py-8 text-gray-500">Loading...</p>
              )}
            </CardContent>
          </Card>

          {/* Performance Insights */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Performance Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              {insightsData?.performance?.insights && insightsData.performance.insights.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {insightsData.performance.insights.map((insight, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded border">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <p className="text-sm">{insight}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-8 text-gray-500">
                  Send more emails to unlock performance insights
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {(historyData || []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No optimization history yet</p>
                <p className="text-sm mt-2">Optimize emails to see your history</p>
              </CardContent>
            </Card>
          ) : (
            (historyData || []).map((item: any) => (
              <Card key={item.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500">{formatDate(item.createdAt)}</span>
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                      {item.focus || 'all'} optimization
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Original Subject</p>
                      <p className="text-sm">{item.original?.subject}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Optimized Subject</p>
                      <p className="text-sm text-green-600">{item.optimized?.subject}</p>
                    </div>
                  </div>
                  {item.changes && item.changes.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-gray-500 mb-1">Changes</p>
                      <ul className="text-sm space-y-1">
                        {item.changes.slice(0, 2).map((change: string, i: number) => (
                          <li key={i} className="text-gray-600">• {change}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
