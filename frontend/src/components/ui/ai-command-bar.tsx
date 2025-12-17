import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Mic, Clock, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AiCommandBarProps {
  onSubmit?: (text: string) => void;
  placeholder?: string;
  className?: string;
  showHistory?: boolean;
  autoFocus?: boolean;
}

export function AiCommandBar({
  onSubmit,
  placeholder = "Ask me to find, draft, sequence, or analyze…",
  className,
  showHistory = true,
  autoFocus = false
}: AiCommandBarProps) {
  const [value, setValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = () => {
    if (value.trim() && onSubmit) {
      onSubmit(value.trim());
      setHistory(prev => [value.trim(), ...prev.slice(0, 4)]);
      setValue("");
    }
  };

  const handleVoiceInput = async () => {
    setIsListening(!isListening);
    // In production, integrate with Web Speech API
    if (!isListening) {
      // Start listening
      console.log("Voice input started");
    } else {
      // Stop listening
      console.log("Voice input stopped");
    }
  };

  return (
    <div className={cn("relative w-full", className)}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="ai-command-bar relative flex items-center gap-3 rounded-2xl bg-muted px-5 py-3"
      >
        <Sparkles className="h-5 w-5 text-primary animate-pulse" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder={placeholder}
          className="flex-1 border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
          data-testid="ai-command-input"
        />
        <div className="flex items-center gap-2">
          {showHistory && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
              className="h-8 w-8"
              data-testid="history-button"
            >
              <Clock className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleVoiceInput}
            className={cn("h-8 w-8", isListening && "text-primary")}
            data-testid="voice-button"
          >
            <Mic className={cn("h-4 w-4", isListening && "animate-pulse")} />
          </Button>
          {value.trim() && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSubmit}
              className="h-8 w-8 text-primary"
              data-testid="submit-button"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </motion.div>

      {/* History Dropdown */}
      <AnimatePresence>
        {showHistoryDropdown && history.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 z-50 mt-2 rounded-lg bg-card border border-border shadow-lg overflow-hidden"
          >
            {history.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  setValue(item);
                  setShowHistoryDropdown(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-muted transition-colors text-sm"
              >
                {item}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}