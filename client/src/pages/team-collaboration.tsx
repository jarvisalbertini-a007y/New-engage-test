import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, MessageSquare, Hash, AtSign, Bell, Video,
  FileText, Calendar, CheckCircle, Clock, AlertCircle,
  MoreVertical, Send, Plus, Search, Filter, Share2,
  UserPlus, Settings, Activity, TrendingUp, Target,
  Briefcase, ChevronRight, Star, Pin, Archive,
  Edit, Trash2, Eye, Download, Upload, Link2
} from "lucide-react";

// Team members
const teamMembers = [
  { id: 1, name: "Sarah Chen", role: "Sales Manager", avatar: "SC", status: "online", activeNow: true },
  { id: 2, name: "Mike Johnson", role: "Senior AE", avatar: "MJ", status: "online", activeNow: false },
  { id: 3, name: "Emma Wilson", role: "SDR Lead", avatar: "EW", status: "away", activeNow: false },
  { id: 4, name: "David Park", role: "Account Executive", avatar: "DP", status: "online", activeNow: true },
  { id: 5, name: "Lisa Thompson", role: "Sales Development Rep", avatar: "LT", status: "offline", activeNow: false }
];

// Shared workspaces
const workspaces = [
  {
    id: 1,
    name: "Q4 Enterprise Deals",
    description: "Collaborate on closing major enterprise accounts",
    members: 5,
    lastActivity: "2 hours ago",
    type: "deals",
    pinned: true,
    unread: 3
  },
  {
    id: 2,
    name: "Product Launch Campaign",
    description: "Coordinate outreach for new product release",
    members: 8,
    lastActivity: "30 mins ago",
    type: "campaign",
    pinned: true,
    unread: 12
  },
  {
    id: 3,
    name: "West Coast Territory",
    description: "Territory planning and account mapping",
    members: 3,
    lastActivity: "1 day ago",
    type: "territory",
    pinned: false,
    unread: 0
  },
  {
    id: 4,
    name: "Competitive Intel",
    description: "Share competitive insights and battle cards",
    members: 12,
    lastActivity: "5 hours ago",
    type: "intelligence",
    pinned: false,
    unread: 5
  }
];

// Activity feed
const activityFeed = [
  {
    id: 1,
    user: "Sarah Chen",
    action: "shared a deal",
    target: "TechCorp - $250K",
    time: "5 mins ago",
    type: "deal",
    details: "Needs help with security questionnaire"
  },
  {
    id: 2,
    user: "Mike Johnson",
    action: "commented on",
    target: "Enterprise Pitch Deck",
    time: "15 mins ago",
    type: "comment",
    details: "Added pricing slides for tier 1 accounts"
  },
  {
    id: 3,
    user: "Emma Wilson",
    action: "mentioned you in",
    target: "Q4 Strategy Discussion",
    time: "30 mins ago",
    type: "mention",
    details: "@you thoughts on the new lead scoring model?"
  },
  {
    id: 4,
    user: "David Park",
    action: "completed task",
    target: "Follow up with Global Inc",
    time: "1 hour ago",
    type: "task",
    details: "Meeting scheduled for next Tuesday"
  },
  {
    id: 5,
    user: "Lisa Thompson",
    action: "requested help with",
    target: "DataFlow Inc negotiation",
    time: "2 hours ago",
    type: "help",
    details: "Customer asking for 40% discount"
  }
];

// Shared deals
const sharedDeals = [
  {
    id: 1,
    company: "TechCorp",
    value: 250000,
    stage: "Negotiation",
    owner: "Sarah Chen",
    sharedWith: ["Mike Johnson", "Emma Wilson"],
    needsHelp: true,
    helpType: "Technical",
    daysInStage: 5
  },
  {
    id: 2,
    company: "Global Systems",
    value: 180000,
    stage: "Proposal",
    owner: "Mike Johnson",
    sharedWith: ["Sarah Chen"],
    needsHelp: false,
    daysInStage: 3
  },
  {
    id: 3,
    company: "DataFlow Inc",
    value: 95000,
    stage: "Discovery",
    owner: "David Park",
    sharedWith: ["Emma Wilson", "Lisa Thompson"],
    needsHelp: true,
    helpType: "Pricing",
    daysInStage: 8
  }
];

