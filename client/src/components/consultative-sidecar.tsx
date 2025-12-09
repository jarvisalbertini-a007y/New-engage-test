import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Brain, Send, X, Loader2, Bot, User, Sparkles, ArrowRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useChatContext } from "@/contexts/chat-context";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface AdvisorMessage {
  id: string;
  role: "user" | "advisor";
  content: string;
  timestamp: Date;
  dataCitations?: string[];
  suggestedActions?: { label: string; link: string }[];
}

interface SuggestedQuestion {
  id: string;
  text: string;
  category: string;
}

interface DashboardStats {
  replyRate?: number;
  aiSequences?: number;
  activeVisitors?: number;
  pipelineValue?: number;
}

const suggestedQuestions: SuggestedQuestion[] = [
  { id: "1", text: "What's working for companies like mine?", category: "strategy" },
  { id: "2", text: "How should I approach enterprise accounts?", category: "targeting" },
  { id: "3", text: "What email length performs best?", category: "content" },
  { id: "4", text: "When should I follow up after no response?", category: "timing" },
  { id: "5", text: "Should I target CFOs or VPs of Finance?", category: "targeting" },
  { id: "6", text: "What's the best approach for Series B companies?", category: "strategy" },
  { id: "7", text: "How aggressive should my follow-up cadence be?", category: "timing" },
];

export function ConsultativeSidecar() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [location] = useLocation();
  
  const { currentPage } = useChatContext();
  const { isAuthenticated } = useAuth();

  const { data: dashboardStats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    enabled: isAuthenticated && isOpen,
  });

  const { data: campaigns } = useQuery({
    queryKey: ["/api/sequences"],
    enabled: isAuthenticated && isOpen,
  });

  const askAdvisorMutation = useMutation({
    mutationFn: async (question: string) => {
      const context = {
        page: currentPage || location,
        stats: dashboardStats,
        campaignCount: Array.isArray(campaigns) ? campaigns.length : 0,
        activeCampaigns: Array.isArray(campaigns) ? campaigns.filter((c: any) => c.status === 'active').length : 0,
      };
      
      const response = await apiRequest("POST", "/api/advisor/ask", {
        question,
        context,
      });
      return response.json();
    },
    onSuccess: (data) => {
      const advisorMessage: AdvisorMessage = {
        id: crypto.randomUUID(),
        role: "advisor",
        content: data.advice,
        timestamp: new Date(),
        dataCitations: data.dataCitations,
        suggestedActions: data.suggestedActions,
      };
      setMessages((prev) => [...prev, advisorMessage]);
    },
  });

  const handleSendMessage = useCallback(() => {
    if (!input.trim() || askAdvisorMutation.isPending) return;

    const userMessage: AdvisorMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    askAdvisorMutation.mutate(input);
    setInput("");
  }, [input, askAdvisorMutation]);

  const handleSuggestedQuestion = useCallback((question: SuggestedQuestion) => {
    const userMessage: AdvisorMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question.text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    askAdvisorMutation.mutate(question.text);
  }, [askAdvisorMutation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const renderMessage = (message: AdvisorMessage) => {
    const isUser = message.role === "user";

    return (
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("flex gap-3 mb-4", isUser ? "flex-row-reverse" : "")}
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className={cn(
            "text-xs",
            isUser ? "bg-primary text-primary-foreground" : "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
          )}>
            {isUser ? <User className="h-4 w-4" /> : <Brain className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
        <div className={cn("flex flex-col max-w-[85%]", isUser ? "items-end" : "")}>
          <div
            className={cn(
              "rounded-2xl px-4 py-2.5 text-sm",
              isUser
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-muted/50 text-foreground rounded-tl-sm"
            )}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          {message.dataCitations && message.dataCitations.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {message.dataCitations.map((citation, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full"
                >
                  <TrendingUp className="h-2.5 w-2.5" />
                  {citation}
                </span>
              ))}
            </div>
          )}
          {message.suggestedActions && message.suggestedActions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {message.suggestedActions.map((action, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 bg-background/50 hover:bg-background"
                  onClick={() => window.location.href = action.link}
                  data-testid={`advisor-action-${idx}`}
                >
                  <ArrowRight className="h-3 w-3" />
                  {action.label}
                </Button>
              ))}
            </div>
          )}
          <span className="text-[10px] text-muted-foreground mt-1">
            {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </motion.div>
    );
  };

  if (!isAuthenticated) return null;

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-3 py-3 rounded-l-xl shadow-lg hover:shadow-xl transition-all group"
            data-testid="advisor-toggle"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Brain className="h-5 w-5" />
            </motion.div>
            <span className="text-sm font-medium writing-mode-vertical hidden lg:block rotate-180" style={{ writingMode: 'vertical-rl' }}>
              Ask Strategy
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className="w-[400px] sm:w-[450px] p-0 bg-background/95 backdrop-blur-xl border-l border-border/50 flex flex-col"
          data-testid="advisor-panel"
        >
          <SheetHeader className="px-6 py-4 border-b border-border/50 bg-gradient-to-r from-amber-500/10 to-orange-600/10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <SheetTitle className="text-lg font-semibold">Strategic Advisor</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Ask me anything about sales strategy
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="space-y-6">
                <div className="text-center py-8">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="h-8 w-8 text-amber-500" />
                  </div>
                  <h4 className="font-medium text-base mb-2">Sales Strategy Expert</h4>
                  <p className="text-sm text-muted-foreground max-w-[280px] mx-auto">
                    20+ years of B2B sales experience at your fingertips. Ask about targeting, messaging, cadence, or any strategic question.
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-1">
                    Suggested Questions
                  </p>
                  <div className="grid gap-2">
                    {suggestedQuestions.slice(0, 5).map((question) => (
                      <button
                        key={question.id}
                        onClick={() => handleSuggestedQuestion(question)}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left group border border-transparent hover:border-amber-500/20"
                        data-testid={`suggested-question-${question.id}`}
                      >
                        <div className="h-8 w-8 rounded-md bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors shrink-0">
                          <Brain className="h-4 w-4 text-amber-500" />
                        </div>
                        <span className="text-sm">{question.text}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {dashboardStats && (
                  <div className="bg-muted/20 rounded-lg p-4 border border-border/30">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
                      Your Current Performance
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Reply Rate</p>
                        <p className="font-semibold">{dashboardStats.replyRate ?? 0}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Active Sequences</p>
                        <p className="font-semibold">{dashboardStats.aiSequences ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Active Visitors</p>
                        <p className="font-semibold">{dashboardStats.activeVisitors ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Pipeline Value</p>
                        <p className="font-semibold">${(dashboardStats.pipelineValue ?? 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {messages.map(renderMessage)}
                {askAdvisorMutation.isPending && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-3 mb-4"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
                        <Brain className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-amber-500/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-amber-500/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-amber-500/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t border-border/50 bg-muted/10">
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a sales strategy question..."
                className="flex-1 bg-background/50 border-border/50"
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                disabled={askAdvisorMutation.isPending}
                data-testid="advisor-input"
              />
              <Button
                size="icon"
                onClick={handleSendMessage}
                disabled={!input.trim() || askAdvisorMutation.isPending}
                className="h-10 w-10 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                data-testid="advisor-send"
              >
                {askAdvisorMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
