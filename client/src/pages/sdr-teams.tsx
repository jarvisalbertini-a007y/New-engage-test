import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, Brain, TrendingUp, Target, MessageSquare, Calendar, ChevronRight, Plus, Bot, Activity, Award, Zap, UserCheck, Search, BarChart3, Users2, ArrowRight, Sparkles, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// AI Persona configurations
const AI_PERSONAS = {
  researcher: {
    name: "The Researcher",
    icon: Search,
    color: "bg-blue-500",
    description: "Gathers comprehensive intel",
    skills: ["Market research", "Lead enrichment", "Competitive analysis"]
  },
  writer: {
    name: "The Writer",
    icon: MessageSquare,
    color: "bg-purple-500",
    description: "Crafts compelling messages",
    skills: ["Copywriting", "Personalization", "Storytelling"]
  },
  qualifier: {
    name: "The Qualifier",
    icon: UserCheck,
    color: "bg-green-500",
    description: "Assesses lead quality",
    skills: ["Lead scoring", "BANT qualification", "Intent analysis"]
  },
  scheduler: {
    name: "The Scheduler",
    icon: Calendar,
    color: "bg-orange-500",
    description: "Manages calendars and bookings",
    skills: ["Calendar management", "Follow-up timing", "Availability optimization"]
  },
  manager: {
    name: "The Manager",
    icon: BarChart3,
    color: "bg-red-500",
    description: "Oversees and optimizes",
    skills: ["Performance analysis", "Strategy optimization", "Resource allocation"]
  }
};

