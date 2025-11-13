import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSequenceSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Mail, Phone, Linkedin, Clock, Edit, Trash2, Play, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import EmailComposer from "./email-composer";

interface SequenceStep {
  stepNumber: number;
  type: "email" | "linkedin" | "phone" | "wait";
  delay: number; // days
  subject?: string;
  template: string;
  isActive: boolean;
}

interface SequenceBuilderProps {
  personas: Array<any>;
  onSequenceCreated: (sequence: any) => void;
  initialData?: any;
}

export default function SequenceBuilder({ personas, onSequenceCreated, initialData }: SequenceBuilderProps) {
  const [steps, setSteps] = useState<SequenceStep[]>([
    {
      stepNumber: 1,
      type: "email",
      delay: 0,
      subject: "Introduction to {{company}}",
      template: "Hi {{firstName}},\n\nI hope this email finds you well...",
      isActive: true,
    }
  ]);
  const [isStepEditorOpen, setIsStepEditorOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<SequenceStep | null>(null);
  const [sequenceType, setSequenceType] = useState<"email_only" | "multi_channel">("email_only");
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(insertSequenceSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      status: "draft",
      steps: [],
      targets: {},
      // Don't set createdBy - let the backend handle it or set to null
    },
  });

  const { register, handleSubmit, setValue, watch } = form;

  const addStep = (type: SequenceStep["type"]) => {
    const newStep: SequenceStep = {
      stepNumber: steps.length + 1,
      type,
      delay: type === "wait" ? 1 : steps.length * 2, // Default delay
      subject: type === "email" ? `Follow up ${steps.length + 1}` : undefined,
      template: getDefaultTemplate(type),
      isActive: true,
    };
    setSteps([...steps, newStep]);
  };

  const getDefaultTemplate = (type: SequenceStep["type"]): string => {
    switch (type) {
      case "email":
        return "Hi {{firstName}},\n\nI wanted to follow up on my previous email...\n\nBest regards,\n{{senderName}}";
      case "linkedin":
        return "Hi {{firstName}}, I noticed we're both in the {{industry}} space. Would love to connect!";
      case "phone":
        return "Call script: Introduce yourself, reference previous emails, offer value proposition.";
      case "wait":
        return "Wait step - no action required";
      default:
        return "";
    }
  };

  const removeStep = (stepNumber: number) => {
    const filteredSteps = steps.filter(step => step.stepNumber !== stepNumber);
    // Renumber the remaining steps
    const renumberedSteps = filteredSteps.map((step, index) => ({
      ...step,
      stepNumber: index + 1,
    }));
    setSteps(renumberedSteps);
  };

  const editStep = (step: SequenceStep) => {
    setEditingStep(step);
    setIsStepEditorOpen(true);
  };

  const updateStep = (updatedStep: SequenceStep) => {
    setSteps(prev => prev.map(step => 
      step.stepNumber === updatedStep.stepNumber ? updatedStep : step
    ));
    setIsStepEditorOpen(false);
    setEditingStep(null);
  };

  const generateAISteps = async () => {
    try {
      const sequenceName = form.getValues("name") || "New Sequence";
      const sequenceDescription = form.getValues("description") || "";
      
      console.log("Generating AI steps with:", { sequenceName, sequenceDescription, sequenceType });
      
      const response = await apiRequest("POST", "/api/sequences/generate-steps", {
        name: sequenceName,
        description: sequenceDescription,
        sequenceType,
      });

      console.log("Response received successfully");

      const data = await response.json();
      console.log("Generated steps data:", data);
      
      if (!data.steps || !Array.isArray(data.steps)) {
        throw new Error("Invalid response format - missing steps array");
      }
      
      const aiSteps: SequenceStep[] = data.steps.map((step: any, index: number) => ({
        stepNumber: step.stepNumber || index + 1,
        type: step.type || "email",
        delay: step.delay || 0,
        subject: step.subject,
        template: step.template || step.content || "",
        isActive: step.isActive !== false,
      }));
      
      console.log("Processed AI steps:", aiSteps);
      setSteps(aiSteps);
      toast({
        title: "AI Steps Generated",
        description: `Successfully created ${aiSteps.length} steps for your sequence.`,
      });
    } catch (error) {
      console.error("Error generating AI steps:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate AI steps. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onSubmit = (data: any) => {
    // Transform steps to match API schema - convert template to body, remove UI-only fields
    const apiSteps = steps.map(({ template, stepNumber, isActive, ...rest }) => ({
      ...rest,
      body: template || "", // API expects 'body' not 'template'
    }));
    
    const sequenceData = {
      ...data,
      status: "draft", // Required field - sequences start as draft
      steps: apiSteps,
      targets: {
        sequenceType,
        stepCount: steps.length,
      }
    };
    
    console.log("Sending sequence data:", JSON.stringify(sequenceData, null, 2));
    onSequenceCreated(sequenceData);
  };

  const getStepIcon = (type: SequenceStep["type"]) => {
    switch (type) {
      case "email": return Mail;
      case "linkedin": return Linkedin;
      case "phone": return Phone;
      case "wait": return Clock;
      default: return Mail;
    }
  };

  const getStepColor = (type: SequenceStep["type"]) => {
    switch (type) {
      case "email": return "bg-chart-1/10 text-chart-1 border-chart-1/20";
      case "linkedin": return "bg-chart-2/10 text-chart-2 border-chart-2/20";
      case "phone": return "bg-chart-3/10 text-chart-3 border-chart-3/20";
      case "wait": return "bg-muted text-muted-foreground";
      default: return "bg-chart-1/10 text-chart-1 border-chart-1/20";
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Sequence Name</Label>
            <Input
              id="name"
              {...register("name", { required: true })}
              placeholder="e.g., Q1 SaaS Outreach"
              data-testid="input-sequence-name"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              {...register("description")}
              placeholder="Brief description of this sequence"
              data-testid="input-sequence-description"
            />
          </div>
        </div>

        {/* Sequence Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Sequence Configuration</CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={generateAISteps}
                  data-testid="button-ai-generate-steps"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  AI Generate
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Sequence Type</Label>
              <Select value={sequenceType} onValueChange={(value: any) => setSequenceType(value)}>
                <SelectTrigger data-testid="select-sequence-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email_only">Email Only</SelectItem>
                  <SelectItem value="multi_channel">Multi-Channel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Sequence Steps */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Sequence Steps ({steps.length})</CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addStep("email")}
                  data-testid="button-add-email-step"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Add Email
                </Button>
                {sequenceType === "multi_channel" && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addStep("linkedin")}
                      data-testid="button-add-linkedin-step"
                    >
                      <Linkedin className="h-4 w-4 mr-2" />
                      LinkedIn
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addStep("phone")}
                      data-testid="button-add-phone-step"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Phone
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addStep("wait")}
                      data-testid="button-add-wait-step"
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Wait
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {steps.length > 0 ? (
              <div className="space-y-4">
                {steps.map((step, index) => {
                  const StepIcon = getStepIcon(step.type);
                  return (
                    <div key={step.stepNumber} className="relative">
                      {/* Connection Line */}
                      {index < steps.length - 1 && (
                        <div className="absolute left-6 top-16 w-0.5 h-8 bg-border"></div>
                      )}
                      
                      <div className={`border rounded-lg p-4 ${getStepColor(step.type)}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            <div className="w-12 h-12 rounded-lg bg-background/80 flex items-center justify-center border">
                              <StepIcon className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h4 className="font-medium">
                                  Step {step.stepNumber}: {step.type.charAt(0).toUpperCase() + step.type.slice(1)}
                                </h4>
                                <Badge variant="outline" className="text-xs">
                                  {step.delay === 0 ? 'Immediate' : `${step.delay} day${step.delay > 1 ? 's' : ''} delay`}
                                </Badge>
                              </div>
                              {step.subject && (
                                <p className="font-medium text-sm mb-1">{step.subject}</p>
                              )}
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {step.template}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => editStep(step)}
                              data-testid={`button-edit-step-${step.stepNumber}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeStep(step.stepNumber)}
                              data-testid={`button-remove-step-${step.stepNumber}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <Mail className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No steps added</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first step to start building your sequence
                </p>
                <Button
                  type="button"
                  onClick={() => addStep("email")}
                  data-testid="button-add-first-step"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Step
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <Button type="button" variant="outline" data-testid="button-save-draft">
            Save as Draft
          </Button>
          <Button type="submit" data-testid="button-create-sequence">
            Create Sequence
          </Button>
        </div>
      </form>

      {/* Step Editor Dialog */}
      <Dialog open={isStepEditorOpen} onOpenChange={setIsStepEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Step {editingStep?.stepNumber}: {editingStep?.type}
            </DialogTitle>
          </DialogHeader>
          {editingStep && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Step Type</Label>
                  <Select 
                    value={editingStep.type} 
                    onValueChange={(value: any) => setEditingStep({...editingStep, type: value})}
                  >
                    <SelectTrigger data-testid="select-step-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="wait">Wait</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Delay (days)</Label>
                  <Input
                    type="number"
                    value={editingStep.delay}
                    onChange={(e) => setEditingStep({...editingStep, delay: parseInt(e.target.value) || 0})}
                    data-testid="input-step-delay"
                  />
                </div>
              </div>

              {editingStep.type === "email" && (
                <div>
                  <Label>Subject Line</Label>
                  <Input
                    value={editingStep.subject || ""}
                    onChange={(e) => setEditingStep({...editingStep, subject: e.target.value})}
                    placeholder="Email subject..."
                    data-testid="input-step-subject"
                  />
                </div>
              )}

              <div>
                <Label>Template</Label>
                <Textarea
                  value={editingStep.template}
                  onChange={(e) => setEditingStep({...editingStep, template: e.target.value})}
                  className="h-40"
                  placeholder="Enter step content..."
                  data-testid="textarea-step-template"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsStepEditorOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  onClick={() => updateStep(editingStep)}
                  data-testid="button-update-step"
                >
                  Update Step
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
