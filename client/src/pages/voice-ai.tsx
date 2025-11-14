import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Phone, PhoneOff, PhoneCall, Mic, MicOff, Volume2, 
  PlayCircle, PauseCircle, Calendar, Users, BarChart3, 
  FileText, AlertCircle, CheckCircle2, Clock, TrendingUp,
  PhoneIncoming, PhoneOutgoing, Voicemail, Settings,
  Bot, Brain, Target, Zap, Shield, HeadphonesIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface VoiceCampaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  script?: string;
  targetList?: any;
  callSchedule?: any;
  voiceSettings?: any;
  createdAt: string;
}

interface VoiceCall {
  id: string;
  campaignId?: string;
  contactId: string;
  phoneNumber: string;
  callStatus: string;
  duration?: number;
  startTime?: string;
  endTime?: string;
  recordingUrl?: string;
  transcript?: string;
  sentiment?: any;
  outcome?: string;
  createdAt: string;
}

interface VoiceScript {
  id: string;
  name: string;
  scriptType: string;
  introduction: string;
  mainContent: string;
  objectionHandlers?: any;
  closingStatement?: string;
  fallbackResponses?: any;
  variables?: any;
  performanceMetrics?: any;
  isActive: boolean;
  createdAt: string;
}

interface CallAnalytics {
  callId: string;
  keyMoments?: string[];
  speakingRatio?: number;
  interruptionCount: number;
  talkSpeed?: number;
  emotionalTone?: any;
  conversionPoints?: string[];
  objectionCount: number;
  positiveSignals: number;
  negativeSignals: number;
  nextBestAction?: string;
}

