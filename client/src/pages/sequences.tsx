import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
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
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create sequence. Please try again.",
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sequences</h1>
            <p className="text-muted-foreground">Manage your multi-channel outreach sequences</p>
          </div>
          <div className="flex items-center space-x-4">
            <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-sequence">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Sequence
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
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Sequences</p>
                  <p className="text-3xl font-bold" data-testid="text-total-sequences">
                    {sequences?.length || 0}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-chart-1" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Sequences</p>
                  <p className="text-3xl font-bold text-chart-1" data-testid="text-active-sequences">
                    {sequences?.filter((s: any) => s.status === 'active').length || 0}
                  </p>
                </div>
                <Play className="h-8 w-8 text-chart-1" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Contacts</p>
                  <p className="text-3xl font-bold text-chart-2" data-testid="text-total-contacts">
                    {totalContacts}
                  </p>
                </div>
                <Users className="h-8 w-8 text-chart-2" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Reply Rate</p>
                  <p className="text-3xl font-bold text-chart-3" data-testid="text-reply-rate">
                    {avgReplyRate}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-chart-3" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sequence Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Your Sequences</CardTitle>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSequences.map((sequence: any) => (
                      <Card key={sequence.id} className="relative">
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
                            <Button size="sm" variant="outline" data-testid={`button-edit-${sequence.id}`}>
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
                    <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                      <Users className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">No sequences found</h3>
                    <p className="text-muted-foreground mb-4">
                      {selectedStatus === "all" 
                        ? "Create your first sequence to start automating your outreach"
                        : `No ${selectedStatus} sequences found`
                      }
                    </p>
                    <Button onClick={() => setIsBuilderOpen(true)} data-testid="button-create-first-sequence">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Sequence
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
