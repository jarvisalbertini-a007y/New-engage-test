import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, Target, Brain, Users, BarChart, AlertCircle,
  Zap, Plus, Settings, Activity, CheckCircle, ArrowUp,
  Mail, Phone, Calendar, DollarSign, Clock, MousePointer,
  FileText, MessageSquare, Shield, Sparkles, ArrowRight,
  ChevronUp, ChevronDown, Filter, Download, RefreshCw,
  UserPlus, Building, Globe, Award, Gauge, Play
} from "lucide-react";
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  Legend
} from "recharts";
import type { LeadScoringModel, LeadScore, Contact } from "@shared/schema";

// Score category colors
const scoreColors = {
  hot: "#ef4444",
  warm: "#f59e0b",
  cold: "#3b82f6"
};

// Scoring factors with weights
const scoringFactors = {
  behavioral: [
    { name: "Email Opens", weight: 10, icon: Mail },
    { name: "Link Clicks", weight: 15, icon: MousePointer },
    { name: "Website Visits", weight: 20, icon: Globe },
    { name: "Content Downloads", weight: 25, icon: FileText },
    { name: "Demo Requests", weight: 30, icon: Calendar }
  ],
  demographic: [
    { name: "Job Title Match", weight: 20, icon: UserPlus },
    { name: "Company Size", weight: 15, icon: Building },
    { name: "Industry Match", weight: 15, icon: Award },
    { name: "Location", weight: 10, icon: Globe }
  ],
  engagement: [
    { name: "Reply Rate", weight: 25, icon: MessageSquare },
    { name: "Meeting Attendance", weight: 30, icon: Calendar },
    { name: "Call Duration", weight: 20, icon: Phone },
    { name: "Response Time", weight: 15, icon: Clock }
  ]
};

