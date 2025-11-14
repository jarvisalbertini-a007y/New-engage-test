import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { api as apiHelpers } from "@/lib/apiHelpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Play, Target, Mail, Phone, Users, TrendingUp, Clock, CheckCircle,
  Building, Rocket, Calendar, Search, Filter, Sparkles, BookOpen,
  Trophy, Zap, FileText, MessageSquare, BarChart, Eye, Copy
} from "lucide-react";
import type { Playbook } from "@shared/schema";

export function PlaybooksPage() {
  const { toast } = useToast();
  const [selectedIndustry, setSelectedIndustry] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedSequences, setSelectedSequences] = useState<string[]>([]);

  // Fetch playbook templates from the API
  const { data: templatePlaybooks = [], isLoading: templatesLoading } = useQuery<Playbook[]>({
    queryKey: ["/api/playbooks", { isTemplate: true }],
  });

  // Fetch user's custom playbooks
  const { data: customPlaybooks = [], isLoading: customLoading } = useQuery<Playbook[]>({
    queryKey: ["/api/playbooks", { isTemplate: false }],
  });

  // Apply playbook mutation
  const applyPlaybook = useMutation({
    mutationFn: async ({ playbookId, sequences }: { playbookId: string; sequences: string[] }) => {
      return apiHelpers.post(`/api/playbooks/${playbookId}/apply`, { sequences });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sequences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/playbooks"] });
      toast({
        title: "Playbook Applied!",
        description: "Sequences and templates have been created successfully.",
      });
      setApplyModalOpen(false);
      setSelectedPlaybook(null);
      setSelectedSequences([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error applying playbook",
        description: error.message || "Failed to apply the playbook",
        variant: "destructive",
      });
    }
  });

  // Duplicate template mutation
  const duplicateTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      return apiHelpers.post(`/api/playbooks/${templateId}/duplicate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playbooks"] });
      toast({
        title: "Template Duplicated!",
        description: "You can now customize your copy of the template.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error duplicating template",
        description: error.message || "Failed to duplicate the template",
        variant: "destructive",
      });
    }
  });

  // Handle opening apply modal
  const handleApplyClick = (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
    const sequences = playbook.sequences ?? [];
    setSelectedSequences(sequences.map((s) => s.name)); // Select all by default
    setApplyModalOpen(true);
  };

  // Handle preview
  const handlePreviewClick = (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
    setPreviewModalOpen(true);
  };

  // Handle applying the playbook
  const handleApplyPlaybook = () => {
    if (selectedPlaybook) {
      applyPlaybook.mutate({ 
        playbookId: selectedPlaybook.id, 
        sequences: selectedSequences 
      });
    }
  };

  // Filter templates based on search and industry
  const filteredTemplates = templatePlaybooks.filter(template => {
    const matchesSearch = searchQuery === "" || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
    
    const matchesIndustry = selectedIndustry === "all" || 
      template.industry === selectedIndustry;
    
    return matchesSearch && matchesIndustry;
  });

  // Extract unique industries from templates
  const industries = ["all", ...Array.from(new Set(templatePlaybooks.map(t => t.industry)))];

  // Calculate average metrics
  const avgReplyRate = templatePlaybooks.length > 0 
    ? templatePlaybooks.reduce((acc, t) => {
        const metrics = t.successMetrics ?? {};
        const rate = parseInt(metrics.avgReplyRate || "0");
        return acc + rate;
      }, 0) / templatePlaybooks.length
    : 0;

  const avgTimeToReply = templatePlaybooks.length > 0
    ? templatePlaybooks.reduce((acc, t) => {
        const metrics = t.successMetrics ?? {};
        const time = parseFloat(metrics.timeToResponse || "0");
        return acc + time;
      }, 0) / templatePlaybooks.length
    : 0;

  if (templatesLoading || customLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading playbooks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl mb-2">Sales Playbooks</h1>
            <p className="text-muted-foreground">
              Deploy battle-tested outreach strategies with one click
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search playbooks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
                data-testid="input-search-playbooks"
              />
            </div>
            <Button variant="outline" data-testid="button-create-custom">
              <Sparkles className="h-4 w-4 mr-2" />
              Create Custom
            </Button>
          </div>
        </div>

        {/* Industry Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {industries.map((industry) => (
            <Button
              key={industry}
              variant={selectedIndustry === industry ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedIndustry(industry)}
              className="capitalize"
              data-testid={`filter-${industry}`}
            >
              {industry === "all" ? "All Industries" : industry}
            </Button>
          ))}
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-semibold">{templatePlaybooks.length}</p>
                  <p className="text-sm text-muted-foreground">Templates</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Trophy className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-semibold">{avgReplyRate.toFixed(0)}%</p>
                  <p className="text-sm text-muted-foreground">Avg Reply Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-semibold">{avgTimeToReply.toFixed(1)} days</p>
                  <p className="text-sm text-muted-foreground">Time to Reply</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Zap className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-semibold">{customPlaybooks.length}</p>
                  <p className="text-sm text-muted-foreground">Custom</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Templates vs Custom */}
        <Tabs defaultValue="templates" className="space-y-4">
          <TabsList>
            <TabsTrigger value="templates">Templates ({templatePlaybooks.length})</TabsTrigger>
            <TabsTrigger value="custom">My Playbooks ({customPlaybooks.length})</TabsTrigger>
          </TabsList>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            {filteredTemplates.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No templates found matching your criteria.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTemplates.map((template) => {
                  const sequences = template.sequences ?? [];
                  const targetAudience = template.targetAudience ?? {};
                  const metrics = template.successMetrics ?? {};
                  
                  return (
                    <Card key={template.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{template.name}</CardTitle>
                            <Badge variant="secondary" className="mt-2">
                              {template.industry}
                            </Badge>
                          </div>
                          <Building className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <CardDescription className="mt-2">
                          {template.description || "No description available"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Target Audience */}
                        <div>
                          <p className="text-sm font-medium mb-2">Target Audience</p>
                          <div className="flex flex-wrap gap-1">
                            {(targetAudience.titles || []).slice(0, 3).map((title, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {title}
                              </Badge>
                            ))}
                            {targetAudience.titles && targetAudience.titles.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{targetAudience.titles.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Sequences */}
                        <div>
                          <p className="text-sm font-medium mb-2">Sequences</p>
                          <div className="space-y-2">
                            {sequences.slice(0, 2).map((seq, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{seq.name}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {seq.steps} steps
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {seq.duration}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                          <div className="text-center">
                            <p className="text-sm font-semibold">{metrics.avgReplyRate || "0%"}</p>
                            <p className="text-xs text-muted-foreground">Reply</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold">{metrics.avgMeetingRate || "0%"}</p>
                            <p className="text-xs text-muted-foreground">Meeting</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold">{metrics.timeToFirst || "0d"}</p>
                            <p className="text-xs text-muted-foreground">Speed</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button 
                            size="sm" 
                            className="flex-1"
                            onClick={() => handleApplyClick(template)}
                            data-testid={`button-apply-${template.id}`}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Apply
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handlePreviewClick(template)}
                            data-testid={`button-preview-${template.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => duplicateTemplate.mutate(template.id)}
                            data-testid={`button-duplicate-${template.id}`}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Custom Playbooks Tab */}
          <TabsContent value="custom" className="space-y-4">
            {customPlaybooks.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground mb-4">You haven't created any custom playbooks yet.</p>
                  <Button variant="outline">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Create Your First Playbook
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {customPlaybooks.map((playbook) => {
                  const sequences = playbook.sequences ?? [];
                  const metrics = playbook.successMetrics ?? {};
                  
                  return (
                    <Card key={playbook.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{playbook.name}</CardTitle>
                            <Badge className="mt-2">Custom</Badge>
                          </div>
                          <Rocket className="h-5 w-5 text-primary" />
                        </div>
                        <CardDescription className="mt-2">
                          {playbook.description || "Custom playbook"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm font-medium mb-2">
                            {sequences.length} Sequence{sequences.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="flex-1"
                            onClick={() => handleApplyClick(playbook)}
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Apply
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handlePreviewClick(playbook)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Apply Modal */}
        <Dialog open={applyModalOpen} onOpenChange={setApplyModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Apply Playbook: {selectedPlaybook?.name}</DialogTitle>
              <DialogDescription>
                Select which sequences to create from this playbook
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm font-medium">Sequences to Create</Label>
                <div className="space-y-2 mt-2">
                  {(selectedPlaybook?.sequences ?? []).map((seq) => (
                    <div key={seq.name} className="flex items-center space-x-2">
                      <Checkbox 
                        id={seq.name}
                        checked={selectedSequences.includes(seq.name)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedSequences([...selectedSequences, seq.name]);
                          } else {
                            setSelectedSequences(selectedSequences.filter(s => s !== seq.name));
                          }
                        }}
                      />
                      <label 
                        htmlFor={seq.name}
                        className="flex-1 flex items-center justify-between cursor-pointer"
                      >
                        <span className="font-medium">{seq.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{seq.steps} steps</Badge>
                          <span className="text-sm text-muted-foreground">{seq.duration}</span>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setApplyModalOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleApplyPlaybook}
                disabled={selectedSequences.length === 0 || applyPlaybook.isPending}
              >
                {applyPlaybook.isPending ? "Applying..." : "Apply Playbook"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Modal */}
        <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedPlaybook?.name}</DialogTitle>
              <DialogDescription>
                {selectedPlaybook?.description}
              </DialogDescription>
            </DialogHeader>
            
            {selectedPlaybook && (
              <div className="space-y-6 py-4">
                {/* Email Templates */}
                {selectedPlaybook.emailTemplates && (
                  <div>
                    <h3 className="font-semibold mb-3">Email Templates</h3>
                    <div className="space-y-3">
                      {Object.entries(selectedPlaybook.emailTemplates ?? {}).map(([key, template]) => (
                        <Card key={key}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</CardTitle>
                            <p className="text-sm font-medium text-muted-foreground">
                              Subject: {template.subject}
                            </p>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm whitespace-pre-wrap">{template.preview}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Success Metrics */}
                {selectedPlaybook.successMetrics && (
                  <div>
                    <h3 className="font-semibold mb-3">Expected Performance</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {Object.entries(selectedPlaybook.successMetrics ?? {}).map(([key, value]) => (
                        <Card key={key}>
                          <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold text-primary">{String(value)}</p>
                            <p className="text-sm text-muted-foreground capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewModalOpen(false)}>
                Close
              </Button>
              <Button onClick={() => {
                setPreviewModalOpen(false);
                if (selectedPlaybook) handleApplyClick(selectedPlaybook);
              }}>
                Apply This Playbook
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}