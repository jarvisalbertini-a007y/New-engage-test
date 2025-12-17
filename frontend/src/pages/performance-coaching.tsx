import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Award, TrendingUp, Target, Users, Brain, Calendar,
  BarChart, Activity, AlertCircle, CheckCircle, Clock,
  MessageSquare, Video, BookOpen, Trophy, Star, Zap,
  ChevronRight, ArrowUp, ArrowDown, Play, User,
  Lightbulb, Shield, Heart, Sparkles, GraduationCap, Phone
} from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

// Performance metrics
const performanceData = {
  overall: {
    score: 78,
    trend: "+5%",
    rank: "12 of 50",
    grade: "B+",
    improvement: "+12 points from last month"
  },
  skills: [
    { skill: "Prospecting", score: 85, benchmark: 75 },
    { skill: "Discovery", score: 72, benchmark: 80 },
    { skill: "Presentation", score: 88, benchmark: 85 },
    { skill: "Negotiation", score: 65, benchmark: 70 },
    { skill: "Closing", score: 70, benchmark: 75 },
    { skill: "Follow-up", score: 82, benchmark: 80 }
  ],
  metrics: {
    calls: { current: 187, target: 200, trend: "up" },
    emails: { current: 450, target: 400, trend: "up" },
    meetings: { current: 12, target: 15, trend: "down" },
    deals: { current: 8, target: 10, trend: "stable" },
    revenue: { current: 125000, target: 150000, trend: "up" },
    winRate: { current: 28, target: 35, trend: "down" }
  },
  weeklyProgress: [
    { week: "W1", score: 72, activities: 95 },
    { week: "W2", score: 75, activities: 110 },
    { week: "W3", score: 71, activities: 88 },
    { week: "W4", score: 78, activities: 125 },
    { week: "W5", score: 78, activities: 115 }
  ]
};

// Coaching recommendations
const coachingRecommendations = [
  {
    id: 1,
    priority: "high",
    category: "Skill Development",
    title: "Improve Negotiation Skills",
    description: "Your negotiation scores are 5 points below benchmark. This is impacting your closing rate.",
    impact: "Could increase win rate by 8-12%",
    actions: [
      "Watch 'Advanced Negotiation Tactics' training video",
      "Role-play negotiation scenarios with manager",
      "Review top performer negotiation recordings"
    ],
    timeEstimate: "2-3 hours/week",
    resources: ["Training Videos", "Call Library", "1:1 Coaching"]
  },
  {
    id: 2,
    priority: "medium",
    category: "Activity Optimization",
    title: "Increase Meeting Conversion Rate",
    description: "You're booking fewer meetings than target despite high call volume.",
    impact: "Could add 3-5 more meetings per week",
    actions: [
      "Refine your cold call opening pitch",
      "A/B test different meeting request approaches",
      "Focus calls on warmer leads (score 70+)"
    ],
    timeEstimate: "1 hour/week",
    resources: ["Call Scripts", "Lead Scoring Tool", "Best Practices"]
  },
  {
    id: 3,
    priority: "medium",
    category: "Process Improvement",
    title: "Optimize Discovery Process",
    description: "Discovery scores indicate missed qualification opportunities.",
    impact: "Better qualification could save 5+ hours/week",
    actions: [
      "Use BANT framework more consistently",
      "Document pain points more thoroughly",
      "Ask more probing questions about budget"
    ],
    timeEstimate: "30 min per call",
    resources: ["Discovery Templates", "BANT Guide", "Example Calls"]
  },
  {
    id: 4,
    priority: "low",
    category: "Time Management",
    title: "Batch Similar Activities",
    description: "Your activity patterns show frequent context switching.",
    impact: "Could save 1-2 hours daily",
    actions: [
      "Block time for calls (9-11 AM)",
      "Batch email responses (2-3 PM)",
      "Schedule admin tasks for end of day"
    ],
    timeEstimate: "15 min planning/day",
    resources: ["Calendar Blocking Guide", "Productivity Tips"]
  }
];