export function LeadScoringPage() {
  const { toast } = useToast();
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [showCreateModel, setShowCreateModel] = useState(false);
  const [scoreFilter, setScoreFilter] = useState<"all" | "hot" | "warm" | "cold">("all");

  // Fetch scoring models
  const { data: models, isLoading: modelsLoading } = useQuery<LeadScoringModel[]>({
    queryKey: ["/api/lead-scoring-models"],
  });

  // Fetch lead scores
  const { data: scores, isLoading: scoresLoading } = useQuery<LeadScore[]>({
    queryKey: ["/api/lead-scores", selectedModel],
    enabled: !!selectedModel,
  });

  // Fetch contacts for scoring
  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  // Create model mutation
  const createModel = useMutation({
    mutationFn: async (model: any) => {
      return apiRequest("/api/lead-scoring-models", "POST", model);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scoring-models"] });
      setShowCreateModel(false);
      toast({
        title: "Model Created!",
        description: "Lead scoring model has been created successfully.",
      });
    },
  });

  // Create score mutation
  const createScore = useMutation({
    mutationFn: async (score: any) => {
      return apiRequest("/api/lead-scores", "POST", score);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scores"] });
      toast({
        title: "Lead Scored!",
        description: "Lead has been scored successfully.",
      });
    },
  });

  // Update model mutation
  const updateModel = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      return apiRequest(`/api/lead-scoring-models/${id}`, "PATCH", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lead-scoring-models"] });
    },
  });

  // Calculate metrics
  const activeModel = models?.find(m => m.id === selectedModel);
  const hotLeads = scores?.filter(s => s.category === "hot").length || 0;
  const warmLeads = scores?.filter(s => s.category === "warm").length || 0;
  const coldLeads = scores?.filter(s => s.category === "cold").length || 0;
  const averageScore = scores?.reduce((sum, s) => sum + s.score, 0) / (scores?.length || 1) || 0;

  // Prepare chart data
  const distributionData = [
    { name: "Hot", value: hotLeads, fill: scoreColors.hot },
    { name: "Warm", value: warmLeads, fill: scoreColors.warm },
    { name: "Cold", value: coldLeads, fill: scoreColors.cold }
  ];

  const scoreRangeData = [
    { range: "0-25", count: scores?.filter(s => s.score <= 25).length || 0 },
    { range: "26-50", count: scores?.filter(s => s.score > 25 && s.score <= 50).length || 0 },
    { range: "51-75", count: scores?.filter(s => s.score > 50 && s.score <= 75).length || 0 },
    { range: "76-100", count: scores?.filter(s => s.score > 75).length || 0 }
  ];

  const conversionData = [
    { name: "Conversion Rate", value: activeModel?.accuracy || 0, fill: "#10b981" }
  ];

  // Filter scores based on category
  const filteredScores = scores?.filter(s => 
    scoreFilter === "all" || s.category === scoreFilter
  ) || [];

  // Get top scoring leads
  const topLeads = [...(filteredScores || [])]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const runScoringModel = async () => {
    if (!selectedModel || !contacts || !activeModel) return;

    // Score all contacts with the selected model
    for (const contact of contacts) {
      const score = calculateScore(contact, activeModel);
      await createScore.mutateAsync({
        contactId: contact.id,
        modelId: selectedModel,
        score: score.score,
        category: score.category,
        factors: score.factors,
        predictedConversionRate: score.conversionRate,
        daysToConvert: score.daysToConvert,
        nextBestAction: score.nextBestAction
      });
    }
  };

  const calculateScore = (contact: any, model: LeadScoringModel) => {
    // Simulate AI scoring calculation
    const baseScore = Math.floor(Math.random() * 40) + 30;
    const titleBonus = contact.title?.includes("VP") || contact.title?.includes("Director") ? 20 : 0;
    const engagementBonus = Math.floor(Math.random() * 30);
    
    const totalScore = Math.min(100, baseScore + titleBonus + engagementBonus);
    
    return {
      score: totalScore,
      category: totalScore >= 75 ? "hot" : totalScore >= 50 ? "warm" : "cold",
      factors: {
        behavioral: Math.floor(Math.random() * 30) + 20,
        demographic: titleBonus,
        engagement: engagementBonus
      },
      conversionRate: totalScore >= 75 ? Math.floor(Math.random() * 30) + 50 : 
                      totalScore >= 50 ? Math.floor(Math.random() * 30) + 20 : 
                      Math.floor(Math.random() * 20),
      daysToConvert: totalScore >= 75 ? Math.floor(Math.random() * 14) + 7 :
                     totalScore >= 50 ? Math.floor(Math.random() * 30) + 14 :
                     Math.floor(Math.random() * 60) + 30,
      nextBestAction: totalScore >= 75 ? "Schedule Demo" :
                     totalScore >= 50 ? "Send Personalized Email" :
                     "Add to Nurture Campaign"
    };
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl mb-2 flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" />
              Predictive Lead Scoring
            </h1>
            <p className="text-muted-foreground">
              AI-powered lead scoring to prioritize your outreach efforts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[200px]" data-testid="select-model">
                <SelectValue placeholder="Select Model" />
              </SelectTrigger>
              <SelectContent>
                {models?.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => setShowCreateModel(true)}
              data-testid="button-create-model"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Model
            </Button>
            <Button
              variant="outline"
              onClick={runScoringModel}
              disabled={!selectedModel}
              data-testid="button-run-scoring"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Scoring
            </Button>
          </div>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Hot Leads</p>
                  <p className="text-2xl font-bold text-red-500">{hotLeads}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-red-500 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Ready to buy</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Warm Leads</p>
                  <p className="text-2xl font-bold text-yellow-500">{warmLeads}</p>
                </div>
                <Target className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Engaged</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cold Leads</p>
                  <p className="text-2xl font-bold text-blue-500">{coldLeads}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Need nurturing</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Score</p>
                  <p className="text-2xl font-bold">{Math.round(averageScore)}</p>
                </div>
                <Gauge className="h-8 w-8 text-primary opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Out of 100</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Model Accuracy</p>
                  <p className="text-2xl font-bold text-green-500">
                    {activeModel?.accuracy || 0}%
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Prediction rate</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="scores" className="space-y-4">
          <TabsList>
            <TabsTrigger value="scores">Lead Scores</TabsTrigger>
            <TabsTrigger value="models">Scoring Models</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="factors">Scoring Factors</TabsTrigger>
          </TabsList>

          <TabsContent value="scores" className="space-y-4">
            {/* Score Filters */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              {(["all", "hot", "warm", "cold"] as const).map((category) => (
                <Button
                  key={category}
                  variant={scoreFilter === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setScoreFilter(category)}
                  className="capitalize"
                  data-testid={`filter-${category}`}
                >
                  {category === "all" ? "All Leads" : category}
                </Button>
              ))}
            </div>

            {/* Top Scoring Leads */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Top Scoring Leads</CardTitle>
                  <CardDescription>Your highest priority prospects</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topLeads.map((lead, idx) => (
                    <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-semibold text-muted-foreground">
                          #{idx + 1}
                        </div>
                        <div>
                          <p className="font-medium">Contact {lead.contactId}</p>
                          <p className="text-sm text-muted-foreground">
                            {lead.nextBestAction}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <span className="text-xl font-bold">{lead.score}</span>
                            <span className="text-sm text-muted-foreground">/100</span>
                          </div>
                          <Badge
                            variant={
                              lead.category === "hot" ? "destructive" :
                              lead.category === "warm" ? "default" : "secondary"
                            }
                          >
                            {lead.category}
                          </Badge>
                        </div>
                        {lead.score >= 75 && (
                          <TrendingUp className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Score Distribution</CardTitle>
                  <CardDescription>Lead categories breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={distributionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {distributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Lead Score Table */}
            <Card>
              <CardHeader>
                <CardTitle>All Lead Scores</CardTitle>
                <CardDescription>
                  Complete list of scored leads with AI predictions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredScores.map((score) => (
                    <div key={score.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-lg font-bold">{score.score}</span>
                        </div>
                        <div>
                          <p className="font-medium">Contact {score.contactId}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{score.predictedConversionRate}% conversion probability</span>
                            <span>•</span>
                            <span>{score.daysToConvert} days to close</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            score.category === "hot" ? "destructive" :
                            score.category === "warm" ? "default" : "secondary"
                          }
                        >
                          {score.category}
                        </Badge>
                        <Button variant="ghost" size="sm" data-testid={`button-action-${score.id}`}>
                          {score.nextBestAction}
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="models" className="space-y-4">
            {models && models.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {models.map((model) => (
                  <Card key={model.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{model.name}</CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {model.description}
                          </CardDescription>
                        </div>
                        <Badge variant={model.isActive ? "default" : "secondary"}>
                          {model.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Type</span>
                          <span className="font-medium capitalize">{model.modelType}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Accuracy</span>
                          <span className="font-medium text-green-500">{model.accuracy || 0}%</span>
                        </div>
                        {model.lastTrained && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Last Trained</span>
                            <span className="font-medium">
                              {new Date(model.lastTrained).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {model.thresholds && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">THRESHOLDS</p>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                Hot
                              </span>
                              <span>≥ {typeof model.thresholds === 'object' && model.thresholds !== null && 'hot' in model.thresholds ? (model.thresholds as any).hot : 75}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                Warm
                              </span>
                              <span>≥ {typeof model.thresholds === 'object' && model.thresholds !== null && 'warm' in model.thresholds ? (model.thresholds as any).warm : 50}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                Cold
                              </span>
                              <span>&lt; {typeof model.thresholds === 'object' && model.thresholds !== null && 'warm' in model.thresholds ? (model.thresholds as any).warm : 50}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setSelectedModel(model.id)}
                          data-testid={`button-use-${model.id}`}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Use
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-settings-${model.id}`}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12">
                <div className="text-center space-y-3">
                  <Brain className="h-12 w-12 text-muted-foreground mx-auto" />
                  <h3 className="font-semibold">No Scoring Models</h3>
                  <p className="text-sm text-muted-foreground">
                    Create your first AI scoring model to start prioritizing leads
                  </p>
                  <Button onClick={() => setShowCreateModel(true)} data-testid="button-create-first">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Model
                  </Button>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Score Range Distribution</CardTitle>
                  <CardDescription>Lead distribution across score ranges</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <RechartsBarChart data={scoreRangeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8b5cf6" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Conversion Prediction</CardTitle>
                  <CardDescription>AI model conversion accuracy</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <RadialBarChart cx="50%" cy="50%" innerRadius="10%" outerRadius="80%" data={conversionData}>
                      <RadialBar
                        dataKey="value"
                        fill="#10b981"
                      />
                      <Legend />
                      <Tooltip />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Scoring Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Scoring Trends</CardTitle>
                <CardDescription>Lead score changes over time</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center">
                <div className="text-center space-y-2">
                  <BarChart className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Score trends will appear here as you track lead progression
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="factors" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {Object.entries(scoringFactors).map(([category, factors]) => (
                <Card key={category}>
                  <CardHeader>
                    <CardTitle className="capitalize">{category} Factors</CardTitle>
                    <CardDescription>
                      Weighted scoring components
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {factors.map((factor) => (
                      <div key={factor.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <factor.icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{factor.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={factor.weight * 3} className="w-20" />
                          <span className="text-sm font-medium w-8">+{factor.weight}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* AI Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Scoring Insights
                </CardTitle>
                <CardDescription>
                  Machine learning patterns and recommendations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">High Correlation Found</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Leads who download whitepapers and attend webinars have 3x higher conversion rate
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Model Improvement Suggestion</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Adding "budget confirmed" as a scoring factor could improve accuracy by 15%
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Trend Analysis</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Enterprise leads score 25 points higher on average than SMB leads
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Model Modal */}
        {showCreateModel && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl">
              <CardHeader>
                <CardTitle>Create Scoring Model</CardTitle>
                <CardDescription>
                  Configure your AI-powered lead scoring model
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Model Name</Label>
                  <Input
                    placeholder="e.g., Enterprise B2B Scoring"
                    data-testid="input-model-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    placeholder="Describe what this model scores"
                    data-testid="input-model-description"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Model Type</Label>
                  <Select defaultValue="predictive">
                    <SelectTrigger data-testid="select-model-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="predictive">Predictive</SelectItem>
                      <SelectItem value="behavioral">Behavioral</SelectItem>
                      <SelectItem value="demographic">Demographic</SelectItem>
                      <SelectItem value="firmographic">Firmographic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Score Thresholds</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs">Hot (≥)</Label>
                      <Input type="number" defaultValue="75" data-testid="input-hot-threshold" />
                    </div>
                    <div>
                      <Label className="text-xs">Warm (≥)</Label>
                      <Input type="number" defaultValue="50" data-testid="input-warm-threshold" />
                    </div>
                    <div>
                      <Label className="text-xs">Cold (&lt;50)</Label>
                      <Input type="number" defaultValue="50" disabled />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      createModel.mutate({
                        name: "Enterprise B2B Scoring",
                        description: "AI model for enterprise leads",
                        modelType: "predictive",
                        scoringFactors: scoringFactors,
                        thresholds: { hot: 75, warm: 50 },
                        isActive: true,
                        accuracy: Math.floor(Math.random() * 20) + 75
                      });
                    }}
                    data-testid="button-create"
                  >
                    Create Model
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateModel(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}