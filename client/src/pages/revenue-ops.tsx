import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, TrendingDown, AlertTriangle, Clock, Target,
  BarChart3, Activity, Users, DollarSign, Brain,
  AlertCircle, CheckCircle2, XCircle, ChevronRight,
  Calendar, Filter, Download, Play, Pause, RefreshCcw
} from "lucide-react";
import { Line, Bar, Funnel } from "recharts";
import { LineChart, BarChart, FunnelChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { apiRequest } from "@/lib/queryClient";

// Interfaces for Revenue Operations data
interface PipelineHealth {
  id: string;
  snapshotDate: string;
  totalDeals: number;
  totalValue: number;
  byStage: any;
  velocity: any;
  conversion: any;
  riskIndicators: any[];
  healthScore: number;
}

interface DealForensics {
  id: string;
  dealId: string;
  analysisType: string;
  rootCauses: any[];
  criticalMoments: any[];
  missedOpportunities: any;
  recommendations: any;
  competitorFactors: any;
}

interface RevenueForecast {
  forecastPeriod: string;
  predictedRevenue: number;
  confidenceLevel: number;
  assumptions: string[];
  scenarios: any[];
}

interface CoachingInsight {
  id: string;
  userId: string;
  insightType: string;
  insight: string;
  actionItems: string[];
  priority: string;
  status: string;
}

export default function RevenueOpsPage() {
  const [selectedView, setSelectedView] = useState("command-center");
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [interventionInProgress, setInterventionInProgress] = useState(false);

  // Fetch pipeline health data
  const { data: pipelineHealth, isLoading: loadingHealth, refetch: refetchHealth } = useQuery<PipelineHealth>({
    queryKey: ["/api/revenue-ops/health"]
  });

  // Fetch revenue forecast
  const { data: forecast, isLoading: loadingForecast } = useQuery<RevenueForecast>({
    queryKey: ["/api/revenue-ops/forecast"]
  });

  // Fetch risks and recommendations
  const { data: risks, isLoading: loadingRisks } = useQuery<any>({
    queryKey: ["/api/revenue-ops/risks"]
  });

  // Fetch coaching insights
  const { data: coachingInsights, isLoading: loadingInsights } = useQuery<CoachingInsight[]>({
    queryKey: ["/api/revenue-ops/coaching"]
  });

  // Fetch velocity metrics
  const { data: velocity, isLoading: loadingVelocity } = useQuery<any>({
    queryKey: ["/api/revenue-ops/velocity"]
  });

  // Fetch win/loss analysis
  const { data: winLoss, isLoading: loadingWinLoss } = useQuery<any>({
    queryKey: ["/api/revenue-ops/win-loss"]
  });

  const handleIntervention = async (type: string, action: string, dealId?: string) => {
    setInterventionInProgress(true);
    try {
      await apiRequest("/api/revenue-ops/intervene", {
        method: "POST",
        body: JSON.stringify({ type, action, dealId })
      });
      // Refresh data after intervention
      await refetchHealth();
    } catch (error) {
      console.error("Failed to trigger intervention:", error);
    } finally {
      setInterventionInProgress(false);
    }
  };

  const analyzeDeal = async (dealId: string, analysisType: string) => {
    try {
      const forensics = await apiRequest("/api/revenue-ops/forensics", {
        method: "POST",
        body: JSON.stringify({ dealId, analysisType })
      });
      return forensics;
    } catch (error) {
      console.error("Failed to analyze deal:", error);
      return null;
    }
  };

  // Mock data for visualization (in production, this would come from the API)
  const forecastChartData = forecast?.scenarios?.map((scenario: any) => ({
    name: scenario.type.charAt(0).toUpperCase() + scenario.type.slice(1),
    revenue: scenario.revenue / 1000000,
    probability: scenario.probability * 100
  })) || [];

  const stageConversionData = [
    { stage: "Prospect", deals: 100, conversion: 100 },
    { stage: "Qualified", deals: 75, conversion: 75 },
    { stage: "Proposal", deals: 45, conversion: 60 },
    { stage: "Negotiation", deals: 30, conversion: 66.7 },
    { stage: "Closed Won", deals: 20, conversion: 66.7 }
  ];

  const velocityChartData = Object.entries(velocity?.stageProgression || {}).map(([stage, days]) => ({
    stage: stage.charAt(0).toUpperCase() + stage.slice(1),
    days: days as number
  }));

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-2">Revenue Operations Command Center</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered pipeline intelligence and deal forensics
          </p>
        </div>

        <Tabs value={selectedView} onValueChange={setSelectedView} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="command-center" data-testid="tab-command-center">
              Command Center
            </TabsTrigger>
            <TabsTrigger value="forensics" data-testid="tab-forensics">
              Deal Forensics
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              Pipeline Analytics
            </TabsTrigger>
            <TabsTrigger value="coaching" data-testid="tab-coaching">
              Coaching Hub
            </TabsTrigger>
          </TabsList>

          {/* Command Center Dashboard */}
          <TabsContent value="command-center" className="space-y-6">
            {/* Health Score and Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pipeline Health</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline space-x-2">
                    <div className="text-3xl font-bold">
                      {pipelineHealth?.healthScore || 0}
                    </div>
                    <span className="text-sm text-muted-foreground">/100</span>
                  </div>
                  <Progress value={pipelineHealth?.healthScore || 0} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-2">
                    {pipelineHealth?.healthScore >= 70 ? "Healthy" : 
                     pipelineHealth?.healthScore >= 50 ? "Needs Attention" : "Critical"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Pipeline</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    ${((pipelineHealth?.totalValue || 0) / 1000000).toFixed(1)}M
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {pipelineHealth?.totalDeals || 0} active deals
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Q1 2025 Forecast</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    ${((forecast?.predictedRevenue || 0) / 1000000).toFixed(1)}M
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {((forecast?.confidenceLevel || 0) * 100).toFixed(0)}% confidence
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">At Risk</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-destructive">
                    {risks?.totalAtRisk || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    ${((risks?.totalValueAtRisk || 0) / 1000000).toFixed(1)}M value
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Risk Alerts */}
            {risks?.risks && risks.risks.length > 0 && (
              <Alert className="border-destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    {risks.risks.slice(0, 3).map((risk: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span>{risk.description}</span>
                        <Badge variant={risk.severity === 'high' ? 'destructive' : 'secondary'}>
                          {risk.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Revenue Forecast Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Forecast Scenarios</CardTitle>
                <CardDescription>AI-generated predictions with confidence levels</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={forecastChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => `$${value}M`} />
                    <Legend />
                    <Bar dataKey="revenue" fill="#8884d8" name="Revenue ($M)" />
                    <Bar dataKey="probability" fill="#82ca9d" name="Probability (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Recommended Actions</CardTitle>
                <CardDescription>AI-powered interventions to improve pipeline health</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {risks?.recommendations?.map((rec: string, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">{rec}</span>
                    <Button 
                      size="sm"
                      onClick={() => handleIntervention('recommendation', rec)}
                      disabled={interventionInProgress}
                      data-testid={`action-button-${idx}`}
                    >
                      {interventionInProgress ? (
                        <RefreshCcw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      <span className="ml-1">Execute</span>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deal Forensics View */}
          <TabsContent value="forensics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Deal Forensics Analysis</CardTitle>
                <CardDescription>Deep dive into deal outcomes and critical moments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Deal Selection */}
                  <div className="flex space-x-2">
                    <Button 
                      onClick={() => analyzeDeal("deal-1", "won")}
                      variant="outline"
                      data-testid="analyze-won"
                    >
                      Analyze Won Deal
                    </Button>
                    <Button 
                      onClick={() => analyzeDeal("deal-2", "lost")}
                      variant="outline"
                      data-testid="analyze-lost"
                    >
                      Analyze Lost Deal
                    </Button>
                    <Button 
                      onClick={() => analyzeDeal("deal-3", "stuck")}
                      variant="outline"
                      data-testid="analyze-stuck"
                    >
                      Analyze Stuck Deal
                    </Button>
                  </div>

                  {/* Timeline Visualization */}
                  <div className="mt-6">
                    <h3 className="font-medium mb-3">Deal Timeline</h3>
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border"></div>
                      {[
                        { date: "Jan 5", event: "Initial Contact", type: "success" },
                        { date: "Jan 12", event: "Discovery Call", type: "success" },
                        { date: "Jan 20", event: "Technical Demo", type: "warning" },
                        { date: "Jan 28", event: "Pricing Discussion", type: "critical" },
                        { date: "Feb 5", event: "Contract Negotiation", type: "success" }
                      ].map((moment, idx) => (
                        <div key={idx} className="relative flex items-center mb-4">
                          <div className={`absolute left-2 w-4 h-4 rounded-full ${
                            moment.type === 'success' ? 'bg-green-500' :
                            moment.type === 'warning' ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}></div>
                          <div className="ml-10">
                            <p className="text-xs text-muted-foreground">{moment.date}</p>
                            <p className="font-medium">{moment.event}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Root Cause Analysis */}
                  <div className="grid gap-4 md:grid-cols-2 mt-6">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Root Causes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-start">
                            <XCircle className="h-4 w-4 text-destructive mr-2 mt-0.5" />
                            Lack of executive sponsorship
                          </li>
                          <li className="flex items-start">
                            <XCircle className="h-4 w-4 text-destructive mr-2 mt-0.5" />
                            Competitive displacement
                          </li>
                          <li className="flex items-start">
                            <XCircle className="h-4 w-4 text-destructive mr-2 mt-0.5" />
                            Budget constraints not identified early
                          </li>
                        </ul>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Missed Opportunities</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-start">
                            <AlertCircle className="h-4 w-4 text-yellow-500 mr-2 mt-0.5" />
                            Could have engaged decision maker earlier
                          </li>
                          <li className="flex items-start">
                            <AlertCircle className="h-4 w-4 text-yellow-500 mr-2 mt-0.5" />
                            Should have addressed pricing concerns proactively
                          </li>
                          <li className="flex items-start">
                            <AlertCircle className="h-4 w-4 text-yellow-500 mr-2 mt-0.5" />
                            Needed stronger business case presentation
                          </li>
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pipeline Analytics */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Stage Conversion Funnel */}
            <Card>
              <CardHeader>
                <CardTitle>Stage Conversion Funnel</CardTitle>
                <CardDescription>Deal progression and conversion rates by stage</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stageConversionData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="stage" type="category" />
                    <Tooltip />
                    <Bar dataKey="deals" fill="#8884d8" name="Deals" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Velocity Metrics */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Deal Velocity by Stage</CardTitle>
                  <CardDescription>Average days in each stage</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={velocityChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="stage" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="days" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Velocity Trends</CardTitle>
                  <CardDescription>Deal cycle acceleration/deceleration</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Average Deal Cycle</span>
                      <span className="font-medium">{velocity?.avgDealCycle || 0} days</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Accelerating Deals</span>
                      <Badge variant="secondary" className="bg-green-100">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {velocity?.acceleratingDeals || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Decelerating Deals</span>
                      <Badge variant="secondary" className="bg-red-100">
                        <TrendingDown className="h-3 w-3 mr-1" />
                        {velocity?.deceleratingDeals || 0}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Win/Loss Patterns */}
            <Card>
              <CardHeader>
                <CardTitle>Win/Loss Pattern Analysis</CardTitle>
                <CardDescription>AI-identified patterns in deal outcomes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium text-green-600 mb-2">Win Patterns</h4>
                    <ul className="space-y-1 text-sm">
                      {winLoss?.winPatterns?.map((pattern: string, idx: number) => (
                        <li key={idx} className="flex items-start">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5" />
                          {pattern}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-red-600 mb-2">Loss Patterns</h4>
                    <ul className="space-y-1 text-sm">
                      {winLoss?.lossPatterns?.map((pattern: string, idx: number) => (
                        <li key={idx} className="flex items-start">
                          <XCircle className="h-4 w-4 text-red-500 mr-2 mt-0.5" />
                          {pattern}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <Separator className="my-4" />
                <div>
                  <h4 className="font-medium mb-2">Recommendations</h4>
                  <ul className="space-y-1 text-sm">
                    {winLoss?.recommendations?.map((rec: string, idx: number) => (
                      <li key={idx} className="flex items-start">
                        <ChevronRight className="h-4 w-4 text-muted-foreground mr-2 mt-0.5" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Coaching Hub */}
          <TabsContent value="coaching" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Coaching Insights</CardTitle>
                <CardDescription>Personalized recommendations for performance improvement</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {coachingInsights?.map((insight) => (
                      <Card key={insight.id} className="border-l-4 border-l-primary">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Brain className="h-4 w-4 text-primary" />
                              <span className="font-medium capitalize">{insight.insightType} Insight</span>
                            </div>
                            <Badge 
                              variant={
                                insight.priority === 'high' ? 'destructive' :
                                insight.priority === 'medium' ? 'default' : 
                                'secondary'
                              }
                            >
                              {insight.priority}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm mb-3">{insight.insight}</p>
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Action Items:</p>
                            {insight.actionItems.map((action, idx) => (
                              <div key={idx} className="flex items-center text-sm">
                                <CheckCircle2 className="h-3 w-3 text-muted-foreground mr-2" />
                                {action}
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex space-x-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              data-testid={`acknowledge-${insight.id}`}
                            >
                              Acknowledge
                            </Button>
                            <Button 
                              size="sm"
                              data-testid={`action-plan-${insight.id}`}
                            >
                              Create Action Plan
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}