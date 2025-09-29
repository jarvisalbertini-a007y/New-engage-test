import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Wand2, NotebookPen, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface AICoachPanelProps {
  initialContent?: string;
  onImprove?: (improved: { subject: string; body: string }) => void;
  onAddToSequence?: (content: string) => void;
}

export default function AICoachPanel({ initialContent = "", onImprove, onAddToSequence }: AICoachPanelProps) {
  const [emailContent, setEmailContent] = useState(initialContent);

  const { data: analysis, isLoading: analyzing } = useQuery({
    queryKey: ["/api/emails/analyze", emailContent],
    enabled: emailContent.length > 10,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleImprove = async () => {
    if (emailContent.trim() && onImprove) {
      try {
        const response = await api.improveEmail(emailContent);
        onImprove(response.improved);
      } catch (error) {
        console.error("Failed to improve email:", error);
      }
    }
  };

  const handleAddToSequence = () => {
    if (onAddToSequence) {
      onAddToSequence(emailContent);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-chart-1";
    if (score >= 60) return "text-chart-2";
    return "text-chart-4";
  };

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold">AI Email Coach</h3>
        <p className="text-sm text-muted-foreground mt-1">Real-time email analysis and suggestions</p>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email Draft</label>
            <Textarea
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              className="w-full h-32 resize-none"
              placeholder="Start writing your email..."
              data-testid="textarea-email-draft"
            />
          </div>

          {analysis && (
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                  <Wand2 className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm mb-2">AI Analysis & Suggestions</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-chart-1 rounded-full"></div>
                      <span>
                        Email Score: <strong className={getScoreColor(analysis.score)}>{analysis.score}/100</strong>
                      </span>
                    </div>
                    {analysis.suggestions?.map((suggestion: string, index: number) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-chart-2 rounded-full"></div>
                        <span>{suggestion}</span>
                      </div>
                    ))}
                    {analysis.spamScore > 30 && (
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-destructive rounded-full"></div>
                        <span>High spam risk detected ({analysis.spamScore}/100)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {analyzing && (
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 animate-pulse" />
                <span className="text-sm">Analyzing email...</span>
              </div>
            </div>
          )}

          <div className="flex space-x-3">
            <Button 
              onClick={handleImprove}
              disabled={!emailContent.trim()}
              data-testid="button-ai-improve"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              AI Improve
            </Button>
            <Button 
              variant="secondary"
              onClick={handleAddToSequence}
              disabled={!emailContent.trim()}
              data-testid="button-add-to-sequence"
            >
              <NotebookPen className="h-4 w-4 mr-2" />
              Add to Sequence
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