// Learning resources
const learningResources = [
  {
    type: "video",
    title: "Mastering Cold Calls",
    duration: "45 min",
    instructor: "Sarah Chen",
    rating: 4.8,
    completions: 234,
    topics: ["Opening", "Objection Handling", "Meeting Booking"]
  },
  {
    type: "article",
    title: "The Psychology of Closing",
    duration: "15 min read",
    author: "Mike Johnson",
    rating: 4.6,
    views: 1420,
    topics: ["Closing Techniques", "Buyer Psychology", "Timing"]
  },
  {
    type: "course",
    title: "Enterprise Sales Mastery",
    duration: "6 hours",
    instructor: "David Park",
    rating: 4.9,
    enrolled: 89,
    topics: ["Enterprise Process", "Stakeholder Mapping", "Complex Deals"]
  },
  {
    type: "webinar",
    title: "Q4 Sales Strategy",
    duration: "Live - Thursday 2 PM",
    instructor: "Lisa Williams",
    rating: "New",
    registered: 45,
    topics: ["Q4 Planning", "Year-end Tactics", "Forecasting"]
  }
];

// Coaching sessions
const coachingSessions = [
  {
    type: "1:1 Coaching",
    coach: "Mark Thompson",
    date: "Tomorrow, 10:00 AM",
    topic: "Deal Review - TechCorp",
    status: "scheduled"
  },
  {
    type: "Team Workshop",
    coach: "Sarah Chen",
    date: "Friday, 2:00 PM",
    topic: "Advanced Objection Handling",
    status: "scheduled"
  },
  {
    type: "Peer Review",
    coach: "Emma Wilson",
    date: "Next Monday, 11:00 AM",
    topic: "Call Recording Analysis",
    status: "pending"
  }
];

// Achievement badges
const achievements = [
  { name: "Call Champion", description: "200+ calls in a week", earned: true, icon: Phone },
  { name: "Email Master", description: "50%+ email response rate", earned: true, icon: MessageSquare },
  { name: "Meeting Machine", description: "15+ meetings booked", earned: false, icon: Calendar },
  { name: "Closing Expert", description: "5+ deals closed in month", earned: false, icon: Trophy },
  { name: "Pipeline Builder", description: "$500k+ in pipeline", earned: true, icon: TrendingUp }
];

