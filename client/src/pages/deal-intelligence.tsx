import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target,
  Clock,
  AlertCircle,
  CheckCircle,
  Users,
  Building,
  Calendar,
  DollarSign,
  Brain,
  Zap,
  Shield,
  UserCheck,
  AlertTriangle,
  BarChart3,
  Eye,
  MousePointer,
  Download,
  Search,
  Phone,
  Mail,
  Linkedin
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

interface IntentSignal {
  id: string;
  contactId?: string;
  companyId?: string;
  signalType: string;
  signalStrength: number;
  source?: string;
  metadata?: any;
  detectedAt: string;
}

interface CompanyIntelligence {
  intelligence: any;
  intentScore: number;
  buyingStage: string;
  champions: any[];
  blockers: any[];
  forecast: {
    winProbability: number;
    predictedCloseDate: string;
    predictedDealSize: number;
    recommendations: string[];
  };
}

interface MicroMoment {
  type: string;
  companyId?: string;
  companyName?: string;
  urgency: string;
  action: string;
  message: string;
  timestamp: string;
}

export default function DealIntelligencePage() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Fetch intelligence insights
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ["/api/intelligence/insights"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch micro-moments/alerts
  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ["/api/intelligence/alerts"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch company intelligence when selected
  const { data: companyIntel, isLoading: companyLoading } = useQuery({
    queryKey: selectedCompanyId ? ["/api/intelligence/company", selectedCompanyId] : null,
    enabled: !!selectedCompanyId,
  });

  // Mutation to capture new signal
  const captureSignal = useMutation({
    mutationFn: (signal: Partial<IntentSignal>) =>
      apiRequest("/api/intelligence/signals", {
        method: "POST",
        body: JSON.stringify(signal),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/intelligence"] });
    },
  });

  const getSignalIcon = (signalType: string) => {
    const icons = {
      website_visit: <Eye className="h-4 w-4" />,
      content_download: <Download className="h-4 w-4" />,
      email_open: <Mail className="h-4 w-4" />,
      price_check: <DollarSign className="h-4 w-4" />,
      competitor_research: <Search className="h-4 w-4" />,
      demo_request: <Calendar className="h-4 w-4" />,
      feature_comparison: <BarChart3 className="h-4 w-4" />,
      case_study_view: <MousePointer className="h-4 w-4" />,
    };
    return icons[signalType] || <Activity className="h-4 w-4" />;
  };

  const getBuyingStageProgress = (stage: string) => {
    const stages = {
      awareness: 20,
      consideration: 40,
      evaluation: 60,
      decision: 80,
      purchase: 100,
    };
    return stages[stage] || 0;
  };

  const getUrgencyColor = (urgency: string) => {
    const colors = {
      critical: "bg-red-500",
      high: "bg-orange-500",
      medium: "bg-yellow-500",
      low: "bg-green-500",
    };
    return colors[urgency] || "bg-gray-500";
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Deal Intelligence Engine</h1>
          <p className="text-muted-foreground">
            AI-powered insights and predictions to optimize your sales engagement
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="dashboard">
              <Activity className="mr-2 h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="companies">
              <Building className="mr-2 h-4 w-4" />
              Companies
            </TabsTrigger>
            <TabsTrigger value="timing">
              <Clock className="mr-2 h-4 w-4" />
              Timing
            </TabsTrigger>
            <TabsTrigger value="predictions">
              <Brain className="mr-2 h-4 w-4" />
              Predictions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Real-time Alerts Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Real-time Micro-Moments
                </CardTitle>
                <CardDescription>
                  Critical engagement opportunities requiring immediate action
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 w-full">
                  {alertsLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Loading alerts...
                    </div>
                  ) : alerts && alerts.length > 0 ? (
                    <div className="space-y-3">
                      {alerts.map((alert: MicroMoment, idx: number) => (
                        <Alert key={idx} className="relative">
                          <div
                            className={`absolute left-0 top-0 bottom-0 w-1 rounded-l ${getUrgencyColor(
                              alert.urgency
                            )}`}
                          />
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle className="flex items-center justify-between">
                            <span>{alert.companyName || "Unknown Company"}</span>
                            <Badge variant={alert.urgency === "critical" ? "destructive" : "default"}>
                              {alert.urgency}
                            </Badge>
                          </AlertTitle>
                          <AlertDescription>
                            <p className="mb-2">{alert.message}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(alert.timestamp), "HH:mm:ss")}
                              </span>
                              <Button size="sm" variant="outline">
                                {alert.action}
                              </Button>
                            </div>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No active micro-moments detected
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Signals</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {insights?.totalSignals || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-500">+12%</span> from last week
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Hot Companies</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {insights?.hotCompanies?.length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Intent score &gt; 70
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Win Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">68%</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-500">+5%</span> improvement
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Predicted Pipeline</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$2.4M</div>
                  <p className="text-xs text-muted-foreground">
                    Next 90 days
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Signal Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Signal Distribution</CardTitle>
                <CardDescription>
                  Breakdown of intent signals by type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {insights?.signalDistribution &&
                    Object.entries(insights.signalDistribution).map(([type, count]) => (
                      <div key={type} className="flex items-center gap-4">
                        <div className="flex items-center gap-2 min-w-[180px]">
                          {getSignalIcon(type)}
                          <span className="text-sm capitalize">
                            {type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="flex-1">
                          <Progress
                            value={(count as number / insights.totalSignals) * 100}
                            className="h-2"
                          />
                        </div>
                        <span className="text-sm font-medium min-w-[40px] text-right">
                          {count as number}
                        </span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Trending Insights */}
            <Card>
              <CardHeader>
                <CardTitle>Market Trends</CardTitle>
                <CardDescription>
                  Detected patterns and changes in buyer behavior
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights?.trendsDetected?.map((trend: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{trend.trend}</p>
                          <p className="text-xs text-muted-foreground">
                            Last {trend.period}
                          </p>
                        </div>
                      </div>
                      <Badge variant={trend.change.startsWith("+") ? "default" : "secondary"}>
                        {trend.change}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="companies" className="space-y-6">
            {/* Company Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Select Company</CardTitle>
                <CardDescription>
                  Choose a company to view detailed intelligence
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedCompanyId || ""} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {insights?.hotCompanies?.map((company: any) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name} (Score: {company.intentScore})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Company Intelligence Profile */}
            {selectedCompanyId && companyIntel && (
              <>
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Intent Score Gauge */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Intent Score</CardTitle>
                      <CardDescription>
                        Overall buying intent strength
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="relative pt-4">
                        <div className="text-center">
                          <div className="text-5xl font-bold">
                            {companyIntel.intentScore}
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            out of 100
                          </p>
                        </div>
                        <Progress
                          value={companyIntel.intentScore}
                          className="mt-4 h-3"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Buying Stage */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Buying Journey</CardTitle>
                      <CardDescription>
                        Current stage in the sales process
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-lg px-3 py-1">
                            {companyIntel.buyingStage}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {getBuyingStageProgress(companyIntel.buyingStage)}% complete
                          </span>
                        </div>
                        <Progress
                          value={getBuyingStageProgress(companyIntel.buyingStage)}
                          className="h-2"
                        />
                        <div className="grid grid-cols-5 gap-1 text-xs text-center">
                          <div>Awareness</div>
                          <div>Consideration</div>
                          <div>Evaluation</div>
                          <div>Decision</div>
                          <div>Purchase</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Champions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <UserCheck className="h-5 w-5 text-green-500" />
                        Champions
                      </CardTitle>
                      <CardDescription>
                        Internal advocates driving the deal forward
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {companyIntel.champions && companyIntel.champions.length > 0 ? (
                        <div className="space-y-3">
                          {companyIntel.champions.map((champion: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback>
                                    {champion.contact?.firstName?.[0]}
                                    {champion.contact?.lastName?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">
                                    {champion.contact?.firstName} {champion.contact?.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {champion.role}
                                  </p>
                                </div>
                              </div>
                              <Badge variant="default">
                                Score: {champion.engagementScore}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No champions identified yet
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Blockers */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-red-500" />
                        Blockers
                      </CardTitle>
                      <CardDescription>
                        Potential obstacles to closing the deal
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {companyIntel.blockers && companyIntel.blockers.length > 0 ? (
                        <div className="space-y-3">
                          {companyIntel.blockers.map((blocker: any, idx: number) => (
                            <div key={idx} className="p-3 border rounded-lg">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                                  <p className="text-sm font-medium">{blocker.type}</p>
                                </div>
                                <Badge
                                  variant={
                                    blocker.severity === "high"
                                      ? "destructive"
                                      : blocker.severity === "medium"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {blocker.severity}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">
                                {blocker.description}
                              </p>
                              <p className="text-xs">
                                <span className="font-medium">Action: </span>
                                {blocker.recommendation}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No blockers detected
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="timing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Optimal Engagement Times</CardTitle>
                <CardDescription>
                  AI-analyzed best times to reach your contacts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-medium">
                      <Phone className="h-5 w-5" />
                      Best Call Times
                    </div>
                    <div className="space-y-2">
                      <div className="p-3 border rounded-lg">
                        <p className="font-medium">Monday 10:00 AM</p>
                        <p className="text-xs text-muted-foreground">
                          85% answer rate
                        </p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <p className="font-medium">Wednesday 2:00 PM</p>
                        <p className="text-xs text-muted-foreground">
                          78% answer rate
                        </p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <p className="font-medium">Thursday 11:00 AM</p>
                        <p className="text-xs text-muted-foreground">
                          72% answer rate
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-medium">
                      <Mail className="h-5 w-5" />
                      Best Email Times
                    </div>
                    <div className="space-y-2">
                      <div className="p-3 border rounded-lg">
                        <p className="font-medium">Tuesday 9:00 AM</p>
                        <p className="text-xs text-muted-foreground">
                          42% open rate
                        </p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <p className="font-medium">Thursday 3:00 PM</p>
                        <p className="text-xs text-muted-foreground">
                          38% open rate
                        </p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <p className="font-medium">Friday 10:00 AM</p>
                        <p className="text-xs text-muted-foreground">
                          35% open rate
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-medium">
                      <Linkedin className="h-5 w-5" />
                      Best LinkedIn Times
                    </div>
                    <div className="space-y-2">
                      <div className="p-3 border rounded-lg">
                        <p className="font-medium">Wednesday 12:00 PM</p>
                        <p className="text-xs text-muted-foreground">
                          65% response rate
                        </p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <p className="font-medium">Tuesday 5:00 PM</p>
                        <p className="text-xs text-muted-foreground">
                          58% response rate
                        </p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <p className="font-medium">Monday 4:00 PM</p>
                        <p className="text-xs text-muted-foreground">
                          52% response rate
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Response Pattern Heatmap */}
            <Card>
              <CardHeader>
                <CardTitle>Response Pattern Analysis</CardTitle>
                <CardDescription>
                  Historical engagement patterns by day and hour
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground py-12">
                  Response pattern heatmap visualization would go here
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="predictions" className="space-y-6">
            {selectedCompanyId && companyIntel?.forecast && (
              <div className="grid gap-6 md:grid-cols-3">
                {/* Win Probability */}
                <Card>
                  <CardHeader>
                    <CardTitle>Win Probability</CardTitle>
                    <CardDescription>
                      AI-predicted chance of closing
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-5xl font-bold">
                        {companyIntel.forecast.winProbability}%
                      </div>
                      <Progress
                        value={companyIntel.forecast.winProbability}
                        className="mt-4 h-3"
                      />
                      <div className="flex items-center justify-center gap-2 mt-4">
                        {companyIntel.forecast.winProbability > 70 ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-sm text-green-500">High confidence</span>
                          </>
                        ) : companyIntel.forecast.winProbability > 40 ? (
                          <>
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm text-yellow-500">Medium confidence</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span className="text-sm text-red-500">At risk</span>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Predicted Deal Size */}
                <Card>
                  <CardHeader>
                    <CardTitle>Predicted Deal Size</CardTitle>
                    <CardDescription>
                      Estimated contract value
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-5xl font-bold">
                        ${(companyIntel.forecast.predictedDealSize / 1000).toFixed(0)}k
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Based on company size and engagement
                      </p>
                      <div className="mt-4 p-3 bg-secondary rounded-lg">
                        <div className="flex justify-between text-sm">
                          <span>Min estimate</span>
                          <span className="font-medium">
                            ${(companyIntel.forecast.predictedDealSize * 0.8 / 1000).toFixed(0)}k
                          </span>
                        </div>
                        <div className="flex justify-between text-sm mt-1">
                          <span>Max estimate</span>
                          <span className="font-medium">
                            ${(companyIntel.forecast.predictedDealSize * 1.3 / 1000).toFixed(0)}k
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Predicted Close Date */}
                <Card>
                  <CardHeader>
                    <CardTitle>Predicted Close Date</CardTitle>
                    <CardDescription>
                      Estimated deal closure timeline
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-3xl font-bold">
                        {format(new Date(companyIntel.forecast.predictedCloseDate), "MMM d, yyyy")}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        {Math.ceil(
                          (new Date(companyIntel.forecast.predictedCloseDate).getTime() -
                            Date.now()) /
                            (1000 * 60 * 60 * 24)
                        )}{" "}
                        days from now
                      </p>
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Current stage</span>
                          <Badge variant="outline">{companyIntel.buyingStage}</Badge>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between text-sm">
                          <span>Velocity</span>
                          <Badge variant="default">Normal</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* AI Recommendations */}
            {selectedCompanyId && companyIntel?.forecast?.recommendations && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    AI Recommendations
                  </CardTitle>
                  <CardDescription>
                    Suggested actions to improve deal outcome
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {companyIntel.forecast.recommendations.map((rec: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className="mt-1">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm">{rec}</p>
                        </div>
                        <Button size="sm" variant="outline">
                          Action
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {!selectedCompanyId && (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a company from the Companies tab to view predictions</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Simulate Data Button for Demo */}
        <div className="fixed bottom-6 right-6">
          <Button
            onClick={() => {
              // Simulate capturing a new intent signal
              captureSignal.mutate({
                companyId: insights?.hotCompanies?.[0]?.id || "comp1",
                signalType: ["website_visit", "content_download", "price_check", "demo_request"][
                  Math.floor(Math.random() * 4)
                ],
                signalStrength: Math.floor(Math.random() * 5) + 6,
                source: "web",
                metadata: { demo: true },
              });
            }}
            className="shadow-lg"
          >
            <Zap className="mr-2 h-4 w-4" />
            Simulate Signal
          </Button>
        </div>
      </div>
    </div>
  );
}