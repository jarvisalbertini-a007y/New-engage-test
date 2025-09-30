import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Shield, AlertTriangle, CheckCircle, Activity, Mail, RefreshCw, TrendingUp, Zap, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Mock data for domain health
const mockDomainHealth = {
  overall: 85,
  spf: { status: "pass", record: "v=spf1 include:_spf.google.com ~all" },
  dkim: { status: "pass", selector: "google" },
  dmarc: { status: "warning", policy: "p=none" },
  reputation: 92,
  blacklists: 0,
  deliverabilityRate: 97.5,
};

// Mock data for email warming
const mockWarmingSchedule = [
  { day: 1, emails: 10, opened: 8, replied: 2 },
  { day: 2, emails: 15, opened: 12, replied: 3 },
  { day: 3, emails: 20, opened: 17, replied: 5 },
  { day: 4, emails: 30, opened: 25, replied: 7 },
  { day: 5, emails: 40, opened: 35, replied: 10 },
  { day: 6, emails: 50, opened: 43, replied: 12 },
  { day: 7, emails: 65, opened: 58, replied: 15 },
];

// Mock inbox placement data
const mockInboxPlacement = [
  { provider: "Gmail", inbox: 95, spam: 3, missing: 2 },
  { provider: "Outlook", inbox: 93, spam: 5, missing: 2 },
  { provider: "Yahoo", inbox: 91, spam: 7, missing: 2 },
  { provider: "Apple", inbox: 97, spam: 2, missing: 1 },
];

