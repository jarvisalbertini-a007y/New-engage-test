import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Phone, PhoneCall, PhoneOff, Voicemail, Mic, MicOff, Users, Play, Pause, TrendingUp, Clock, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface CallAnalytics {
  totalCalls: number;
  connectedCalls: number;
  voicemails: number;
  avgDuration: number;
  connectRate: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export default function CloudDialer() {
  const { toast } = useToast();
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [scriptType, setScriptType] = useState("cold_call");
  const [isMuted, setIsMuted] = useState(false);

  // Queries
  const { data: contacts } = useQuery({
    queryKey: ["/api/contacts"],
    queryFn: () => api.getContacts({ limit: 50 }),
  });

  const { data: activeCalls } = useQuery({
    queryKey: ["/api/calls", { status: "active" }],
    queryFn: () => api.getPhoneCalls({ status: "connected" }),
    refetchInterval: 5000, // Poll every 5 seconds for active calls
  });

  const { data: recentCalls } = useQuery({
    queryKey: ["/api/calls"],
    queryFn: () => api.getPhoneCalls({}),
  });

  const { data: analytics } = useQuery({
    queryKey: ["/api/calls/analytics"],
    queryFn: () => api.getCallAnalytics(),
  });

  const { data: scripts } = useQuery({
    queryKey: ["/api/call-scripts"],
    queryFn: () => api.getCallScripts({}),
  });

  // Mutations
  const initiateCallMutation = useMutation({
    mutationFn: (data: { contactId: string; userId: string; scriptType: string }) =>
      api.initiateCall(data),
    onSuccess: (call: any) => {
      setActiveCallId(call.id);
      toast({
        title: "Call Initiated",
        description: "Dialing contact...",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calls/analytics"] });
    },
    onError: (error) => {
      toast({
        title: "Call Failed",
        description: error instanceof Error ? error.message : "Failed to initiate call",
        variant: "destructive",
      });
    },
  });

  const campaignMutation = useMutation({
    mutationFn: (data: { contactIds: string[]; userId: string; scriptType: string }) =>
      api.startCallCampaign(data),
    onSuccess: (response: any) => {
      toast({
        title: "Campaign Started",
        description: response.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calls"] });
      setSelectedContacts([]);
    },
  });

  const generateScriptMutation = useMutation({
    mutationFn: (data: { type: string; contactId?: string }) =>
      api.generateCallScript(data),
    onSuccess: () => {
      toast({
        title: "Script Generated",
        description: "AI-generated talk track ready",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/call-scripts"] });
    },
  });

  const handleCall = (contactId: string) => {
    initiateCallMutation.mutate({
      contactId,
      userId: "user1", // In production, get from auth context
      scriptType,
    });
  };

  const handleCampaign = () => {
    if (selectedContacts.length === 0) {
      toast({
        title: "No Contacts Selected",
        description: "Please select contacts to call",
        variant: "destructive",
      });
      return;
    }

    campaignMutation.mutate({
      contactIds: selectedContacts,
      userId: "user1", // In production, get from auth context
      scriptType,
    });
  };

  const getCallStatusColor = (status: string) => {
    switch (status) {
      case "connected":
      case "completed":
        return "bg-green-500";
      case "voicemail":
        return "bg-yellow-500";
      case "failed":
        return "bg-red-500";
      case "ringing":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cloud Dialer</h1>
            <p className="text-muted-foreground">AI-powered parallel dialing with talk tracks</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => generateScriptMutation.mutate({ type: scriptType })}
              variant="outline"
              data-testid="button-generate-script"
            >
              Generate AI Script
            </Button>
            <Button
              onClick={handleCampaign}
              disabled={selectedContacts.length === 0 || campaignMutation.isPending}
              data-testid="button-start-campaign"
            >
              <Users className="h-4 w-4 mr-2" />
              Start Campaign ({selectedContacts.length})
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6 space-y-6">
        {/* Analytics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Calls</p>
                  <p className="text-3xl font-bold">{analytics?.totalCalls || 0}</p>
                </div>
                <Phone className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Connect Rate</p>
                  <p className="text-3xl font-bold">{analytics?.connectRate || 0}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-chart-1" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Voicemails</p>
                  <p className="text-3xl font-bold">{analytics?.voicemails || 0}</p>
                </div>
                <Voicemail className="h-8 w-8 text-chart-2" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Duration</p>
                  <p className="text-3xl font-bold">
                    {analytics?.avgDuration ? formatDuration(analytics.avgDuration) : "0:00"}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-chart-3" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Sentiment</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-green-500">Positive</span>
                    <span>{analytics?.sentimentBreakdown?.positive || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-yellow-500">Neutral</span>
                    <span>{analytics?.sentimentBreakdown?.neutral || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-red-500">Negative</span>
                    <span>{analytics?.sentimentBreakdown?.negative || 0}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Call */}
        {activeCallId && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle>Active Call</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>JD</AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  </div>
                  <div>
                    <p className="font-medium">John Doe</p>
                    <p className="text-sm text-muted-foreground">TechCorp Solutions</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="icon"
                    variant={isMuted ? "destructive" : "outline"}
                    onClick={() => setIsMuted(!isMuted)}
                    data-testid="button-mute"
                  >
                    {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={() => setActiveCallId(null)}
                    data-testid="button-end-call"
                  >
                    <PhoneOff className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Call Duration</span>
                  <span className="font-medium">2:34</span>
                </div>
                <Progress value={65} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="contacts" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="scripts">Talk Tracks</TabsTrigger>
            <TabsTrigger value="history">Call History</TabsTrigger>
            <TabsTrigger value="voicemails">Voicemails</TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Contact List</CardTitle>
                  <Select value={scriptType} onValueChange={setScriptType}>
                    <SelectTrigger className="w-48" data-testid="select-script-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cold_call">Cold Call</SelectItem>
                      <SelectItem value="follow_up">Follow Up</SelectItem>
                      <SelectItem value="demo_booking">Demo Booking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {contacts?.map((contact: any) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted"
                        data-testid={`contact-${contact.id}`}
                      >
                        <div className="flex items-center space-x-4">
                          <input
                            type="checkbox"
                            checked={selectedContacts.includes(contact.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedContacts([...selectedContacts, contact.id]);
                              } else {
                                setSelectedContacts(selectedContacts.filter(id => id !== contact.id));
                              }
                            }}
                            className="h-4 w-4"
                          />
                          <Avatar>
                            <AvatarFallback>
                              {contact.firstName?.[0]}{contact.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {contact.firstName} {contact.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {contact.title} • {contact.phoneNumber || "No phone"}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleCall(contact.id)}
                          disabled={!contact.phoneNumber || initiateCallMutation.isPending}
                          data-testid={`button-call-${contact.id}`}
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Call Now
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scripts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI-Generated Talk Tracks</CardTitle>
                <CardDescription>
                  Personalized scripts with objection handling
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-4">
                    {scripts?.map((script: any) => (
                      <Card key={script.id}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{script.name}</CardTitle>
                            <div className="flex items-center space-x-2">
                              <Badge variant={script.aiGenerated ? "secondary" : "outline"}>
                                {script.aiGenerated ? "AI Generated" : "Manual"}
                              </Badge>
                              <Badge>{script.type}</Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <p className="text-sm font-medium mb-1">Opening:</p>
                            <p className="text-sm text-muted-foreground">{script.opening}</p>
                          </div>
                          {script.valueProps && script.valueProps.length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-1">Value Props:</p>
                              <ul className="list-disc list-inside text-sm text-muted-foreground">
                                {script.valueProps.map((prop: string, i: number) => (
                                  <li key={i}>{prop}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {script.closing && (
                            <div>
                              <p className="text-sm font-medium mb-1">Closing:</p>
                              <p className="text-sm text-muted-foreground">{script.closing}</p>
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center space-x-4 text-sm">
                              <span>Usage: {script.usageCount || 0}</span>
                              <span>Success: {script.successRate || 0}%</span>
                            </div>
                            <Button variant="outline" size="sm">
                              Use This Script
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Calls</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {recentCalls?.map((call: any) => (
                      <div
                        key={call.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`call-history-${call.id}`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`w-2 h-2 rounded-full ${getCallStatusColor(call.status)}`} />
                          <div>
                            <p className="font-medium">{call.phoneNumber}</p>
                            <p className="text-sm text-muted-foreground">
                              {call.direction} • {call.status} • 
                              {call.duration ? ` ${formatDuration(call.duration)}` : " No duration"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {call.sentiment && (
                            <Badge variant={
                              call.sentiment === 'positive' ? 'default' :
                              call.sentiment === 'negative' ? 'destructive' : 'secondary'
                            }>
                              {call.sentiment}
                            </Badge>
                          )}
                          <span className="text-sm text-muted-foreground">
                            {new Date(call.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="voicemails" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Voicemail Drops</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Voicemail className="h-12 w-12 mx-auto mb-4" />
                  <p>No voicemails yet</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}