export default function SDRTeamsPage() {
  const { toast } = useToast();
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTeam, setNewTeam] = useState({
    name: "",
    description: "",
    teamType: "hybrid" as "hunter" | "farmer" | "hybrid",
    roles: [] as string[]
  });

  // Fetch teams
  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["/api/sdr-teams"],
  });

  // Fetch selected team details
  const { data: teamDetails, isLoading: detailsLoading } = useQuery({
    queryKey: [`/api/sdr-teams/${selectedTeam}`],
    enabled: !!selectedTeam,
  });

  // Fetch performance for selected team
  const { data: performance } = useQuery({
    queryKey: [`/api/sdr-teams/${selectedTeam}/performance`],
    enabled: !!selectedTeam,
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async (teamData: typeof newTeam) => {
      return await apiRequest("/api/sdr-teams", {
        method: "POST",
        body: JSON.stringify(teamData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sdr-teams"] });
      setIsCreateDialogOpen(false);
      setNewTeam({ name: "", description: "", teamType: "hybrid", roles: [] });
      toast({
        title: "Team created successfully",
        description: "Your new SDR team is ready to collaborate",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to create team",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Assign deal mutation
  const assignDealMutation = useMutation({
    mutationFn: async ({ teamId, dealData }: any) => {
      return await apiRequest(`/api/sdr-teams/${teamId}/assign`, {
        method: "POST",
        body: JSON.stringify(dealData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sdr-teams/${selectedTeam}`] });
      toast({
        title: "Deal assigned",
        description: "The team has started working on the deal",
      });
    },
  });

  // Trigger collaboration mutation
  const collaborateMutation = useMutation({
    mutationFn: async ({ teamId, task }: any) => {
      return await apiRequest(`/api/sdr-teams/${teamId}/collaborate`, {
        method: "POST",
        body: JSON.stringify(task),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/sdr-teams/${selectedTeam}`] });
      toast({
        title: "Collaboration complete",
        description: "Team members have completed the task",
      });
    },
  });

  // Optimize team mutation
  const optimizeMutation = useMutation({
    mutationFn: async (teamId: string) => {
      return await apiRequest(`/api/sdr-teams/${teamId}/optimize`, {
        method: "PUT",
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Optimization analysis complete",
        description: data.expectedImprovement,
      });
    },
  });

  const handleRoleToggle = (role: string) => {
    setNewTeam(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role]
    }));
  };

  const handleCreateTeam = () => {
    if (!newTeam.name || newTeam.roles.length === 0) {
      toast({
        title: "Invalid team configuration",
        description: "Please provide a team name and select at least one role",
        variant: "destructive",
      });
      return;
    }
    createTeamMutation.mutate(newTeam);
  };

  const renderTeamCard = (team: any) => (
    <Card 
      key={team.id}
      className="cursor-pointer hover:shadow-lg transition-all-soft"
      onClick={() => setSelectedTeam(team.id)}
      data-testid={`card-team-${team.id}`}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500">
              <Users2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">{team.name}</CardTitle>
              <CardDescription className="text-xs">{team.description}</CardDescription>
            </div>
          </div>
          <Badge variant={team.teamType === "hunter" ? "default" : team.teamType === "farmer" ? "secondary" : "outline"}>
            {team.teamType}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              {team.memberRoles?.length || 0} AI Members
            </span>
          </div>
          
          {team.metrics && (
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                <div className="text-xs text-gray-500">Conversion</div>
                <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                  {team.metrics.conversionRate || 0}%
                </div>
              </div>
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <div className="text-xs text-gray-500">Active Deals</div>
                <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {team.metrics.totalDeals || 0}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1">
            {team.memberRoles?.map((role: string) => (
              <Badge key={role} variant="outline" className="text-xs">
                {role}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderTeamDetails = () => {
    if (!teamDetails) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{teamDetails.team.name}</h2>
            <p className="text-gray-500">{teamDetails.team.description}</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => optimizeMutation.mutate(selectedTeam!)}
              variant="outline"
              data-testid="button-optimize-team"
            >
              <Zap className="h-4 w-4 mr-2" />
              Optimize Team
            </Button>
            <Button
              onClick={() => {
                collaborateMutation.mutate({
                  teamId: selectedTeam,
                  task: {
                    type: "research",
                    context: { company: "Example Corp", contact: "John Doe" }
                  }
                });
              }}
              data-testid="button-trigger-collaboration"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Trigger Collaboration
            </Button>
          </div>
        </div>

        <Tabs defaultValue="members" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="members">Team Members</TabsTrigger>
            <TabsTrigger value="collaborations">Collaborations</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {teamDetails.members?.map((member: any) => {
                const persona = AI_PERSONAS[member.role as keyof typeof AI_PERSONAS];
                const Icon = persona?.icon || Bot;
                
                return (
                  <Card key={member.id} data-testid={`card-member-${member.id}`}>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className={persona?.color}>
                            <Icon className="h-5 w-5 text-white" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base">{persona?.name}</CardTitle>
                          <CardDescription>{persona?.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">Current Load</span>
                          <Badge variant="outline">{member.currentLoad || 0} tasks</Badge>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-gray-500">Skills</span>
                          <div className="flex flex-wrap gap-1">
                            {member.skills?.map((skill: string) => (
                              <Badge key={skill} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {member.isActive ? (
                          <Badge className="w-full justify-center" variant="outline">
                            <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="w-full justify-center" variant="outline">
                            <AlertCircle className="h-3 w-3 mr-1 text-gray-400" />
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="collaborations" className="space-y-4">
            <ScrollArea className="h-[400px] rounded-lg border p-4">
              <div className="space-y-4">
                {teamDetails.recentCollaborations?.map((collab: any) => (
                  <div key={collab.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                      <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{collab.collaborationType}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(collab.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Participants: {collab.participantRoles?.join(", ")}
                      </div>
                      {collab.outcome && (
                        <Badge variant={collab.outcome === "success" ? "default" : "secondary"} className="mt-2">
                          {collab.outcome}
                        </Badge>
                      )}
                      {collab.decisions && Array.isArray(collab.decisions) && (
                        <div className="mt-2 space-y-1">
                          {collab.decisions.map((decision: any, idx: number) => (
                            <div key={idx} className="text-xs flex items-center gap-2">
                              <ArrowRight className="h-3 w-3 text-gray-400" />
                              <span className="font-medium">{decision.role}:</span>
                              <span className="text-gray-600">{decision.action}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            {performance && (
              <div className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Wins</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">{performance.wins}</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Losses</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">{performance.losses}</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Conversion Rate</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{performance.conversionRate}%</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Avg Deal Size</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${performance.avgDealSize}</div>
                    </CardContent>
                  </Card>
                </div>

                {performance.metrics && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Performance Metrics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm">Total Collaborations</span>
                          <span className="font-medium">{performance.metrics.totalCollaborations}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Successful Collaborations</span>
                          <span className="font-medium">{performance.metrics.successfulCollaborations}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Average Response Time</span>
                          <span className="font-medium">{performance.metrics.averageResponseTime}</span>
                        </div>
                        {performance.metrics.topPerformer && (
                          <div className="flex justify-between">
                            <span className="text-sm">Top Performer</span>
                            <Badge>{performance.metrics.topPerformer}</Badge>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="workflow" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Team Collaboration Workflow</CardTitle>
                <CardDescription>How AI personas work together on deals</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                      <Search className="h-4 w-4 text-blue-600" />
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">Research Phase</div>
                      <div className="text-xs text-gray-500">Researcher gathers intel on company and contacts</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                      <MessageSquare className="h-4 w-4 text-purple-600" />
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">Content Creation</div>
                      <div className="text-xs text-gray-500">Writer crafts personalized messages</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                      <UserCheck className="h-4 w-4 text-green-600" />
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">Qualification</div>
                      <div className="text-xs text-gray-500">Qualifier assesses lead quality and fit</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                      <Calendar className="h-4 w-4 text-orange-600" />
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">Scheduling</div>
                      <div className="text-xs text-gray-500">Scheduler coordinates meetings</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900">
                      <BarChart3 className="h-4 w-4 text-red-600" />
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">Performance Review</div>
                      <div className="text-xs text-gray-500">Manager analyzes and optimizes process</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  if (teamsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Bot className="h-12 w-12 mx-auto text-gray-400 animate-pulse" />
          <p className="mt-2 text-gray-500">Loading SDR teams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SDR Teams</h1>
          <p className="text-gray-500">Autonomous AI teams collaborating on deals</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-team">
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create SDR Team</DialogTitle>
              <DialogDescription>
                Assemble an AI team with specific roles and capabilities
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team Name</Label>
                <Input
                  id="team-name"
                  placeholder="e.g., Enterprise Hunters"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  data-testid="input-team-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="team-description">Description</Label>
                <Input
                  id="team-description"
                  placeholder="Team focus and objectives"
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  data-testid="input-team-description"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="team-type">Team Type</Label>
                <Select
                  value={newTeam.teamType}
                  onValueChange={(value: any) => setNewTeam({ ...newTeam, teamType: value })}
                >
                  <SelectTrigger id="team-type" data-testid="select-team-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hunter">Hunter (New Business)</SelectItem>
                    <SelectItem value="farmer">Farmer (Account Growth)</SelectItem>
                    <SelectItem value="hybrid">Hybrid (Both)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Select AI Personas</Label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(AI_PERSONAS).map(([key, persona]) => {
                    const Icon = persona.icon;
                    const isSelected = newTeam.roles.includes(key);
                    
                    return (
                      <div
                        key={key}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'hover:border-gray-400'
                        }`}
                        onClick={() => handleRoleToggle(key)}
                        data-testid={`toggle-role-${key}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-md ${persona.color}`}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-sm">{persona.name}</div>
                            <div className="text-xs text-gray-500">{persona.description}</div>
                          </div>
                          {isSelected && (
                            <CheckCircle className="h-5 w-5 text-blue-500" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateTeam} disabled={createTeamMutation.isPending} data-testid="button-confirm-create">
                {createTeamMutation.isPending ? "Creating..." : "Create Team"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {selectedTeam ? (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <div className="space-y-4">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setSelectedTeam(null)}
            >
              <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
              Back to Teams
            </Button>
            
            <div className="space-y-2">
              {teams.map((team: any) => (
                <div
                  key={team.id}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    team.id === selectedTeam
                      ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-900'
                  }`}
                  onClick={() => setSelectedTeam(team.id)}
                >
                  <div className="font-medium text-sm">{team.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {team.memberRoles?.length || 0} members • {team.teamType}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div>{renderTeamDetails()}</div>
        </div>
      ) : (
        <div>
          {teams.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <Users2 className="h-12 w-12 mx-auto text-gray-400" />
                <h3 className="mt-4 text-lg font-semibold">No SDR Teams Yet</h3>
                <p className="mt-2 text-gray-500">
                  Create your first AI-powered SDR team to start automating your sales process
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setIsCreateDialogOpen(true)}
                  data-testid="button-create-first-team"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Team
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {teams.map((team: any) => renderTeamCard(team))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}