export default function Deliverability() {
  const [selectedDomain, setSelectedDomain] = useState("company.com");
  const [warmingEnabled, setWarmingEnabled] = useState(true);
  const [warmingSpeed, setWarmingSpeed] = useState("moderate");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: domainHealth, isLoading: isLoadingHealth, refetch: refetchHealth } = useQuery({
    queryKey: ["/api/deliverability/domain-health", selectedDomain],
    queryFn: () => api.getDomainHealth(selectedDomain),
    initialData: mockDomainHealth,
  });

  const { data: warmingStatus } = useQuery({
    queryKey: ["/api/deliverability/warming-status", selectedDomain],
    queryFn: () => api.getWarmingStatus(selectedDomain),
    initialData: { 
      isActive: warmingEnabled, 
      currentVolume: 65, 
      targetVolume: 500,
      daysActive: 7,
      schedule: mockWarmingSchedule 
    },
  });

  const { data: inboxPlacement } = useQuery({
    queryKey: ["/api/deliverability/inbox-placement"],
    queryFn: () => api.getInboxPlacement(),
    initialData: mockInboxPlacement,
  });

  const updateWarmingMutation = useMutation({
    mutationFn: (settings: any) => api.updateWarmingSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deliverability/warming-status"] });
      toast({
        title: "Warming Settings Updated",
        description: "Your email warming configuration has been updated.",
      });
    },
  });

  const verifyDomainMutation = useMutation({
    mutationFn: () => api.verifyDomain(selectedDomain),
    onSuccess: () => {
      refetchHealth();
      toast({
        title: "Domain Verification Complete",
        description: "Your domain configuration has been verified.",
      });
    },
  });

  const getHealthColor = (score: number) => {
    if (score >= 90) return "text-chart-1";
    if (score >= 70) return "text-chart-2";
    if (score >= 50) return "text-chart-4";
    return "text-destructive";
  };

  const getStatusIcon = (status: string) => {
    if (status === "pass") return <CheckCircle className="h-4 w-4 text-chart-1" />;
    if (status === "warning") return <AlertTriangle className="h-4 w-4 text-chart-2" />;
    return <AlertTriangle className="h-4 w-4 text-destructive" />;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Email Deliverability</h1>
            <p className="text-muted-foreground">Monitor and improve your email delivery rates</p>
          </div>
          <div className="flex items-center space-x-4">
            <Select value={selectedDomain} onValueChange={setSelectedDomain}>
              <SelectTrigger className="w-[200px]" data-testid="select-domain">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="company.com">company.com</SelectItem>
                <SelectItem value="sales.company.com">sales.company.com</SelectItem>
                <SelectItem value="marketing.company.com">marketing.company.com</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline"
              onClick={() => refetchHealth()}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button 
              onClick={() => verifyDomainMutation.mutate()}
              disabled={verifyDomainMutation.isPending}
              data-testid="button-verify"
            >
              <Shield className="h-4 w-4 mr-2" />
              {verifyDomainMutation.isPending ? "Verifying..." : "Verify Domain"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background">
        <div className="p-6 space-y-6">
          {/* Health Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-bold ${getHealthColor(domainHealth?.overall || 0)}`}>
                    {domainHealth?.overall}%
                  </span>
                  <Shield className={`h-5 w-5 ${getHealthColor(domainHealth?.overall || 0)}`} />
                </div>
                <Progress value={domainHealth?.overall} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Reputation Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-bold ${getHealthColor(domainHealth?.reputation || 0)}`}>
                    {domainHealth?.reputation}
                  </span>
                  <TrendingUp className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Sender reputation</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Deliverability Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-chart-1">
                    {domainHealth?.deliverabilityRate}%
                  </span>
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Inbox placement</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Blacklists</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-bold ${domainHealth?.blacklists === 0 ? 'text-chart-1' : 'text-destructive'}`}>
                    {domainHealth?.blacklists}
                  </span>
                  <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Active listings</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="authentication" className="space-y-4">
            <TabsList>
              <TabsTrigger value="authentication">Authentication</TabsTrigger>
              <TabsTrigger value="warming">Email Warming</TabsTrigger>
              <TabsTrigger value="placement">Inbox Placement</TabsTrigger>
              <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            </TabsList>

            <TabsContent value="authentication" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">SPF Record</CardTitle>
                    <CardDescription>Sender Policy Framework</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span>Status</span>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(domainHealth?.spf?.status || "fail")}
                          <Badge variant={domainHealth?.spf?.status === "pass" ? "default" : "destructive"}>
                            {domainHealth?.spf?.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-2 bg-muted rounded-md">
                        <code className="text-xs">{domainHealth?.spf?.record}</code>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">DKIM Signature</CardTitle>
                    <CardDescription>DomainKeys Identified Mail</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span>Status</span>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(domainHealth?.dkim?.status || "fail")}
                          <Badge variant={domainHealth?.dkim?.status === "pass" ? "default" : "destructive"}>
                            {domainHealth?.dkim?.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-2 bg-muted rounded-md">
                        <code className="text-xs">Selector: {domainHealth?.dkim?.selector}</code>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">DMARC Policy</CardTitle>
                    <CardDescription>Domain Authentication</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span>Status</span>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(domainHealth?.dmarc?.status || "fail")}
                          <Badge variant={domainHealth?.dmarc?.status === "pass" ? "default" : "secondary"}>
                            {domainHealth?.dmarc?.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-2 bg-muted rounded-md">
                        <code className="text-xs">{domainHealth?.dmarc?.policy}</code>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {domainHealth?.dmarc?.status === "warning" && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>DMARC Policy Warning</AlertTitle>
                  <AlertDescription>
                    Your DMARC policy is set to "none". Consider updating to "quarantine" or "reject" for better protection against email spoofing.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="warming" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Email Warming Configuration</CardTitle>
                  <CardDescription>Gradually increase sending volume to build reputation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Warming Status</Label>
                      <p className="text-sm text-muted-foreground">
                        {warmingEnabled ? "Actively warming your domain" : "Warming is paused"}
                      </p>
                    </div>
                    <Switch
                      checked={warmingEnabled}
                      onCheckedChange={(checked) => {
                        setWarmingEnabled(checked);
                        updateWarmingMutation.mutate({ enabled: checked, speed: warmingSpeed });
                      }}
                      data-testid="switch-warming"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Warming Speed</Label>
                    <Select 
                      value={warmingSpeed} 
                      onValueChange={(value) => {
                        setWarmingSpeed(value);
                        updateWarmingMutation.mutate({ enabled: warmingEnabled, speed: value });
                      }}
                    >
                      <SelectTrigger data-testid="select-speed">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="slow">Slow (Safe)</SelectItem>
                        <SelectItem value="moderate">Moderate (Recommended)</SelectItem>
                        <SelectItem value="fast">Fast (Aggressive)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span className="text-muted-foreground">
                        {warmingStatus?.currentVolume} / {warmingStatus?.targetVolume} emails/day
                      </span>
                    </div>
                    <Progress 
                      value={(warmingStatus?.currentVolume / warmingStatus?.targetVolume) * 100} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      Day {warmingStatus?.daysActive} of warming schedule
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-4">Warming Progress</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={mockWarmingSchedule}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="emails" stroke="hsl(var(--chart-1))" name="Sent" />
                        <Line type="monotone" dataKey="opened" stroke="hsl(var(--chart-2))" name="Opened" />
                        <Line type="monotone" dataKey="replied" stroke="hsl(var(--chart-3))" name="Replied" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="placement" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Inbox Placement by Provider</CardTitle>
                  <CardDescription>Monitor where your emails are landing</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {inboxPlacement?.map((provider: any) => (
                      <div key={provider.provider} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{provider.provider}</span>
                          <div className="flex items-center space-x-2 text-sm">
                            <span className="text-chart-1">{provider.inbox}% Inbox</span>
                            <span className="text-chart-4">{provider.spam}% Spam</span>
                            <span className="text-muted-foreground">{provider.missing}% Lost</span>
                          </div>
                        </div>
                        <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                          <div 
                            className="bg-chart-1" 
                            style={{ width: `${provider.inbox}%` }}
                          />
                          <div 
                            className="bg-chart-4" 
                            style={{ width: `${provider.spam}%` }}
                          />
                          <div 
                            className="bg-muted-foreground" 
                            style={{ width: `${provider.missing}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={inboxPlacement}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="provider" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="inbox" fill="hsl(var(--chart-1))" name="Inbox %" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Issues</CardTitle>
                    <CardDescription>Delivery problems detected</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle className="text-sm">High bounce rate detected</AlertTitle>
                        <AlertDescription className="text-xs">
                          5.2% bounce rate on campaign "Q4 Outreach" - 2 hours ago
                        </AlertDescription>
                      </Alert>
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle className="text-sm">SPF alignment failure</AlertTitle>
                        <AlertDescription className="text-xs">
                          12 emails failed SPF checks - 5 hours ago
                        </AlertDescription>
                      </Alert>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recommendations</CardTitle>
                    <CardDescription>Improve your deliverability</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start space-x-2">
                        <Zap className="h-4 w-4 text-chart-2 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Enable DMARC enforcement</p>
                          <p className="text-xs text-muted-foreground">
                            Update your DMARC policy from "none" to "quarantine"
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <Zap className="h-4 w-4 text-chart-2 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Clean your email list</p>
                          <p className="text-xs text-muted-foreground">
                            Remove 247 inactive subscribers to improve engagement
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <Zap className="h-4 w-4 text-chart-2 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Increase warming volume</p>
                          <p className="text-xs text-muted-foreground">
                            Your domain can handle higher volume based on current metrics
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}