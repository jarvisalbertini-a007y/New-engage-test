import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Edit3, Send, X, ChevronLeft, ChevronRight, 
  Sparkles, Target, Clock, TrendingUp
} from "lucide-react";
import { AiCard } from "@/components/ui/ai-card";
import { AiToast } from "@/components/ui/ai-toast";
import { Fab } from "@/components/ui/fab";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface Draft {
  id: string;
  type: "email" | "linkedin" | "call";
  sequenceStep?: number;
  recipient: {
    name: string;
    company: string;
    role: string;
  };
  subject?: string;
  content: string;
  intent: "high" | "medium" | "low";
  signals: string[];
  score: {
    clarity: number;
    personalization: number;
    tone: number;
    length: number;
  };
  suggestions: string[];
}

// Inline Editor Component
function InlineEditor({ 
  draft, 
  onSave, 
  onCancel 
}: { 
  draft: Draft; 
  onSave: (content: string) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(draft.content);
  const [showCoaching, setShowCoaching] = useState(true);

  const scores = draft.score;
  const avgScore = (scores.clarity + scores.personalization + scores.tone + scores.length) / 4;

  return (
    <div className="flex gap-6 h-full">
      {/* Editor */}
      <div className="flex-1 flex flex-col">
        <div className="mb-4">
          <h2 className="font-h2 text-xl mb-2">Edit {draft.type === "email" ? "Email" : "Message"}</h2>
          <p className="text-sm text-muted-foreground">
            To: {draft.recipient.name} at {draft.recipient.company}
          </p>
        </div>
        
        {draft.subject && (
          <input
            type="text"
            defaultValue={draft.subject}
            className="mb-4 px-3 py-2 border rounded-lg bg-background"
            placeholder="Subject line"
          />
        )}
        
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 min-h-[300px] resize-none font-body"
          placeholder="Type your message..."
        />
        
        <div className="flex gap-3 mt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onSave(content)}>
            Approve & Send
          </Button>
        </div>
      </div>

      {/* AI Coaching Sidebar */}
      {showCoaching && (
        <Card className="w-80 p-5 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Coach
            </h3>
            <button
              onClick={() => setShowCoaching(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Overall Score */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Score</span>
              <span className="text-2xl font-bold text-primary">
                {Math.round(avgScore * 100)}%
              </span>
            </div>
            <Progress value={avgScore * 100} className="h-2" />
          </div>

          {/* Individual Scores */}
          <div className="space-y-3 mb-6">
            {Object.entries(scores).map(([key, value]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs capitalize text-muted-foreground">{key}</span>
                  <span className="text-xs font-medium">{Math.round(value * 100)}%</span>
                </div>
                <Progress value={value * 100} className="h-1" />
              </div>
            ))}
          </div>

          {/* Suggestions */}
          <div>
            <h4 className="text-sm font-medium mb-2">Suggestions</h4>
            <ul className="space-y-2">
              {draft.suggestions.map((suggestion, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function OutreachReview() {
  const [location, setLocation] = useLocation();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Load drafts from sequences
  const { data: sequences } = useQuery({
    queryKey: ["/api/sequences"],
  });

  useEffect(() => {
    // Generate mock drafts for demonstration
    const mockDrafts: Draft[] = [
      {
        id: "1",
        type: "email",
        sequenceStep: 1,
        recipient: {
          name: "Sarah Chen",
          company: "Acme Corp",
          role: "CFO"
        },
        subject: "Reducing tool spend by 30% at Acme",
        content: "Hi Sarah,\n\nCongrats on the Series B! With your team growing from 50 to 200, I imagine tool consolidation is becoming critical.\n\nWe helped TechCo reduce their SaaS spend by 30% while scaling—would a 15-minute call next week be helpful to share their playbook?\n\nBest,\nAlex",
        intent: "high",
        signals: ["Funding announcement", "Pricing page visit", "Team growth"],
        score: {
          clarity: 0.92,
          personalization: 0.88,
          tone: 0.85,
          length: 0.94
        },
        suggestions: [
          "Shorten the first sentence",
          "Add specific day/time for the call",
          "Include a case study link"
        ]
      },
      {
        id: "2",
        type: "linkedin",
        sequenceStep: 2,
        recipient: {
          name: "Mike Johnson",
          company: "DataFlow",
          role: "VP Sales"
        },
        content: "Mike - saw your post about scaling challenges. We faced the same at my last company.\n\nQuick thought: automating lead scoring cut our qualification time by 60%. Happy to share the framework if helpful.",
        intent: "medium",
        signals: ["Job change", "LinkedIn activity", "Competitor mention"],
        score: {
          clarity: 0.90,
          personalization: 0.82,
          tone: 0.88,
          length: 0.96
        },
        suggestions: [
          "Reference specific post content",
          "Add credibility indicator"
        ]
      },
      {
        id: "3",
        type: "email",
        sequenceStep: 3,
        recipient: {
          name: "Lisa Park",
          company: "GrowthCo",
          role: "CRO"
        },
        subject: "Re: Pipeline velocity",
        content: "Lisa,\n\nFollowing up on my previous note. I noticed GrowthCo just expanded to EMEA—congrats!\n\nMulti-geo pipeline management is complex. We have a 5-minute video showing how similar companies unified their process. Worth a look?\n\nI'm free Tuesday 2pm or Thursday 10am PT if you'd like to discuss.\n\nBest,\nAlex",
        intent: "high",
        signals: ["Expansion news", "Email engagement", "Website visit"],
        score: {
          clarity: 0.89,
          personalization: 0.91,
          tone: 0.87,
          length: 0.90
        },
        suggestions: [
          "Stronger value prop in opening",
          "More specific EMEA challenge"
        ]
      }
    ];
    
    setDrafts(mockDrafts);
  }, []);

  const currentDraft = drafts[currentIndex];

  const handleAction = (action: "skip" | "edit" | "approve") => {
    if (action === "approve") {
      setToastMessage(`✓ Sent to ${currentDraft.recipient.name}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      
      // Move to next draft
      if (currentIndex < drafts.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        // All done
        setDrafts([]);
      }
    } else if (action === "skip") {
      // Move to next draft
      if (currentIndex < drafts.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setDrafts([]);
      }
    } else if (action === "edit") {
      setEditingDraft(currentDraft);
    }
  };

  const handleSwipe = (direction: "left" | "right" | "up") => {
    if (direction === "right") {
      handleAction("approve");
    } else if (direction === "left") {
      handleAction("skip");
    } else if (direction === "up") {
      handleAction("edit");
    }
  };

  const handleEditSave = (content: string) => {
    // Update draft content
    const updated = [...drafts];
    updated[currentIndex] = { ...updated[currentIndex], content };
    setDrafts(updated);
    
    // Send and move to next
    setEditingDraft(null);
    handleAction("approve");
  };

  if (editingDraft) {
    return (
      <div className="h-screen p-6">
        <InlineEditor
          draft={editingDraft}
          onSave={handleEditSave}
          onCancel={() => setEditingDraft(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/dashboard-ai")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <h1 className="font-h1 text-2xl mb-2">Review AI Drafts</h1>
        <p className="text-muted-foreground">
          {drafts.length > 0 ? (
            <>
              {currentIndex + 1} of {drafts.length} drafts • 
              Swipe right to approve, left to skip, up to edit
            </>
          ) : (
            "No drafts to review"
          )}
        </p>
      </div>

      {/* Card Stack */}
      <div className="relative max-w-2xl mx-auto h-[500px]">
        {drafts.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {drafts.slice(currentIndex, currentIndex + 3).map((draft, index) => (
              <AiCard
                key={draft.id}
                title={`${draft.type === "email" ? "Email" : draft.type === "linkedin" ? "LinkedIn" : "Call Script"} - Step ${draft.sequenceStep}`}
                meta={`${draft.recipient.role} · ${draft.signals[0]}`}
                preview={draft.content}
                avatar={{
                  fallback: draft.recipient.company.substring(0, 2).toUpperCase()
                }}
                badges={[
                  { 
                    label: draft.intent + " intent",
                    variant: draft.intent === "high" ? "default" : "secondary"
                  }
                ]}
                index={index}
                isTop={index === 0}
                onSkip={() => handleAction("skip")}
                onEdit={() => handleAction("edit")}
                onApprove={() => handleAction("approve")}
                onSwipe={handleSwipe}
                className="mx-auto"
              />
            ))}
          </AnimatePresence>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Send className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">All drafts reviewed!</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setLocation("/dashboard-ai")}
              >
                Back to Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      {drafts.length > 0 && currentDraft && (
        <div className="max-w-2xl mx-auto mt-8">
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex gap-1">
              {drafts.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    i === currentIndex ? "bg-primary" : "bg-muted"
                  )}
                />
              ))}
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentIndex(Math.min(drafts.length - 1, currentIndex + 1))}
              disabled={currentIndex === drafts.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Toast */}
      <AiToast
        variant="success"
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
      
      {/* FAB */}
      <Fab
        icon="sparkles"
        onClick={() => {
          // Generate more drafts
          console.log("Generate more drafts");
        }}
      />
    </div>
  );
}