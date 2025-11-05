import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, Filter, Star, Download, Upload, DollarSign, Grid3x3, List,
  Bot, Brain, Code, MessageSquare, Database, Sparkles, ChevronRight,
  Package, TrendingUp, Award, Users, StarHalf, Clock, Edit, Trash2,
  Plus, X, Check, AlertCircle, Zap
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

// Schema for publishing an agent
const publishAgentSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  category: z.enum(["research", "writing", "analysis", "communication", "data"]),
  price: z.string().transform(val => parseFloat(val) >= 0 ? val : "0"),
  tags: z.string().transform(val => val.split(",").map(tag => tag.trim()).filter(Boolean)),
  systemPrompt: z.string().min(10, "System prompt is required"),
  configTemplate: z.string().optional(),
  inputSchema: z.string().optional(),
  outputSchema: z.string().optional(),
  version: z.string().default("1.0.0"),
});

type PublishAgentFormData = z.infer<typeof publishAgentSchema>;

// Star rating component
function StarRating({ rating, size = "sm", interactive = false, onChange }: {
  rating: number;
  size?: "sm" | "lg";
  interactive?: boolean;
  onChange?: (rating: number) => void;
}) {
  const stars = [];
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  
  for (let i = 1; i <= 5; i++) {
    const filled = rating >= i;
    const halfFilled = rating > i - 1 && rating < i;
    
    stars.push(
      <button
        key={i}
        type="button"
        disabled={!interactive}
        onClick={() => interactive && onChange?.(i)}
        className={cn(
          "transition-colors",
          interactive && "hover:scale-110 cursor-pointer"
        )}
        data-testid={`star-${i}`}
      >
        {halfFilled ? (
          <StarHalf className={cn(iconSize, "fill-yellow-400 text-yellow-400")} />
        ) : (
          <Star className={cn(
            iconSize,
            filled ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
          )} />
        )}
      </button>
    );
  }
  
  return <div className="flex items-center gap-0.5">{stars}</div>;
}

// Category icons
const categoryIcons = {
  research: Brain,
  writing: MessageSquare,
  analysis: TrendingUp,
  communication: Users,
  data: Database,
};

