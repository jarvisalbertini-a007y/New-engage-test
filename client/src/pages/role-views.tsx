import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User, Users, Target, TrendingUp, Phone, Mail, Calendar,
  DollarSign, Activity, CheckCircle, AlertCircle, Clock,
  BarChart, PieChart, Award, Briefcase, UserCheck,
  Building, Globe, ChevronRight, ArrowUp, ArrowDown,
  Play, Pause, Settings, Filter, Download, RefreshCw
} from "lucide-react";
import {
  BarChart as RechartsBarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from "recharts";

// Role definitions
const roles = {
  sdr: {
    name: "Sales Development Rep",
    icon: Phone,
    color: "blue",
    focus: ["Lead Generation", "Outreach", "Qualification", "Meeting Booking"],
    metrics: ["Calls Made", "Emails Sent", "Meetings Booked", "Response Rate"]
  },
  ae: {
    name: "Account Executive", 
    icon: Briefcase,
    color: "green",
    focus: ["Pipeline Management", "Deal Closing", "Upselling", "Relationship Building"],
    metrics: ["Pipeline Value", "Win Rate", "Average Deal Size", "Sales Cycle"]
  },
  manager: {
    name: "Sales Manager",
    icon: Users,
    color: "purple",
    focus: ["Team Performance", "Coaching", "Forecasting", "Process Optimization"],
    metrics: ["Team Quota", "Rep Performance", "Pipeline Health", "Activity Metrics"]
  },
  executive: {
    name: "Executive",
    icon: Building,
    color: "amber",
    focus: ["Revenue Growth", "Strategic Initiatives", "Market Expansion", "ROI"],
    metrics: ["Revenue", "Growth Rate", "Market Share", "Customer Acquisition Cost"]
  }
};

// Mock data for different roles
const generateRoleData = (role: string) => {
  switch(role) {
    case 'sdr':
      return {
        dailyMetrics: [
          { name: "Calls", value: 47, target: 50, icon: Phone },
          { name: "Emails", value: 125, target: 100, icon: Mail },
          { name: "LinkedIn", value: 32, target: 30, icon: Globe },
          { name: "Meetings", value: 5, target: 8, icon: Calendar }
        ],
        weeklyActivity: [
          { day: "Mon", calls: 45, emails: 110, meetings: 4 },
          { day: "Tue", calls: 52, emails: 135, meetings: 6 },
          { day: "Wed", calls: 41, emails: 98, meetings: 3 },
          { day: "Thu", calls: 49, emails: 125, meetings: 5 },
          { day: "Fri", calls: 38, emails: 95, meetings: 4 }
        ],
        leadQueue: [
          { company: "TechCorp", score: 85, status: "Hot", action: "Call now" },
          { company: "DataFlow Inc", score: 72, status: "Warm", action: "Send follow-up" },
          { company: "CloudBase", score: 68, status: "Warm", action: "LinkedIn connect" },
          { company: "AI Solutions", score: 55, status: "Cold", action: "Add to sequence" }
        ],
        topTasks: [
          "Follow up with Johnson from Demo yesterday",
          "Complete 20 more cold calls by 3 PM",
          "Research 10 new prospects in healthcare",
          "Update CRM notes for morning calls"
        ]
      };
    
    case 'ae':
      return {
        pipeline: [
          { stage: "Qualification", value: 125000, deals: 8 },
          { stage: "Discovery", value: 340000, deals: 12 },
          { stage: "Proposal", value: 520000, deals: 6 },
          { stage: "Negotiation", value: 280000, deals: 3 },
          { stage: "Closing", value: 180000, deals: 2 }
        ],
        deals: [
          { company: "Enterprise Co", value: 150000, stage: "Negotiation", probability: 75, daysInStage: 5 },
          { company: "Global Tech", value: 85000, stage: "Proposal", probability: 60, daysInStage: 12 },
          { company: "MegaCorp", value: 220000, stage: "Discovery", probability: 40, daysInStage: 3 },
          { company: "StartupXYZ", value: 45000, stage: "Closing", probability: 90, daysInStage: 2 }
        ],
        performance: {
          quota: 500000,
          closed: 385000,
          projected: 445000,
          winRate: 32,
          avgDealSize: 77000,
          avgCycle: 45
        },
        upcomingMeetings: [
          { time: "10:00 AM", company: "Enterprise Co", type: "Contract Review" },
          { time: "2:00 PM", company: "Global Tech", type: "Demo" },
          { time: "4:00 PM", company: "MegaCorp", type: "Discovery Call" }
        ]
      };
    
    case 'manager':
      return {
        teamPerformance: [
          { rep: "Sarah Chen", quota: 150000, achieved: 142000, deals: 12, activities: 450 },
          { rep: "Mike Johnson", quota: 150000, achieved: 98000, deals: 8, activities: 380 },
          { rep: "Emma Wilson", quota: 120000, achieved: 135000, deals: 15, activities: 520 },
          { rep: "David Lee", quota: 120000, achieved: 87000, deals: 6, activities: 290 },
          { rep: "Lisa Park", quota: 100000, achieved: 112000, deals: 10, activities: 410 }
        ],
        teamMetrics: {
          totalQuota: 640000,
          totalAchieved: 574000,
          attainment: 89.7,
          avgDealSize: 52000,
          totalActivities: 2050,
          conversionRate: 18
        },
        pipelineHealth: [
          { metric: "Coverage Ratio", value: 3.2, status: "good", target: 3.0 },
          { metric: "Win Rate", value: 28, status: "warning", target: 35 },
          { metric: "Sales Velocity", value: 45000, status: "good", target: 40000 },
          { metric: "Average Deal Age", value: 52, status: "warning", target: 45 }
        ],
        coachingNeeds: [
          { rep: "Mike Johnson", issue: "Low conversion rate", action: "Schedule 1:1 on objection handling" },
          { rep: "David Lee", issue: "Low activity volume", action: "Review time management" },
          { rep: "Sarah Chen", issue: "Deals stuck in negotiation", action: "Practice closing techniques" }
        ]
      };
    
    case 'executive':
      return {
        kpis: [
          { metric: "Annual Revenue", value: "$12.5M", change: "+18%", target: "$15M" },
          { metric: "Growth Rate", value: "24%", change: "+5%", target: "30%" },
          { metric: "CAC", value: "$8,500", change: "-12%", target: "$7,000" },
          { metric: "LTV:CAC", value: "3.2:1", change: "+0.4", target: "3.5:1" }
        ],
        revenueChart: [
          { month: "Jan", actual: 980000, target: 900000 },
          { month: "Feb", actual: 1050000, target: 950000 },
          { month: "Mar", actual: 1120000, target: 1000000 },
          { month: "Apr", actual: 1080000, target: 1100000 },
          { month: "May", actual: 1250000, target: 1150000 },
          { month: "Jun", actual: 1180000, target: 1200000 }
        ],
        marketSegments: [
          { segment: "Enterprise", revenue: 5200000, growth: 32 },
          { segment: "Mid-Market", revenue: 4800000, growth: 18 },
          { segment: "SMB", revenue: 2500000, growth: 45 }
        ],
        strategicInitiatives: [
          { name: "Product-Led Growth", status: "In Progress", impact: "High", completion: 65 },
          { name: "EMEA Expansion", status: "Planning", impact: "High", completion: 25 },
          { name: "Partnership Program", status: "Active", impact: "Medium", completion: 80 },
          { name: "AI Integration", status: "In Progress", impact: "High", completion: 40 }
        ]
      };
    
    default:
      return {};
  }
};

export function RoleViewsPage() {
  const [selectedRole, setSelectedRole] = useState<keyof typeof roles>("sdr");
  const currentRole = roles[selectedRole];
  const roleData = generateRoleData(selectedRole);

  const renderSDRView = () => {
    const data = roleData as ReturnType<typeof generateRoleData>;
    if (!data.dailyMetrics) return null;

    return (
      <div className="space-y-6">
        {/* Daily Targets */}
        <div className="grid grid-cols-4 gap-4">
          {data.dailyMetrics.map((metric) => (
            <Card key={metric.name}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <metric.icon className="h-5 w-5 text-muted-foreground" />
                  <span className={`text-sm ${metric.value >= metric.target ? 'text-green-500' : 'text-yellow-500'}`}>
                    {metric.value}/{metric.target}
                  </span>
                </div>
                <p className="font-semibold">{metric.name}</p>
                <Progress value={(metric.value / metric.target) * 100} className="mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Activity Chart and Lead Queue */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={data.weeklyActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="calls" stackId="1" stroke="#3b82f6" fill="#3b82f6" />
                  <Area type="monotone" dataKey="emails" stackId="1" stroke="#10b981" fill="#10b981" />
                  <Area type="monotone" dataKey="meetings" stackId="1" stroke="#f59e0b" fill="#f59e0b" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Priority Lead Queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.leadQueue?.map((lead, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="font-medium">{lead.company}</p>
                    <p className="text-sm text-muted-foreground">{lead.action}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={lead.status === "Hot" ? "destructive" : lead.status === "Warm" ? "default" : "secondary"}>
                      {lead.status}
                    </Badge>
                    <span className="font-semibold">{lead.score}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Tasks */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Priorities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topTasks?.map((task, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                    {idx + 1}
                  </div>
                  <span className="text-sm">{task}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderAEView = () => {
    const data = roleData as any;
    if (!data.pipeline) return null;

    return (
      <div className="space-y-6">
        {/* Performance Metrics */}
        <div className="grid grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Quota</p>
              <p className="text-2xl font-bold">${(data.performance.quota / 1000).toFixed(0)}k</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Closed</p>
              <p className="text-2xl font-bold text-green-500">${(data.performance.closed / 1000).toFixed(0)}k</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Projected</p>
              <p className="text-2xl font-bold">${(data.performance.projected / 1000).toFixed(0)}k</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-bold">{data.performance.winRate}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Avg Deal</p>
              <p className="text-2xl font-bold">${(data.performance.avgDealSize / 1000).toFixed(0)}k</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Cycle</p>
              <p className="text-2xl font-bold">{data.performance.avgCycle}d</p>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline and Deals */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline by Stage</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <RechartsBarChart data={data.pipeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => `$${(value / 1000).toFixed(0)}k`} />
                  <Bar dataKey="value" fill="#8b5cf6" />
                </RechartsBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Deals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.deals?.map((deal: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{deal.company}</p>
                    <p className="text-sm text-muted-foreground">
                      {deal.stage} • {deal.daysInStage} days
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">${(deal.value / 1000).toFixed(0)}k</p>
                    <Badge variant={deal.probability >= 70 ? "default" : "secondary"}>
                      {deal.probability}%
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Today's Meetings */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.upcomingMeetings?.map((meeting: any, idx: number) => (
                <div key={idx} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                  <div className="text-center">
                    <Calendar className="h-5 w-5 text-primary mb-1" />
                    <p className="text-xs font-medium">{meeting.time}</p>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{meeting.company}</p>
                    <p className="text-sm text-muted-foreground">{meeting.type}</p>
                  </div>
                  <Button size="sm" variant="outline" data-testid={`join-meeting-${idx}`}>
                    Join
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderManagerView = () => {
    const data = roleData as any;
    if (!data.teamPerformance) return null;

    return (
      <div className="space-y-6">
        {/* Team Summary */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Team Quota</p>
              <p className="text-2xl font-bold">${(data.teamMetrics.totalQuota / 1000).toFixed(0)}k</p>
              <p className="text-xs text-green-500 mt-1">{data.teamMetrics.attainment}% achieved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Avg Deal Size</p>
              <p className="text-2xl font-bold">${(data.teamMetrics.avgDealSize / 1000).toFixed(0)}k</p>
              <p className="text-xs text-muted-foreground mt-1">Across all reps</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Activities</p>
              <p className="text-2xl font-bold">{data.teamMetrics.totalActivities}</p>
              <p className="text-xs text-muted-foreground mt-1">This week</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Conversion Rate</p>
              <p className="text-2xl font-bold">{data.teamMetrics.conversionRate}%</p>
              <p className="text-xs text-yellow-500 mt-1">Below target</p>
            </CardContent>
          </Card>
        </div>

        {/* Team Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Team Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.teamPerformance?.map((rep: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <User className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{rep.rep}</p>
                      <p className="text-sm text-muted-foreground">
                        {rep.deals} deals • {rep.activities} activities
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">
                        ${(rep.achieved / 1000).toFixed(0)}k / ${(rep.quota / 1000).toFixed(0)}k
                      </p>
                      <Progress value={(rep.achieved / rep.quota) * 100} className="w-32 mt-1" />
                    </div>
                    <Badge variant={rep.achieved >= rep.quota ? "default" : "secondary"}>
                      {Math.round((rep.achieved / rep.quota) * 100)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Health and Coaching Needs */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.pipelineHealth?.map((metric: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm">{metric.metric}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{metric.value}</span>
                    {metric.status === "good" ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Coaching Opportunities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.coachingNeeds?.map((need: any, idx: number) => (
                <div key={idx} className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="font-medium text-sm">{need.rep}</p>
                  <p className="text-xs text-muted-foreground mt-1">{need.issue}</p>
                  <Button size="sm" variant="link" className="p-0 h-auto mt-2" data-testid={`coach-${idx}`}>
                    {need.action} →
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  const renderExecutiveView = () => {
    const data = roleData as any;
    if (!data.kpis) return null;

    return (
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          {data.kpis?.map((kpi: any, idx: number) => (
            <Card key={idx}>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{kpi.metric}</p>
                <p className="text-2xl font-bold">{kpi.value}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-sm ${kpi.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                    {kpi.change}
                  </span>
                  <span className="text-xs text-muted-foreground">Target: {kpi.target}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Revenue Chart and Market Segments */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: any) => `$${(value / 1000000).toFixed(1)}M`} />
                  <Line type="monotone" dataKey="actual" stroke="#10b981" strokeWidth={2} />
                  <Line type="monotone" dataKey="target" stroke="#94a3b8" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Market Segments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.marketSegments?.map((segment: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{segment.segment}</p>
                    <p className="text-sm text-muted-foreground">
                      ${(segment.revenue / 1000000).toFixed(1)}M revenue
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-green-500">+{segment.growth}%</span>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Strategic Initiatives */}
        <Card>
          <CardHeader>
            <CardTitle>Strategic Initiatives</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.strategicInitiatives?.map((initiative: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex-1">
                    <p className="font-medium">{initiative.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{initiative.status}</Badge>
                      <Badge variant={initiative.impact === "High" ? "destructive" : "secondary"}>
                        {initiative.impact} Impact
                      </Badge>
                    </div>
                  </div>
                  <div className="w-32">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Progress</span>
                      <span>{initiative.completion}%</span>
                    </div>
                    <Progress value={initiative.completion} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl mb-2 flex items-center gap-2">
              <currentRole.icon className="h-8 w-8 text-primary" />
              {currentRole.name} Dashboard
            </h1>
            <p className="text-muted-foreground">
              Personalized view for your role and priorities
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as keyof typeof roles)}>
              <SelectTrigger className="w-[200px]" data-testid="select-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(roles).map(([key, role]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <role.icon className="h-4 w-4" />
                      {role.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" data-testid="button-customize">
              <Settings className="h-4 w-4 mr-2" />
              Customize
            </Button>
          </div>
        </div>

        {/* Role Focus Areas */}
        <div className="flex gap-2 flex-wrap">
          {currentRole.focus.map((area, idx) => (
            <Badge key={idx} variant="outline" className="px-3 py-1">
              {area}
            </Badge>
          ))}
        </div>

        {/* Key Metrics Bar */}
        <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
          {currentRole.metrics.map((metric, idx) => (
            <div key={idx} className="flex-1 text-center">
              <p className="text-sm text-muted-foreground">{metric}</p>
              <p className="text-xl font-semibold">
                {Math.floor(Math.random() * 100) + 50}
                {idx === 0 || idx === 1 ? "" : "%"}
              </p>
            </div>
          ))}
        </div>

        {/* Role-Specific Content */}
        {selectedRole === "sdr" && renderSDRView()}
        {selectedRole === "ae" && renderAEView()}
        {selectedRole === "manager" && renderManagerView()}
        {selectedRole === "executive" && renderExecutiveView()}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" data-testid="button-refresh">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Data
              </Button>
              <Button variant="outline" size="sm" data-testid="button-export">
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
              <Button variant="outline" size="sm" data-testid="button-filter">
                <Filter className="h-4 w-4 mr-2" />
                Filter View
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}