import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, Bot, Crown, Zap, Wrench, Users, ChevronRight, 
  Play, Settings, FileSearch, Send, CheckCircle, Calendar,
  FileText, BarChart, Link2, Database, ArrowUpRight, 
  Sparkles, Activity, TrendingUp, Download, Star, Filter,
  Grid3x3, List, ExternalLink, ChevronDown
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AgentCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
}

interface AgentTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  longDescription: string | null;
  tier: "leader" | "specialist" | "worker";
  domain: string;
  complexity: "simple" | "moderate" | "complex" | "expert";
  capabilities: string[];
  systemPrompt: string;
  tags: string[];
  requiredIntegrations: string[] | null;
  categoryId: string | null;
  popularity: number;
  rating: string | null;
  reviewCount: number;
  isActive: boolean;
}

interface DeployedAgent {
  id: string;
  orgId: string;
  templateId: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
}

interface AgentExecution {
  id: string;
  deployedAgentId: string;
  status: string;
  targetType: string | null;
  targetId: string | null;
  inputContext: any;
  aiResponse: string | null;
  parsedActions: any;
  actionsExecuted: any;
  error: string | null;
  executionTimeMs: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface CatalogStats {
  categories: number;
  templates: number;
  byTier: {
    leaders: number;
    specialists: number;
    workers: number;
  };
}

const tierConfig = {
  leader: {
    label: "Department Leader",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    icon: Crown,
    description: "Coordinates specialist and worker agents",
  },
  specialist: {
    label: "Specialist",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    icon: Zap,
    description: "Expert in specific domains",
  },
  worker: {
    label: "Worker",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: Wrench,
    description: "Executes focused tasks",
  },
};

const domainIcons: Record<string, any> = {
  prospecting: Search,
  research: FileSearch,
  outreach: Send,
  qualification: CheckCircle,
  scheduling: Calendar,
  content: FileText,
  analysis: BarChart,
  integration: Link2,
  data: Database,
  management: Users,
};

const complexityColors = {
  simple: "bg-green-500/10 text-green-400",
  moderate: "bg-yellow-500/10 text-yellow-400",
  complex: "bg-orange-500/10 text-orange-400",
  expert: "bg-red-500/10 text-red-400",
};

export default function AgentCatalogPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);
  const [showExecutionDialog, setShowExecutionDialog] = useState(false);
  const [selectedDeployedAgent, setSelectedDeployedAgent] = useState<DeployedAgent | null>(null);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const { toast } = useToast();

  // Fetch catalog stats
  const { data: stats, isLoading: loadingStats } = useQuery<CatalogStats>({
    queryKey: ["/api/agent-catalog/stats"],
  });

  // Fetch categories
  const { data: categories = [], isLoading: loadingCategories } = useQuery<AgentCategory[]>({
    queryKey: ["/api/agent-catalog/categories"],
  });

  // Fetch templates
  const { data: templates = [], isLoading: loadingTemplates } = useQuery<AgentTemplate[]>({
    queryKey: ["/api/agent-catalog/templates", selectedDomain, selectedTier, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedDomain !== "all") params.set("domain", selectedDomain);
      if (selectedTier !== "all") params.set("tier", selectedTier);
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/agent-catalog/templates?${params}`);
      return res.json();
    },
  });

  // Fetch deployed agents
  const { data: deployedAgents = [] } = useQuery<DeployedAgent[]>({
    queryKey: ["/api/agent-catalog/deployed"],
  });

  // Seed catalog mutation
  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/agent-catalog/seed");
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.alreadySeeded) {
        toast({
          title: "Catalog Ready",
          description: "Agent catalog is already populated.",
        });
      } else {
        toast({
          title: "Catalog Seeded",
          description: `Added ${data.categories} categories and ${data.templates} templates.`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/agent-catalog"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to seed catalog",
        variant: "destructive",
      });
    },
  });

  // Deploy agent mutation
  const deployMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await apiRequest("POST", "/api/agent-catalog/deploy", { templateId });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Agent Deployed",
        description: "Agent is now active in your organization.",
      });
      setSelectedTemplate(null);
      setIsDeploying(false);
      queryClient.invalidateQueries({ queryKey: ["/api/agent-catalog/deployed"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to deploy agent",
        variant: "destructive",
      });
      setIsDeploying(false);
    },
  });

  // Run agent mutation
  const runMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const res = await apiRequest("POST", `/api/agent-catalog/deployed/${agentId}/run`, {
        targetType: "lead",
        action: "analyze"
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setExecutionResult(data);
      toast({
        title: "Agent Executed",
        description: data.execution?.status === "completed" 
          ? `Completed in ${data.execution.executionTimeMs}ms with ${data.actionsExecuted?.length || 0} actions`
          : "Agent execution completed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-catalog/deployed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-catalog/deployed", selectedDeployedAgent?.id, "executions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Execution Failed",
        description: error.message || "Failed to run agent",
        variant: "destructive",
      });
      setExecutionResult(null);
    },
    onSettled: () => {
      setRunningAgentId(null);
    }
  });

  // Fetch executions for selected deployed agent
  const { data: executions = [] } = useQuery<AgentExecution[]>({
    queryKey: ["/api/agent-catalog/deployed", selectedDeployedAgent?.id, "executions"],
    queryFn: async () => {
      if (!selectedDeployedAgent?.id) return [];
      const res = await fetch(`/api/agent-catalog/deployed/${selectedDeployedAgent.id}/executions`);
      return res.json();
    },
    enabled: !!selectedDeployedAgent?.id,
  });

  // Auto-seed on mount if empty
  useEffect(() => {
    if (stats && stats.templates === 0) {
      seedMutation.mutate();
    }
  }, [stats]);

  const filteredTemplates = templates.filter(t => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return t.name.toLowerCase().includes(query) || 
             t.description.toLowerCase().includes(query) ||
             t.tags?.some(tag => tag.toLowerCase().includes(query));
    }
    return true;
  });

  const groupedByDomain = filteredTemplates.reduce((acc, template) => {
    const domain = template.domain;
    if (!acc[domain]) acc[domain] = [];
    acc[domain].push(template);
    return acc;
  }, {} as Record<string, AgentTemplate[]>);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-foreground mb-2" data-testid="page-title">
                Agent Catalog
              </h1>
              <p className="text-sm text-muted-foreground">
                Deploy autonomous agents from our library of 100+ pre-built templates
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                data-testid="toggle-view-mode"
              >
                {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid3x3 className="h-4 w-4" />}
              </Button>
              {stats && stats.templates === 0 && (
                <Button 
                  onClick={() => seedMutation.mutate()} 
                  disabled={seedMutation.isPending}
                  data-testid="seed-catalog-btn"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Initialize Catalog
                </Button>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold font-mono" data-testid="stat-total-agents">
                      {loadingStats ? "—" : stats?.templates || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Agents</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Crown className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold font-mono" data-testid="stat-leaders">
                      {loadingStats ? "—" : stats?.byTier.leaders || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Leaders</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold font-mono" data-testid="stat-specialists">
                      {loadingStats ? "—" : stats?.byTier.specialists || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Specialists</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Wrench className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold font-mono" data-testid="stat-workers">
                      {loadingStats ? "—" : stats?.byTier.workers || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Workers</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold font-mono" data-testid="stat-deployed">
                      {deployedAgents.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Deployed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search agents by name, description, or tags..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="search-agents"
              />
            </div>
            <Select value={selectedDomain} onValueChange={setSelectedDomain}>
              <SelectTrigger className="w-full md:w-48" data-testid="filter-domain">
                <SelectValue placeholder="All Domains" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Domains</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.slug}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedTier} onValueChange={setSelectedTier}>
              <SelectTrigger className="w-full md:w-48" data-testid="filter-tier">
                <SelectValue placeholder="All Tiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="leader">Leaders</SelectItem>
                <SelectItem value="specialist">Specialists</SelectItem>
                <SelectItem value="worker">Workers</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Agent Hierarchy Visualization */}
        {selectedDomain === "all" && !searchQuery && (
          <div className="mb-8">
            <h2 className="text-lg font-medium mb-4">Agent Hierarchy</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {(["leader", "specialist", "worker"] as const).map((tier) => {
                const config = tierConfig[tier];
                const TierIcon = config.icon;
                const tierAgents = filteredTemplates.filter(t => t.tier === tier).slice(0, 5);
                
                return (
                  <Card key={tier} className="bg-card/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", config.color)}>
                          <TierIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{config.label}s</CardTitle>
                          <CardDescription className="text-xs">{config.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {tierAgents.map(agent => {
                          const DomainIcon = domainIcons[agent.domain] || Bot;
                          return (
                            <button
                              key={agent.id}
                              onClick={() => setSelectedTemplate(agent)}
                              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors text-left"
                              data-testid={`agent-quick-${agent.slug}`}
                            >
                              <DomainIcon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm truncate flex-1">{agent.name}</span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </button>
                          );
                        })}
                        {tierAgents.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No agents in this tier
                          </p>
                        )}
                      </div>
                    </CardContent>
                    {tierAgents.length > 0 && (
                      <CardFooter className="pt-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => setSelectedTier(tier)}
                          data-testid={`view-all-${tier}`}
                        >
                          View all {config.label.toLowerCase()}s
                          <ArrowUpRight className="h-4 w-4 ml-2" />
                        </Button>
                      </CardFooter>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Agent Grid/List */}
        <Tabs defaultValue="browse" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="browse" data-testid="tab-browse">Browse Catalog</TabsTrigger>
            <TabsTrigger value="deployed" data-testid="tab-deployed">
              Deployed Agents ({deployedAgents.length})
            </TabsTrigger>
            <TabsTrigger value="by-domain" data-testid="tab-by-domain">By Domain</TabsTrigger>
          </TabsList>

          <TabsContent value="browse">
            {loadingTemplates ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Card key={i} className="bg-card/50">
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-4 w-1/2 mb-2" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredTemplates.length === 0 ? (
              <Card className="bg-card/50">
                <CardContent className="py-12 text-center">
                  <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Agents Found</h3>
                  <p className="text-muted-foreground text-sm">
                    {searchQuery ? "Try adjusting your search or filters" : "Initialize the catalog to get started"}
                  </p>
                </CardContent>
              </Card>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map(template => (
                  <AgentCard
                    key={template.id}
                    template={template}
                    onSelect={() => setSelectedTemplate(template)}
                    isDeployed={deployedAgents.some(d => d.templateId === template.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTemplates.map(template => (
                  <AgentListItem
                    key={template.id}
                    template={template}
                    onSelect={() => setSelectedTemplate(template)}
                    isDeployed={deployedAgents.some(d => d.templateId === template.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="deployed">
            {deployedAgents.length === 0 ? (
              <Card className="bg-card/50">
                <CardContent className="py-12 text-center">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Deployed Agents</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Browse the catalog and deploy your first agent
                  </p>
                  <Button variant="outline" onClick={() => {}}>
                    Browse Catalog
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {deployedAgents.map(agent => (
                  <Card key={agent.id} className="bg-card/50" data-testid={`deployed-agent-card-${agent.id}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{agent.name}</CardTitle>
                        <Badge variant="outline" className={cn(
                          agent.status === "active" ? "bg-green-500/10 text-green-400" :
                          agent.status === "error" ? "bg-red-500/10 text-red-400" :
                          "bg-yellow-500/10 text-yellow-400"
                        )}>
                          {agent.status}
                        </Badge>
                      </div>
                      <CardDescription>{agent.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs text-muted-foreground">
                        Deployed {new Date(agent.createdAt).toLocaleDateString()}
                      </div>
                    </CardContent>
                    <CardFooter className="gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => {
                          setSelectedDeployedAgent(agent);
                          setShowExecutionDialog(true);
                        }}
                        data-testid={`button-history-${agent.id}`}
                      >
                        <Activity className="h-4 w-4 mr-2" />
                        History
                      </Button>
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => {
                          setRunningAgentId(agent.id);
                          runMutation.mutate(agent.id);
                        }}
                        disabled={runningAgentId === agent.id || agent.status !== "active"}
                        data-testid={`button-run-${agent.id}`}
                      >
                        {runningAgentId === agent.id ? (
                          <>
                            <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Running...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Run Now
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="by-domain">
            <div className="space-y-8">
              {Object.entries(groupedByDomain).map(([domain, agents]) => {
                const DomainIcon = domainIcons[domain] || Bot;
                const category = categories.find(c => c.slug === domain);
                
                return (
                  <div key={domain}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <DomainIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium capitalize">{domain}</h3>
                        {category && (
                          <p className="text-sm text-muted-foreground">{category.description}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="ml-auto">
                        {agents.length} agents
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {agents.slice(0, 6).map(template => (
                        <AgentCard
                          key={template.id}
                          template={template}
                          onSelect={() => setSelectedTemplate(template)}
                          isDeployed={deployedAgents.some(d => d.templateId === template.id)}
                        />
                      ))}
                    </div>
                    {agents.length > 6 && (
                      <Button
                        variant="ghost"
                        className="mt-4"
                        onClick={() => setSelectedDomain(domain)}
                      >
                        View all {agents.length} {domain} agents
                        <ArrowUpRight className="h-4 w-4 ml-2" />
                      </Button>
                    )}
                    <Separator className="mt-6" />
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* Agent Detail Dialog */}
        <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            {selectedTemplate && (
              <>
                <DialogHeader>
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                      tierConfig[selectedTemplate.tier].color
                    )}>
                      {(() => {
                        const TierIcon = tierConfig[selectedTemplate.tier].icon;
                        return <TierIcon className="h-6 w-6" />;
                      })()}
                    </div>
                    <div className="flex-1">
                      <DialogTitle className="text-xl mb-1">{selectedTemplate.name}</DialogTitle>
                      <DialogDescription>{selectedTemplate.description}</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge className={tierConfig[selectedTemplate.tier].color}>
                      {tierConfig[selectedTemplate.tier].label}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {selectedTemplate.domain}
                    </Badge>
                    <Badge className={complexityColors[selectedTemplate.complexity]}>
                      {selectedTemplate.complexity}
                    </Badge>
                  </div>

                  {/* Long Description */}
                  {selectedTemplate.longDescription && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">About</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedTemplate.longDescription}
                      </p>
                    </div>
                  )}

                  {/* Capabilities */}
                  {selectedTemplate.capabilities && selectedTemplate.capabilities.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Capabilities</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedTemplate.capabilities.map((cap: string) => (
                          <Badge key={cap} variant="secondary" className="text-xs">
                            {cap.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Required Integrations */}
                  {selectedTemplate.requiredIntegrations && selectedTemplate.requiredIntegrations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Required Integrations</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedTemplate.requiredIntegrations.map((int: string) => (
                          <Badge key={int} variant="outline" className="text-xs">
                            <Link2 className="h-3 w-3 mr-1" />
                            {int}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {selectedTemplate.tags && selectedTemplate.tags.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedTemplate.tags.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-accent/30 rounded-lg">
                      <p className="text-lg font-semibold font-mono">{selectedTemplate.popularity || 0}</p>
                      <p className="text-xs text-muted-foreground">Deployments</p>
                    </div>
                    <div className="text-center p-3 bg-accent/30 rounded-lg">
                      <p className="text-lg font-semibold font-mono">
                        {selectedTemplate.rating ? parseFloat(selectedTemplate.rating).toFixed(1) : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">Rating</p>
                    </div>
                    <div className="text-center p-3 bg-accent/30 rounded-lg">
                      <p className="text-lg font-semibold font-mono">{selectedTemplate.reviewCount || 0}</p>
                      <p className="text-xs text-muted-foreground">Reviews</p>
                    </div>
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setIsDeploying(true);
                      deployMutation.mutate(selectedTemplate.id);
                    }}
                    disabled={isDeploying || deployMutation.isPending}
                    data-testid="deploy-agent-btn"
                  >
                    {isDeploying ? (
                      <>Deploying...</>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Deploy Agent
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Execution History Dialog */}
        <Dialog open={showExecutionDialog} onOpenChange={setShowExecutionDialog}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Execution History: {selectedDeployedAgent?.name}
              </DialogTitle>
              <DialogDescription>
                View past executions and results for this agent
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="h-[500px] pr-4">
              {executions.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No executions yet</p>
                  <p className="text-sm">Run the agent to see execution history</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {executions.map(execution => (
                    <Card key={execution.id} className={cn(
                      "bg-card/30",
                      execution.status === "completed" && "border-green-500/20",
                      execution.status === "failed" && "border-red-500/20",
                      execution.status === "running" && "border-blue-500/20"
                    )} data-testid={`execution-card-${execution.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn(
                              execution.status === "completed" && "bg-green-500/10 text-green-400",
                              execution.status === "failed" && "bg-red-500/10 text-red-400",
                              execution.status === "running" && "bg-blue-500/10 text-blue-400 animate-pulse",
                              execution.status === "pending" && "bg-yellow-500/10 text-yellow-400"
                            )} data-testid={`execution-status-${execution.id}`}>
                              {execution.status}
                            </Badge>
                            {execution.executionTimeMs && (
                              <span className="text-xs text-muted-foreground" data-testid={`execution-time-${execution.id}`}>
                                {execution.executionTimeMs}ms
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(execution.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {execution.parsedActions && (
                          <div>
                            <h4 className="text-xs font-medium mb-1">Actions Taken</h4>
                            <div className="flex flex-wrap gap-1">
                              {(execution.parsedActions as any)?.actions?.map((action: any, i: number) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {action.type}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {execution.error && (
                          <div className="p-2 bg-red-500/10 rounded text-red-400 text-sm" data-testid={`execution-error-${execution.id}`}>
                            {execution.error}
                          </div>
                        )}
                        {execution.aiResponse && (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground" data-testid={`execution-response-toggle-${execution.id}`}>
                              View AI Response
                            </summary>
                            <pre className="mt-2 p-2 bg-muted/50 rounded text-xs overflow-x-auto whitespace-pre-wrap">
                              {typeof execution.aiResponse === 'string' 
                                ? execution.aiResponse 
                                : JSON.stringify(execution.aiResponse, null, 2)}
                            </pre>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExecutionDialog(false)} data-testid="button-close-history">
                Close
              </Button>
              {selectedDeployedAgent && (
                <Button 
                  onClick={() => {
                    setRunningAgentId(selectedDeployedAgent.id);
                    runMutation.mutate(selectedDeployedAgent.id);
                  }}
                  disabled={runningAgentId === selectedDeployedAgent.id}
                  data-testid="button-run-from-history"
                >
                  {runningAgentId === selectedDeployedAgent.id ? (
                    <>
                      <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run Now
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Agent Card Component
function AgentCard({ 
  template, 
  onSelect, 
  isDeployed 
}: { 
  template: AgentTemplate; 
  onSelect: () => void;
  isDeployed: boolean;
}) {
  const tierCfg = tierConfig[template.tier];
  const TierIcon = tierCfg.icon;
  const DomainIcon = domainIcons[template.domain] || Bot;

  return (
    <Card 
      className={cn(
        "bg-card/50 hover:bg-card/80 transition-colors cursor-pointer group",
        isDeployed && "ring-1 ring-green-500/30"
      )}
      onClick={onSelect}
      data-testid={`agent-card-${template.slug}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", tierCfg.color)}>
            <TierIcon className="h-5 w-5" />
          </div>
          <Badge variant="outline" className="text-xs capitalize">
            {template.domain}
          </Badge>
        </div>
        <CardTitle className="text-base mt-3 group-hover:text-primary transition-colors">
          {template.name}
        </CardTitle>
        <CardDescription className="text-xs line-clamp-2">
          {template.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn("text-xs", tierCfg.color)}>
            {tierCfg.label}
          </Badge>
          <Badge className={cn("text-xs", complexityColors[template.complexity])}>
            {template.complexity}
          </Badge>
          {isDeployed && (
            <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400">
              Deployed
            </Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <div className="flex items-center text-xs text-muted-foreground gap-4">
          <span className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {template.popularity || 0}
          </span>
          {template.rating && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {parseFloat(template.rating).toFixed(1)}
            </span>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

// Agent List Item Component
function AgentListItem({ 
  template, 
  onSelect,
  isDeployed 
}: { 
  template: AgentTemplate; 
  onSelect: () => void;
  isDeployed: boolean;
}) {
  const tierCfg = tierConfig[template.tier];
  const TierIcon = tierCfg.icon;

  return (
    <Card 
      className={cn(
        "bg-card/50 hover:bg-card/80 transition-colors cursor-pointer",
        isDeployed && "ring-1 ring-green-500/30"
      )}
      onClick={onSelect}
      data-testid={`agent-list-${template.slug}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", tierCfg.color)}>
            <TierIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium truncate">{template.name}</h3>
              {isDeployed && (
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 shrink-0">
                  Deployed
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">{template.description}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={cn("text-xs", tierCfg.color)}>
              {tierCfg.label}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">
              {template.domain}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
