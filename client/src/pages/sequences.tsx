import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { api as apiHelpers } from "@/lib/apiHelpers";
import { Plus, Play, Pause, Copy, Edit, Trash2, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import SequenceBuilder from "@/components/sequence-builder";
import { useToast } from "@/hooks/use-toast";

export default function Sequences() {
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingSequence, setEditingSequence] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sequences, isLoading } = useQuery({
    queryKey: ["/api/sequences"],
  });

  const { data: personas } = useQuery({
    queryKey: ["/api/personas"],
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["/api/contacts"],
  });

  const { data: emails = [] } = useQuery({
    queryKey: ["/api/emails"],
  });

  // Calculate real metrics
  const totalContacts = contacts.length;
  const sentEmails = emails.filter((e: any) => 
    ['sent', 'delivered', 'opened', 'replied'].includes(e.status)
  );
  const repliedEmails = emails.filter((e: any) => e.status === 'replied');
  const avgReplyRate = sentEmails.length > 0 
    ? Math.round((repliedEmails.length / sentEmails.length) * 100) 
    : 0;

  const createSequenceMutation = useMutation({
    mutationFn: api.createSequence,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sequences"] });
      setIsBuilderOpen(false);
      toast({
        title: "Sequence Created",
        description: "Your new sequence has been created successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Sequence creation failed:", error);
      const errorMessage = error?.message || error?.response?.data?.error || "Failed to create sequence. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const filteredSequences = sequences?.filter((seq: any) => 
    selectedStatus === "all" || seq.status === selectedStatus
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-chart-1 text-background';
      case 'paused': return 'bg-chart-2 text-background';
      case 'draft': return 'bg-muted text-muted-foreground';
      case 'completed': return 'bg-chart-3 text-background';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleSequenceCreated = (sequenceData: any) => {
    createSequenceMutation.mutate(sequenceData);
  };

  const duplicateSequence = (sequence: any) => {
    const duplicatedSequence = {
      ...sequence,
      name: `${sequence.name} (Copy)`,
      status: 'draft',
    };
    delete duplicatedSequence.id;
    createSequenceMutation.mutate(duplicatedSequence);
  };

  const startSequenceMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiHelpers.post(`/api/sequences/${id}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sequences"] });
      toast({
        title: "Sequence Started",
        description: "The sequence is now active and will begin processing.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to start sequence",
        variant: "destructive",
      });
    },
  });

  const pauseSequenceMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiHelpers.post(`/api/sequences/${id}/pause`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sequences"] });
      toast({
        title: "Sequence Paused",
        description: "The sequence has been paused.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to pause sequence",
        variant: "destructive",
      });
    },
  });

  const updateSequenceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiHelpers.patch(`/api/sequences/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sequences"] });
      toast({
        title: "Sequence Updated",
        description: "Your sequence has been updated successfully.",
      });
      setEditingSequence(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update sequence",
        variant: "destructive",
      });
    },
  });

  const toggleSequence = (sequence: any) => {
    if (sequence.status === 'active') {
      pauseSequenceMutation.mutate(sequence.id);
    } else {
      startSequenceMutation.mutate(sequence.id);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 md:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold">Sequences</h1>
              <p className="text-sm md:text-base text-muted-foreground">Manage your multi-channel outreach sequences</p>
            </div>
            <div className="flex items-center gap-4">
            <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-lg hover:soft-shadow-hover transition-all-soft" data-testid="button-create-sequence">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Create Sequence</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Sequence</DialogTitle>
                </DialogHeader>
                <SequenceBuilder 
                  personas={personas || []}
                  onSequenceCreated={handleSequenceCreated}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Total Sequences</p>
                  <p className="text-2xl md:text-3xl font-bold" data-testid="text-total-sequences">
                    {sequences?.length || 0}
                  </p>
                </div>
                <TrendingUp className="h-6 md:h-8 w-6 md:w-8 text-chart-1" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Active Sequences</p>
                  <p className="text-2xl md:text-3xl font-bold text-chart-1" data-testid="text-active-sequences">
                    {sequences?.filter((s: any) => s.status === 'active').length || 0}
                  </p>
                </div>
                <Play className="h-6 md:h-8 w-6 md:w-8 text-chart-1" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Total Contacts</p>
                  <p className="text-2xl md:text-3xl font-bold text-chart-2" data-testid="text-total-contacts">
                    {totalContacts}
                  </p>
                </div>
                <Users className="h-6 md:h-8 w-6 md:w-8 text-chart-2" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">Avg Reply Rate</p>
                  <p className="text-2xl md:text-3xl font-bold text-chart-3" data-testid="text-reply-rate">
                    {avgReplyRate}%
                  </p>
                </div>
                <TrendingUp className="h-6 md:h-8 w-6 md:w-8 text-chart-3" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sequence Tabs */}
        <Card className="rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
          <CardHeader>
            <CardTitle className="text-sm md:text-base">Your Sequences</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
                <TabsTrigger value="active" data-testid="tab-active">Active</TabsTrigger>
                <TabsTrigger value="paused" data-testid="tab-paused">Paused</TabsTrigger>
                <TabsTrigger value="draft" data-testid="tab-draft">Draft</TabsTrigger>
                <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
              </TabsList>
              
              <TabsContent value={selectedStatus} className="space-y-4 mt-6">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading sequences...</div>
                ) : filteredSequences?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSequences.map((sequence: any) => (
                      <Card key={sequence.id} className="relative rounded-xl soft-shadow hover:soft-shadow-hover transition-all-soft">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg" data-testid={`text-sequence-name-${sequence.id}`}>
                                {sequence.name}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground mt-1">
                                {sequence.description || "No description"}
                              </p>
                            </div>
                            <Badge className={getStatusColor(sequence.status)}>
                              {sequence.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Steps:</span>
                              <span className="ml-2 font-medium">
                                {Array.isArray(sequence.steps) ? sequence.steps.length : 0}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Enrolled:</span>
                              <span className="ml-2 font-medium text-muted-foreground">
                                —
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Sent:</span>
                              <span className="ml-2 font-medium text-muted-foreground">
                                —
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Reply Rate:</span>
                              <span className="ml-2 font-medium text-muted-foreground">
                                —
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-xs text-muted-foreground text-center py-2">
                            {sequence.status === 'draft' ? 'Activate to start tracking metrics' : 
                             sequence.status === 'completed' ? 'Sequence completed' :
                             'No contacts enrolled yet'}
                          </div>
                          
                          <div className="flex items-center space-x-2 pt-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => setEditingSequence(sequence)}
                              data-testid={`button-edit-${sequence.id}`}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => duplicateSequence(sequence)}
                              data-testid={`button-copy-${sequence.id}`}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                            <Button 
                              size="sm" 
                              variant={sequence.status === 'active' ? 'outline' : 'default'}
                              onClick={() => toggleSequence(sequence)}
                              data-testid={`button-toggle-${sequence.id}`}
                            >
                              {sequence.status === 'active' ? (
                                <>
                                  <Pause className="h-3 w-3 mr-1" />
                                  Pause
                                </>
                              ) : (
                                <>
                                  <Play className="h-3 w-3 mr-1" />
                                  Start
                                </>
                              )}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="mx-auto w-20 h-20 md:w-24 md:h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                      <Users className="h-10 md:h-12 w-10 md:w-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-base md:text-lg font-medium mb-2">No sequences found</h3>
                    <p className="text-sm md:text-base text-muted-foreground mb-4">
                      {selectedStatus === "all" 
                        ? "Create your first sequence to start automating your outreach"
                        : `No ${selectedStatus} sequences found`
                      }
                    </p>
                    <Button onClick={() => setIsBuilderOpen(true)} className="rounded-lg hover:soft-shadow-hover transition-all-soft" data-testid="button-create-first-sequence">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Sequence
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        </div>
        
        {/* Edit Sequence Modal */}
        <Dialog open={!!editingSequence} onOpenChange={(open) => !open && setEditingSequence(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Sequence</DialogTitle>
            </DialogHeader>
            {editingSequence && (
              <SequenceBuilder 
                personas={personas || []}
                onSequenceCreated={() => {}}
                onSequenceUpdated={(data) => {
                  updateSequenceMutation.mutate({
                    id: editingSequence.id,
                    data: {
                      name: data.name,
                      description: data.description,
                      steps: data.steps,
                      targets: data.targets,
                    }
                  });
                }}
                initialData={editingSequence}
                isEditing={true}
              />
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