// Team goals
const teamGoals = [
  {
    name: "Q4 Revenue Target",
    target: 2500000,
    current: 1850000,
    deadline: "Dec 31",
    owners: ["Sarah Chen", "Mike Johnson"],
    status: "on-track"
  },
  {
    name: "New Logo Acquisition",
    target: 25,
    current: 18,
    deadline: "Dec 31",
    owners: ["Emma Wilson"],
    status: "at-risk"
  },
  {
    name: "Pipeline Coverage",
    target: 3.5,
    current: 2.8,
    deadline: "Nov 30",
    owners: ["David Park"],
    status: "behind"
  }
];

// Discussion threads
const discussions = [
  {
    id: 1,
    title: "Best approach for enterprise security requirements?",
    author: "Sarah Chen",
    time: "2 hours ago",
    replies: 8,
    views: 24,
    tags: ["enterprise", "security", "sales-process"],
    pinned: true
  },
  {
    id: 2,
    title: "New competitor pricing intel - Important!",
    author: "Mike Johnson",
    time: "5 hours ago",
    replies: 12,
    views: 45,
    tags: ["competitive", "pricing", "urgent"],
    pinned: true
  },
  {
    id: 3,
    title: "Success story: How I closed MegaCorp deal",
    author: "Emma Wilson",
    time: "1 day ago",
    replies: 15,
    views: 67,
    tags: ["win-story", "best-practices"],
    pinned: false
  }
];

