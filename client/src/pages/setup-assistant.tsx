import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot, Send, User, CheckCircle, Circle, ChevronRight,
  Settings, Database, Mail, Users, Target, Zap,
  Calendar, Globe, Phone, MessageSquare, Loader2,
  Sparkles, ArrowRight, HelpCircle, BookOpen, RefreshCw
} from "lucide-react";

// Setup flows
const setupFlows = {
  emailConfig: {
    name: "Email Configuration",
    icon: Mail,
    steps: [
      { id: "provider", question: "Which email provider do you use?", type: "choice", options: ["Gmail", "Outlook", "Custom SMTP", "Other"] },
      { id: "domain", question: "What's your email domain?", type: "input", placeholder: "company.com" },
      { id: "warmup", question: "Would you like to set up email warmup?", type: "choice", options: ["Yes, recommended", "No, skip for now"] },
      { id: "signature", question: "Would you like help creating an email signature?", type: "choice", options: ["Yes", "No, I have one"] },
      { id: "templates", question: "How many email templates would you like to start with?", type: "choice", options: ["5 (Recommended)", "10", "20", "Custom"] }
    ]
  },
  leadImport: {
    name: "Lead Import",
    icon: Database,
    steps: [
      { id: "source", question: "Where are your leads coming from?", type: "choice", options: ["CRM", "Spreadsheet", "Manual Entry", "API"] },
      { id: "count", question: "How many leads do you want to import?", type: "input", placeholder: "e.g., 500" },
      { id: "fields", question: "Which fields do you have?", type: "multichoice", options: ["Name", "Email", "Company", "Phone", "LinkedIn", "Title"] },
      { id: "enrichment", question: "Would you like to enrich leads with additional data?", type: "choice", options: ["Yes, enrich all", "Yes, selective", "No"] },
      { id: "scoring", question: "Should we apply lead scoring?", type: "choice", options: ["Yes, use AI scoring", "Yes, custom rules", "No"] }
    ]
  },
  sequenceSetup: {
    name: "Sequence Setup",
    icon: Zap,
    steps: [
      { id: "type", question: "What type of sequence do you want to create?", type: "choice", options: ["Cold Outreach", "Follow-up", "Re-engagement", "Onboarding"] },
      { id: "channels", question: "Which channels will you use?", type: "multichoice", options: ["Email", "LinkedIn", "Phone", "SMS"] },
      { id: "touchpoints", question: "How many touchpoints?", type: "choice", options: ["5", "7", "10", "Custom"] },
      { id: "timing", question: "How should we space the touchpoints?", type: "choice", options: ["Aggressive (2-3 days)", "Moderate (3-5 days)", "Conservative (5-7 days)"] },
      { id: "personalization", question: "Level of personalization?", type: "choice", options: ["Full AI personalization", "Template with variables", "Static templates"] }
    ]
  },
  teamSetup: {
    name: "Team Setup",
    icon: Users,
    steps: [
      { id: "size", question: "How many team members?", type: "input", placeholder: "e.g., 5" },
      { id: "roles", question: "What roles do you have?", type: "multichoice", options: ["SDR", "AE", "Manager", "Executive", "Marketing"] },
      { id: "territories", question: "How do you assign territories?", type: "choice", options: ["By region", "By industry", "By company size", "Round-robin", "No territories"] },
      { id: "permissions", question: "Permission model?", type: "choice", options: ["Open (all see everything)", "Team-based", "Hierarchical", "Custom"] },
      { id: "goals", question: "Set team goals?", type: "choice", options: ["Yes, let's set quotas", "Yes, activity goals", "Both", "Skip for now"] }
    ]
  },
  aiTraining: {
    name: "AI Training",
    icon: Sparkles,
    steps: [
      { id: "industry", question: "What industry are you in?", type: "input", placeholder: "e.g., SaaS, Healthcare, Finance" },
      { id: "buyer", question: "Who is your ideal buyer?", type: "input", placeholder: "e.g., VP Sales, CTO, Marketing Manager" },
      { id: "product", question: "Describe your product/service in one sentence", type: "input", placeholder: "We help companies..." },
      { id: "tone", question: "What tone should the AI use?", type: "choice", options: ["Professional", "Friendly", "Casual", "Technical"] },
      { id: "examples", question: "Would you like to provide example emails for training?", type: "choice", options: ["Yes, I have examples", "No, use defaults"] }
    ]
  }
};