export default function VoiceAIPage() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("campaigns");
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<string | null>(null);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [isCreatingScript, setIsCreatingScript] = useState(false);
  const [liveCallsFilter, setLiveCallsFilter] = useState("all");
  
  // New campaign form state
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    description: "",
    script: "",
    voiceType: "professional",
    speed: 1.0,
    pitch: 1.0,
  });
  
  // New script form state
  const [newScript, setNewScript] = useState({
    name: "",
    scriptType: "cold_call",
    introduction: "",
    mainContent: "",
    closingStatement: "",
  });

  // Fetch campaigns
  const { data: campaigns, isLoading: loadingCampaigns } = useQuery<VoiceCampaign[]>({
    queryKey: ["/api/voice/campaigns"],
    queryFn: async () => {
      const response = await fetch("/api/voice/campaigns");
      if (!response.ok) throw new Error("Failed to fetch campaigns");
      return response.json();
    },
  });

  // Fetch calls
  const { data: calls, isLoading: loadingCalls } = useQuery<VoiceCall[]>({
    queryKey: ["/api/voice/calls"],
    queryFn: async () => {
      const response = await fetch("/api/voice/calls");
      if (!response.ok) throw new Error("Failed to fetch calls");
      return response.json();
    },
  });

  // Fetch scripts
  const { data: scripts, isLoading: loadingScripts } = useQuery<VoiceScript[]>({
    queryKey: ["/api/voice/scripts"],
    queryFn: async () => {
      const response = await fetch("/api/voice/scripts");
      if (!response.ok) throw new Error("Failed to fetch scripts");
      return response.json();
    },
  });

  // Fetch analytics
  const { data: analyticsData, isLoading: loadingAnalytics } = useQuery<{
    analytics: CallAnalytics[];
    aggregateMetrics: any;
    period: string;
  }>({
    queryKey: ["/api/voice/analytics"],
    queryFn: async () => {
      const response = await fetch("/api/voice/analytics");
      if (!response.ok) throw new Error("Failed to fetch analytics");
      return response.json();
    },
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/voice/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create campaign");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice/campaigns"] });
      toast({
        title: "Campaign Created",
        description: "Your voice campaign has been created successfully.",
      });
      setIsCreatingCampaign(false);
      setNewCampaign({
        name: "",
        description: "",
        script: "",
        voiceType: "professional",
        speed: 1.0,
        pitch: 1.0,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create voice campaign. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create script mutation
  const createScriptMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/voice/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create script");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice/scripts"] });
      toast({
        title: "Script Created",
        description: "Your voice script has been created successfully.",
      });
      setIsCreatingScript(false);
      setNewScript({
        name: "",
        scriptType: "cold_call",
        introduction: "",
        mainContent: "",
        closingStatement: "",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create voice script. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Initiate call mutation
  const initiateCallMutation = useMutation({
    mutationFn: async (data: { contactId: string; scriptId: string; campaignId?: string }) => {
      const response = await fetch("/api/voice/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to initiate call");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice/calls"] });
      toast({
        title: "Call Initiated",
        description: "The AI voice call has been initiated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.reason || "Failed to initiate call.",
        variant: "destructive",
      });
    },
  });

  const handleCreateCampaign = () => {
    const campaignData = {
      ...newCampaign,
      voiceSettings: {
        voiceType: newCampaign.voiceType,
        speed: newCampaign.speed,
        pitch: newCampaign.pitch,
      },
      status: "draft",
    };
    createCampaignMutation.mutate(campaignData);
  };

  const handleCreateScript = () => {
    const scriptData = {
      ...newScript,
      isActive: true,
      objectionHandlers: {},
      fallbackResponses: {},
    };
    createScriptMutation.mutate(scriptData);
  };

  const getCallStatusColor = (status: string) => {
    switch (status) {
      case "answered":
        return "bg-green-500/10 text-green-600";
      case "voicemail":
        return "bg-yellow-500/10 text-yellow-600";
      case "failed":
        return "bg-red-500/10 text-red-600";
      case "initiated":
      case "ringing":
        return "bg-blue-500/10 text-blue-600";
      default:
        return "bg-gray-500/10 text-gray-600";
    }
  };

  const getCallStatusIcon = (status: string) => {
    switch (status) {
      case "answered":
        return <PhoneCall className="h-4 w-4" />;
      case "voicemail":
        return <Voicemail className="h-4 w-4" />;
      case "failed":
        return <PhoneOff className="h-4 w-4" />;
      case "initiated":
        return <PhoneOutgoing className="h-4 w-4" />;
      case "ringing":
        return <PhoneIncoming className="h-4 w-4" />;
      default:
        return <Phone className="h-4 w-4" />;
    }
  };

  const activeCalls = calls?.filter(call => 
    ["initiated", "ringing", "answered"].includes(call.callStatus)
  ) || [];

  const completedCalls = calls?.filter(call => 
    ["voicemail", "failed"].includes(call.callStatus) || call.endTime
  ) || [];

  return (
    <div className="flex-1 space-y-6 p-6 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <HeadphonesIcon className="h-8 w-8 text-blue-600" />
            Voice AI Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Automated AI phone calls with natural conversation flow
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="px-3 py-1">
            <Shield className="h-3 w-3 mr-1" />
            Compliance Active
          </Badge>
          <Badge variant="default" className="px-3 py-1">
            <Phone className="h-3 w-3 mr-1 animate-pulse" />
            {activeCalls.length} Active Calls
          </Badge>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Calls Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{calls?.length || 0}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              +12% from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Answer Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">68%</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <BarChart3 className="h-3 w-3" />
              Industry avg: 55%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Call Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4:32</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3" />
              Optimal: 3-5 min
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Positive Outcomes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42%</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <CheckCircle2 className="h-3 w-3" />
              18 callbacks scheduled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="live-calls">Live Calls</TabsTrigger>
          <TabsTrigger value="scripts">Script Library</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Voice Campaigns</h2>
            <Dialog open={isCreatingCampaign} onOpenChange={setIsCreatingCampaign}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-campaign">
                  <Bot className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Voice Campaign</DialogTitle>
                  <DialogDescription>
                    Set up an automated voice calling campaign with AI
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="campaign-name">Campaign Name</Label>
                    <Input
                      id="campaign-name"
                      data-testid="input-campaign-name"
                      value={newCampaign.name}
                      onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                      placeholder="Q1 Outreach Campaign"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="campaign-description">Description</Label>
                    <Textarea
                      id="campaign-description"
                      data-testid="input-campaign-description"
                      value={newCampaign.description}
                      onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                      placeholder="Cold calling campaign for enterprise prospects..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Voice Persona</Label>
                    <Select
                      value={newCampaign.voiceType}
                      onValueChange={(value) => setNewCampaign({ ...newCampaign, voiceType: value })}
                    >
                      <SelectTrigger data-testid="select-voice-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                        <SelectItem value="warm">Warm</SelectItem>
                        <SelectItem value="confident">Confident</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="voice-speed">Voice Speed: {newCampaign.speed}x</Label>
                      <Input
                        id="voice-speed"
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={newCampaign.speed}
                        onChange={(e) => setNewCampaign({ ...newCampaign, speed: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="voice-pitch">Voice Pitch: {newCampaign.pitch}x</Label>
                      <Input
                        id="voice-pitch"
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={newCampaign.pitch}
                        onChange={(e) => setNewCampaign({ ...newCampaign, pitch: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreatingCampaign(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateCampaign}
                    disabled={!newCampaign.name || createCampaignMutation.isPending}
                    data-testid="button-save-campaign"
                  >
                    {createCampaignMutation.isPending ? "Creating..." : "Create Campaign"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loadingCampaigns ? (
            <div className="text-center py-8">Loading campaigns...</div>
          ) : (
            <div className="grid gap-4">
              {campaigns?.map((campaign) => (
                <Card key={campaign.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{campaign.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {campaign.description || "No description"}
                        </CardDescription>
                      </div>
                      <Badge 
                        variant={campaign.status === "active" ? "default" : "secondary"}
                        data-testid={`badge-campaign-status-${campaign.id}`}
                      >
                        {campaign.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Voice Type</p>
                        <p className="font-medium">
                          {campaign.voiceSettings?.voiceType || "Professional"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Calls Made</p>
                        <p className="font-medium">
                          {calls?.filter(c => c.campaignId === campaign.id).length || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Success Rate</p>
                        <p className="font-medium">45%</p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          data-testid={`button-view-campaign-${campaign.id}`}
                        >
                          <BarChart3 className="h-4 w-4 mr-1" />
                          View Stats
                        </Button>
                        <Button 
                          size="sm"
                          variant={campaign.status === "active" ? "destructive" : "default"}
                          data-testid={`button-toggle-campaign-${campaign.id}`}
                        >
                          {campaign.status === "active" ? (
                            <>
                              <PauseCircle className="h-4 w-4 mr-1" />
                              Pause
                            </>
                          ) : (
                            <>
                              <PlayCircle className="h-4 w-4 mr-1" />
                              Activate
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {(!campaigns || campaigns.length === 0) && (
                <Card className="text-center py-8">
                  <CardContent>
                    <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No voice campaigns yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Create your first AI voice campaign to start automated calling
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Live Calls Tab */}
        <TabsContent value="live-calls" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Call Management</h2>
            <div className="flex gap-2">
              <Select value={liveCallsFilter} onValueChange={setLiveCallsFilter}>
                <SelectTrigger className="w-32" data-testid="select-call-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Calls</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Calls */}
          {activeCalls.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Phone className="h-4 w-4 animate-pulse text-green-600" />
                Active Calls ({activeCalls.length})
              </h3>
              <div className="grid gap-3">
                {activeCalls.map((call) => (
                  <Card key={call.id} className="border-green-200 bg-green-50/50">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <Phone className="h-8 w-8 text-green-600" />
                            <span className="absolute -top-1 -right-1 h-3 w-3 bg-green-600 rounded-full animate-pulse" />
                          </div>
                          <div>
                            <p className="font-medium">{call.phoneNumber}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge 
                                className={getCallStatusColor(call.callStatus)}
                                data-testid={`badge-call-status-${call.id}`}
                              >
                                {getCallStatusIcon(call.callStatus)}
                                <span className="ml-1">{call.callStatus}</span>
                              </Badge>
                              {call.startTime && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(call.startTime).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline">
                            <Volume2 className="h-4 w-4 mr-1" />
                            Listen
                          </Button>
                          <Button size="sm" variant="destructive">
                            <PhoneOff className="h-4 w-4 mr-1" />
                            End Call
                          </Button>
                        </div>
                      </div>
                      {/* Live Transcript */}
                      <div className="mt-4 p-3 bg-white rounded-lg">
                        <p className="text-xs text-muted-foreground mb-2">Live Transcript</p>
                        <div className="space-y-2 text-sm">
                          <p><strong>AI:</strong> Hello, this is Sarah from TechCorp. Is this a good time to talk?</p>
                          <p><strong>Prospect:</strong> Um, what is this regarding?</p>
                          <p className="text-muted-foreground italic">
                            <Mic className="h-3 w-3 inline mr-1 animate-pulse" />
                            AI responding...
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Completed Calls */}
          <div className="space-y-4">
            <h3 className="font-medium">Recent Calls</h3>
            <div className="grid gap-3">
              {completedCalls.slice(0, 5).map((call) => (
                <Card key={call.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Phone className="h-6 w-6 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{call.phoneNumber}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge className={getCallStatusColor(call.callStatus)}>
                              {getCallStatusIcon(call.callStatus)}
                              <span className="ml-1">{call.callStatus}</span>
                            </Badge>
                            {call.duration && (
                              <span>{Math.floor(call.duration / 60)}:{(call.duration % 60).toString().padStart(2, '0')}</span>
                            )}
                            {call.outcome && (
                              <Badge variant="outline">{call.outcome}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          data-testid={`button-view-transcript-${call.id}`}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Transcript
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          data-testid={`button-analyze-call-${call.id}`}
                        >
                          <Brain className="h-4 w-4 mr-1" />
                          Analyze
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {(!calls || calls.length === 0) && (
                <Card className="text-center py-8">
                  <CardContent>
                    <PhoneOff className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No calls yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Start a voice campaign to initiate AI calls
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Scripts Tab */}
        <TabsContent value="scripts" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Voice Scripts</h2>
            <Dialog open={isCreatingScript} onOpenChange={setIsCreatingScript}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-script">
                  <FileText className="h-4 w-4 mr-2" />
                  Create Script
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Voice Script</DialogTitle>
                  <DialogDescription>
                    Design a conversation script for AI voice calls
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="script-name">Script Name</Label>
                    <Input
                      id="script-name"
                      data-testid="input-script-name"
                      value={newScript.name}
                      onChange={(e) => setNewScript({ ...newScript, name: e.target.value })}
                      placeholder="Enterprise Cold Call Script"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Script Type</Label>
                    <Select
                      value={newScript.scriptType}
                      onValueChange={(value) => setNewScript({ ...newScript, scriptType: value })}
                    >
                      <SelectTrigger data-testid="select-script-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cold_call">Cold Call</SelectItem>
                        <SelectItem value="follow_up">Follow Up</SelectItem>
                        <SelectItem value="demo_booking">Demo Booking</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="script-intro">Introduction</Label>
                    <Textarea
                      id="script-intro"
                      data-testid="input-script-intro"
                      value={newScript.introduction}
                      onChange={(e) => setNewScript({ ...newScript, introduction: e.target.value })}
                      placeholder="Hi [Name], this is [Agent] from [Company]. I'm reaching out to..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="script-main">Main Content</Label>
                    <Textarea
                      id="script-main"
                      data-testid="input-script-main"
                      value={newScript.mainContent}
                      onChange={(e) => setNewScript({ ...newScript, mainContent: e.target.value })}
                      placeholder="The reason for my call is to discuss how we've helped companies like yours..."
                      rows={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="script-closing">Closing Statement</Label>
                    <Textarea
                      id="script-closing"
                      data-testid="input-script-closing"
                      value={newScript.closingStatement}
                      onChange={(e) => setNewScript({ ...newScript, closingStatement: e.target.value })}
                      placeholder="Would you be interested in scheduling a brief 15-minute demo?"
                      rows={2}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreatingScript(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateScript}
                    disabled={!newScript.name || !newScript.introduction || !newScript.mainContent || createScriptMutation.isPending}
                    data-testid="button-save-script"
                  >
                    {createScriptMutation.isPending ? "Creating..." : "Create Script"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loadingScripts ? (
            <div className="text-center py-8">Loading scripts...</div>
          ) : (
            <div className="grid gap-4">
              {scripts?.map((script) => (
                <Card key={script.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{script.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">
                            {script.scriptType.replace('_', ' ').toUpperCase()}
                          </Badge>
                          {script.isActive ? (
                            <Badge variant="default" className="bg-green-600">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        data-testid={`button-preview-script-${script.id}`}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {script.introduction}
                    </p>
                    {script.performanceMetrics && (
                      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">Success Rate</p>
                          <p className="font-medium">65%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Avg Duration</p>
                          <p className="font-medium">3:45</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Times Used</p>
                          <p className="font-medium">128</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {(!scripts || scripts.length === 0) && (
                <Card className="text-center py-8">
                  <CardContent>
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No scripts created yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Create your first voice script to guide AI conversations
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Voice Channel Analytics</h2>
            <Select defaultValue="7days">
              <SelectTrigger className="w-32" data-testid="select-analytics-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7days">7 Days</SelectItem>
                <SelectItem value="30days">30 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadingAnalytics ? (
            <div className="text-center py-8">Loading analytics...</div>
          ) : analyticsData ? (
            <div className="space-y-6">
              {/* Aggregate Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Speaking Ratio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {(analyticsData.aggregateMetrics.avgSpeakingRatio * 100).toFixed(0)}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Prospect vs AI speaking time
                    </p>
                    <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${analyticsData.aggregateMetrics.avgSpeakingRatio * 100}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Objection Handling</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {analyticsData.aggregateMetrics.totalObjections}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Total objections handled
                    </p>
                    <div className="mt-2 flex gap-1">
                      <Badge variant="outline" className="text-xs">
                        Price: 45%
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Timing: 30%
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Need: 25%
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Sentiment Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-green-600">Positive</span>
                          <span>{analyticsData.aggregateMetrics.positiveSignals}</span>
                        </div>
                        <div className="h-2 bg-green-600/20 rounded-full overflow-hidden">
                          <div className="h-full bg-green-600 rounded-full" style={{ width: '60%' }} />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-red-600">Negative</span>
                          <span>{analyticsData.aggregateMetrics.negativeSignals}</span>
                        </div>
                        <div className="h-2 bg-red-600/20 rounded-full overflow-hidden">
                          <div className="h-full bg-red-600 rounded-full" style={{ width: '40%' }} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Call Outcomes Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Call Outcomes Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="text-sm">Interested / Meeting Booked</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">42%</span>
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-green-600 rounded-full" style={{ width: '42%' }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm">Callback Scheduled</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">28%</span>
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-600 rounded-full" style={{ width: '28%' }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Voicemail className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">Voicemail Left</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">18%</span>
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: '18%' }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm">Not Interested</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">12%</span>
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-red-600 rounded-full" style={{ width: '12%' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Best Performing Scripts */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Scripts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {["Enterprise Discovery", "SMB Quick Pitch", "Follow-up Sequence"].map((script, index) => (
                      <div key={index} className="flex items-center justify-between pb-3 border-b last:border-0">
                        <div>
                          <p className="font-medium">{script}</p>
                          <p className="text-sm text-muted-foreground">
                            {150 - index * 30} calls • {65 - index * 5}% success rate
                          </p>
                        </div>
                        <Badge variant="outline">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          +{15 - index * 3}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="text-center py-8">
              <CardContent>
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No analytics data available</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Analytics will appear once you start making calls
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}