export function TeamCollaborationPage() {
  const [activeWorkspace, setActiveWorkspace] = useState(workspaces[0]);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("activity");

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getActivityIcon = (type: string) => {
    switch(type) {
      case 'deal': return Briefcase;
      case 'comment': return MessageSquare;
      case 'mention': return AtSign;
      case 'task': return CheckCircle;
      case 'help': return AlertCircle;
      default: return Activity;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl mb-2 flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              Team Collaboration
            </h1>
            <p className="text-muted-foreground">
              Work together, win together - Real-time collaboration for sales teams
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" data-testid="button-invite">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Team
            </Button>
            <Button variant="outline" data-testid="button-video">
              <Video className="h-4 w-4 mr-2" />
              Start Huddle
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          {/* Workspaces Sidebar */}
          <div className="md:col-span-1 space-y-4">
            {/* Team Members Online */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Team Members</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{member.avatar}</AvatarFallback>
                      </Avatar>
                      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${getStatusColor(member.status)}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.role}</p>
                    </div>
                    {member.activeNow && (
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Workspaces */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Workspaces</CardTitle>
                  <Button size="sm" variant="ghost" data-testid="button-add-workspace">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => setActiveWorkspace(workspace)}
                    className={`w-full text-left p-2 rounded-lg transition-colors ${
                      activeWorkspace.id === workspace.id 
                        ? 'bg-primary/10 border border-primary/20' 
                        : 'hover:bg-muted/50'
                    }`}
                    data-testid={`workspace-${workspace.id}`}
                  >
                    <div className="flex items-start gap-2">
                      <Hash className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{workspace.name}</p>
                          {workspace.pinned && <Pin className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{workspace.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{workspace.members} members</span>
                          {workspace.unread > 0 && (
                            <Badge variant="destructive" className="h-4 px-1 text-xs">
                              {workspace.unread}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="md:col-span-3 space-y-4">
            {/* Workspace Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Hash className="h-5 w-5" />
                      {activeWorkspace.name}
                    </CardTitle>
                    <CardDescription>{activeWorkspace.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" data-testid="button-workspace-settings">
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" data-testid="button-share">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Tabs */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="activity">Activity Feed</TabsTrigger>
                <TabsTrigger value="deals">Shared Deals</TabsTrigger>
                <TabsTrigger value="discussions">Discussions</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
                <TabsTrigger value="goals">Team Goals</TabsTrigger>
              </TabsList>

              {/* Activity Feed */}
              <TabsContent value="activity" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {activityFeed.map((activity) => {
                      const Icon = getActivityIcon(activity.type);
                      return (
                        <div key={activity.id} className="flex gap-3 p-3 rounded-lg hover:bg-muted/30">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            activity.type === 'mention' ? 'bg-primary/10 text-primary' :
                            activity.type === 'help' ? 'bg-red-500/10 text-red-500' :
                            'bg-muted'
                          }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm">
                              <span className="font-medium">{activity.user}</span>{" "}
                              <span className="text-muted-foreground">{activity.action}</span>{" "}
                              <span className="font-medium">{activity.target}</span>
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">{activity.details}</p>
                            <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                          </div>
                          {activity.type === 'help' && (
                            <Button size="sm" variant="outline" data-testid={`help-${activity.id}`}>
                              Offer Help
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Message Input */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Share an update, ask for help, or mention @teammate..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="min-h-[80px]"
                        data-testid="input-message"
                      />
                      <div className="flex flex-col gap-2">
                        <Button disabled={!message.trim()} data-testid="button-post">
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" data-testid="button-attach">
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Shared Deals */}
              <TabsContent value="deals" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Collaborative Deals</CardTitle>
                      <Button size="sm" data-testid="button-share-deal">
                        <Plus className="h-4 w-4 mr-2" />
                        Share Deal
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {sharedDeals.map((deal) => (
                      <div key={deal.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{deal.company}</h4>
                              {deal.needsHelp && (
                                <Badge variant="destructive">Needs Help</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              ${(deal.value / 1000).toFixed(0)}k • {deal.stage} • {deal.daysInStage} days
                            </p>
                          </div>
                          <Button size="sm" variant="outline" data-testid={`view-deal-${deal.id}`}>
                            View Details
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback>{deal.owner.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm">Owner: {deal.owner}</span>
                          </div>
                          <div className="flex -space-x-2">
                            {deal.sharedWith.map((person, idx) => (
                              <Avatar key={idx} className="h-6 w-6 border-2 border-background">
                                <AvatarFallback className="text-xs">
                                  {person.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            <span className="text-xs text-muted-foreground ml-3">
                              +{deal.sharedWith.length} collaborating
                            </span>
                          </div>
                        </div>
                        
                        {deal.needsHelp && (
                          <div className="flex items-center gap-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span className="text-sm">Help needed with: {deal.helpType}</span>
                            <Button size="sm" variant="link" className="ml-auto" data-testid={`offer-help-${deal.id}`}>
                              Offer Assistance →
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Discussions */}
              <TabsContent value="discussions" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Team Discussions</CardTitle>
                      <Button size="sm" data-testid="button-new-discussion">
                        <Plus className="h-4 w-4 mr-2" />
                        New Discussion
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {discussions.map((discussion) => (
                      <div key={discussion.id} className="border rounded-lg p-4 hover:bg-muted/30 cursor-pointer">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {discussion.pinned && <Pin className="h-4 w-4 text-primary" />}
                              <h4 className="font-medium">{discussion.title}</h4>
                            </div>
                            <div className="flex flex-wrap gap-1 mb-2">
                              {discussion.tags.map((tag, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>by {discussion.author}</span>
                              <span>{discussion.time}</span>
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {discussion.replies}
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {discussion.views}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Files */}
              <TabsContent value="files" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Shared Files</CardTitle>
                      <Button size="sm" data-testid="button-upload">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2">
                      {[
                        { name: "Q4 Sales Playbook.pdf", size: "2.4 MB", shared: "Sarah Chen", time: "2 hours ago" },
                        { name: "Enterprise Pricing.xlsx", size: "856 KB", shared: "Mike Johnson", time: "1 day ago" },
                        { name: "Product Demo Script.docx", size: "124 KB", shared: "Emma Wilson", time: "3 days ago" },
                        { name: "Competitive Analysis.pptx", size: "5.2 MB", shared: "David Park", time: "1 week ago" }
                      ].map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {file.size} • Shared by {file.shared} • {file.time}
                              </p>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" data-testid={`download-${idx}`}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Team Goals */}
              <TabsContent value="goals" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Shared Team Goals</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {teamGoals.map((goal, idx) => (
                      <div key={idx} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{goal.name}</h4>
                            <p className="text-sm text-muted-foreground">Due: {goal.deadline}</p>
                          </div>
                          <Badge variant={
                            goal.status === 'on-track' ? 'default' :
                            goal.status === 'at-risk' ? 'secondary' :
                            'destructive'
                          }>
                            {goal.status.replace('-', ' ')}
                          </Badge>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Progress</span>
                            <span>
                              {typeof goal.target === 'number' && goal.target > 10 
                                ? `$${(goal.current / 1000).toFixed(0)}k / $${(goal.target / 1000).toFixed(0)}k`
                                : `${goal.current} / ${goal.target}`
                              }
                            </span>
                          </div>
                          <Progress 
                            value={(goal.current / goal.target) * 100} 
                            className="h-2"
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex -space-x-2">
                            {goal.owners.map((owner, ownerIdx) => (
                              <Avatar key={ownerIdx} className="h-6 w-6 border-2 border-background">
                                <AvatarFallback className="text-xs">
                                  {owner.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            <span className="text-xs text-muted-foreground ml-3">
                              {goal.owners.join(', ')}
                            </span>
                          </div>
                          <Button size="sm" variant="outline" data-testid={`view-goal-${idx}`}>
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}