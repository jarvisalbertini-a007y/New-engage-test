import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Plus, Edit, Trash2, Users, Target, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { insertPersonaSchema } from "@shared/schema";
import { zodResolver } from "@hookform/resolvers/zod";

export default function Personas() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: personas, isLoading } = useQuery({
    queryKey: ["/api/personas"],
  });

  const createPersonaMutation = useMutation({
    mutationFn: api.createPersona,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personas"] });
      setIsCreateOpen(false);
      reset();
      toast({
        title: "Persona Created",
        description: "Your new persona has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create persona. Please try again.",
        variant: "destructive",
      });
    },
  });

  const form = useForm({
    resolver: zodResolver(insertPersonaSchema.extend({
      targetTitles: insertPersonaSchema.shape.targetTitles.optional(),
      industries: insertPersonaSchema.shape.industries.optional(),
      companySizes: insertPersonaSchema.shape.companySizes.optional(),
    })),
    defaultValues: {
      name: "",
      description: "",
      targetTitles: [] as string[],
      industries: [] as string[],
      companySizes: [] as string[],
      valuePropositions: {},
      toneGuidelines: {},
    },
  });

  const { register, handleSubmit, reset, setValue, watch } = form;

  const onSubmit = (data: any) => {
    const personaData = {
      ...data,
      createdBy: "current-user", // In a real app, this would come from auth context
    };
    createPersonaMutation.mutate(personaData);
  };

  const addTitle = (title: string) => {
    const currentTitles = watch("targetTitles") || [];
    if (title.trim() && !currentTitles.includes(title.trim())) {
      setValue("targetTitles", [...currentTitles, title.trim()]);
    }
  };

  const removeTitle = (title: string) => {
    const currentTitles = watch("targetTitles") || [];
    setValue("targetTitles", currentTitles.filter(t => t !== title));
  };

  const addIndustry = (industry: string) => {
    const currentIndustries = watch("industries") || [];
    if (industry.trim() && !currentIndustries.includes(industry.trim())) {
      setValue("industries", [...currentIndustries, industry.trim()]);
    }
  };

  const removeIndustry = (industry: string) => {
    const currentIndustries = watch("industries") || [];
    setValue("industries", currentIndustries.filter(i => i !== industry));
  };

  const addCompanySize = (size: string) => {
    const currentSizes = watch("companySizes") || [];
    if (size && !currentSizes.includes(size)) {
      setValue("companySizes", [...currentSizes, size]);
    }
  };

  const removeCompanySize = (size: string) => {
    const currentSizes = watch("companySizes") || [];
    setValue("companySizes", currentSizes.filter(s => s !== size));
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Personas</h1>
            <p className="text-muted-foreground">Define target audiences and messaging strategies</p>
          </div>
          <div className="flex items-center space-x-4">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-persona">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Persona
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Persona</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Persona Name</Label>
                      <Input
                        id="name"
                        {...register("name", { required: true })}
                        placeholder="e.g., SaaS Decision Makers"
                        data-testid="input-persona-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        {...register("description")}
                        placeholder="Brief description of this persona"
                        data-testid="input-persona-description"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Target Job Titles</Label>
                    <div className="space-y-2">
                      <div className="flex space-x-2">
                        <Input
                          placeholder="Add job title (e.g., VP of Sales)"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addTitle(e.currentTarget.value);
                              e.currentTarget.value = '';
                            }
                          }}
                          data-testid="input-add-title"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(watch("targetTitles") || []).map((title: string) => (
                          <Badge key={title} variant="secondary" className="flex items-center gap-1">
                            {title}
                            <button
                              type="button"
                              onClick={() => removeTitle(title)}
                              className="ml-1 hover:text-destructive"
                              data-testid={`button-remove-title-${title}`}
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Target Industries</Label>
                    <div className="space-y-2">
                      <div className="flex space-x-2">
                        <Input
                          placeholder="Add industry (e.g., SaaS, Fintech)"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addIndustry(e.currentTarget.value);
                              e.currentTarget.value = '';
                            }
                          }}
                          data-testid="input-add-industry"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(watch("industries") || []).map((industry: string) => (
                          <Badge key={industry} variant="secondary" className="flex items-center gap-1">
                            {industry}
                            <button
                              type="button"
                              onClick={() => removeIndustry(industry)}
                              className="ml-1 hover:text-destructive"
                              data-testid={`button-remove-industry-${industry}`}
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Company Sizes</Label>
                    <div className="space-y-2">
                      <Select onValueChange={addCompanySize}>
                        <SelectTrigger data-testid="select-company-size">
                          <SelectValue placeholder="Add company size" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-10">1-10 employees</SelectItem>
                          <SelectItem value="11-50">11-50 employees</SelectItem>
                          <SelectItem value="51-200">51-200 employees</SelectItem>
                          <SelectItem value="201-500">201-500 employees</SelectItem>
                          <SelectItem value="501-1000">501-1000 employees</SelectItem>
                          <SelectItem value="1000+">1000+ employees</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex flex-wrap gap-2">
                        {(watch("companySizes") || []).map((size: string) => (
                          <Badge key={size} variant="secondary" className="flex items-center gap-1">
                            {size}
                            <button
                              type="button"
                              onClick={() => removeCompanySize(size)}
                              className="ml-1 hover:text-destructive"
                              data-testid={`button-remove-size-${size}`}
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="valueProps">Value Propositions</Label>
                    <Textarea
                      id="valueProps"
                      placeholder="Describe the key value propositions for this persona. For example: Increase sales efficiency by 40%, reduce manual work, improve team collaboration."
                      onChange={(e) => {
                        // Store as a simple object with the text
                        setValue("valuePropositions", { 
                          description: e.target.value 
                        });
                      }}
                      data-testid="textarea-value-props"
                    />
                  </div>

                  <div>
                    <Label>Tone & Style (Select Multiple)</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {['Professional', 'Casual', 'Friendly', 'Urgent', 'Consultative', 'Educational', 'Conversational', 'Executive', 'Technical'].map((tone) => (
                        <label key={tone} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            value={tone.toLowerCase()}
                            onChange={(e) => {
                              const currentGuidelines = watch("toneGuidelines") || {};
                              const selectedTones = currentGuidelines.tones || [];
                              
                              if (e.target.checked) {
                                setValue("toneGuidelines", {
                                  ...currentGuidelines,
                                  tones: [...selectedTones, e.target.value]
                                });
                              } else {
                                setValue("toneGuidelines", {
                                  ...currentGuidelines,
                                  tones: selectedTones.filter((t: string) => t !== e.target.value)
                                });
                              }
                            }}
                            className="h-4 w-4"
                            data-testid={`checkbox-tone-${tone.toLowerCase()}`}
                          />
                          <span className="text-sm">{tone}</span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-3">
                      <Label htmlFor="additionalGuidelines">Additional Guidelines (Optional)</Label>
                      <Textarea
                        id="additionalGuidelines"
                        placeholder="Any additional tone or style guidelines for this persona..."
                        onChange={(e) => {
                          const currentGuidelines = watch("toneGuidelines") || {};
                          setValue("toneGuidelines", {
                            ...currentGuidelines,
                            additional: e.target.value
                          });
                        }}
                        data-testid="textarea-additional-guidelines"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3">
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createPersonaMutation.isPending} data-testid="button-save-persona">
                      {createPersonaMutation.isPending ? "Creating..." : "Create Persona"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Personas</p>
                  <p className="text-3xl font-bold" data-testid="text-total-personas">
                    {personas?.length || 0}
                  </p>
                </div>
                <Users className="h-8 w-8 text-chart-1" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Sequences</p>
                  <p className="text-3xl font-bold text-chart-2" data-testid="text-active-sequences">
                    0
                  </p>
                </div>
                <Target className="h-8 w-8 text-chart-2" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Messages Generated</p>
                  <p className="text-3xl font-bold text-chart-3" data-testid="text-messages-generated">
                    0
                  </p>
                </div>
                <MessageSquare className="h-8 w-8 text-chart-3" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Personas Grid */}
        <Card>
          <CardHeader>
            <CardTitle>Your Personas ({personas?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading personas...</div>
            ) : personas?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {personas.map((persona: any) => (
                  <Card key={persona.id} className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg" data-testid={`text-persona-name-${persona.id}`}>
                            {persona.name}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {persona.description || "No description"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingPersona(persona)}
                          data-testid={`button-edit-persona-${persona.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">TARGET TITLES</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {persona.targetTitles?.slice(0, 3).map((title: string) => (
                            <Badge key={title} variant="outline" className="text-xs">
                              {title}
                            </Badge>
                          ))}
                          {persona.targetTitles?.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{persona.targetTitles.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">INDUSTRIES</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {persona.industries?.slice(0, 2).map((industry: string) => (
                            <Badge key={industry} variant="secondary" className="text-xs">
                              {industry}
                            </Badge>
                          ))}
                          {persona.industries?.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{persona.industries.length - 2} more
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-xs font-medium text-muted-foreground">COMPANY SIZES</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {persona.companySizes?.slice(0, 2).map((size: string) => (
                            <Badge key={size} variant="outline" className="text-xs">
                              {size}
                            </Badge>
                          ))}
                          {persona.companySizes?.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{persona.companySizes.length - 2} more
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2">
                        <div className="text-xs text-muted-foreground">
                          {Math.floor(Math.random() * 50 + 10)} sequences using
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-use-persona-${persona.id}`}
                        >
                          Use in Content
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
                <h3 className="text-lg font-medium mb-2">No personas created</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first persona to start generating targeted content
                </p>
                <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first-persona">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Persona
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
