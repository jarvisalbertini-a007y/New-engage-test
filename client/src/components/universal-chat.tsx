import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MessageCircle, Send, X, Sparkles, Command, Loader2, Bot, User, Zap, ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useChatContext } from "@/contexts/chat-context";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  actions?: SuggestedAction[];
}

interface SuggestedAction {
  id: string;
  label: string;
  type: string;
  params?: Record<string, any>;
  requiresPermission?: string;
}

interface QuickAction {
  id: string;
  label: string;
  prompt: string;
  icon: typeof Zap;
}

const getQuickActionsForPage = (page: string, entity?: { type: string; id: string; data: any }): QuickAction[] => {
  const baseActions: QuickAction[] = [
    { id: "help", label: "How can I help?", prompt: "What can you help me with?", icon: Sparkles },
  ];

  const pageActions: Record<string, QuickAction[]> = {
    "/leads": [
      { id: "find-similar", label: "Find similar leads", prompt: "Find leads similar to the ones I'm viewing", icon: Zap },
      { id: "enrich", label: "Enrich this company", prompt: "Enrich the data for the selected company", icon: Zap },
      { id: "score-leads", label: "Score my leads", prompt: "Score and prioritize my current leads", icon: Zap },
    ],
    "/sequences": [
      { id: "create-sequence", label: "Create a sequence", prompt: "Help me create a new email sequence", icon: Zap },
      { id: "optimize", label: "Optimize this sequence", prompt: "Analyze and optimize my current sequence", icon: Zap },
    ],
    "/content-studio": [
      { id: "write-email", label: "Write an email", prompt: "Help me write a personalized email", icon: Zap },
      { id: "generate-template", label: "Generate template", prompt: "Generate an email template for outreach", icon: Zap },
    ],
    "/personas": [
      { id: "create-persona", label: "Create persona", prompt: "Help me create a buyer persona", icon: Zap },
      { id: "suggest-messaging", label: "Suggest messaging", prompt: "Suggest messaging for my personas", icon: Zap },
    ],
    "/analytics": [
      { id: "analyze-performance", label: "Analyze performance", prompt: "Analyze my outreach performance", icon: Zap },
      { id: "insights", label: "Get insights", prompt: "What insights can you give me from my data?", icon: Zap },
    ],
    "/visitors": [
      { id: "identify-visitors", label: "Identify visitors", prompt: "Help me identify high-intent visitors", icon: Zap },
      { id: "suggest-outreach", label: "Suggest outreach", prompt: "Suggest outreach for recent visitors", icon: Zap },
    ],
  };

  return [...(pageActions[page] || []), ...baseActions];
};

