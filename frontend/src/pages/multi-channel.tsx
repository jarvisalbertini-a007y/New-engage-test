import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Mail, 
  Linkedin, 
  MessageSquare, 
  Phone, 
  Send, 
  Settings, 
  Plus, 
  ChevronRight,
  Activity,
  TrendingUp,
  Users,
  DollarSign,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Target,
  Zap,
  Eye,
  MousePointer,
  Reply,
  Share2,
  GitBranch,
  Shuffle,
  TestTube,
  Play,
  Pause,
  Archive,
  Trash2,
  Edit,
  Copy,
  MoreVertical,
  Filter,
  Download,
  Upload
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChannelConfig {
  id: string;
  channel: string;
  isActive: boolean;
  settings: Record<string, any>;
  dailyLimits: Record<string, any>;
  currentUsage: Record<string, any>;
}

interface Campaign {
  id: string;
  name: string;
  description?: string;
  channels: string[];
  status: string;
  metrics?: Record<string, any>;
  createdAt: string;
}

interface ChannelAnalytics {
  [channel: string]: {
    total: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    deliveryRate?: string;
    openRate?: string;
    clickRate?: string;
    replyRate?: string;
  };
}

const channelIcons: Record<string, any> = {
  email: Mail,
  linkedin: Linkedin,
  sms: MessageSquare,
  phone: Phone,
  physical_mail: Send,
};

const channelColors: Record<string, string> = {
  email: "bg-blue-500",
  linkedin: "bg-indigo-500",
  sms: "bg-green-500",
  phone: "bg-purple-500",
  physical_mail: "bg-orange-500",
};