export function PerformanceCoachingPage() {
  const [selectedRep, setSelectedRep] = useState("self");
  const [timeframe, setTimeframe] = useState("month");
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  const getSkillColor = (score: number, benchmark: number) => {
    if (score >= benchmark + 5) return "text-green-500";
    if (score >= benchmark) return "text-blue-500";
    if (score >= benchmark - 5) return "text-yellow-500";
    return "text-red-500";
  };

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl mb-2 flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" />
              Performance Coaching
            </h1>
            <p className="text-muted-foreground">
              AI-powered coaching recommendations to improve your sales performance
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedRep} onValueChange={setSelectedRep}>
              <SelectTrigger className="w-[180px]" data-testid="select-rep">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="self">My Performance</SelectItem>
                <SelectItem value="team">Team Overview</SelectItem>
                <SelectItem value="sarah">Sarah Chen</SelectItem>
                <SelectItem value="mike">Mike Johnson</SelectItem>
                <SelectItem value="emma">Emma Wilson</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-[120px]" data-testid="select-timeframe">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Performance Overview */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span className="text-xs text-green-500">{performanceData.overall.trend}</span>
              </div>
              <p className="text-2xl font-bold mt-2">{performanceData.overall.score}</p>
              <p className="text-xs text-muted-foreground">Performance Score</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Award className="h-5 w-5 text-primary" />
                <Badge variant="outline">{performanceData.overall.grade}</Badge>
              </div>
              <p className="text-2xl font-bold mt-2">{performanceData.overall.rank}</p>
              <p className="text-xs text-muted-foreground">Team Ranking</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Target className="h-5 w-5 text-blue-500" />
                <ArrowUp className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold mt-2">{performanceData.metrics.winRate.current}%</p>
              <p className="text-xs text-muted-foreground">Win Rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Activity className="h-5 w-5 text-purple-500" />
                <span className="text-xs">{performanceData.metrics.meetings.trend}</span>
              </div>
              <p className="text-2xl font-bold mt-2">{performanceData.metrics.meetings.current}</p>
              <p className="text-xs text-muted-foreground">Meetings Booked</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className="text-xs text-green-500">+18%</span>
              </div>
              <p className="text-2xl font-bold mt-2">${(performanceData.metrics.revenue.current / 1000).toFixed(0)}k</p>
              <p className="text-xs text-muted-foreground">Revenue</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="coaching" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="coaching">AI Coaching</TabsTrigger>
            <TabsTrigger value="skills">Skills Analysis</TabsTrigger>
            <TabsTrigger value="trends">Performance Trends</TabsTrigger>
            <TabsTrigger value="learning">Learning Hub</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
          </TabsList>

          {/* AI Coaching Tab */}
          <TabsContent value="coaching" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Personalized Coaching Recommendations
                </CardTitle>
                <CardDescription>
                  AI-generated insights based on your performance data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {coachingRecommendations.map((rec) => (
                  <div key={rec.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 ${
                          rec.priority === 'high' ? 'bg-red-500' :
                          rec.priority === 'medium' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{rec.title}</h3>
                            <Badge variant={getPriorityColor(rec.priority)}>
                              {rec.priority} priority
                            </Badge>
                            <Badge variant="outline">{rec.category}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{rec.description}</p>
                          <p className="text-sm font-medium text-primary mt-2">{rec.impact}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" data-testid={`start-coaching-${rec.id}`}>
                        Start
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                    
                    <div className="pl-5">
                      <p className="text-sm font-medium mb-2">Action Items:</p>
                      <ul className="space-y-1">
                        {rec.actions.map((action, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-muted-foreground" />
                            {action}
                          </li>
                        ))}
                      </ul>
                      
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {rec.timeEstimate}
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {rec.resources.join(", ")}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Upcoming Coaching Sessions */}
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Coaching Sessions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {coachingSessions.map((session, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {session.type.includes('1:1') ? <User className="h-5 w-5" /> :
                         session.type.includes('Team') ? <Users className="h-5 w-5" /> :
                         <Users className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-medium">{session.type}: {session.topic}</p>
                        <p className="text-sm text-muted-foreground">
                          with {session.coach} • {session.date}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={session.status === 'scheduled' ? 'default' : 'secondary'}>
                        {session.status}
                      </Badge>
                      <Button size="sm" variant="outline" data-testid={`join-session-${idx}`}>
                        {session.status === 'scheduled' ? 'Join' : 'Confirm'}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Skills Analysis Tab */}
          <TabsContent value="skills" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Skills Radar</CardTitle>
                  <CardDescription>Your skills vs team benchmark</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={performanceData.skills}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="skill" />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
                      <Radar name="You" dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                      <Radar name="Benchmark" dataKey="benchmark" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Skills Breakdown</CardTitle>
                  <CardDescription>Detailed skill assessment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {performanceData.skills.map((skill) => (
                    <div key={skill.skill} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{skill.skill}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${getSkillColor(skill.score, skill.benchmark)}`}>
                            {skill.score}
                          </span>
                          <span className="text-xs text-muted-foreground">/ {skill.benchmark}</span>
                        </div>
                      </div>
                      <div className="relative">
                        <Progress value={skill.score} className="h-2" />
                        <div 
                          className="absolute top-0 h-2 w-0.5 bg-muted-foreground"
                          style={{ left: `${skill.benchmark}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Skill Development Plan */}
            <Card>
              <CardHeader>
                <CardTitle>Skill Development Plan</CardTitle>
                <CardDescription>Focus areas for improvement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <span className="font-medium text-sm">Immediate Focus</span>
                    </div>
                    <p className="font-semibold">Negotiation & Closing</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      10+ points below benchmark. Schedule training this week.
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium text-sm">Next Priority</span>
                    </div>
                    <p className="font-semibold">Discovery Skills</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Slightly below target. Review best practices.
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-sm">Strength Area</span>
                    </div>
                    <p className="font-semibold">Presentation Skills</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Above benchmark. Share knowledge with team.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Trends Tab */}
          <TabsContent value="trends" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceData.weeklyProgress}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={2} name="Performance Score" />
                    <Line yAxisId="right" type="monotone" dataKey="activities" stroke="#10b981" strokeWidth={2} name="Activities" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Activity Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(performanceData.metrics).slice(0, 4).map(([key, data]) => (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="capitalize text-sm">{key}</span>
                          {data.trend === 'up' ? <ArrowUp className="h-3 w-3 text-green-500" /> :
                           data.trend === 'down' ? <ArrowDown className="h-3 w-3 text-red-500" /> :
                           <Activity className="h-3 w-3 text-yellow-500" />}
                        </div>
                        <div className="text-right">
                          <span className="font-semibold">{data.current}</span>
                          <span className="text-sm text-muted-foreground"> / {data.target}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium">Best performing day: Tuesday</p>
                      <p className="text-xs text-muted-foreground">52 calls, 6 meetings booked</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium">Improvement trend detected</p>
                      <p className="text-xs text-muted-foreground">+5% performance over 4 weeks</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Target className="h-4 w-4 text-blue-500 mt-1" />
                    <div>
                      <p className="text-sm font-medium">Close to meeting target</p>
                      <p className="text-xs text-muted-foreground">3 more meetings needed this week</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Learning Hub Tab */}
          <TabsContent value="learning" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Recommended Learning Resources
                </CardTitle>
                <CardDescription>Curated content based on your skill gaps</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {learningResources.map((resource, idx) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            resource.type === 'video' ? 'bg-red-500/10 text-red-500' :
                            resource.type === 'article' ? 'bg-blue-500/10 text-blue-500' :
                            resource.type === 'course' ? 'bg-purple-500/10 text-purple-500' :
                            'bg-green-500/10 text-green-500'
                          }`}>
                            {resource.type === 'video' ? <Play className="h-5 w-5" /> :
                             resource.type === 'article' ? <BookOpen className="h-5 w-5" /> :
                             resource.type === 'course' ? <GraduationCap className="h-5 w-5" /> :
                             <Video className="h-5 w-5" />}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium">{resource.title}</h4>
                            <p className="text-sm text-muted-foreground">{resource.duration}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {resource.rating !== 'New' && (
                                <div className="flex items-center gap-1">
                                  <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                  <span className="text-xs">{resource.rating}</span>
                                </div>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {resource.type === 'video' && `${resource.completions} completed`}
                                {resource.type === 'article' && `${resource.views} views`}
                                {resource.type === 'course' && `${resource.enrolled} enrolled`}
                                {resource.type === 'webinar' && `${resource.registered} registered`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1">
                        {resource.topics.map((topic, topicIdx) => (
                          <Badge key={topicIdx} variant="secondary" className="text-xs">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                      
                      <Button size="sm" className="w-full" variant="outline" data-testid={`resource-${idx}`}>
                        {resource.type === 'webinar' ? 'Register' : 'Start Learning'}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Achievements</CardTitle>
                <CardDescription>Badges and milestones earned</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-5">
                  {achievements.map((achievement, idx) => (
                    <div 
                      key={idx} 
                      className={`text-center p-4 rounded-lg border ${
                        achievement.earned 
                          ? 'bg-primary/5 border-primary/20' 
                          : 'bg-muted/30 border-muted opacity-50'
                      }`}
                    >
                      <div className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center ${
                        achievement.earned 
                          ? 'bg-primary/10 text-primary' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <achievement.icon className="h-8 w-8" />
                      </div>
                      <p className="font-medium text-sm">{achievement.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{achievement.description}</p>
                      {achievement.earned && (
                        <Badge variant="default" className="mt-2">Earned</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Leaderboard */}
            <Card>
              <CardHeader>
                <CardTitle>Team Leaderboard</CardTitle>
                <CardDescription>See how you rank against peers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { rank: 1, name: "Emma Wilson", score: 92, change: "up" },
                    { rank: 2, name: "David Park", score: 88, change: "up" },
                    { rank: 3, name: "Sarah Chen", score: 85, change: "stable" },
                    { rank: 4, name: "You", score: 78, change: "up", highlight: true },
                    { rank: 5, name: "Mike Johnson", score: 75, change: "down" }
                  ].map((member) => (
                    <div 
                      key={member.rank}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        member.highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          member.rank <= 3 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-muted'
                        }`}>
                          {member.rank}
                        </div>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{member.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{member.score}</span>
                        {member.change === 'up' && <ArrowUp className="h-4 w-4 text-green-500" />}
                        {member.change === 'down' && <ArrowDown className="h-4 w-4 text-red-500" />}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}