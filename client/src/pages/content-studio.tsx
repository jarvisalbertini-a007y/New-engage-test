import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { Wand2, Copy, Save, Send, User, Building, Lightbulb, Target, Brain, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function ContentStudio() {
  const [selectedPersona, setSelectedPersona] = useState("none");
  const [selectedContact, setSelectedContact] = useState("none");
  const [selectedCompany, setSelectedCompany] = useState("none");
  const [selectedInsight, setSelectedInsight] = useState("none");
  const [contentType, setContentType] = useState("email");
  const [tone, setTone] = useState("professional");
  const [customPrompt, setCustomPrompt] = useState("");
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [targetingFilters, setTargetingFilters] = useState({
    industry: "",
    companySize: "",
    title: "",
    location: ""
  });
  
  const { toast } = useToast();

  const { data: personas = [] } = useQuery({
    queryKey: ["/api/personas"],
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["/api/contacts"],
    queryFn: () => api.getContacts({ limit: 100 }),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["/api/companies"],
    queryFn: () => api.getCompanies(100),
  });

  const { data: insights = [] } = useQuery({
    queryKey: ["/api/insights"],
    queryFn: () => api.getInsights({ limit: 20 }),
  });

  const generateContentMutation = useMutation({
    mutationFn: api.generateContent,
    onSuccess: (data) => {
      setGeneratedContent(data);
      toast({
        title: "Content Generated",
        description: "AI has created your personalized content.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      // Save as a sequence with a single step
      return await apiRequest('/api/sequences', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          status: 'draft',
          steps: [{
            stepNumber: 1,
            type: contentType as 'email' | 'linkedin' | 'phone',
            delayDays: 0,
            subject: data.subject,
            template: data.body
          }],
          personaId: selectedPersona !== "none" ? selectedPersona : undefined,
          createdBy: 'user'
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sequences"] });
      setIsSaveDialogOpen(false);
      setTemplateName("");
      setTemplateDescription("");
      toast({
        title: "Template Saved",
        description: "Your content has been saved as a template.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    const request = {
      personaId: selectedPersona !== "none" ? selectedPersona : undefined,
      contactId: selectedContact !== "none" ? selectedContact : undefined,
      companyId: selectedCompany !== "none" ? selectedCompany : undefined,
      insightId: selectedInsight !== "none" ? selectedInsight : undefined,
      customPrompt: customPrompt || undefined,
      tone,
      type: contentType,
    };

    generateContentMutation.mutate(request);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Content copied to clipboard.",
    });
  };

  const getSelectedContact = () => {
    return contacts?.find((c: any) => c.id === selectedContact);
  };

  const getSelectedCompany = () => {
    return companies?.find((c: any) => c.id === selectedCompany);
  };

  const getSelectedInsight = () => {
    return insights?.find((i: any) => i.id === selectedInsight);
  };

  const getPersonalizationScore = () => {
    let score = 30; // Base score
    if (selectedPersona !== "none") score += 20;
    if (selectedContact !== "none") score += 25;
    if (selectedCompany !== "none") score += 15;
    if (selectedInsight !== "none") score += 10;
    return Math.min(100, score);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Content Studio</h1>
            <p className="text-muted-foreground">AI-powered content generation for personalized outreach</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              onClick={handleGenerate}
              disabled={generateContentMutation.isPending}
              data-testid="button-generate-content"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              {generateContentMutation.isPending ? "Generating..." : "Generate Content"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Content Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="content-type">Content Type</Label>
                  <Select value={contentType} onValueChange={setContentType}>
                    <SelectTrigger data-testid="select-content-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="linkedin">LinkedIn Message</SelectItem>
                      <SelectItem value="cold_call_script">Cold Call Script</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="tone">Tone</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger data-testid="select-tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="persona">Target Persona</Label>
                  <Select value={selectedPersona} onValueChange={setSelectedPersona}>
                    <SelectTrigger data-testid="select-persona">
                      <SelectValue placeholder="Select persona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {personas?.map((persona: any) => (
                        <SelectItem key={persona.id} value={persona.id}>
                          {persona.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="contact">Target Contact</Label>
                  <Select value={selectedContact} onValueChange={setSelectedContact}>
                    <SelectTrigger data-testid="select-contact">
                      <SelectValue placeholder="Select contact" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {contacts?.slice(0, 20).map((contact: any) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.firstName} {contact.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="company">Target Company</Label>
                  <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                    <SelectTrigger data-testid="select-company">
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {companies?.slice(0, 20).map((company: any) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="insight">Recent Insight</Label>
                  <Select value={selectedInsight} onValueChange={setSelectedInsight}>
                    <SelectTrigger data-testid="select-insight">
                      <SelectValue placeholder="Select insight" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {insights?.slice(0, 10).map((insight: any) => (
                        <SelectItem key={insight.id} value={insight.id}>
                          {insight.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="custom-prompt">Custom Instructions</Label>
                  <Textarea
                    id="custom-prompt"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Add specific instructions for the AI..."
                    className="h-20"
                    data-testid="textarea-custom-prompt"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Personalization Score */}
            <Card>
              <CardHeader>
                <CardTitle>Personalization Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Current Score</span>
                    <Badge variant="secondary">{getPersonalizationScore()}/100</Badge>
                  </div>
                  <Progress value={getPersonalizationScore()} className="h-3" />
                  <div className="text-sm text-muted-foreground">
                    Add more context to improve personalization
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Context Preview */}
            {(selectedContact !== "none" || selectedCompany !== "none" || selectedInsight !== "none") && (
              <Card>
                <CardHeader>
                  <CardTitle>Context Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedContact !== "none" && (
                    <div className="flex items-start space-x-2">
                      <User className="h-4 w-4 text-chart-1 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">
                          {getSelectedContact()?.firstName} {getSelectedContact()?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getSelectedContact()?.title}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {selectedCompany !== "none" && (
                    <div className="flex items-start space-x-2">
                      <Building className="h-4 w-4 text-chart-2 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">
                          {getSelectedCompany()?.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getSelectedCompany()?.industry} • {getSelectedCompany()?.size}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {selectedInsight !== "none" && (
                    <div className="flex items-start space-x-2">
                      <Lightbulb className="h-4 w-4 text-chart-4 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">
                          {getSelectedInsight()?.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getSelectedInsight()?.type}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Generated Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Generated Content</CardTitle>
              </CardHeader>
              <CardContent>
                {generatedContent ? (
                  <Tabs defaultValue="content" className="space-y-4">
                    <TabsList>
                      <TabsTrigger value="content" data-testid="tab-content">Content</TabsTrigger>
                      <TabsTrigger value="analysis" data-testid="tab-analysis">Analysis</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="content" className="space-y-4">
                      {generatedContent.subject && (
                        <div>
                          <Label>Subject Line</Label>
                          <div className="p-3 bg-muted rounded-md mt-1">
                            <p className="font-medium">{generatedContent.subject}</p>
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <Label>Body</Label>
                        <div className="p-3 bg-muted rounded-md mt-1">
                          <pre className="whitespace-pre-wrap font-sans text-sm">
                            {generatedContent.body}
                          </pre>
                        </div>
                      </div>
                      
                      <div className="flex space-x-3">
                        <Button
                          variant="outline"
                          onClick={() => copyToClipboard(generatedContent.body)}
                          data-testid="button-copy-content"
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </Button>
                        <Button variant="outline" data-testid="button-save-content">
                          <Save className="h-4 w-4 mr-2" />
                          Save Template
                        </Button>
                        <Button data-testid="button-add-to-sequence">
                          <Send className="h-4 w-4 mr-2" />
                          Add to Sequence
                        </Button>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="analysis" className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Confidence Score</Label>
                          <div className="flex items-center space-x-2 mt-1">
                            <Progress value={generatedContent.confidence || 0} className="flex-1" />
                            <span className="text-sm font-medium">
                              {generatedContent.confidence || 0}/100
                            </span>
                          </div>
                        </div>
                        <div>
                          <Label>Tone</Label>
                          <Badge variant="secondary" className="mt-1">
                            {generatedContent.tone}
                          </Badge>
                        </div>
                      </div>
                      
                      {generatedContent.personalizationElements?.length > 0 && (
                        <div>
                          <Label>Personalization Elements</Label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {generatedContent.personalizationElements.map((element: string, index: number) => (
                              <Badge key={index} variant="outline">
                                {element}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="text-center py-12">
                    <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                      <Wand2 className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">Ready to Generate</h3>
                    <p className="text-muted-foreground mb-4">
                      Configure your settings and click "Generate Content" to create personalized outreach
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Templates */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Templates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 border rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">SaaS Outreach Template</p>
                        <p className="text-xs text-muted-foreground">Email • Professional tone</p>
                      </div>
                      <Button size="sm" variant="outline" data-testid="button-use-template-1">
                        Use Template
                      </Button>
                    </div>
                  </div>
                  
                  <div className="p-3 border rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Funding Follow-up</p>
                        <p className="text-xs text-muted-foreground">LinkedIn • Friendly tone</p>
                      </div>
                      <Button size="sm" variant="outline" data-testid="button-use-template-2">
                        Use Template
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
