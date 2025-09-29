import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { RefreshCw, Filter, TrendingUp, DollarSign, UserPlus, Rocket, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import InsightCard from "@/components/insight-card";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function Insights() {
  const [selectedType, setSelectedType] = useState("all");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: insights, isLoading, refetch } = useQuery({
    queryKey: ["/api/insights"],
    queryFn: () => api.getInsights({ limit: 50 }),
  });

  const { data: companies } = useQuery({
    queryKey: ["/api/companies"],
    queryFn: () => api.getCompanies(100),
  });

  const discoverInsightsMutation = useMutation({
    mutationFn: api.discoverInsights,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/insights"] });
      toast({
        title: "New Insights Discovered",
        description: "Fresh insights have been added to your feed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to discover new insights. Please try again.",
        variant: "destructive",
      });
    },
  });

  const filteredInsights = insights?.filter((insight: any) => {
    const matchesType = selectedType === "all" || insight.type === selectedType;
    const matchesCompany = selectedCompany === "all" || insight.companyId === selectedCompany;
    return matchesType && matchesCompany;
  });

  const getInsightStats = () => {
    if (!insights) return {};
    
    const stats = insights.reduce((acc: any, insight: any) => {
      acc[insight.type] = (acc[insight.type] || 0) + 1;
      return acc;
    }, {});

    return {
      total: insights.length,
      funding: stats.funding || 0,
      leadership_change: stats.leadership_change || 0,
      product_launch: stats.product_launch || 0,
      hiring: stats.hiring || 0,
    };
  };

  const stats = getInsightStats();

  const handleGenerateMessage = async (insightId: string) => {
    try {
      const recommendations = await api.getInsightRecommendations(insightId);
      toast({
        title: "Message Generated",
        description: "AI has generated a personalized message for this insight.",
      });
      // In a real app, this would open a modal or navigate to content studio
      console.log("Recommendations:", recommendations);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const insightDate = new Date(date);
    const diffMs = now.getTime() - insightDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Insights Engine</h1>
            <p className="text-muted-foreground">AI-powered company intelligence and trigger events</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button 
              onClick={() => discoverInsightsMutation.mutate()}
              disabled={discoverInsightsMutation.isPending}
              data-testid="button-discover"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              {discoverInsightsMutation.isPending ? "Discovering..." : "Discover New"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Insights</p>
                  <p className="text-3xl font-bold" data-testid="text-total-insights">
                    {stats.total || 0}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-chart-1" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Funding</p>
                  <p className="text-3xl font-bold text-chart-1" data-testid="text-funding-insights">
                    {stats.funding || 0}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-chart-1" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Leadership</p>
                  <p className="text-3xl font-bold text-chart-2" data-testid="text-leadership-insights">
                    {stats.leadership_change || 0}
                  </p>
                </div>
                <UserPlus className="h-8 w-8 text-chart-2" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Product</p>
                  <p className="text-3xl font-bold text-chart-4" data-testid="text-product-insights">
                    {stats.product_launch || 0}
                  </p>
                </div>
                <Rocket className="h-8 w-8 text-chart-4" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Hiring</p>
                  <p className="text-3xl font-bold text-chart-3" data-testid="text-hiring-insights">
                    {stats.hiring || 0}
                  </p>
                </div>
                <Briefcase className="h-8 w-8 text-chart-3" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-full md:w-48" data-testid="select-insight-type">
                  <SelectValue placeholder="Insight Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="funding">Funding</SelectItem>
                  <SelectItem value="leadership_change">Leadership Change</SelectItem>
                  <SelectItem value="product_launch">Product Launch</SelectItem>
                  <SelectItem value="hiring">Hiring</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-full md:w-48" data-testid="select-company">
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies?.map((company: any) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Insights Feed */}
        <Card>
          <CardHeader>
            <CardTitle>Insights Feed ({filteredInsights?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading insights...</div>
            ) : filteredInsights?.length ? (
              <div className="divide-y divide-border">
                {filteredInsights.map((insight: any) => (
                  <InsightCard
                    key={insight.id}
                    id={insight.id}
                    type={insight.type}
                    title={insight.title}
                    description={insight.description}
                    timeAgo={getTimeAgo(insight.createdAt)}
                    onGenerateMessage={handleGenerateMessage}
                  />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                  <TrendingUp className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No insights found</h3>
                <p className="text-muted-foreground mb-4">
                  {selectedType === "all" && selectedCompany === "all"
                    ? "Discover new insights to start tracking company intelligence"
                    : "No insights match your current filters"
                  }
                </p>
                <Button 
                  onClick={() => discoverInsightsMutation.mutate()}
                  disabled={discoverInsightsMutation.isPending}
                  data-testid="button-discover-insights"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Discover Insights
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