export default function MultiChannelPage() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("configuration");
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [showChannelDialog, setShowChannelDialog] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  
  // Form states
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    description: "",
    channels: [] as string[],
    sequenceSteps: {},
    audience: {},
  });
  
  const [channelForm, setChannelForm] = useState({
    channel: "",
    settings: {} as Record<string, any>,
  });

  // Query channels
  const { data: channels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ["/api/channels"],
  });

  // Query campaigns
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ["/api/multi-channel/campaigns"],
  });

  // Query analytics
  const { data: analytics = {}, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/multi-channel/analytics", selectedCampaign?.id],
    enabled: !!selectedCampaign,
  });

  // Configure channel mutation
  const configureChannelMutation = useMutation({
    mutationFn: (data: { channel: string; settings: Record<string, any> }) =>
      apiRequest("/api/channels/configure", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
      toast({
        title: "Channel Configured",
        description: "Channel has been configured successfully.",
      });
      setShowChannelDialog(false);
      resetChannelForm();
    },
    onError: (error: any) => {
      toast({
        title: "Configuration Failed",
        description: error.message || "Failed to configure channel",
        variant: "destructive",
      });
    },
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("/api/multi-channel/campaigns", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/multi-channel/campaigns"] });
      toast({
        title: "Campaign Created",
        description: "Multi-channel campaign has been created successfully.",
      });
      setShowCampaignDialog(false);
      resetCampaignForm();
    },
    onError: (error: any) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create campaign",
        variant: "destructive",
      });
    },
  });

  // Optimize campaign mutation
  const optimizeCampaignMutation = useMutation({
    mutationFn: (campaignId: string) =>
      apiRequest("/api/multi-channel/optimize", "POST", { campaignId }),
    onSuccess: (data) => {
      toast({
        title: "Optimization Complete",
        description: "Channel mix has been optimized using AI.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Optimization Failed",
        description: error.message || "Failed to optimize channel mix",
        variant: "destructive",
      });
    },
  });

  const resetCampaignForm = () => {
    setCampaignForm({
      name: "",
      description: "",
      channels: [],
      sequenceSteps: {},
      audience: {},
    });
  };

  const resetChannelForm = () => {
    setChannelForm({
      channel: "",
      settings: {},
    });
    setSelectedChannel(null);
  };

  const handleChannelToggle = (channel: string) => {
    setCampaignForm((prev) => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel],
    }));
  };

  const renderChannelCard = (config: ChannelConfig) => {
    const Icon = channelIcons[config.channel] || Mail;
    const usage = config.currentUsage || {};
    const limits = config.dailyLimits || {};
    
    const getUsagePercentage = () => {
      if (config.channel === 'email' && limits.dailyLimit) {
        return (usage.emailsSentToday || 0) / limits.dailyLimit * 100;
      }
      if (config.channel === 'linkedin') {
        const connections = (usage.connectionsSentToday || 0) / (limits.connectionLimit || 100) * 100;
        const inmails = (usage.inmailsSentToday || 0) / (limits.inmailLimit || 50) * 100;
        return Math.max(connections, inmails);
      }
      if (config.channel === 'sms' && limits.smsLimit) {
        return (usage.smsSentToday || 0) / limits.smsLimit * 100;
      }
      return 0;
    };

    const usagePercentage = getUsagePercentage();
    
    return (
      <Card key={config.id} className="relative" data-testid={`card-channel-${config.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${channelColors[config.channel]} bg-opacity-20`}>
                <Icon className={`h-5 w-5 ${channelColors[config.channel].replace('bg-', 'text-')}`} />
              </div>
              <div>
                <CardTitle className="text-base capitalize">{config.channel.replace('_', ' ')}</CardTitle>
                <CardDescription className="text-xs">
                  {config.isActive ? "Active" : "Inactive"}
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={config.isActive}
              data-testid={`switch-channel-active-${config.id}`}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Daily Usage</span>
                <span>{usagePercentage.toFixed(0)}%</span>
              </div>
              <Progress value={usagePercentage} className="h-2" />
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              {config.channel === 'email' && (
                <>
                  <div>
                    <span className="text-muted-foreground">Sent Today:</span>
                    <span className="ml-1 font-medium">{usage.emailsSentToday || 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Limit:</span>
                    <span className="ml-1 font-medium">{limits.dailyLimit || 450}</span>
                  </div>
                </>
              )}
              {config.channel === 'linkedin' && (
                <>
                  <div>
                    <span className="text-muted-foreground">Connections:</span>
                    <span className="ml-1 font-medium">{usage.connectionsSentToday || 0}/{limits.connectionLimit || 100}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">InMails:</span>
                    <span className="ml-1 font-medium">{usage.inmailsSentToday || 0}/{limits.inmailLimit || 50}</span>
                  </div>
                </>
              )}
              {config.channel === 'sms' && (
                <>
                  <div>
                    <span className="text-muted-foreground">SMS Sent:</span>
                    <span className="ml-1 font-medium">{usage.smsSentToday || 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Limit:</span>
                    <span className="ml-1 font-medium">{limits.smsLimit || 500}</span>
                  </div>
                </>
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setSelectedChannel(config.channel);
                setShowChannelDialog(true);
              }}
              data-testid={`button-configure-${config.channel}`}
            >
              <Settings className="h-3 w-3 mr-1" />
              Configure
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderCampaignCard = (campaign: Campaign) => {
    const statusColors: Record<string, string> = {
      draft: "bg-gray-500",
      active: "bg-green-500",
      paused: "bg-yellow-500",
      completed: "bg-blue-500",
    };

    return (
      <Card
        key={campaign.id}
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setSelectedCampaign(campaign)}
        data-testid={`card-campaign-${campaign.id}`}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{campaign.name}</CardTitle>
            <Badge className={`${statusColors[campaign.status]} text-white`}>
              {campaign.status}
            </Badge>
          </div>
          {campaign.description && (
            <CardDescription className="text-sm line-clamp-2">
              {campaign.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            {campaign.channels.map((channel) => {
              const Icon = channelIcons[channel] || Mail;
              return (
                <div
                  key={channel}
                  className={`p-1.5 rounded ${channelColors[channel]} bg-opacity-20`}
                  title={channel}
                >
                  <Icon className={`h-3 w-3 ${channelColors[channel].replace('bg-', 'text-')}`} />
                </div>
              );
            })}
          </div>
          
          {campaign.metrics && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Sent:</span>
                <span className="ml-1 font-medium">{campaign.metrics.sent || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Opened:</span>
                <span className="ml-1 font-medium">{campaign.metrics.opened || 0}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Replied:</span>
                <span className="ml-1 font-medium">{campaign.metrics.replied || 0}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderAnalyticsChart = (channelData: any, channelName: string) => {
    const Icon = channelIcons[channelName] || Mail;
    
    return (
      <Card key={channelName} data-testid={`card-analytics-${channelName}`}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${channelColors[channelName]} bg-opacity-20`}>
              <Icon className={`h-5 w-5 ${channelColors[channelName].replace('bg-', 'text-')}`} />
            </div>
            <CardTitle className="text-base capitalize">{channelName.replace('_', ' ')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Delivery Rate</p>
                <p className="text-xl font-semibold">{channelData.deliveryRate || '0%'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Open Rate</p>
                <p className="text-xl font-semibold">{channelData.openRate || '0%'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Click Rate</p>
                <p className="text-xl font-semibold">{channelData.clickRate || '0%'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Reply Rate</p>
                <p className="text-xl font-semibold">{channelData.replyRate || '0%'}</p>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total Sent</span>
                <span className="font-medium">{channelData.sent || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Delivered</span>
                <span className="font-medium">{channelData.delivered || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Bounced</span>
                <span className="font-medium">{channelData.bounced || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Unsubscribed</span>
                <span className="font-medium">{channelData.unsubscribed || 0}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderCampaignBuilder = () => (
    <div className="space-y-6">
      <div className="bg-muted/50 rounded-lg p-6 border-2 border-dashed border-muted-foreground/25">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-primary/10">
              <GitBranch className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h3 className="text-lg font-semibold">Visual Campaign Builder</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Create sophisticated multi-channel campaigns with our drag-and-drop flow builder. Set conditions, delays, and branching logic.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" disabled>
              <Upload className="h-4 w-4 mr-2" />
              Import Template
            </Button>
            <Button onClick={() => setShowCampaignDialog(true)} data-testid="button-create-campaign">
              <Plus className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        </div>
      </div>
      
      {campaigns.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map(renderCampaignCard)}
        </div>
      )}
    </div>
  );

  const renderOrchestrationDashboard = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Campaigns</p>
                <p className="text-2xl font-bold">{campaigns.filter(c => c.status === 'active').length}</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Messages Today</p>
                <p className="text-2xl font-bold">247</p>
              </div>
              <Send className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Response Rate</p>
                <p className="text-2xl font-bold">12.4%</p>
              </div>
              <Reply className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cost per Contact</p>
                <p className="text-2xl font-bold">$0.42</p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Real-time Activity Feed</CardTitle>
          <CardDescription>Monitor cross-channel engagement as it happens</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {/* Simulated activity feed */}
              <div className="flex items-center gap-3 text-sm">
                <div className={`p-1.5 rounded ${channelColors.email} bg-opacity-20`}>
                  <Mail className={`h-3 w-3 ${channelColors.email.replace('bg-', 'text-')}`} />
                </div>
                <span className="font-medium">John Doe</span>
                <span className="text-muted-foreground">opened email</span>
                <span className="text-xs text-muted-foreground ml-auto">2 min ago</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className={`p-1.5 rounded ${channelColors.linkedin} bg-opacity-20`}>
                  <Linkedin className={`h-3 w-3 ${channelColors.linkedin.replace('bg-', 'text-')}`} />
                </div>
                <span className="font-medium">Jane Smith</span>
                <span className="text-muted-foreground">accepted connection</span>
                <span className="text-xs text-muted-foreground ml-auto">5 min ago</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className={`p-1.5 rounded ${channelColors.sms} bg-opacity-20`}>
                  <MessageSquare className={`h-3 w-3 ${channelColors.sms.replace('bg-', 'text-')}`} />
                </div>
                <span className="font-medium">Mike Johnson</span>
                <span className="text-muted-foreground">replied to SMS</span>
                <span className="text-xs text-muted-foreground ml-auto">8 min ago</span>
              </div>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Multi-Channel Orchestration</h1>
          <p className="text-muted-foreground">
            Coordinate outreach across email, LinkedIn, SMS, phone, and physical mail
          </p>
        </div>

        {/* Main Content */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList>
            <TabsTrigger value="configuration">Channel Configuration</TabsTrigger>
            <TabsTrigger value="campaigns">Campaign Builder</TabsTrigger>
            <TabsTrigger value="orchestration">Orchestration</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="configuration" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Channel Configuration Hub</h2>
                <p className="text-sm text-muted-foreground">
                  Set up and manage your communication channels
                </p>
              </div>
              <Button onClick={() => setShowChannelDialog(true)} data-testid="button-add-channel">
                <Plus className="h-4 w-4 mr-2" />
                Add Channel
              </Button>
            </div>

            {channelsLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-[200px]" />
                ))}
              </div>
            ) : channels.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {channels.map(renderChannelCard)}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Settings className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Channels Configured</h3>
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    Get started by configuring your first communication channel
                  </p>
                  <Button onClick={() => setShowChannelDialog(true)} data-testid="button-configure-first-channel">
                    <Plus className="h-4 w-4 mr-2" />
                    Configure Channel
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-6">
            {campaignsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-[150px]" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-[200px]" />
                  ))}
                </div>
              </div>
            ) : (
              renderCampaignBuilder()
            )}
          </TabsContent>

          <TabsContent value="orchestration" className="space-y-6">
            {renderOrchestrationDashboard()}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Channel Performance Analytics</h2>
                <p className="text-sm text-muted-foreground">
                  Compare performance across all channels
                </p>
              </div>
              {selectedCampaign && (
                <Button
                  onClick={() => optimizeCampaignMutation.mutate(selectedCampaign.id)}
                  disabled={optimizeCampaignMutation.isPending}
                  data-testid="button-optimize-campaign"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Optimize with AI
                </Button>
              )}
            </div>

            {selectedCampaign ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Showing analytics for campaign: <strong>{selectedCampaign.name}</strong>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Select a campaign from the Campaign Builder tab to view its analytics
                </AlertDescription>
              </Alert>
            )}

            {analyticsLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-[300px]" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(analytics as ChannelAnalytics).map(([channel, data]) =>
                  renderAnalyticsChart(data, channel)
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Campaign Creation Dialog */}
        <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Multi-Channel Campaign</DialogTitle>
              <DialogDescription>
                Set up a new campaign that coordinates outreach across multiple channels
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                  placeholder="Enter campaign name"
                  data-testid="input-campaign-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="campaign-description">Description</Label>
                <Textarea
                  id="campaign-description"
                  value={campaignForm.description}
                  onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                  placeholder="Describe your campaign objectives"
                  data-testid="textarea-campaign-description"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Select Channels</Label>
                <div className="grid grid-cols-2 gap-3">
                  {['email', 'linkedin', 'sms', 'phone', 'physical_mail'].map((channel) => {
                    const Icon = channelIcons[channel];
                    const isSelected = campaignForm.channels.includes(channel);
                    return (
                      <Button
                        key={channel}
                        variant={isSelected ? "default" : "outline"}
                        className="justify-start"
                        onClick={() => handleChannelToggle(channel)}
                        data-testid={`button-toggle-channel-${channel}`}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {channel.replace('_', ' ')}
                      </Button>
                    );
                  })}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Campaign Settings</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">A/B Testing</div>
                      <div className="text-xs text-muted-foreground">Test different messages across channels</div>
                    </div>
                    <Switch data-testid="switch-ab-testing" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">Auto-Switch Channels</div>
                      <div className="text-xs text-muted-foreground">Automatically switch on no response</div>
                    </div>
                    <Switch defaultChecked data-testid="switch-auto-switch" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">Smart Timing</div>
                      <div className="text-xs text-muted-foreground">Send at optimal times per recipient</div>
                    </div>
                    <Switch defaultChecked data-testid="switch-smart-timing" />
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createCampaignMutation.mutate(campaignForm)}
                disabled={!campaignForm.name || campaignForm.channels.length === 0 || createCampaignMutation.isPending}
                data-testid="button-confirm-create-campaign"
              >
                Create Campaign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Channel Configuration Dialog */}
        <Dialog open={showChannelDialog} onOpenChange={setShowChannelDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configure {selectedChannel || 'Channel'}</DialogTitle>
              <DialogDescription>
                Set up your {selectedChannel} integration and preferences
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {!selectedChannel && (
                <div className="space-y-2">
                  <Label>Select Channel Type</Label>
                  <Select
                    value={channelForm.channel}
                    onValueChange={(value) => {
                      setChannelForm({ ...channelForm, channel: value });
                      setSelectedChannel(value);
                    }}
                  >
                    <SelectTrigger data-testid="select-channel-type">
                      <SelectValue placeholder="Choose a channel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="physical_mail">Physical Mail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {selectedChannel === 'email' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email-provider">Email Provider</Label>
                    <Select
                      value={channelForm.settings.provider}
                      onValueChange={(value) =>
                        setChannelForm({
                          ...channelForm,
                          settings: { ...channelForm.settings, provider: value },
                        })
                      }
                    >
                      <SelectTrigger id="email-provider" data-testid="select-email-provider">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="smtp">SMTP</SelectItem>
                        <SelectItem value="sendgrid">SendGrid</SelectItem>
                        <SelectItem value="mailgun">Mailgun</SelectItem>
                        <SelectItem value="ses">Amazon SES</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="from-email">From Email</Label>
                    <Input
                      id="from-email"
                      type="email"
                      value={channelForm.settings.fromEmail}
                      onChange={(e) =>
                        setChannelForm({
                          ...channelForm,
                          settings: { ...channelForm.settings, fromEmail: e.target.value },
                        })
                      }
                      placeholder="your@email.com"
                      data-testid="input-from-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="from-name">From Name</Label>
                    <Input
                      id="from-name"
                      value={channelForm.settings.fromName}
                      onChange={(e) =>
                        setChannelForm({
                          ...channelForm,
                          settings: { ...channelForm.settings, fromName: e.target.value },
                        })
                      }
                      placeholder="Your Name"
                      data-testid="input-from-name"
                    />
                  </div>
                </>
              )}
              
              {selectedChannel === 'linkedin' && (
                <>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Connect your LinkedIn account to send InMails and connection requests
                    </AlertDescription>
                  </Alert>
                  <Button className="w-full" data-testid="button-connect-linkedin">
                    <Linkedin className="h-4 w-4 mr-2" />
                    Connect LinkedIn Account
                  </Button>
                </>
              )}
              
              {selectedChannel === 'sms' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="sms-provider">SMS Provider</Label>
                    <Select
                      value={channelForm.settings.provider}
                      onValueChange={(value) =>
                        setChannelForm({
                          ...channelForm,
                          settings: { ...channelForm.settings, provider: value },
                        })
                      }
                    >
                      <SelectTrigger id="sms-provider" data-testid="select-sms-provider">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="twilio">Twilio</SelectItem>
                        <SelectItem value="vonage">Vonage</SelectItem>
                        <SelectItem value="messagebird">MessageBird</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sms-number">Phone Number</Label>
                    <Input
                      id="sms-number"
                      value={channelForm.settings.phoneNumber}
                      onChange={(e) =>
                        setChannelForm({
                          ...channelForm,
                          settings: { ...channelForm.settings, phoneNumber: e.target.value },
                        })
                      }
                      placeholder="+1234567890"
                      data-testid="input-sms-number"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">TCPA Compliance</div>
                      <div className="text-xs text-muted-foreground">Ensure opt-in compliance</div>
                    </div>
                    <Switch defaultChecked data-testid="switch-tcpa-compliance" />
                  </div>
                </>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowChannelDialog(false);
                resetChannelForm();
              }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const settings: any = {};
                  settings[selectedChannel || channelForm.channel] = channelForm.settings;
                  configureChannelMutation.mutate({
                    channel: selectedChannel || channelForm.channel,
                    settings,
                  });
                }}
                disabled={!selectedChannel && !channelForm.channel}
                data-testid="button-save-channel-config"
              >
                Save Configuration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}