import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Brain, 
  Users, 
  Target, 
  MessageSquare, 
  TrendingUp, 
  Clock,
  Mail,
  Linkedin,
  Phone,
  ChevronRight,
  Sparkles,
  BarChart3,
  Lightbulb,
  UserCheck,
  RefreshCw,
  Plus,
  Activity,
  BookOpen,
  Video,
  FileText,
  Presentation,
  AlertCircle,
  CheckCircle2,
  XCircle
} from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from "recharts";
import type { DigitalTwin, Contact, Company } from "@shared/schema";

interface TwinWithContact extends DigitalTwin {
  contact?: Contact;
  company?: Company;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];
const COMMUNICATION_STYLES = ["formal", "casual", "technical", "friendly", "professional"];
const BUYING_STAGES = ["awareness", "interest", "consideration", "intent", "evaluation", "purchase"];
const CONTENT_PREFERENCES = ["case_studies", "whitepapers", "videos", "demos", "webinars"];

export default function DigitalTwins() {
  const [selectedTwin, setSelectedTwin] = useState<TwinWithContact | null>(null);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [template, setTemplate] = useState("");
  const [interaction, setInteraction] = useState({
    interactionType: "email",
    channel: "email",
    content: "",
    response: "",
    sentiment: "neutral",
    engagementScore: 0.5,
    outcome: ""
  });
  const { toast } = useToast();

  // Fetch contacts to show digital twins
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts']
  });

  // Fetch aggregate insights
  const { data: insights } = useQuery({
    queryKey: ['/api/digital-twins/insights'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Create digital twin mutation
  const createTwinMutation = useMutation({
    mutationFn: async (contactId: string) => {
      return apiRequest('/api/digital-twins', {
        method: 'POST',
        body: JSON.stringify({ contactId })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({ title: "Digital twin created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create digital twin", variant: "destructive" });
    }
  });

  // Learn from interaction mutation
  const learnMutation = useMutation({
    mutationFn: async ({ twinId, interaction }: any) => {
      return apiRequest(`/api/digital-twins/${twinId}/learn`, {
        method: 'PUT',
        body: JSON.stringify(interaction)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/digital-twins'] });
      setTrainingOpen(false);
      toast({ title: "Twin model updated with new interaction" });
    }
  });

  // Personalize content mutation
  const personalizeMutation = useMutation({
    mutationFn: async ({ twinId, template }: any) => {
      return apiRequest(`/api/digital-twins/${twinId}/personalize`, {
        method: 'POST',
        body: JSON.stringify({ template })
      });
    }
  });

  // Get twin data for a contact
  const getTwinData = async (contactId: string) => {
    try {
      const response = await fetch(`/api/digital-twins/${contactId}`);
      if (response.ok) {
        const twin = await response.json();
        const contact = contacts.find(c => c.id === contactId);
        setSelectedTwin({ ...twin, contact });
      }
    } catch (error) {
      console.error("Error fetching twin:", error);
    }
  };

  // Prepare personality traits data for radar chart
  const getPersonalityData = (traits: any) => {
    if (!traits) return [];
    return [
      { trait: "Decision Style", value: traits.decision_style === "analytical" ? 80 : 40 },
      { trait: "Risk Tolerance", value: traits.risk_tolerance === "high" ? 90 : traits.risk_tolerance === "moderate" ? 50 : 20 },
      { trait: "Engagement", value: traits.engagement_level === "high" ? 85 : traits.engagement_level === "medium" ? 50 : 20 },
      { trait: "Response Time", value: traits.response_time === "fast" ? 90 : traits.response_time === "standard" ? 50 : 20 },
      { trait: "Detail Focus", value: traits.detail_oriented ? 85 : 40 }
    ];
  };

  // Get content preference icons
  const getContentIcon = (type: string) => {
    switch (type) {
      case "case_studies": return <BookOpen className="w-4 h-4" />;
      case "whitepapers": return <FileText className="w-4 h-4" />;
      case "videos": return <Video className="w-4 h-4" />;
      case "demos": return <Presentation className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  // Get channel icon
  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email": return <Mail className="w-4 h-4" />;
      case "linkedin": return <Linkedin className="w-4 h-4" />;
      case "phone": return <Phone className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  // Get buying stage color
  const getStageColor = (stage: string) => {
    const index = BUYING_STAGES.indexOf(stage);
    return index >= 4 ? "success" : index >= 2 ? "warning" : "default";
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2" data-testid="text-page-title">
            Digital Twin Prospects
          </h1>
          <p className="text-gray-600" data-testid="text-page-description">
            AI-powered prospect modeling for hyper-personalization
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="px-3 py-1" data-testid="badge-twin-count">
            <Brain className="w-4 h-4 mr-1" />
            {insights?.totalTwins || 0} Active Twins
          </Badge>
          <Badge variant="outline" className="px-3 py-1" data-testid="badge-avg-confidence">
            <Activity className="w-4 h-4 mr-1" />
            {Math.round(insights?.averageConfidence || 0)}% Avg Confidence
          </Badge>
        </div>
      </div>

      {/* Aggregate Insights */}
      {insights && (
        <Card className="mb-6" data-testid="card-aggregate-insights">
          <CardHeader>
            <CardTitle>Aggregate Insights</CardTitle>
            <CardDescription>Patterns across all digital twins</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Stage Distribution */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Buying Stage Distribution</h4>
                {Object.entries(insights.stageDistribution || {}).map(([stage, count]) => (
                  <div key={stage} className="flex justify-between items-center">
                    <span className="text-sm capitalize">{stage}</span>
                    <Badge variant={getStageColor(stage) as any}>{count as number}</Badge>
                  </div>
                ))}
              </div>

              {/* Common Pain Points */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Top Pain Points</h4>
                {insights.commonPainPoints?.map((point: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <AlertCircle className="w-3 h-3 text-orange-500" />
                    <span className="text-sm capitalize">{point}</span>
                  </div>
                ))}
              </div>

              {/* Top Patterns */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Common Patterns</h4>
                {insights.topPatterns?.map((pattern: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span className="text-sm">{pattern}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <Users className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="profiles" data-testid="tab-profiles">
            <Brain className="w-4 h-4 mr-2" />
            Twin Profiles
          </TabsTrigger>
          <TabsTrigger value="training" data-testid="tab-training">
            <Target className="w-4 h-4 mr-2" />
            Training & Testing
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map(contact => (
              <Card 
                key={contact.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => getTwinData(contact.id)}
                data-testid={`card-contact-${contact.id}`}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {contact.firstName} {contact.lastName}
                      </CardTitle>
                      <CardDescription>
                        {contact.title} at {contact.companyId}
                      </CardDescription>
                    </div>
                    <Brain className="w-5 h-5 text-purple-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Twin Status</span>
                      <Badge variant="outline">Active</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Confidence</span>
                      <span className="font-semibold">75%</span>
                    </div>
                    <Button 
                      className="w-full mt-3"
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        createTwinMutation.mutate(contact.id);
                      }}
                      data-testid={`button-create-twin-${contact.id}`}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Create Twin
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Profiles Tab */}
        <TabsContent value="profiles" className="space-y-4">
          {selectedTwin ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Profile Overview */}
              <div className="space-y-4">
                <Card data-testid="card-twin-overview">
                  <CardHeader>
                    <CardTitle>Twin Profile</CardTitle>
                    <CardDescription>
                      {selectedTwin.contact?.firstName} {selectedTwin.contact?.lastName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Communication Style</Label>
                      <Badge variant="secondary" className="mt-1">
                        {selectedTwin.communicationStyle}
                      </Badge>
                    </div>
                    
                    <div>
                      <Label>Preferred Channels</Label>
                      <div className="flex gap-2 mt-1">
                        {selectedTwin.preferredChannels?.map(channel => (
                          <Badge key={channel} variant="outline">
                            {getChannelIcon(channel)}
                            <span className="ml-1">{channel}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Best Engagement Time</Label>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">{selectedTwin.bestEngagementTime || "Not determined"}</span>
                      </div>
                    </div>

                    <div>
                      <Label>Model Confidence</Label>
                      <Progress value={selectedTwin.modelConfidence} className="mt-2" />
                      <span className="text-sm text-gray-600">{selectedTwin.modelConfidence}%</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Interests & Values */}
                <Card data-testid="card-interests-values">
                  <CardHeader>
                    <CardTitle className="text-lg">Interests & Values</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm">Interests</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedTwin.interests?.map(interest => (
                            <Badge key={interest} variant="secondary" className="text-xs">
                              {interest}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm">Values</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedTwin.values?.map(value => (
                            <Badge key={value} variant="outline" className="text-xs">
                              {value}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Middle Column - Personality & Preferences */}
              <div className="space-y-4">
                {/* Personality Radar Chart */}
                <Card data-testid="card-personality-radar">
                  <CardHeader>
                    <CardTitle className="text-lg">Personality Traits</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <RadarChart data={getPersonalityData(selectedTwin.personalityTraits)}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="trait" />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} />
                        <Radar 
                          name="Traits" 
                          dataKey="value" 
                          stroke="#8884d8" 
                          fill="#8884d8" 
                          fillOpacity={0.6} 
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Content Preferences */}
                <Card data-testid="card-content-preferences">
                  <CardHeader>
                    <CardTitle className="text-lg">Content Preferences</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedTwin.contentPreferences?.map(pref => (
                        <div key={pref} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            {getContentIcon(pref)}
                            <span className="text-sm capitalize">{pref.replace('_', ' ')}</span>
                          </div>
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Pain Points */}
                <Card data-testid="card-pain-points">
                  <CardHeader>
                    <CardTitle className="text-lg">Pain Points</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {selectedTwin.painPoints?.map((point, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                          <span className="text-sm capitalize">{point}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Recommendations */}
              <div className="space-y-4">
                {/* Buying Stage */}
                <Card data-testid="card-buying-stage">
                  <CardHeader>
                    <CardTitle className="text-lg">Buying Journey</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm">Current Stage</Label>
                        <Badge 
                          variant={getStageColor(selectedTwin.buyingStageIndicators?.stage || "awareness") as any}
                          className="mt-1"
                        >
                          {selectedTwin.buyingStageIndicators?.stage || "awareness"}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-sm">Signals</Label>
                        <div className="mt-1 space-y-1">
                          {selectedTwin.buyingStageIndicators?.signals?.map((signal: string, idx: number) => (
                            <div key={idx} className="text-xs text-gray-600 flex items-center gap-1">
                              <ChevronRight className="w-3 h-3" />
                              {signal}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recommended Actions */}
                <Card data-testid="card-recommended-actions">
                  <CardHeader>
                    <CardTitle className="text-lg">Recommended Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button className="w-full justify-start" variant="outline" size="sm">
                      <Mail className="w-4 h-4 mr-2" />
                      Send personalized email
                    </Button>
                    <Button className="w-full justify-start" variant="outline" size="sm">
                      <Linkedin className="w-4 h-4 mr-2" />
                      Connect on LinkedIn
                    </Button>
                    <Button className="w-full justify-start" variant="outline" size="sm">
                      <FileText className="w-4 h-4 mr-2" />
                      Share case study
                    </Button>
                    <Button className="w-full justify-start" variant="outline" size="sm">
                      <Phone className="w-4 h-4 mr-2" />
                      Schedule discovery call
                    </Button>
                  </CardContent>
                </Card>

                {/* Messaging Approach */}
                <Card data-testid="card-messaging-approach">
                  <CardHeader>
                    <CardTitle className="text-lg">Messaging Strategy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div>
                        <Label className="text-xs">Tone</Label>
                        <p className="text-gray-700 capitalize">{selectedTwin.communicationStyle}</p>
                      </div>
                      <div>
                        <Label className="text-xs">Focus Areas</Label>
                        <ul className="text-gray-700 space-y-1">
                          <li>• ROI and efficiency gains</li>
                          <li>• Integration capabilities</li>
                          <li>• Success stories</li>
                        </ul>
                      </div>
                      <div>
                        <Label className="text-xs">Avoid</Label>
                        <ul className="text-gray-700 space-y-1">
                          <li>• Technical jargon</li>
                          <li>• Aggressive selling</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Brain className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">Select a contact from the dashboard to view their digital twin profile</p>
            </div>
          )}
        </TabsContent>

        {/* Training & Testing Tab */}
        <TabsContent value="training" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Manual Training */}
            <Card data-testid="card-manual-training">
              <CardHeader>
                <CardTitle>Train Digital Twin</CardTitle>
                <CardDescription>Manually input interactions to improve the model</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedTwin ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Interaction Type</Label>
                      <Select 
                        value={interaction.interactionType} 
                        onValueChange={(value) => setInteraction({...interaction, interactionType: value})}
                      >
                        <SelectTrigger data-testid="select-interaction-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="call">Phone Call</SelectItem>
                          <SelectItem value="meeting">Meeting</SelectItem>
                          <SelectItem value="linkedin">LinkedIn</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Content Sent</Label>
                      <Textarea 
                        placeholder="What message or content was sent?"
                        value={interaction.content}
                        onChange={(e) => setInteraction({...interaction, content: e.target.value})}
                        data-testid="textarea-content"
                      />
                    </div>

                    <div>
                      <Label>Response Received</Label>
                      <Textarea 
                        placeholder="How did they respond?"
                        value={interaction.response}
                        onChange={(e) => setInteraction({...interaction, response: e.target.value})}
                        data-testid="textarea-response"
                      />
                    </div>

                    <div>
                      <Label>Sentiment</Label>
                      <Select 
                        value={interaction.sentiment} 
                        onValueChange={(value) => setInteraction({...interaction, sentiment: value})}
                      >
                        <SelectTrigger data-testid="select-sentiment">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="positive">Positive</SelectItem>
                          <SelectItem value="neutral">Neutral</SelectItem>
                          <SelectItem value="negative">Negative</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Engagement Score (0-1)</Label>
                      <Input 
                        type="number" 
                        min="0" 
                        max="1" 
                        step="0.1"
                        value={interaction.engagementScore}
                        onChange={(e) => setInteraction({...interaction, engagementScore: parseFloat(e.target.value)})}
                        data-testid="input-engagement-score"
                      />
                    </div>

                    <Button 
                      className="w-full"
                      onClick={() => learnMutation.mutate({ twinId: selectedTwin.id, interaction })}
                      disabled={learnMutation.isPending}
                      data-testid="button-train-twin"
                    >
                      {learnMutation.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Training...
                        </>
                      ) : (
                        <>
                          <Brain className="w-4 h-4 mr-2" />
                          Train Twin
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-center text-gray-600 py-4">
                    Select a digital twin to start training
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Content Personalization Test */}
            <Card data-testid="card-content-personalization">
              <CardHeader>
                <CardTitle>Test Personalization</CardTitle>
                <CardDescription>See how the twin personalizes your content</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedTwin ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Template Content</Label>
                      <Textarea 
                        placeholder="Enter a template with {{variables}} to personalize..."
                        value={template}
                        onChange={(e) => setTemplate(e.target.value)}
                        rows={6}
                        data-testid="textarea-template"
                      />
                    </div>

                    <Button 
                      className="w-full"
                      onClick={() => personalizeMutation.mutate({ twinId: selectedTwin.id, template })}
                      disabled={personalizeMutation.isPending || !template}
                      data-testid="button-personalize"
                    >
                      {personalizeMutation.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Personalizing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Personalize Content
                        </>
                      )}
                    </Button>

                    {personalizeMutation.data && (
                      <div className="mt-4 p-4 bg-gray-50 rounded">
                        <Label className="text-sm mb-2">Personalized Result:</Label>
                        <p className="text-sm whitespace-pre-wrap">{personalizeMutation.data.content}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-gray-600 py-4">
                    Select a digital twin to test personalization
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Success Metrics */}
          <Card data-testid="card-success-metrics">
            <CardHeader>
              <CardTitle>Success Rate Tracking</CardTitle>
              <CardDescription>A/B testing results and performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">78%</div>
                  <p className="text-sm text-gray-600">Personalized vs 45% Generic</p>
                  <Label className="text-xs">Open Rate</Label>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">34%</div>
                  <p className="text-sm text-gray-600">Personalized vs 12% Generic</p>
                  <Label className="text-xs">Response Rate</Label>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600">2.5x</div>
                  <p className="text-sm text-gray-600">Higher conversion</p>
                  <Label className="text-xs">Meeting Booked</Label>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}