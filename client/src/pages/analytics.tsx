import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Area, AreaChart } from "recharts";
import { TrendingUp, TrendingDown, Mail, Users, DollarSign, Target, Eye, Reply, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

// Mock data for charts
const emailPerformanceData = [
  { name: 'Jan', sent: 4000, opened: 2400, replied: 800, bounced: 200 },
  { name: 'Feb', sent: 3000, opened: 1398, replied: 600, bounced: 150 },
  { name: 'Mar', sent: 2000, opened: 1800, replied: 750, bounced: 100 },
  { name: 'Apr', sent: 2780, opened: 2200, replied: 900, bounced: 120 },
  { name: 'May', sent: 1890, opened: 1500, replied: 650, bounced: 80 },
  { name: 'Jun', sent: 2390, opened: 1900, replied: 800, bounced: 90 },
];

const sequencePerformanceData = [
  { name: 'SaaS Outreach Q1', replies: 45, opens: 78, meetings: 12, revenue: 85000 },
  { name: 'Enterprise Follow-up', replies: 38, opens: 65, meetings: 8, revenue: 120000 },
  { name: 'AI Agent Prospecting', replies: 52, opens: 82, meetings: 15, revenue: 95000 },
  { name: 'Funding Follow-up', replies: 28, opens: 55, meetings: 6, revenue: 65000 },
  { name: 'Product Launch', replies: 33, opens: 60, meetings: 9, revenue: 72000 },
];

const channelPerformanceData = [
  { name: 'Email', value: 65, color: 'hsl(var(--chart-1))' },
  { name: 'LinkedIn', value: 25, color: 'hsl(var(--chart-2))' },
  { name: 'Phone', value: 10, color: 'hsl(var(--chart-3))' },
];

const pipelineData = [
  { stage: 'Prospects', count: 1250, value: 3125000 },
  { stage: 'Qualified', count: 450, value: 2250000 },
  { stage: 'Demo', count: 180, value: 1800000 },
  { stage: 'Proposal', count: 75, value: 1125000 },
  { stage: 'Negotiation', count: 35, value: 875000 },
  { stage: 'Closed Won', count: 25, value: 625000 },
];

const recentCampaigns = [
  { id: 1, name: 'Q1 SaaS Outreach', status: 'active', contacts: 247, replyRate: 32.1, meetings: 15 },
  { id: 2, name: 'Enterprise Follow-up', status: 'completed', contacts: 89, replyRate: 41.2, meetings: 8 },
  { id: 3, name: 'Funding Alert Campaign', status: 'paused', contacts: 156, replyRate: 28.5, meetings: 6 },
  { id: 4, name: 'Product Launch Announcement', status: 'active', contacts: 324, replyRate: 35.8, meetings: 12 },
];

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("30d");
  const [selectedMetric, setSelectedMetric] = useState("all");

  const { data: dashboardStats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: sequences } = useQuery({
    queryKey: ["/api/sequences"],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-chart-1 text-background';
      case 'completed': return 'bg-chart-2 text-background';
      case 'paused': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 md:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Analytics</h1>
              <p className="text-sm md:text-base text-muted-foreground">Track performance and optimize your sales engagement</p>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32" data-testid="select-time-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="rounded-lg hover:soft-shadow-hover transition-all-soft" data-testid="button-export-report">
              <span className="hidden sm:inline">Export Report</span>
              <span className="sm:hidden">Export</span>
            </Button>
          </div>
        </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Total Emails Sent</p>
                  <p className="text-2xl md:text-3xl font-bold" data-testid="text-emails-sent">
                    {Math.floor(Math.random() * 5000 + 15000).toLocaleString()}
                  </p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-chart-1/10 rounded-lg flex items-center justify-center">
                  <Mail className="h-5 w-5 md:h-6 md:w-6 text-chart-1" />
                </div>
              </div>
              <div className="mt-3 md:mt-4 flex items-center text-xs md:text-sm">
                <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-chart-1 mr-1" />
                <span className="text-chart-1 font-medium">+12.5%</span>
                <span className="text-muted-foreground ml-1 md:ml-2 hidden sm:inline">from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Reply Rate</p>
                  <p className="text-2xl md:text-3xl font-bold text-chart-2" data-testid="text-reply-rate">
                    34.2%
                  </p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-chart-2/10 rounded-lg flex items-center justify-center">
                  <Reply className="h-5 w-5 md:h-6 md:w-6 text-chart-2" />
                </div>
              </div>
              <div className="mt-3 md:mt-4 flex items-center text-xs md:text-sm">
                <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-chart-2 mr-1" />
                <span className="text-chart-2 font-medium">+8.3%</span>
                <span className="text-muted-foreground ml-1 md:ml-2 hidden sm:inline">from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Meetings Booked</p>
                  <p className="text-2xl md:text-3xl font-bold text-chart-3" data-testid="text-meetings-booked">
                    {Math.floor(Math.random() * 50 + 125)}
                  </p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-chart-3/10 rounded-lg flex items-center justify-center">
                  <Calendar className="h-5 w-5 md:h-6 md:w-6 text-chart-3" />
                </div>
              </div>
              <div className="mt-3 md:mt-4 flex items-center text-xs md:text-sm">
                <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-chart-3 mr-1" />
                <span className="text-chart-3 font-medium">+22.1%</span>
                <span className="text-muted-foreground ml-1 md:ml-2 hidden sm:inline">from last month</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Pipeline Value</p>
                  <p className="text-xl md:text-3xl font-bold text-chart-4" data-testid="text-pipeline-value">
                    {formatCurrency(dashboardStats?.pipelineValue || 2400000)}
                  </p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-chart-4/10 rounded-lg flex items-center justify-center">
                  <DollarSign className="h-5 w-5 md:h-6 md:w-6 text-chart-4" />
                </div>
              </div>
              <div className="mt-3 md:mt-4 flex items-center text-xs md:text-sm">
                <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-chart-4 mr-1" />
                <span className="text-chart-4 font-medium">+18.7%</span>
                <span className="text-muted-foreground ml-1 md:ml-2 hidden sm:inline">from last month</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <Tabs defaultValue="performance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
            <TabsTrigger value="sequences" data-testid="tab-sequences">Sequences</TabsTrigger>
            <TabsTrigger value="channels" data-testid="tab-channels">Channels</TabsTrigger>
            <TabsTrigger value="pipeline" data-testid="tab-pipeline">Pipeline</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
                <CardHeader>
                  <CardTitle className="text-sm md:text-base">Email Performance Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={emailPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Area type="monotone" dataKey="sent" stackId="1" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.1} />
                      <Area type="monotone" dataKey="opened" stackId="2" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.3} />
                      <Area type="monotone" dataKey="replied" stackId="3" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
                <CardHeader>
                  <CardTitle className="text-sm md:text-base">Reply Rate Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={emailPerformanceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="replied" 
                        stroke="hsl(var(--chart-1))" 
                        strokeWidth={3}
                        dot={{ fill: 'hsl(var(--chart-1))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sequences" className="space-y-4 md:space-y-6">
            <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
              <CardHeader>
                <CardTitle className="text-sm md:text-base">Sequence Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={sequencePerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" angle={-45} textAnchor="end" height={100} />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="replies" fill="hsl(var(--chart-1))" name="Replies" />
                    <Bar dataKey="meetings" fill="hsl(var(--chart-2))" name="Meetings" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="channels" className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
                <CardHeader>
                  <CardTitle className="text-sm md:text-base">Channel Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={channelPerformanceData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                      >
                        {channelPerformanceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
                <CardHeader>
                  <CardTitle className="text-sm md:text-base">Channel Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {channelPerformanceData.map((channel) => (
                    <div key={channel.name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{channel.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {Math.floor(Math.random() * 30 + 20)}% reply rate
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{channel.value}%</p>
                        <p className="text-sm text-muted-foreground">of total</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Sales Pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pipelineData.map((stage, index) => (
                    <div key={stage.stage} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-chart-1 rounded-full flex items-center justify-center text-background text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{stage.stage}</p>
                          <p className="text-sm text-muted-foreground">{stage.count} prospects</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(stage.value)}</p>
                        <p className="text-sm text-muted-foreground">
                          {((stage.value / pipelineData[0].value) * 100).toFixed(1)}% of total
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Campaign Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Campaign Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3">Campaign</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-right p-3">Contacts</th>
                    <th className="text-right p-3">Reply Rate</th>
                    <th className="text-right p-3">Meetings</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCampaigns.map((campaign) => (
                    <tr key={campaign.id} className="border-b border-border hover:bg-muted/50">
                      <td className="p-3 font-medium" data-testid={`text-campaign-${campaign.id}`}>
                        {campaign.name}
                      </td>
                      <td className="p-3">
                        <Badge className={getStatusColor(campaign.status)}>
                          {campaign.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">{campaign.contacts}</td>
                      <td className="p-3 text-right font-medium text-chart-1">
                        {campaign.replyRate}%
                      </td>
                      <td className="p-3 text-right">{campaign.meetings}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