export default function MarketplacePage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [priceFilter, setPriceFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<number>(0);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [userRating, setUserRating] = useState<number>(0);
  const [userReview, setUserReview] = useState("");
  const { toast } = useToast();

  // Fetch marketplace agents
  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ["/api/marketplace/agents", selectedCategory, priceFilter, ratingFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.set("category", selectedCategory);
      if (priceFilter === "free") params.set("maxPrice", "0");
      if (priceFilter === "paid") params.set("minPrice", "0.01");
      if (ratingFilter > 0) params.set("minRating", ratingFilter.toString());
      
      return fetch(`/api/marketplace/agents?${params}`).then(res => res.json());
    },
  });

  // Fetch user's published agents
  const { data: myAgents = [] } = useQuery({
    queryKey: ["/api/marketplace/my-agents"],
  });

  // Fetch agent details
  const { data: agentDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ["/api/marketplace/agents", selectedAgent?.id],
    enabled: !!selectedAgent?.id,
    queryFn: () => fetch(`/api/marketplace/agents/${selectedAgent.id}`).then(res => res.json()),
  });

  // Publish agent mutation
  const publishMutation = useMutation({
    mutationFn: (data: PublishAgentFormData) => 
      apiRequest("/api/marketplace/agents", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          configTemplate: data.configTemplate ? JSON.parse(data.configTemplate) : {},
          inputSchema: data.inputSchema ? JSON.parse(data.inputSchema) : {},
          outputSchema: data.outputSchema ? JSON.parse(data.outputSchema) : {},
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/my-agents"] });
      setIsPublishOpen(false);
      toast({
        title: "Agent published successfully",
        description: "Your agent is now available in the marketplace",
      });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to publish agent",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Download agent mutation
  const downloadMutation = useMutation({
    mutationFn: (agentId: string) => 
      apiRequest(`/api/marketplace/agents/${agentId}/download`, {
        method: "POST",
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/agents", data.agent.id] });
      toast({
        title: "Agent downloaded",
        description: `${data.agent.name} has been added to your workspace`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Rate agent mutation
  const rateMutation = useMutation({
    mutationFn: ({ agentId, rating, review }: { agentId: string; rating: number; review: string }) =>
      apiRequest(`/api/marketplace/agents/${agentId}/rate`, {
        method: "POST",
        body: JSON.stringify({ rating, review }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/agents", selectedAgent?.id] });
      toast({
        title: "Rating submitted",
        description: "Thank you for your feedback",
      });
      setUserRating(0);
      setUserReview("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit rating",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update agent mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) =>
      apiRequest(`/api/marketplace/agents/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/my-agents"] });
      toast({
        title: "Agent updated",
        description: "Your changes have been saved",
      });
    },
  });

  // Delete agent mutation
  const deleteMutation = useMutation({
    mutationFn: (agentId: string) =>
      apiRequest(`/api/marketplace/agents/${agentId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/my-agents"] });
      toast({
        title: "Agent deleted",
        description: "The agent has been removed from the marketplace",
      });
    },
  });

  // Form for publishing agent
  const form = useForm<PublishAgentFormData>({
    resolver: zodResolver(publishAgentSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "research",
      price: "0",
      tags: "",
      systemPrompt: "",
      configTemplate: "",
      inputSchema: "",
      outputSchema: "",
      version: "1.0.0",
    },
  });

  // Filter agents based on search query
  const filteredAgents = agents.filter((agent: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      agent.name.toLowerCase().includes(query) ||
      agent.description.toLowerCase().includes(query) ||
      agent.tags?.some((tag: string) => tag.toLowerCase().includes(query))
    );
  });

  return (
    <div className="flex-1 overflow-auto">
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Agent Marketplace</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Discover and share powerful AI agents for your workflows
            </p>
          </div>
          <Button onClick={() => setIsPublishOpen(true)} data-testid="button-publish-agent">
            <Upload className="h-4 w-4 mr-2" />
            Publish Agent
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-agents"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px]" data-testid="select-category">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Categories</SelectItem>
              <SelectItem value="research">Research</SelectItem>
              <SelectItem value="writing">Writing</SelectItem>
              <SelectItem value="analysis">Analysis</SelectItem>
              <SelectItem value="communication">Communication</SelectItem>
              <SelectItem value="data">Data Processing</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priceFilter} onValueChange={setPriceFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-price">
              <SelectValue placeholder="Price" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Prices</SelectItem>
              <SelectItem value="free">Free Only</SelectItem>
              <SelectItem value="paid">Paid Only</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("grid")}
              data-testid="button-grid-view"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("list")}
              data-testid="button-list-view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="browse" className="space-y-4">
          <TabsList>
            <TabsTrigger value="browse" data-testid="tab-browse">
              <Package className="h-4 w-4 mr-2" />
              Browse
            </TabsTrigger>
            <TabsTrigger value="my-agents" data-testid="tab-my-agents">
              <Bot className="h-4 w-4 mr-2" />
              My Agents ({myAgents.length})
            </TabsTrigger>
            <TabsTrigger value="featured" data-testid="tab-featured">
              <Sparkles className="h-4 w-4 mr-2" />
              Featured
            </TabsTrigger>
          </TabsList>

          {/* Browse Tab */}
          <TabsContent value="browse">
            {loadingAgents ? (
              <div className="text-center py-12">
                <Bot className="h-12 w-12 mx-auto mb-4 animate-pulse" />
                <p className="text-muted-foreground">Loading marketplace agents...</p>
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No agents found matching your criteria</p>
              </div>
            ) : (
              <div className={cn(
                viewMode === "grid" 
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  : "space-y-4"
              )}>
                {filteredAgents.map((agent: any) => {
                  const Icon = categoryIcons[agent.category as keyof typeof categoryIcons] || Bot;
                  
                  return viewMode === "grid" ? (
                    <Card 
                      key={agent.id} 
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => setSelectedAgent(agent)}
                      data-testid={`card-agent-${agent.id}`}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <Icon className="h-8 w-8 text-primary" />
                          {parseFloat(agent.price) > 0 ? (
                            <Badge variant="default" data-testid={`badge-price-${agent.id}`}>
                              ${agent.price}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" data-testid={`badge-free-${agent.id}`}>
                              Free
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {agent.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1">
                            <StarRating rating={parseFloat(agent.rating) || 0} size="sm" />
                            <span className="text-muted-foreground">
                              ({agent.rating || "0"})
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Download className="h-3 w-3" />
                            {agent.downloads}
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter>
                        <div className="flex flex-wrap gap-1">
                          {agent.tags?.slice(0, 3).map((tag: string) => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardFooter>
                    </Card>
                  ) : (
                    <Card 
                      key={agent.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => setSelectedAgent(agent)}
                      data-testid={`list-agent-${agent.id}`}
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Icon className="h-10 w-10 text-primary" />
                            <div>
                              <CardTitle className="text-xl">{agent.name}</CardTitle>
                              <CardDescription className="mt-1">
                                {agent.description}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {parseFloat(agent.price) > 0 ? (
                              <Badge variant="default" className="text-lg px-3 py-1">
                                ${agent.price}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-lg px-3 py-1">
                                Free
                              </Badge>
                            )}
                            <div className="flex items-center gap-2">
                              <StarRating rating={parseFloat(agent.rating) || 0} size="sm" />
                              <span className="text-sm text-muted-foreground">
                                ({agent.downloads} downloads)
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{agent.category}</Badge>
                          {agent.tags?.map((tag: string) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* My Agents Tab */}
          <TabsContent value="my-agents">
            {myAgents.length === 0 ? (
              <div className="text-center py-12">
                <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">You haven't published any agents yet</p>
                <Button onClick={() => setIsPublishOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Publish Your First Agent
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myAgents.map((agent: any) => {
                  const Icon = categoryIcons[agent.category as keyof typeof categoryIcons] || Bot;
                  
                  return (
                    <Card key={agent.id} data-testid={`card-my-agent-${agent.id}`}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <Icon className="h-8 w-8 text-primary" />
                          <div className="flex gap-2">
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => {
                                // Edit agent logic here
                                toast({
                                  title: "Edit feature coming soon",
                                  description: "Agent editing will be available in the next update",
                                });
                              }}
                              data-testid={`button-edit-${agent.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this agent?")) {
                                  deleteMutation.mutate(agent.id);
                                }
                              }}
                              data-testid={`button-delete-${agent.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {agent.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Downloads</span>
                            <span className="font-medium">{agent.downloads}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Rating</span>
                            <div className="flex items-center gap-1">
                              <StarRating rating={parseFloat(agent.rating) || 0} size="sm" />
                              <span>({agent.rating || "N/A"})</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Revenue</span>
                            <span className="font-medium">
                              ${(parseFloat(agent.price) * agent.downloads * 0.7).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Featured Tab */}
          <TabsContent value="featured">
            <div className="text-center py-12">
              <Award className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Featured Agents Coming Soon</h3>
              <p className="text-muted-foreground">
                We're curating the best agents for you. Check back later!
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Agent Detail Modal */}
        <Dialog open={!!selectedAgent} onOpenChange={(open) => !open && setSelectedAgent(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            {loadingDetails ? (
              <div className="text-center py-8">
                <Bot className="h-8 w-8 mx-auto animate-pulse" />
                <p className="text-muted-foreground mt-2">Loading agent details...</p>
              </div>
            ) : agentDetails ? (
              <>
                <DialogHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const Icon = categoryIcons[agentDetails.category as keyof typeof categoryIcons] || Bot;
                        return <Icon className="h-10 w-10 text-primary" />;
                      })()}
                      <div>
                        <DialogTitle className="text-2xl">{agentDetails.name}</DialogTitle>
                        <div className="flex items-center gap-4 mt-2">
                          <Badge variant="outline">{agentDetails.category}</Badge>
                          <span className="text-sm text-muted-foreground">
                            v{agentDetails.version}
                          </span>
                          {parseFloat(agentDetails.price) > 0 ? (
                            <Badge variant="default">${agentDetails.price}</Badge>
                          ) : (
                            <Badge variant="secondary">Free</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-6 mt-6">
                  {/* Description */}
                  <div>
                    <h4 className="font-semibold mb-2">Description</h4>
                    <p className="text-muted-foreground">{agentDetails.description}</p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-secondary/20 rounded-lg">
                      <Download className="h-6 w-6 mx-auto mb-2 text-primary" />
                      <p className="text-2xl font-bold">{agentDetails.downloads}</p>
                      <p className="text-xs text-muted-foreground">Downloads</p>
                    </div>
                    <div className="text-center p-4 bg-secondary/20 rounded-lg">
                      <Star className="h-6 w-6 mx-auto mb-2 text-yellow-400" />
                      <p className="text-2xl font-bold">{agentDetails.rating || "N/A"}</p>
                      <p className="text-xs text-muted-foreground">Rating</p>
                    </div>
                    <div className="text-center p-4 bg-secondary/20 rounded-lg">
                      <MessageSquare className="h-6 w-6 mx-auto mb-2 text-primary" />
                      <p className="text-2xl font-bold">{agentDetails.ratings?.length || 0}</p>
                      <p className="text-xs text-muted-foreground">Reviews</p>
                    </div>
                  </div>

                  {/* Tags */}
                  {agentDetails.tags && agentDetails.tags.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {agentDetails.tags.map((tag: string) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* System Prompt Preview */}
                  {agentDetails.systemPrompt && (
                    <div>
                      <h4 className="font-semibold mb-2">System Prompt</h4>
                      <pre className="bg-secondary/20 p-4 rounded-lg text-sm overflow-x-auto">
                        {agentDetails.systemPrompt}
                      </pre>
                    </div>
                  )}

                  {/* Reviews */}
                  {agentDetails.ratings && agentDetails.ratings.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-2">Reviews</h4>
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-4">
                          {agentDetails.ratings.map((review: any) => (
                            <div key={review.id} className="p-4 border rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <StarRating rating={review.rating} size="sm" />
                                <span className="text-xs text-muted-foreground">
                                  {new Date(review.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              {review.review && (
                                <p className="text-sm text-muted-foreground">
                                  {review.review}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Your Rating */}
                  {agentDetails.hasDownloaded && !agentDetails.userRating && (
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-2">Rate this Agent</h4>
                      <div className="space-y-4">
                        <StarRating 
                          rating={userRating} 
                          size="lg" 
                          interactive 
                          onChange={setUserRating}
                        />
                        <Textarea
                          placeholder="Share your experience with this agent..."
                          value={userReview}
                          onChange={(e) => setUserReview(e.target.value)}
                          rows={3}
                        />
                        <Button 
                          onClick={() => {
                            if (userRating > 0) {
                              rateMutation.mutate({
                                agentId: agentDetails.id,
                                rating: userRating,
                                review: userReview,
                              });
                            }
                          }}
                          disabled={userRating === 0 || rateMutation.isPending}
                        >
                          Submit Rating
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter className="mt-6">
                  {agentDetails.canDownload ? (
                    <Button 
                      onClick={() => downloadMutation.mutate(agentDetails.id)}
                      disabled={downloadMutation.isPending || agentDetails.hasDownloaded}
                      data-testid="button-download-agent"
                    >
                      {agentDetails.hasDownloaded ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Downloaded
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Download Agent
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button variant="default" data-testid="button-purchase-agent">
                      <DollarSign className="h-4 w-4 mr-2" />
                      Purchase for ${agentDetails.price}
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      toast({
                        title: "Integration coming soon",
                        description: "Workflow integration will be available in the next update",
                      });
                    }}
                    data-testid="button-add-workflow"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Add to Workflow
                  </Button>
                </DialogFooter>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Publish Agent Sheet */}
        <Sheet open={isPublishOpen} onOpenChange={setIsPublishOpen}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Publish New Agent</SheetTitle>
              <SheetDescription>
                Share your AI agent with the community
              </SheetDescription>
            </SheetHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => publishMutation.mutate(data))} className="space-y-6 mt-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Content Analyzer Pro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe what your agent does and its key features..."
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="research">Research</SelectItem>
                          <SelectItem value="writing">Writing</SelectItem>
                          <SelectItem value="analysis">Analysis</SelectItem>
                          <SelectItem value="communication">Communication</SelectItem>
                          <SelectItem value="data">Data Processing</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (USD)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          placeholder="0 for free"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Set to 0 to make your agent free. You'll earn 70% of sales for paid agents.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., productivity, automation, sales (comma-separated)"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Add tags to help users find your agent
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="systemPrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Prompt</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter the system prompt that defines your agent's behavior..."
                          rows={5}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="configTemplate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Configuration Template (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder='{"temperature": 0.7, "max_tokens": 2000}'
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        JSON configuration for your agent
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={publishMutation.isPending}>
                    {publishMutation.isPending ? "Publishing..." : "Publish Agent"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsPublishOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}