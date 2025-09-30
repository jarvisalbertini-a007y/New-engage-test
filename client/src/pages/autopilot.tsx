import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Play, Pause, Settings, TrendingUp, Users, Mail, Calendar,
  Zap, Brain, Target, Clock, CheckCircle, AlertCircle, 
  BarChart, Activity, Sparkles, Bot, Shield, Rocket,
  RefreshCw, MessageSquare, Phone, Linkedin
} from "lucide-react";
import type { AutopilotCampaign, AutopilotRun, Persona, Sequence } from "@shared/schema";

interface CampaignMetrics {
  leadsProcessed: number;
  emailsSent: number;
  replies: number;
  meetings: number;
  conversionRate: number;
}

export function AutopilotPage() {
  const { toast } = useToast();
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    targetPersona: "",
    sequence: "",
    dailyTargetLeads: 50,
    dailySendLimit: 100,
    creativityLevel: 5,
    personalizationDepth: "moderate",
    toneOfVoice: "professional",
    autoProspect: true,
    autoFollowUp: true,
    autoQualify: false,
    autoBookMeetings: false,
    workingHours: { start: "09:00", end: "17:00", timezone: "UTC" },
    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  });

  // Fetch campaigns
  const { data: campaigns, isLoading } = useQuery<AutopilotCampaign[]>({
    queryKey: ["/api/autopilot/campaigns"],
  });

  // Fetch personas and sequences for dropdowns
  const { data: personas } = useQuery<Persona[]>({
    queryKey: ["/api/personas"],
  });

  const { data: sequences } = useQuery<Sequence[]>({
    queryKey: ["/api/sequences"],
  });

  // Fetch runs for selected campaign
  const { data: runs } = useQuery<AutopilotRun[]>({
    queryKey: selectedCampaign ? [`/api/autopilot/campaigns/${selectedCampaign}/runs`] : [],
    enabled: !!selectedCampaign,
  });

  // Create campaign mutation
  const createCampaign = useMutation({
    mutationFn: async (campaign: typeof newCampaign) => {
      return apiRequest("/api/autopilot/campaigns", "POST", campaign);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autopilot/campaigns"] });
      setShowCreate(false);
      toast({
        title: "Campaign Created!",
        description: "Your autopilot campaign has been created successfully.",
      });
    },
  });

  // Toggle campaign mutation
  const toggleCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest(`/api/autopilot/campaigns/${campaignId}/toggle`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autopilot/campaigns"] });
      toast({
        title: "Campaign Updated!",
        description: "Campaign status has been updated.",
      });
    },
  });

  // Run campaign mutation
  const runCampaign = useMutation({
    mutationFn: async (campaignId: string) => {
      return apiRequest(`/api/autopilot/campaigns/${campaignId}/run`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/autopilot/campaigns/${selectedCampaign}/runs`] });
      toast({
        title: "Autopilot Run Started!",
        description: "The campaign is now processing leads autonomously.",
      });
    },
  });

  // Calculate total metrics
  const totalMetrics = campaigns?.reduce((acc, campaign) => ({
    leadsProcessed: acc.leadsProcessed + (campaign.totalLeadsProcessed || 0),
    emailsSent: acc.emailsSent + (campaign.totalEmailsSent || 0),
    replies: acc.replies + (campaign.totalReplies || 0),
    meetings: acc.meetings + (campaign.totalMeetingsBooked || 0),
    conversionRate: 0
  }), { leadsProcessed: 0, emailsSent: 0, replies: 0, meetings: 0, conversionRate: 0 }) || 
  { leadsProcessed: 0, emailsSent: 0, replies: 0, meetings: 0, conversionRate: 0 };

  totalMetrics.conversionRate = totalMetrics.emailsSent > 0 
    ? (totalMetrics.meetings / totalMetrics.emailsSent * 100) 
    : 0;

  const activeCampaigns = campaigns?.filter(c => c.status === "active").length || 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl mb-2 flex items-center gap-2">
              <Bot className="h-8 w-8 text-primary" />
              AI Autopilot Mode
            </h1>
            <p className="text-muted-foreground">
              Set it and forget it - let AI handle your entire outreach workflow
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={activeCampaigns > 0 ? "default" : "secondary"} className="text-sm px-3 py-1">
              <Activity className="h-4 w-4 mr-1" />
              {activeCampaigns} Active
            </Badge>
            <Button 
              onClick={() => setShowCreate(true)}
              data-testid="button-create-campaign"
            >
              <Rocket className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </div>
        </div>

        {/* Metrics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Leads Processed</p>
                  <p className="text-2xl font-bold">{totalMetrics.leadsProcessed.toLocaleString()}</p>
                </div>
                <Users className="h-8 w-8 text-primary opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Emails Sent</p>
                  <p className="text-2xl font-bold">{totalMetrics.emailsSent.toLocaleString()}</p>
                </div>
                <Mail className="h-8 w-8 text-blue-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Replies</p>
                  <p className="text-2xl font-bold">{totalMetrics.replies.toLocaleString()}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Meetings</p>
                  <p className="text-2xl font-bold">{totalMetrics.meetings.toLocaleString()}</p>
                </div>
                <Calendar className="h-8 w-8 text-purple-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Conversion</p>
                  <p className="text-2xl font-bold">{totalMetrics.conversionRate.toFixed(1)}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-yellow-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Campaigns List */}
        <Tabs defaultValue="campaigns" className="space-y-4">
          <TabsList>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="space-y-4">
            {campaigns?.map((campaign) => (
              <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {campaign.name}
                        <Badge variant={campaign.status === "active" ? "default" : "secondary"}>
                          {campaign.status}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Target: {campaign.dailyTargetLeads} leads/day • 
                        Limit: {campaign.dailySendLimit} emails/day
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={campaign.status === "active"}
                        onCheckedChange={() => toggleCampaign.mutate(campaign.id)}
                        disabled={toggleCampaign.isPending}
                        data-testid={`switch-campaign-${campaign.id}`}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Campaign Metrics */}
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Processed</p>
                      <p className="font-semibold">{campaign.totalLeadsProcessed || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Sent</p>
                      <p className="font-semibold">{campaign.totalEmailsSent || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Replies</p>
                      <p className="font-semibold">{campaign.totalReplies || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Meetings</p>
                      <p className="font-semibold">{campaign.totalMeetingsBooked || 0}</p>
                    </div>
                  </div>

                  {/* Autonomous Behaviors */}
                  <div className="flex flex-wrap gap-2">
                    {campaign.autoProspect && (
                      <Badge variant="outline" className="text-xs">
                        <Target className="h-3 w-3 mr-1" />
                        Auto Prospect
                      </Badge>
                    )}
                    {campaign.autoFollowUp && (
                      <Badge variant="outline" className="text-xs">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Auto Follow-up
                      </Badge>
                    )}
                    {campaign.autoQualify && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Auto Qualify
                      </Badge>
                    )}
                    {campaign.autoBookMeetings && (
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="h-3 w-3 mr-1" />
                        Auto Book
                      </Badge>
                    )}
                  </div>

                  {/* AI Configuration */}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      Creativity: {campaign.creativityLevel}/10
                    </span>
                    <span className="text-muted-foreground">
                      Personalization: {campaign.personalizationDepth}
                    </span>
                    <span className="text-muted-foreground">
                      Tone: {campaign.toneOfVoice}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCampaign(campaign.id);
                        runCampaign.mutate(campaign.id);
                      }}
                      disabled={campaign.status !== "active" || runCampaign.isPending}
                      data-testid={`button-run-${campaign.id}`}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Run Now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedCampaign(campaign.id)}
                      data-testid={`button-view-${campaign.id}`}
                    >
                      <Activity className="h-4 w-4 mr-1" />
                      View Activity
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid={`button-settings-${campaign.id}`}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Configure
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {campaigns?.length === 0 && (
              <Card className="p-12">
                <div className="text-center space-y-3">
                  <Bot className="h-12 w-12 text-muted-foreground mx-auto" />
                  <h3 className="font-semibold">No Autopilot Campaigns</h3>
                  <p className="text-sm text-muted-foreground">
                    Create your first campaign to start autonomous prospecting
                  </p>
                  <Button onClick={() => setShowCreate(true)} data-testid="button-create-first">
                    <Rocket className="h-4 w-4 mr-2" />
                    Create Campaign
                  </Button>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            {selectedCampaign && runs && runs.length > 0 ? (
              <div className="space-y-4">
                {runs.map((run) => (
                  <Card key={run.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${
                            run.status === "completed" ? "bg-green-500/10" :
                            run.status === "running" ? "bg-blue-500/10" :
                            "bg-red-500/10"
                          }`}>
                            {run.status === "completed" ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : run.status === "running" ? (
                              <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{run.runType} Run</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(run.startedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">
                            {run.leadsProcessed} leads • {run.emailsSent} emails
                          </p>
                          {run.duration && (
                            <p className="text-xs text-muted-foreground">
                              {Math.floor(run.duration / 60)}m {run.duration % 60}s
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-12">
                <div className="text-center space-y-3">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto" />
                  <h3 className="font-semibold">No Activity Yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Run activity will appear here once campaigns are active
                  </p>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Global Autopilot Settings</CardTitle>
                <CardDescription>
                  Configure default behaviors for all autopilot campaigns
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Daily Processing Window</Label>
                  <div className="flex gap-2">
                    <Input type="time" defaultValue="09:00" className="w-32" />
                    <span className="flex items-center">to</span>
                    <Input type="time" defaultValue="17:00" className="w-32" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Safety Limits</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Max emails per day</span>
                      <Input type="number" defaultValue="150" className="w-20" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Max connections per day</span>
                      <Input type="number" defaultValue="50" className="w-20" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Delay between actions (seconds)</span>
                      <Input type="number" defaultValue="30" className="w-20" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>AI Behavior</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Require human approval for meetings</span>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Auto-pause on high bounce rate</span>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Learn from successful patterns</span>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>

                <Button className="w-full" data-testid="button-save-settings">
                  Save Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Campaign Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>Create Autopilot Campaign</CardTitle>
                <CardDescription>
                  Configure your autonomous outreach campaign
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign Name</Label>
                  <Input
                    id="name"
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                    placeholder="e.g., Enterprise SaaS Outreach"
                    data-testid="input-campaign-name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Target Persona</Label>
                    <Select
                      value={newCampaign.targetPersona}
                      onValueChange={(v) => setNewCampaign({ ...newCampaign, targetPersona: v })}
                    >
                      <SelectTrigger data-testid="select-persona">
                        <SelectValue placeholder="Select persona" />
                      </SelectTrigger>
                      <SelectContent>
                        {personas?.map((persona) => (
                          <SelectItem key={persona.id} value={persona.id}>
                            {persona.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Sequence</Label>
                    <Select
                      value={newCampaign.sequence}
                      onValueChange={(v) => setNewCampaign({ ...newCampaign, sequence: v })}
                    >
                      <SelectTrigger data-testid="select-sequence">
                        <SelectValue placeholder="Select sequence" />
                      </SelectTrigger>
                      <SelectContent>
                        {sequences?.map((sequence) => (
                          <SelectItem key={sequence.id} value={sequence.id}>
                            {sequence.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Daily Limits</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-2">
                        <Label>Target Leads per Day</Label>
                        <span className="text-sm text-muted-foreground">{newCampaign.dailyTargetLeads}</span>
                      </div>
                      <Slider
                        value={[newCampaign.dailyTargetLeads]}
                        onValueChange={(v) => setNewCampaign({ ...newCampaign, dailyTargetLeads: v[0] })}
                        max={200}
                        step={10}
                        data-testid="slider-target-leads"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <Label>Email Send Limit</Label>
                        <span className="text-sm text-muted-foreground">{newCampaign.dailySendLimit}</span>
                      </div>
                      <Slider
                        value={[newCampaign.dailySendLimit]}
                        onValueChange={(v) => setNewCampaign({ ...newCampaign, dailySendLimit: v[0] })}
                        max={300}
                        step={10}
                        data-testid="slider-send-limit"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Autonomous Behaviors</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-prospect">Auto Prospect</Label>
                      <Switch
                        id="auto-prospect"
                        checked={newCampaign.autoProspect}
                        onCheckedChange={(v) => setNewCampaign({ ...newCampaign, autoProspect: v })}
                        data-testid="switch-auto-prospect"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-followup">Auto Follow-up</Label>
                      <Switch
                        id="auto-followup"
                        checked={newCampaign.autoFollowUp}
                        onCheckedChange={(v) => setNewCampaign({ ...newCampaign, autoFollowUp: v })}
                        data-testid="switch-auto-followup"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-qualify">Auto Qualify</Label>
                      <Switch
                        id="auto-qualify"
                        checked={newCampaign.autoQualify}
                        onCheckedChange={(v) => setNewCampaign({ ...newCampaign, autoQualify: v })}
                        data-testid="switch-auto-qualify"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-book">Auto Book Meetings</Label>
                      <Switch
                        id="auto-book"
                        checked={newCampaign.autoBookMeetings}
                        onCheckedChange={(v) => setNewCampaign({ ...newCampaign, autoBookMeetings: v })}
                        data-testid="switch-auto-book"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">AI Configuration</h3>
                  <div>
                    <div className="flex justify-between mb-2">
                      <Label>Creativity Level</Label>
                      <span className="text-sm text-muted-foreground">{newCampaign.creativityLevel}/10</span>
                    </div>
                    <Slider
                      value={[newCampaign.creativityLevel]}
                      onValueChange={(v) => setNewCampaign({ ...newCampaign, creativityLevel: v[0] })}
                      max={10}
                      step={1}
                      data-testid="slider-creativity"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Personalization Depth</Label>
                      <Select
                        value={newCampaign.personalizationDepth}
                        onValueChange={(v) => setNewCampaign({ ...newCampaign, personalizationDepth: v })}
                      >
                        <SelectTrigger data-testid="select-personalization">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="deep">Deep</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Tone of Voice</Label>
                      <Select
                        value={newCampaign.toneOfVoice}
                        onValueChange={(v) => setNewCampaign({ ...newCampaign, toneOfVoice: v })}
                      >
                        <SelectTrigger data-testid="select-tone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="direct">Direct</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => createCampaign.mutate(newCampaign)}
                    disabled={!newCampaign.name || createCampaign.isPending}
                    data-testid="button-create-submit"
                  >
                    {createCampaign.isPending ? "Creating..." : "Create Campaign"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreate(false)}
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