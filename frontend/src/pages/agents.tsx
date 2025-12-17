import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Bot, Play, Pause, Settings, TrendingUp, Users, Mail, Activity, Plus, Edit2, Trash2, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Mock performance data
const mockPerformanceData = Array.from({ length: 7 }, (_, i) => ({
  day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i],
  contacted: Math.floor(Math.random() * 100) + 50,
  qualified: Math.floor(Math.random() * 30) + 10,
  meetings: Math.floor(Math.random() * 10) + 2,
}));

export default function AIAgents() {
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newAgentData, setNewAgentData] = useState({
    name: "",
    type: "prospecting",
    description: "",
    persona: "",
    targetsPerDay: 50,
    currentProgress: 0,
    successRate: "0",
    totalContacted: 0,
    totalQualified: 0,
    totalResponded: 0,
    totalBooked: 0,
    totalAttended: 0,
    status: "active",
    settings: {
      autoFollow: true,
      autoQualify: true,
      enrichData: true,
      maxDailyActions: 50,
    },
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["/api/agents"],
    queryFn: api.getAgents,
  });

  const { data: agentMetrics } = useQuery({
    queryKey: ["/api/agents/metrics"],
    queryFn: api.getAgentMetrics,
  });

  const { data: personas } = useQuery({
    queryKey: ["/api/personas"],
  });

  const createAgentMutation = useMutation({
    mutationFn: api.createAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/metrics"] });
      setShowCreateDialog(false);
      setNewAgentData({
        name: "",
        type: "prospecting",
        description: "",
        persona: "",
        targetsPerDay: 50,
        currentProgress: 0,
        successRate: "0",
        totalContacted: 0,
        totalQualified: 0,
        totalResponded: 0,
        totalBooked: 0,
        totalAttended: 0,
        status: "active",
        settings: {
          autoFollow: true,
          autoQualify: true,
          enrichData: true,
          maxDailyActions: 50,
        },
      });
      toast({
        title: "Agent Created",
        description: "Your AI agent has been created and activated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create agent. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateAgentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateAgent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/metrics"] });
      toast({
        title: "Agent Updated",
        description: "Agent settings have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update agent. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteAgentMutation = useMutation({
    mutationFn: api.deleteAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/metrics"] });
      toast({
        title: "Agent Deleted",
        description: "The agent has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete agent. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleAgentStatus = (agent: any) => {
    const newStatus = agent.status === "active" ? "paused" : "active";
    updateAgentMutation.mutate({
      id: agent.id,
      data: { status: newStatus },
    });
  };

  const createAgent = () => {
    createAgentMutation.mutate(newAgentData);
  };

  const updateAgentSettings = (agentId: string, settings: any) => {
    const agent = agents.find((a: any) => a.id === agentId);
    if (agent) {
      updateAgentMutation.mutate({
        id: agentId,
        data: { settings: { ...agent.settings, ...settings } },
      });
    }
  };

  const deleteAgent = (agentId: string) => {
    deleteAgentMutation.mutate(agentId);
  };

  const getAgentIcon = (type: string) => {
    switch (type) {
      case "prospecting": return Users;
      case "engagement": return Mail;
      case "booking": return Clock;
      default: return Bot;
    }
  };

  const getStatusColor = (status: string) => {
    return status === "active" ? "text-chart-1" : "text-muted-foreground";
  };

  const getTimeAgo = (date: string | Date | null) => {
    if (!date) return "Never";
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
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
            <h1 className="text-2xl font-bold">AI Agents</h1>
            <p className="text-muted-foreground">Autonomous prospecting and outreach management</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/agents"] })}
              data-testid="button-refresh"
            >
              <Activity className="h-4 w-4 mr-2" />
              Refresh Status
            </Button>
            <Button 
              onClick={() => setShowCreateDialog(true)}
              data-testid="button-create-agent"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background">
        <div className="p-6 space-y-6">
          {/* Metrics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{agentMetrics?.totalAgents || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">{agentMetrics?.activeAgents || 0} active</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Prospects Found</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(agentMetrics?.totalProspected || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Qualified Leads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(agentMetrics?.totalQualified || 0).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {agentMetrics?.totalProspected > 0 
                    ? Math.round((agentMetrics.totalQualified / agentMetrics.totalProspected) * 100) 
                    : 0}% conversion
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-chart-1">{agentMetrics?.avgSuccessRate || 0}%</div>
                <p className="text-xs text-muted-foreground mt-1">Average</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Today's Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{agentMetrics?.todayActions || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Automated</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Time Saved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round((agentMetrics?.todayActions || 0) * 0.08)}h
                </div>
                <p className="text-xs text-muted-foreground mt-1">This week</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="agents" className="space-y-4">
            <TabsList>
              <TabsTrigger value="agents">Active Agents</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="logs">Activity Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="agents" className="space-y-4">
              {/* Agent Cards */}
              {isLoading ? (
                <div className="text-center py-8">Loading agents...</div>
              ) : agents.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium mb-2">No AI Agents Yet</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create your first AI agent to start automating your sales outreach
                    </p>
                    <Button onClick={() => setShowCreateDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Agent
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agents.map((agent: any) => {
                    const Icon = getAgentIcon(agent.type);
                    return (
                      <Card key={agent.id} className="relative">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 bg-primary/10 rounded-lg">
                                <Icon className={`h-5 w-5 ${getStatusColor(agent.status)}`} />
                              </div>
                              <div>
                                <CardTitle className="text-base">{agent.name}</CardTitle>
                                <CardDescription className="text-xs">
                                  {agent.description}
                                </CardDescription>
                              </div>
                            </div>
                            <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                              {agent.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Daily Progress</span>
                              <span>{agent.currentProgress || 0}/{agent.targetsPerDay}</span>
                            </div>
                            <Progress 
                              value={((agent.currentProgress || 0) / agent.targetsPerDay) * 100} 
                              className="h-2"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">Success Rate</p>
                              <p className="font-medium">{agent.successRate || 0}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Last Run</p>
                              <p className="font-medium">{getTimeAgo(agent.lastRun)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total Actions</p>
                              <p className="font-medium">{(agent.totalContacted || 0).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Qualified</p>
                              <p className="font-medium">{(agent.totalQualified || 0).toLocaleString()}</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t">
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={agent.status === "active"}
                                onCheckedChange={() => toggleAgentStatus(agent)}
                                disabled={updateAgentMutation.isPending}
                                data-testid={`switch-agent-${agent.id}`}
                              />
                              <Label className="text-sm">
                                {agent.status === "active" ? "Active" : "Paused"}
                              </Label>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedAgent(agent);
                                  setShowEditDialog(true);
                                }}
                                data-testid={`button-edit-${agent.id}`}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteAgent(agent.id)}
                                disabled={deleteAgentMutation.isPending}
                                data-testid={`button-delete-${agent.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Performance</CardTitle>
                  <CardDescription>Agent activity over the past 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={mockPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="contacted" stroke="hsl(var(--chart-1))" name="Contacted" />
                      <Line type="monotone" dataKey="qualified" stroke="hsl(var(--chart-2))" name="Qualified" />
                      <Line type="monotone" dataKey="meetings" stroke="hsl(var(--chart-3))" name="Meetings" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Agent Efficiency</CardTitle>
                    <CardDescription>Success rates by agent type</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={[
                        { type: "Prospecting", rate: 82 },
                        { type: "Engagement", rate: 45 },
                        { type: "Booking", rate: 68 },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="type" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="rate" fill="hsl(var(--chart-1))" name="Success Rate %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Top Performers</CardTitle>
                    <CardDescription>Best performing agents this week</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {agents.slice(0, 3).map((agent: any, idx: number) => (
                        <div key={agent.id} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium`}>
                              {idx + 1}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{agent.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {agent.totalQualified || 0} qualified leads
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline">{agent.successRate || 0}%</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="logs" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Real-time agent actions and results</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {agents.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No activity yet. Create and activate agents to see their actions here.
                      </p>
                    ) : (
                      [
                        { time: "2 min ago", agent: agents[0]?.name || "Agent", action: "Found new prospect", target: "Sarah Chen @ DataFlow Inc", status: "success" },
                        { time: "5 min ago", agent: agents[0]?.name || "Agent", action: "Sent follow-up email", target: "Mike Johnson @ TechCorp", status: "success" },
                        { time: "12 min ago", agent: agents[0]?.name || "Agent", action: "Enriched contact data", target: "Lisa Rodriguez @ NextGen", status: "success" },
                        { time: "18 min ago", agent: agents[0]?.name || "Agent", action: "Booking attempt failed", target: "James Wilson @ CloudSoft", status: "failed" },
                        { time: "25 min ago", agent: agents[0]?.name || "Agent", action: "LinkedIn connection sent", target: "Emma Davis @ InnovateTech", status: "pending" },
                        { time: "32 min ago", agent: agents[0]?.name || "Agent", action: "Qualified lead", target: "Robert Lee @ FutureSystems", status: "success" },
                      ].map((log, idx) => (
                        <div key={idx} className="flex items-start space-x-3">
                          <div className="mt-0.5">
                            {log.status === "success" && <CheckCircle className="h-4 w-4 text-chart-1" />}
                            {log.status === "failed" && <AlertTriangle className="h-4 w-4 text-destructive" />}
                            {log.status === "pending" && <Clock className="h-4 w-4 text-chart-2" />}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm">
                                <span className="font-medium">{log.agent}</span>
                                <span className="text-muted-foreground"> {log.action}</span>
                              </p>
                              <span className="text-xs text-muted-foreground">{log.time}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{log.target}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Create Agent Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription>
              Configure your autonomous AI agent for prospecting and outreach.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                value={newAgentData.name}
                onChange={(e) => setNewAgentData({ ...newAgentData, name: e.target.value })}
                placeholder="e.g., Lead Hunter Pro"
                data-testid="input-agent-name"
              />
            </div>
            <div>
              <Label htmlFor="type">Agent Type</Label>
              <Select 
                value={newAgentData.type} 
                onValueChange={(value) => setNewAgentData({ ...newAgentData, type: value })}
              >
                <SelectTrigger id="type" data-testid="select-agent-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospecting">Prospecting Agent</SelectItem>
                  <SelectItem value="engagement">Engagement Agent</SelectItem>
                  <SelectItem value="booking">Booking Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newAgentData.description}
                onChange={(e) => setNewAgentData({ ...newAgentData, description: e.target.value })}
                placeholder="What will this agent do?"
                data-testid="textarea-description"
              />
            </div>
            <div>
              <Label htmlFor="persona">Target Persona</Label>
              <Select 
                value={newAgentData.persona} 
                onValueChange={(value) => setNewAgentData({ ...newAgentData, persona: value })}
              >
                <SelectTrigger id="persona" data-testid="select-persona">
                  <SelectValue placeholder="Select a persona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Enterprise Sales">Enterprise Sales</SelectItem>
                  <SelectItem value="Mid-Market Sales">Mid-Market Sales</SelectItem>
                  <SelectItem value="SMB Sales">SMB Sales</SelectItem>
                  <SelectItem value="Account Executive">Account Executive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="targets">Daily Target Actions</Label>
              <Input
                id="targets"
                type="number"
                value={newAgentData.targetsPerDay}
                onChange={(e) => setNewAgentData({ ...newAgentData, targetsPerDay: parseInt(e.target.value) })}
                data-testid="input-daily-targets"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button 
              onClick={createAgent} 
              disabled={createAgentMutation.isPending}
              data-testid="button-save-agent"
            >
              {createAgentMutation.isPending ? "Creating..." : "Create Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Agent Settings Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agent Settings</DialogTitle>
            <DialogDescription>
              Configure {selectedAgent?.name} behavior and limits.
            </DialogDescription>
          </DialogHeader>
          {selectedAgent && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-follow">Auto Follow-up</Label>
                  <Switch
                    id="auto-follow"
                    checked={selectedAgent.settings?.autoFollow || false}
                    onCheckedChange={(checked) => 
                      updateAgentSettings(selectedAgent.id, { autoFollow: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-qualify">Auto Qualify Leads</Label>
                  <Switch
                    id="auto-qualify"
                    checked={selectedAgent.settings?.autoQualify || false}
                    onCheckedChange={(checked) => 
                      updateAgentSettings(selectedAgent.id, { autoQualify: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="enrich-data">Enrich Contact Data</Label>
                  <Switch
                    id="enrich-data"
                    checked={selectedAgent.settings?.enrichData || false}
                    onCheckedChange={(checked) => 
                      updateAgentSettings(selectedAgent.id, { enrichData: checked })
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="max-actions">Max Daily Actions</Label>
                <Input
                  id="max-actions"
                  type="number"
                  value={selectedAgent.settings?.maxDailyActions || 50}
                  onChange={(e) => 
                    updateAgentSettings(selectedAgent.id, { maxDailyActions: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}