export function UniversalChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [location] = useLocation();
  
  const { currentPage, currentEntity } = useChatContext();
  const { user, isAuthenticated } = useAuth();
  
  const userRole = (user as any)?.role || "SDR";
  const isReadOnly = userRole === "ReadOnly";
  const isAdmin = userRole === "Owner" || userRole === "Admin";

  const quickActions = getQuickActionsForPage(currentPage || location, currentEntity);

  const { data: chatHistory } = useQuery({
    queryKey: ["/api/chat/history"],
    enabled: isAuthenticated && isOpen,
  });

  useEffect(() => {
    if (chatHistory && Array.isArray(chatHistory)) {
      setMessages(chatHistory.map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })));
    }
  }, [chatHistory]);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/chat/message", {
        message,
        context: {
          page: currentPage || location,
          entity: currentEntity,
          userRole,
        },
      });
      return response.json();
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
        actions: data.suggestedActions,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      queryClient.invalidateQueries({ queryKey: ["/api/chat/history"] });
    },
  });

  const executeActionMutation = useMutation({
    mutationFn: async (action: SuggestedAction) => {
      const response = await apiRequest("POST", "/api/chat/action", {
        actionId: action.id,
        actionType: action.type,
        params: action.params,
      });
      return response.json();
    },
    onSuccess: (data) => {
      const resultMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message || "Action completed successfully.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, resultMessage]);
    },
  });

  const handleSendMessage = useCallback(() => {
    if (!input.trim() || sendMessageMutation.isPending) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    sendMessageMutation.mutate(input);
    setInput("");
  }, [input, sendMessageMutation]);

  const handleQuickAction = useCallback((action: QuickAction) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: action.prompt,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    sendMessageMutation.mutate(action.prompt);
  }, [sendMessageMutation]);

  const handleExecuteAction = useCallback((action: SuggestedAction) => {
    if (isReadOnly && action.requiresPermission) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "You don't have permission to perform this action. Please contact an administrator.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }
    executeActionMutation.mutate(action);
  }, [isReadOnly, executeActionMutation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        setIsMinimized(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const renderMessage = (message: Message) => {
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
            isUser ? "bg-primary text-primary-foreground" : "bg-gradient-to-br from-violet-500 to-purple-600 text-white"
          )}>
            {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
        <div className={cn("flex flex-col max-w-[80%]", isUser ? "items-end" : "")}>
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
          {message.actions && message.actions.length > 0 && !isReadOnly && (
            <div className="flex flex-wrap gap-2 mt-2">
              {message.actions
                .filter(action => !action.requiresPermission || isAdmin || !isReadOnly)
                .map((action) => (
                  <Button
                    key={action.id}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1 bg-background/50 hover:bg-background"
                    onClick={() => handleExecuteAction(action)}
                    disabled={executeActionMutation.isPending}
                    data-testid={`chat-action-${action.id}`}
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
        {isOpen && !isMinimized && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-24 right-6 z-50 w-[400px] max-h-[600px] bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            data-testid="chat-panel"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">AI Assistant</h3>
                  <p className="text-[10px] text-muted-foreground">
                    {currentPage ? `Viewing: ${currentPage}` : "Ready to help"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsMinimized(true)}
                  data-testid="chat-minimize"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsOpen(false)}
                  data-testid="chat-close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4 max-h-[400px]">
              {messages.length === 0 ? (
                <div className="space-y-4">
                  <div className="text-center py-6">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="h-6 w-6 text-violet-500" />
                    </div>
                    <h4 className="font-medium text-sm mb-1">How can I help you today?</h4>
                    <p className="text-xs text-muted-foreground">
                      Ask me anything or try a quick action below
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1">
                      Quick Actions
                    </p>
                    <div className="grid gap-2">
                      {quickActions.slice(0, 4).map((action) => (
                        <button
                          key={action.id}
                          onClick={() => handleQuickAction(action)}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left group"
                          data-testid={`quick-action-${action.id}`}
                        >
                          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                            <action.icon className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-sm font-medium">{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {messages.map(renderMessage)}
                  {sendMessageMutation.isPending && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-3 mb-4"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            <div className="p-4 border-t border-border/50 bg-muted/20">
              {isReadOnly && (
                <div className="mb-2">
                  <Badge variant="secondary" className="text-[10px]">
                    Read-only mode - Actions disabled
                  </Badge>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask anything..."
                    className="pr-10 bg-background/50 border-border/50"
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                    disabled={sendMessageMutation.isPending}
                    data-testid="chat-input"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-muted-foreground">
                    <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border/50 bg-muted/50 px-1.5 text-[10px] font-medium">
                      <Command className="h-2.5 w-2.5" />K
                    </kbd>
                  </div>
                </div>
                <Button
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={!input.trim() || sendMessageMutation.isPending}
                  className="h-10 w-10 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                  data-testid="chat-send"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => {
          if (isMinimized) {
            setIsMinimized(false);
          } else {
            setIsOpen(!isOpen);
          }
        }}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all",
          "bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700",
          "hover:scale-105 active:scale-95"
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        data-testid="chat-toggle"
      >
        <AnimatePresence mode="wait">
          {isOpen && !isMinimized ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-6 w-6 text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageCircle className="h-6 w-6 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
        {!isOpen && messages.length > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-medium">
            {messages.length > 9 ? "9+" : messages.length}
          </span>
        )}
      </motion.button>
    </>
  );
}
