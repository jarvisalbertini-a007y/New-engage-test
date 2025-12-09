import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Command, Clock, Loader2, Search, Target, Users, Mail, Pause, ArrowRight, X, Plus, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface ParsedCommand {
  intent: string;
  filters: Record<string, any>;
  suggestedAction: string;
  confidence: number;
  resultCount?: number;
  resultSummary?: string;
}

interface CommandHistoryItem {
  id: string;
  command: string;
  result: ParsedCommand | null;
  timestamp: Date;
}

const exampleCommands = [
  {
    text: "Find CTOs at fintech startups worried about security",
    icon: Target,
  },
  {
    text: "Target VPs of Sales who just posted about hiring SDRs",
    icon: Users,
  },
  {
    text: "Build a follow-up sequence for webinar no-shows",
    icon: Mail,
  },
  {
    text: "Pause campaigns with less than 10% open rate",
    icon: Pause,
  },
];

export function NLPCommandBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [command, setCommand] = useState("");
  const [commandHistory, setCommandHistory] = useState<CommandHistoryItem[]>(() => {
    const saved = localStorage.getItem("nlp-command-history");
    return saved ? JSON.parse(saved) : [];
  });
  const [parsedResult, setParsedResult] = useState<ParsedCommand | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const parseCommandMutation = useMutation({
    mutationFn: async (commandText: string) => {
      const res = await apiRequest("POST", "/api/nlp/parse-command", { command: commandText });
      return res.json() as Promise<ParsedCommand>;
    },
    onSuccess: (data, commandText) => {
      setParsedResult(data);
      const newHistoryItem: CommandHistoryItem = {
        id: Date.now().toString(),
        command: commandText,
        result: data,
        timestamp: new Date(),
      };
      const updatedHistory = [newHistoryItem, ...commandHistory].slice(0, 5);
      setCommandHistory(updatedHistory);
      localStorage.setItem("nlp-command-history", JSON.stringify(updatedHistory));
    },
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (command.trim()) {
      parseCommandMutation.mutate(command.trim());
    }
  }, [command, parseCommandMutation]);

  const handleExampleClick = useCallback((exampleText: string) => {
    setCommand(exampleText);
    parseCommandMutation.mutate(exampleText);
  }, [parseCommandMutation]);

  const handleHistoryClick = useCallback((historyItem: CommandHistoryItem) => {
    setCommand(historyItem.command);
    if (historyItem.result) {
      setParsedResult(historyItem.result);
    }
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setCommand("");
    setParsedResult(null);
  }, []);

  const handleAction = useCallback((action: string) => {
    console.log("Action triggered:", action, parsedResult);
    handleClose();
  }, [parsedResult, handleClose]);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="gap-2 text-muted-foreground hover:text-foreground"
        data-testid="button-open-command-bar"
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">AI Command</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden" data-testid="dialog-nlp-command">
          <DialogHeader className="sr-only">
            <DialogTitle>AI Command Bar</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit}>
            <div className="flex items-center border-b px-4 py-3">
              <motion.div
                animate={parseCommandMutation.isPending ? { rotate: 360 } : {}}
                transition={{ duration: 1, repeat: parseCommandMutation.isPending ? Infinity : 0, ease: "linear" }}
              >
                {parseCommandMutation.isPending ? (
                  <Loader2 className="h-5 w-5 text-primary" />
                ) : (
                  <Sparkles className="h-5 w-5 text-primary" />
                )}
              </motion.div>
              <input
                ref={inputRef}
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Tell me your strategy... (e.g., 'Find VPs of Sales at Series B companies')"
                className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
                data-testid="input-nlp-command"
              />
              {command && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCommand("")}
                  className="h-6 w-6 p-0"
                  data-testid="button-clear-command"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>

          <ScrollArea className="max-h-[400px]">
            <div className="p-4 space-y-4">
              <AnimatePresence mode="wait">
                {parseCommandMutation.isPending && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center justify-center py-8"
                    data-testid="status-processing"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="relative"
                      >
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg" />
                        <Sparkles className="h-8 w-8 text-primary relative" />
                      </motion.div>
                      <p className="text-sm text-muted-foreground">Analyzing your strategy...</p>
                    </div>
                  </motion.div>
                )}

                {parsedResult && !parseCommandMutation.isPending && (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                    data-testid="container-parsed-result"
                  >
                    <div className="rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 p-4 border border-primary/20">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">{parsedResult.intent}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs" data-testid="badge-confidence">
                          {Math.round(parsedResult.confidence * 100)}% confident
                        </Badge>
                      </div>
                      
                      {parsedResult.resultSummary && (
                        <p className="text-sm text-muted-foreground mb-3" data-testid="text-result-summary">
                          {parsedResult.resultSummary}
                        </p>
                      )}

                      {Object.keys(parsedResult.filters).length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {Object.entries(parsedResult.filters).map(([key, value]) => (
                            <Badge key={key} variant="outline" className="text-xs">
                              {key}: {String(value)}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2 pt-2 border-t border-primary/10">
                        <Button
                          size="sm"
                          onClick={() => handleAction("create")}
                          className="gap-1"
                          data-testid="button-create-campaign"
                        >
                          <Plus className="h-3 w-3" />
                          Create Campaign
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction("add")}
                          data-testid="button-add-to-existing"
                        >
                          Add to Existing
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setParsedResult(null);
                            inputRef.current?.focus();
                          }}
                          className="gap-1"
                          data-testid="button-refine-search"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Refine Search
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {!parsedResult && !parseCommandMutation.isPending && (
                  <motion.div
                    key="suggestions"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <div>
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        Example Commands
                      </h3>
                      <div className="space-y-1">
                        {exampleCommands.map((example, index) => (
                          <motion.button
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => handleExampleClick(example.text)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm",
                              "text-left hover:bg-accent transition-colors group"
                            )}
                            data-testid={`button-example-command-${index}`}
                          >
                            <example.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="flex-1 text-muted-foreground group-hover:text-foreground">
                              {example.text}
                            </span>
                            <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {commandHistory.length > 0 && (
                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          Recent Commands
                        </h3>
                        <div className="space-y-1">
                          {commandHistory.map((item, index) => (
                            <motion.button
                              key={item.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              onClick={() => handleHistoryClick(item)}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                                "text-left hover:bg-accent transition-colors group"
                              )}
                              data-testid={`button-history-command-${index}`}
                            >
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="flex-1 text-muted-foreground group-hover:text-foreground truncate">
                                {item.command}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(item.timestamp).toLocaleDateString()}
                              </span>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>

          <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground bg-muted/30">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px] border">Enter</kbd>
                to search
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px] border">Esc</kbd>
                to close
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Powered by AI
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default NLPCommandBar;