// Message types
interface Message {
  id: string;
  type: 'assistant' | 'user';
  content: string;
  options?: string[];
  input?: boolean;
  multichoice?: boolean;
}

// Flow state
interface FlowState {
  currentFlow: string | null;
  currentStep: number;
  responses: Record<string, any>;
  completed: string[];
}

export function SetupAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "👋 Hi! I'm your AI Setup Assistant. I'll help you configure your sales engagement platform step by step. What would you like to set up first?",
      options: Object.keys(setupFlows).map(key => setupFlows[key as keyof typeof setupFlows].name)
    }
  ]);
  
  const [input, setInput] = useState("");
  const [flowState, setFlowState] = useState<FlowState>({
    currentFlow: null,
    currentStep: 0,
    responses: {},
    completed: []
  });
  
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleOptionSelect = (option: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: option
    };
    setMessages(prev => [...prev, userMessage]);

    // Handle flow selection or step response
    if (!flowState.currentFlow) {
      // Starting a new flow
      const flowKey = Object.keys(setupFlows).find(
        key => setupFlows[key as keyof typeof setupFlows].name === option
      );
      
      if (flowKey) {
        startFlow(flowKey);
      }
    } else {
      // Continuing current flow
      handleFlowResponse(option);
    }
  };

  const handleMultiSelect = (option: string) => {
    setSelectedOptions(prev => 
      prev.includes(option) 
        ? prev.filter(o => o !== option)
        : [...prev, option]
    );
  };

  const submitMultiSelect = () => {
    if (selectedOptions.length > 0) {
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: selectedOptions.join(", ")
      };
      setMessages(prev => [...prev, userMessage]);
      handleFlowResponse(selectedOptions);
      setSelectedOptions([]);
    }
  };

  const handleInputSubmit = () => {
    if (input.trim()) {
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: input
      };
      setMessages(prev => [...prev, userMessage]);
      handleFlowResponse(input);
      setInput("");
    }
  };

  const startFlow = (flowKey: string) => {
    const flow = setupFlows[flowKey as keyof typeof setupFlows];
    setFlowState({
      currentFlow: flowKey,
      currentStep: 0,
      responses: {},
      completed: flowState.completed
    });

    // Show first step
    setTimeout(() => {
      const firstStep = flow.steps[0];
      const assistantMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: firstStep.question,
        options: firstStep.type === 'choice' ? firstStep.options : undefined,
        input: firstStep.type === 'input',
        multichoice: firstStep.type === 'multichoice'
      };
      
      if (firstStep.type === 'multichoice' && firstStep.options) {
        assistantMessage.content += " (Select all that apply)";
        assistantMessage.options = firstStep.options;
      }
      
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1000);
    
    setIsTyping(true);
  };

  const handleFlowResponse = (response: any) => {
    if (!flowState.currentFlow) return;

    const flow = setupFlows[flowState.currentFlow as keyof typeof setupFlows];
    const currentStep = flow.steps[flowState.currentStep];
    
    // Save response
    const newResponses = {
      ...flowState.responses,
      [currentStep.id]: response
    };

    // Check if flow is complete
    if (flowState.currentStep >= flow.steps.length - 1) {
      completeFlow(newResponses);
    } else {
      // Move to next step
      const nextStepIndex = flowState.currentStep + 1;
      const nextStep = flow.steps[nextStepIndex];
      
      setFlowState({
        ...flowState,
        currentStep: nextStepIndex,
        responses: newResponses
      });

      // Show next question
      setIsTyping(true);
      setTimeout(() => {
        const assistantMessage: Message = {
          id: Date.now().toString(),
          type: 'assistant',
          content: nextStep.question,
          options: nextStep.type === 'choice' ? nextStep.options : undefined,
          input: nextStep.type === 'input',
          multichoice: nextStep.type === 'multichoice'
        };
        
        if (nextStep.type === 'multichoice' && nextStep.options) {
          assistantMessage.content += " (Select all that apply)";
          assistantMessage.options = nextStep.options;
        }
        
        setMessages(prev => [...prev, assistantMessage]);
        setIsTyping(false);
      }, 1000);
    }
  };

  const completeFlow = (responses: Record<string, any>) => {
    const flow = setupFlows[flowState.currentFlow as keyof typeof setupFlows];
    
    setIsTyping(true);
    setTimeout(() => {
      // Generate summary
      const summary = generateFlowSummary(flowState.currentFlow!, responses);
      
      const completionMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `✅ Perfect! I've completed the ${flow.name} setup. ${summary}\n\nWhat would you like to set up next?`,
        options: Object.keys(setupFlows)
          .filter(key => !flowState.completed.includes(key) && key !== flowState.currentFlow)
          .map(key => setupFlows[key as keyof typeof setupFlows].name)
      };
      
      setMessages(prev => [...prev, completionMessage]);
      setIsTyping(false);
      
      // Reset flow state
      setFlowState({
        currentFlow: null,
        currentStep: 0,
        responses: {},
        completed: [...flowState.completed, flowState.currentFlow!]
      });
    }, 1500);
  };

  const generateFlowSummary = (flowKey: string, responses: Record<string, any>): string => {
    switch(flowKey) {
      case 'emailConfig':
        return `Your ${responses.provider} email is configured with domain ${responses.domain}. ${responses.warmup?.includes('Yes') ? 'Email warmup is active.' : ''} ${responses.templates} templates are ready to use.`;
      case 'leadImport':
        return `Ready to import ${responses.count} leads from ${responses.source}. Fields mapped: ${Array.isArray(responses.fields) ? responses.fields.join(', ') : responses.fields}. ${responses.enrichment?.includes('Yes') ? 'Enrichment enabled.' : ''}`;
      case 'sequenceSetup':
        return `Your ${responses.type} sequence is ready with ${responses.touchpoints} touchpoints across ${Array.isArray(responses.channels) ? responses.channels.join(', ') : responses.channels}. ${responses.personalization} is enabled.`;
      case 'teamSetup':
        return `Team of ${responses.size} members configured with ${Array.isArray(responses.roles) ? responses.roles.join(', ') : responses.roles} roles. Territory assignment: ${responses.territories}. Permissions: ${responses.permissions}.`;
      case 'aiTraining':
        return `AI trained for ${responses.industry} industry targeting ${responses.buyer}. Communication tone set to ${responses.tone}. The AI understands: "${responses.product}"`;
      default:
        return "Configuration complete!";
    }
  };

  const resetChat = () => {
    setMessages([
      {
        id: '1',
        type: 'assistant',
        content: "👋 Hi! I'm your AI Setup Assistant. I'll help you configure your sales engagement platform step by step. What would you like to set up first?",
        options: Object.keys(setupFlows).map(key => setupFlows[key as keyof typeof setupFlows].name)
      }
    ]);
    setFlowState({
      currentFlow: null,
      currentStep: 0,
      responses: {},
      completed: []
    });
    setInput("");
    setSelectedOptions([]);
  };

  // Progress calculation
  const totalSteps = Object.values(setupFlows).reduce((acc, flow) => acc + flow.steps.length, 0);
  const completedSteps = flowState.completed.reduce((acc, flowKey) => {
    const flow = setupFlows[flowKey as keyof typeof setupFlows];
    return acc + flow.steps.length;
  }, 0) + (flowState.currentFlow ? flowState.currentStep : 0);
  const progress = (completedSteps / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl mb-2 flex items-center gap-2">
              <Bot className="h-8 w-8 text-primary" />
              Conversational Setup Assistant
            </h1>
            <p className="text-muted-foreground">
              Let me help you configure your sales platform through a simple conversation
            </p>
          </div>
          <Button variant="outline" onClick={resetChat} data-testid="button-reset">
            <RefreshCw className="h-4 w-4 mr-2" />
            Start Over
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Setup Progress */}
          <div className="md:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Setup Progress</CardTitle>
                <CardDescription>Track your configuration journey</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Overall Progress</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                
                <div className="space-y-3">
                  {Object.entries(setupFlows).map(([key, flow]) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        flowState.completed.includes(key) 
                          ? 'bg-green-500/10 text-green-500'
                          : flowState.currentFlow === key
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <flow.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{flow.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {flowState.completed.includes(key) 
                            ? 'Completed'
                            : flowState.currentFlow === key
                            ? `Step ${flowState.currentStep + 1}/${flow.steps.length}`
                            : 'Not started'}
                        </p>
                      </div>
                      {flowState.completed.includes(key) && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  Quick Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  • Answer questions to configure features
                </div>
                <div className="text-sm text-muted-foreground">
                  • You can skip steps and return later
                </div>
                <div className="text-sm text-muted-foreground">
                  • AI will provide smart defaults
                </div>
                <div className="text-sm text-muted-foreground">
                  • Complete all modules for best results
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chat Interface */}
          <Card className="md:col-span-2 flex flex-col h-[700px]">
            <CardHeader className="border-b">
              <CardTitle>Setup Chat</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              {/* Messages */}
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex gap-2 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          message.type === 'user' ? 'bg-primary/10' : 'bg-muted'
                        }`}>
                          {message.type === 'user' ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <Bot className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className={`rounded-lg p-3 ${
                          message.type === 'user' 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <p className="text-sm whitespace-pre-line">{message.content}</p>
                          
                          {/* Options for choice questions */}
                          {message.options && !message.multichoice && (
                            <div className="mt-3 space-y-2">
                              {message.options.map((option) => (
                                <Button
                                  key={option}
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-start"
                                  onClick={() => handleOptionSelect(option)}
                                  data-testid={`option-${option.toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                  {option}
                                </Button>
                              ))}
                            </div>
                          )}
                          
                          {/* Multi-choice options */}
                          {message.multichoice && message.options && (
                            <div className="mt-3 space-y-2">
                              {message.options.map((option) => (
                                <label
                                  key={option}
                                  className="flex items-center space-x-2 cursor-pointer hover:bg-background/50 p-2 rounded"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedOptions.includes(option)}
                                    onChange={() => handleMultiSelect(option)}
                                    className="rounded border-gray-300"
                                  />
                                  <span className="text-sm">{option}</span>
                                </label>
                              ))}
                              <Button
                                size="sm"
                                onClick={submitMultiSelect}
                                disabled={selectedOptions.length === 0}
                                data-testid="button-submit-multi"
                              >
                                Continue
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Typing indicator */}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="flex gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                        <div className="bg-muted rounded-lg p-3">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              {/* Input area */}
              {messages[messages.length - 1]?.input && (
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleInputSubmit()}
                      placeholder={messages[messages.length - 1].content.includes("domain") ? "company.com" : "Type your answer..."}
                      data-testid="input-chat"
                    />
                    <Button onClick={handleInputSubmit} disabled={!input.trim()} data-testid="button-send">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Completed Setups Summary */}
        {flowState.completed.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Completed Configurations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {flowState.completed.map(flowKey => {
                  const flow = setupFlows[flowKey as keyof typeof setupFlows];
                  return (
                    <div key={flowKey} className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                      <flow.icon className="h-5 w-5 text-green-500" />
                      <div className="flex-1">
                        <p className="font-medium">{flow.name}</p>
                        <p className="text-sm text-muted-foreground">Successfully configured</p>
                      </div>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}