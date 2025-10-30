import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Plus, Wand2, Eye, Reply, DollarSign, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatsCard from "@/components/stats-card";
import VisitorCard from "@/components/visitor-card";
import AICoachPanel from "@/components/ai-coach-panel";
import InsightCard from "@/components/insight-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: activeVisitors, isLoading: visitorsLoading } = useQuery({
    queryKey: ["/api/visitors/active"],
  });

  const { data: sequences, isLoading: sequencesLoading } = useQuery({
    queryKey: ["/api/sequences"],
  });

  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ["/api/insights"],
    queryFn: () => api.getInsights({ limit: 10 }),
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["/api/tasks"],
    queryFn: () => api.getTasks({ status: "pending" }),
  });

  const handleGenerateMessage = (insightId: string) => {
    // Navigate to content studio or open modal for message generation
    console.log("Generate message for insight:", insightId);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 md:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
              <p className="text-sm md:text-base text-muted-foreground">Welcome back, Alex. Here's what's happening with your sales today.</p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="secondary" className="rounded-lg hover:soft-shadow-hover transition-all-soft" data-testid="button-new-sequence">
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">New Sequence</span>
              </Button>
              <Button className="rounded-lg hover:soft-shadow-hover transition-all-soft" data-testid="button-ai-generate">
                <Wand2 className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">AI Generate</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Active Visitors"
            value={statsLoading ? "..." : stats?.activeVisitors || 0}
            change="12%"
            changeLabel="vs last week"
            icon={Eye}
            color="chart-1"
          />
          <StatsCard
            title="Email Reply Rate"
            value={statsLoading ? "..." : `${stats?.replyRate || 0}%`}
            change="8%"
            changeLabel="vs last month"
            icon={Reply}
            color="chart-2"
          />
          <StatsCard
            title="Pipeline Value"
            value={statsLoading ? "..." : formatCurrency(stats?.pipelineValue || 0)}
            change="22%"
            changeLabel="vs last quarter"
            icon={DollarSign}
            color="chart-3"
          />
          <StatsCard
            title="AI Sequences"
            value={statsLoading ? "..." : stats?.aiSequences || 0}
            change="45%"
            changeLabel="active this week"
            icon={Bot}
            color="chart-4"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Visitor Intelligence */}
            <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
              <CardHeader className="border-b border-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <CardTitle className="text-sm md:text-base">Live Visitor Intelligence</CardTitle>
                  <Button variant="link" size="sm" className="hover:soft-shadow-hover transition-all-soft" data-testid="button-view-all-visitors">
                    View All →
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {visitorsLoading ? (
                  <div className="p-4 text-center text-muted-foreground">Loading visitors...</div>
                ) : activeVisitors?.length ? (
                  <div className="divide-y divide-border">
                    {activeVisitors.slice(0, 3).map((visitor: any) => (
                      <VisitorCard
                        key={visitor.session.id}
                        company={visitor.company.name}
                        location={visitor.company.location || "Unknown"}
                        visitors={1}
                        intentScore={visitor.intentScore}
                        timeAgo={visitor.timeAgo}
                        pages={visitor.session.pagesViewed || []}
                        industry={visitor.company.industry}
                        size={visitor.company.size}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">No active visitors</div>
                )}
              </CardContent>
            </Card>

            {/* AI Email Coach */}
            <AICoachPanel
              initialContent="Hi {{firstName}},

I noticed your team at {{company}} has been exploring sales automation solutions. Our AI-powered platform has helped similar companies increase their reply rates by 40%.

Would you be interested in a quick 15-minute demo to see how we can help {{company}} streamline your sales process?

Best regards,
Alex"
            />
          </div>

          {/* Right Column */}
          <div className="space-y-4 md:space-y-6">
            {/* Active Sequences */}
            <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
              <CardHeader className="border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm md:text-base">Active Sequences</CardTitle>
                  <Button variant="ghost" size="sm" className="rounded-lg hover:soft-shadow-hover transition-all-soft" data-testid="button-add-sequence">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {sequencesLoading ? (
                  <div className="p-4 text-center text-muted-foreground">Loading sequences...</div>
                ) : sequences?.length ? (
                  <div className="divide-y divide-border">
                    {sequences.slice(0, 3).map((sequence: any) => (
                      <div key={sequence.id} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-sm">{sequence.name}</h4>
                          <Badge variant={sequence.status === 'active' ? 'default' : 'secondary'}>
                            {sequence.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-3">
                          {Math.floor(Math.random() * 200)} contacts • {Math.floor(Math.random() * 50)}% reply rate
                        </p>
                        <Progress value={Math.floor(Math.random() * 100)} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-2">
                          {Math.floor(Math.random() * 100)}% completed
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">No active sequences</div>
                )}
              </CardContent>
            </Card>

            {/* Recent Insights */}
            <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
              <CardHeader className="border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm md:text-base">Recent Insights</CardTitle>
                  <Button variant="link" size="sm" className="hover:soft-shadow-hover transition-all-soft" data-testid="button-view-all-insights">
                    View All →
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {insightsLoading ? (
                  <div className="p-4 text-center text-muted-foreground">Loading insights...</div>
                ) : insights?.length ? (
                  <div className="divide-y divide-border">
                    {insights.slice(0, 3).map((insight: any) => (
                      <InsightCard
                        key={insight.id}
                        id={insight.id}
                        type={insight.type}
                        title={insight.title}
                        description={insight.description}
                        onGenerateMessage={handleGenerateMessage}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">No insights available</div>
                )}
              </CardContent>
            </Card>

            {/* Today's Tasks */}
            <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
              <CardHeader className="border-b border-border">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm md:text-base">Today's Tasks</CardTitle>
                  <Badge variant="secondary" className="rounded-lg">
                    {tasks?.length || 0} pending
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {tasksLoading ? (
                  <div className="p-4 text-center text-muted-foreground">Loading tasks...</div>
                ) : tasks?.length ? (
                  <div className="divide-y divide-border">
                    {tasks.slice(0, 3).map((task: any) => (
                      <div key={task.id} className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex items-center space-x-3">
                          <Checkbox data-testid={`checkbox-task-${task.id}`} />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{task.title}</p>
                            <p className="text-xs text-muted-foreground">{task.description}</p>
                          </div>
                          <Badge variant={
                            task.priority === 'high' ? 'destructive' :
                            task.priority === 'medium' ? 'default' : 'secondary'
                          }>
                            {task.priority}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">No pending tasks</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Activity */}
        <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
          <CardHeader>
            <CardTitle className="text-sm md:text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-8 h-8 bg-chart-1/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-chart-1" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm truncate">AI Agent sent 23 personalized emails to SaaS prospects</p>
                  <p className="text-xs text-muted-foreground">2 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center gap-3 md:gap-4">
                <div className="w-8 h-8 bg-chart-2/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Reply className="h-4 w-4 text-chart-2" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm truncate">Received interested reply from DataFlow Inc CTO</p>
                  <p className="text-xs text-muted-foreground">15 minutes ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </main>
    </div>
  );
}
