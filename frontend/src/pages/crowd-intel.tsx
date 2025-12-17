import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  Brain, 
  TrendingUp, 
  Award, 
  Shield, 
  Eye,
  Upload,
  Star,
  BarChart3,
  Filter,
  Sparkles,
  Lock,
  CheckCircle,
  AlertCircle,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SharedIntel {
  id: string;
  category: string;
  content: any;
  effectiveness: string | null;
  industry: string | null;
  companySize: string | null;
  useCount: number;
  successRate: string | null;
  tags: string[] | null;
  contributorCount: number;
  lastUpdated: string;
}

interface NetworkStats {
  totalIntel: number;
  totalContributors: number;
  avgSuccessRate: number;
  topCategories: { category: string; count: number }[];
  industryBenchmarks: any[];
}

export default function CrowdIntelPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedIndustry, setSelectedIndustry] = useState<string>("");
  const [selectedCompanySize, setSelectedCompanySize] = useState<string>("");
  const [contributeCategory, setContributeCategory] = useState<string>("");
  const [contributeContent, setContributeContent] = useState<string>("");
  const [contributeEffectiveness, setContributeEffectiveness] = useState<string>("");
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);
  const { toast } = useToast();

  // Fetch network statistics
  const { data: stats, isLoading: statsLoading } = useQuery<NetworkStats>({
    queryKey: ["/api/crowd-intel/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch shared intel
  const { data: intel, isLoading: intelLoading } = useQuery<SharedIntel[]>({
    queryKey: ["/api/crowd-intel", { category: selectedCategory, industry: selectedIndustry, companySize: selectedCompanySize }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append("category", selectedCategory);
      if (selectedIndustry) params.append("industry", selectedIndustry);
      if (selectedCompanySize) params.append("companySize", selectedCompanySize);
      params.append("limit", "50");
      
      const response = await fetch(`/api/crowd-intel?${params}`);
      if (!response.ok) throw new Error("Failed to fetch intel");
      return response.json();
    },
  });

  // Fetch benchmarks
  const { data: benchmarks, isLoading: benchmarksLoading } = useQuery({
    queryKey: ["/api/crowd-intel/benchmarks"],
  });

  // Fetch recommendations
  const { data: recommendations } = useQuery<SharedIntel[]>({
    queryKey: ["/api/crowd-intel/recommendations"],
  });

  // Contribute intel mutation
  const contributeMutation = useMutation({
    mutationFn: async (data: {
      category: string;
      content: any;
      effectiveness?: number;
      industry?: string;
      companySize?: string;
      tags?: string[];
    }) => {
      return apiRequest("/api/crowd-intel/contribute", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Intelligence Contributed",
        description: "Thank you for sharing your knowledge with the network!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/crowd-intel"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crowd-intel/stats"] });
      setContributeContent("");
      setContributeEffectiveness("");
    },
    onError: (error: any) => {
      toast({
        title: "Contribution Failed",
        description: error.message || "Failed to contribute intelligence",
        variant: "destructive",
      });
    },
  });

  // Rate intel mutation
  const rateMutation = useMutation({
    mutationFn: async (data: { intelId: string; rating: number; feedback?: string }) => {
      return apiRequest("/api/crowd-intel/rate", "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Rating Submitted",
        description: "Your feedback helps improve the network",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/crowd-intel"] });
    },
  });

  const handleContribute = () => {
    if (!contributeCategory || !contributeContent) {
      toast({
        title: "Missing Information",
        description: "Please provide category and content",
        variant: "destructive",
      });
      return;
    }

    contributeMutation.mutate({
      category: contributeCategory,
      content: { template: contributeContent },
      effectiveness: contributeEffectiveness ? parseFloat(contributeEffectiveness) : undefined,
      industry: selectedIndustry || undefined,
      companySize: selectedCompanySize || undefined,
    });
  };

  const renderStarRating = (rating: number) => {
    return (
      <div className="flex gap-0.5" data-testid="rating-stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Crowd Intelligence Network</h1>
        <p className="text-gray-600">Learn from the collective wisdom of thousands of sales professionals</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <BarChart3 className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="browse" data-testid="tab-browse">
            <Eye className="h-4 w-4 mr-2" />
            Browse Intel
          </TabsTrigger>
          <TabsTrigger value="contribute" data-testid="tab-contribute">
            <Upload className="h-4 w-4 mr-2" />
            Contribute
          </TabsTrigger>
          <TabsTrigger value="benchmarks" data-testid="tab-benchmarks">
            <TrendingUp className="h-4 w-4 mr-2" />
            Benchmarks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Network Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Intel</p>
                    <p className="text-2xl font-bold" data-testid="stat-total-intel">
                      {stats?.totalIntel || 0}
                    </p>
                  </div>
                  <Brain className="h-8 w-8 text-indigo-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Contributors</p>
                    <p className="text-2xl font-bold" data-testid="stat-contributors">
                      {stats?.totalContributors || 0}
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Avg Success Rate</p>
                    <p className="text-2xl font-bold" data-testid="stat-success-rate">
                      {stats?.avgSuccessRate || 0}%
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Your Score</p>
                    <p className="text-2xl font-bold" data-testid="stat-your-score">850</p>
                  </div>
                  <Award className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats?.topCategories?.map((cat, index) => (
                  <div key={cat.category} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                      <span className="font-medium capitalize">{cat.category.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{cat.count} patterns</span>
                      <Badge variant="secondary">Popular</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          {recommendations && recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommended for You</CardTitle>
                <CardDescription>Based on your industry and usage patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recommendations.slice(0, 4).map((item) => (
                    <div key={item.id} className="p-4 border rounded-lg hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <Badge>{item.category}</Badge>
                        {item.effectiveness && (
                          <span className="text-sm font-medium text-green-600">
                            {item.effectiveness}% effective
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {typeof item.content === 'object' ? JSON.stringify(item.content).substring(0, 100) : item.content}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Users className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{item.contributorCount} contributors</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="browse" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filter Intelligence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All categories</SelectItem>
                      <SelectItem value="email_templates">Email Templates</SelectItem>
                      <SelectItem value="objection_handlers">Objection Handlers</SelectItem>
                      <SelectItem value="sequences">Sequences</SelectItem>
                      <SelectItem value="tactics">Tactics</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Industry</Label>
                  <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
                    <SelectTrigger data-testid="select-industry">
                      <SelectValue placeholder="All industries" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All industries</SelectItem>
                      <SelectItem value="SaaS">SaaS</SelectItem>
                      <SelectItem value="Fintech">Fintech</SelectItem>
                      <SelectItem value="Healthcare">Healthcare</SelectItem>
                      <SelectItem value="Ecommerce">Ecommerce</SelectItem>
                      <SelectItem value="Enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Company Size</Label>
                  <Select value={selectedCompanySize} onValueChange={setSelectedCompanySize}>
                    <SelectTrigger data-testid="select-company-size">
                      <SelectValue placeholder="All sizes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All sizes</SelectItem>
                      <SelectItem value="1-10">1-10</SelectItem>
                      <SelectItem value="11-50">11-50</SelectItem>
                      <SelectItem value="51-200">51-200</SelectItem>
                      <SelectItem value="201-500">201-500</SelectItem>
                      <SelectItem value="500+">500+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Intel List */}
          <div className="space-y-4">
            {intelLoading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : intel && intel.length > 0 ? (
              intel.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <Badge>{item.category.replace('_', ' ')}</Badge>
                        {item.industry && <Badge variant="outline">{item.industry}</Badge>}
                        {item.companySize && <Badge variant="outline">{item.companySize} employees</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.successRate && (
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-600">
                              {item.successRate}% success
                            </span>
                          </div>
                        )}
                        {item.effectiveness && (
                          <div className="flex items-center gap-1">
                            <Sparkles className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-600">
                              {item.effectiveness}% effective
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mb-4">
                      <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
                        {typeof item.content === 'object' 
                          ? JSON.stringify(item.content, null, 2) 
                          : item.content}
                      </pre>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {item.contributorCount} contributors
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          {item.useCount} uses
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const rating = prompt("Rate this intel (1-5):");
                          if (rating && !isNaN(Number(rating))) {
                            rateMutation.mutate({ 
                              intelId: item.id, 
                              rating: Number(rating) 
                            });
                          }
                        }}
                        data-testid={`button-rate-${item.id}`}
                      >
                        <Star className="h-4 w-4 mr-1" />
                        Rate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-gray-600">No intelligence found for the selected filters</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="contribute" className="space-y-6">
          {/* Privacy Notice */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Privacy Protected:</strong> All contributions are automatically anonymized. 
              Company names, personal information, and identifying details are removed before sharing.
              <Button
                variant="link"
                size="sm"
                onClick={() => setShowPrivacyInfo(!showPrivacyInfo)}
                className="ml-2"
              >
                Learn more
              </Button>
            </AlertDescription>
          </Alert>

          {showPrivacyInfo && (
            <Card>
              <CardHeader>
                <CardTitle>What We Share & What We Don't</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-green-600 mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      What We Share
                    </h4>
                    <ul className="text-sm space-y-1 text-gray-600">
                      <li>• Template structures and patterns</li>
                      <li>• Success rates and metrics</li>
                      <li>• Industry and company size ranges</li>
                      <li>• General best practices</li>
                      <li>• Aggregated performance data</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-red-600 mb-2 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      What We Never Share
                    </h4>
                    <ul className="text-sm space-y-1 text-gray-600">
                      <li>• Company names or logos</li>
                      <li>• Personal names or emails</li>
                      <li>• Specific deal information</li>
                      <li>• Phone numbers or addresses</li>
                      <li>• Your identity or organization</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contribution Form */}
          <Card>
            <CardHeader>
              <CardTitle>Share Your Success</CardTitle>
              <CardDescription>
                Help the community by sharing what works for you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Category *</Label>
                <Select value={contributeCategory} onValueChange={setContributeCategory}>
                  <SelectTrigger data-testid="select-contribute-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email_templates">Email Template</SelectItem>
                    <SelectItem value="objection_handlers">Objection Handler</SelectItem>
                    <SelectItem value="sequences">Sequence</SelectItem>
                    <SelectItem value="tactics">Sales Tactic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Content *</Label>
                <Textarea
                  placeholder="Share your template, script, or tactic..."
                  value={contributeContent}
                  onChange={(e) => setContributeContent(e.target.value)}
                  rows={6}
                  className="font-mono text-sm"
                  data-testid="input-contribute-content"
                />
              </div>

              <div>
                <Label>Effectiveness (Optional)</Label>
                <Input
                  type="number"
                  placeholder="Success rate (0-100)"
                  value={contributeEffectiveness}
                  onChange={(e) => setContributeEffectiveness(e.target.value)}
                  min="0"
                  max="100"
                  data-testid="input-effectiveness"
                />
              </div>

              <Button 
                onClick={handleContribute} 
                disabled={contributeMutation.isPending}
                className="w-full"
                data-testid="button-contribute"
              >
                {contributeMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Contributing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Contribute to Network
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="benchmarks" className="space-y-6">
          {/* Industry Benchmarks */}
          <Card>
            <CardHeader>
              <CardTitle>Industry Benchmarks</CardTitle>
              <CardDescription>
                See how your metrics compare to industry averages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Email Metrics */}
                <div>
                  <h3 className="font-medium mb-3">Email Performance</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Open Rate</span>
                      <div className="flex items-center gap-4">
                        <Progress value={35} className="w-32" />
                        <span className="text-sm font-medium w-12">35%</span>
                        <Badge variant="outline" className="text-green-600">
                          <ArrowUp className="h-3 w-3 mr-1" />
                          +5%
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Reply Rate</span>
                      <div className="flex items-center gap-4">
                        <Progress value={8} className="w-32" />
                        <span className="text-sm font-medium w-12">8%</span>
                        <Badge variant="outline" className="text-red-600">
                          <ArrowDown className="h-3 w-3 mr-1" />
                          -2%
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Meeting Rate</span>
                      <div className="flex items-center gap-4">
                        <Progress value={3} className="w-32" />
                        <span className="text-sm font-medium w-12">3%</span>
                        <Badge variant="outline">On par</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Phone Metrics */}
                <div>
                  <h3 className="font-medium mb-3">Phone Performance</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Connect Rate</span>
                      <div className="flex items-center gap-4">
                        <Progress value={12} className="w-32" />
                        <span className="text-sm font-medium w-12">12%</span>
                        <Badge variant="outline">Industry avg</Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Conversion Rate</span>
                      <div className="flex items-center gap-4">
                        <Progress value={25} className="w-32" />
                        <span className="text-sm font-medium w-12">25%</span>
                        <Badge variant="outline" className="text-green-600">
                          <ArrowUp className="h-3 w-3 mr-1" />
                          +8%
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Benchmark Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Your Performance vs Network Average</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="mb-2">
                    <span className="text-3xl font-bold text-green-600">+12%</span>
                  </div>
                  <p className="text-sm text-gray-600">Above average</p>
                  <p className="text-xs text-gray-500 mt-1">Email engagement</p>
                </div>
                <div className="text-center">
                  <div className="mb-2">
                    <span className="text-3xl font-bold text-yellow-600">0%</span>
                  </div>
                  <p className="text-sm text-gray-600">At average</p>
                  <p className="text-xs text-gray-500 mt-1">Meeting bookings</p>
                </div>
                <div className="text-center">
                  <div className="mb-2">
                    <span className="text-3xl font-bold text-red-600">-5%</span>
                  </div>
                  <p className="text-sm text-gray-600">Below average</p>
                  <p className="text-xs text-gray-500 mt-1">Deal velocity</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}