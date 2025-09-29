import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { RefreshCw, Filter, Search, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import VisitorCard from "@/components/visitor-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export default function VisitorIntelligence() {
  const [searchTerm, setSearchTerm] = useState("");
  const [intentFilter, setIntentFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");

  const { data: activeVisitors, isLoading, refetch } = useQuery({
    queryKey: ["/api/visitors/active"],
  });

  const { data: companies } = useQuery({
    queryKey: ["/api/companies"],
    queryFn: () => api.getCompanies(100),
  });

  const filteredVisitors = activeVisitors?.filter((visitor: any) => {
    const matchesSearch = visitor.company.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesIntent = intentFilter === "all" || 
      (intentFilter === "high" && visitor.intentScore >= 80) ||
      (intentFilter === "medium" && visitor.intentScore >= 60 && visitor.intentScore < 80) ||
      (intentFilter === "low" && visitor.intentScore < 60);
    const matchesIndustry = industryFilter === "all" || visitor.company.industry === industryFilter;
    
    return matchesSearch && matchesIntent && matchesIndustry;
  });

  const industries = [...new Set(companies?.map((c: any) => c.industry).filter(Boolean))];

  const getIntentStats = () => {
    if (!activeVisitors) return { high: 0, medium: 0, low: 0 };
    
    return activeVisitors.reduce((acc: any, visitor: any) => {
      if (visitor.intentScore >= 80) acc.high++;
      else if (visitor.intentScore >= 60) acc.medium++;
      else acc.low++;
      return acc;
    }, { high: 0, medium: 0, low: 0 });
  };

  const intentStats = getIntentStats();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Visitor Intelligence</h1>
            <p className="text-muted-foreground">Track and analyze website visitors in real-time</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Visitors</p>
                  <p className="text-3xl font-bold text-chart-1" data-testid="text-active-visitors">
                    {activeVisitors?.length || 0}
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
                  <p className="text-sm text-muted-foreground">High Intent</p>
                  <p className="text-3xl font-bold text-chart-1" data-testid="text-high-intent">
                    {intentStats.high}
                  </p>
                </div>
                <Badge className="bg-chart-1 text-background">80+</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Medium Intent</p>
                  <p className="text-3xl font-bold text-chart-2" data-testid="text-medium-intent">
                    {intentStats.medium}
                  </p>
                </div>
                <Badge className="bg-chart-2 text-background">60-79</Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Low Intent</p>
                  <p className="text-3xl font-bold text-chart-4" data-testid="text-low-intent">
                    {intentStats.low}
                  </p>
                </div>
                <Badge className="bg-chart-4 text-background">&lt;60</Badge>
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
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search companies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-companies"
                  />
                </div>
              </div>
              <Select value={intentFilter} onValueChange={setIntentFilter}>
                <SelectTrigger className="w-full md:w-48" data-testid="select-intent-filter">
                  <SelectValue placeholder="Intent Score" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Intent Levels</SelectItem>
                  <SelectItem value="high">High Intent (80+)</SelectItem>
                  <SelectItem value="medium">Medium Intent (60-79)</SelectItem>
                  <SelectItem value="low">Low Intent (&lt;60)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger className="w-full md:w-48" data-testid="select-industry-filter">
                  <SelectValue placeholder="Industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  {industries.map((industry: string) => (
                    <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Visitor List */}
        <Card>
          <CardHeader>
            <CardTitle>Active Visitors ({filteredVisitors?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading visitors...</div>
            ) : filteredVisitors?.length ? (
              <div className="divide-y divide-border">
                {filteredVisitors.map((visitor: any) => (
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
              <div className="p-8 text-center text-muted-foreground">
                No visitors match your current filters
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
