import { useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Wand2, CheckCircle, AlertTriangle, TrendingUp, Copy, Save, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface EmailAnalysis {
  score: number;
  suggestions: string[];
  improvements: { type: string; message: string }[];
  readabilityScore: number;
  spamScore: number;
  personalizedElements: string[];
}

interface SpamAnalysis {
  score: number;
  flaggedWords: string[];
  suggestions: string[];
}

interface SubjectAnalysis {
  optimized: string;
  score: number;
  suggestions: string[];
}

export default function EmailCoach() {
  const [subject, setSubject] = useState("Quick question about {{company}}'s sales process");
  const [emailBody, setEmailBody] = useState(`Hi {{firstName}},

I noticed {{company}} has been growing rapidly in the {{industry}} space. Our AI-powered sales platform has helped similar companies increase their reply rates by 40% while reducing manual work.

Would you be interested in a quick 15-minute demo to see how we can help {{company}} streamline your sales process?

Best regards,
{{senderName}}`);
  
  const [improvedContent, setImprovedContent] = useState<{ subject: string; body: string } | null>(null);
  const [analysis, setAnalysis] = useState<EmailAnalysis | null>(null);
  const [spamCheck, setSpamCheck] = useState<SpamAnalysis | null>(null);
  const [subjectAnalysis, setSubjectAnalysis] = useState<SubjectAnalysis | null>(null);
  const { toast } = useToast();

  const analyzeMutation = useMutation({
    mutationFn: (content: string) => api.analyzeEmail(content),
    onSuccess: (data) => {
      setAnalysis(data);
    },
    onError: (error) => {
      console.error("Analysis error:", error);
    },
  });

  const spamMutation = useMutation({
    mutationFn: (content: string) => api.checkSpam(content),
    onSuccess: (data) => {
      setSpamCheck(data);
    },
    onError: (error) => {
      console.error("Spam check error:", error);
    },
  });

  const subjectMutation = useMutation({
    mutationFn: (subjectLine: string) => api.optimizeSubject(subjectLine),
    onSuccess: (data) => {
      setSubjectAnalysis(data);
    },
    onError: (error) => {
      console.error("Subject analysis error:", error);
    },
  });

  const runAnalysis = useCallback(() => {
    if (emailBody.length > 10) {
      analyzeMutation.mutate(emailBody);
      spamMutation.mutate(emailBody);
    }
    if (subject.length > 0) {
      subjectMutation.mutate(subject);
    }
  }, [emailBody, subject]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      runAnalysis();
    }, 800);

    return () => clearTimeout(debounceTimer);
  }, [emailBody, subject]);

  const analyzing = analyzeMutation.isPending || spamMutation.isPending || subjectMutation.isPending;

  const improveMutation = useMutation({
    mutationFn: () => api.improveEmail(emailBody),
    onSuccess: (data) => {
      setImprovedContent(data.improved);
      toast({
        title: "Email Improved",
        description: "AI has generated an improved version of your email.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to improve email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const applyImprovement = () => {
    if (improvedContent) {
      setSubject(improvedContent.subject);
      setEmailBody(improvedContent.body);
      setImprovedContent(null);
      toast({
        title: "Changes Applied",
        description: "The improved content has been applied to your draft.",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Content copied to clipboard.",
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-chart-1";
    if (score >= 60) return "text-chart-2";
    return "text-chart-4";
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return "bg-chart-1 text-background";
    if (score >= 60) return "bg-chart-2 text-background";
    return "bg-chart-4 text-background";
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI Email Coach</h1>
            <p className="text-muted-foreground">Real-time email analysis and improvement suggestions</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => improveMutation.mutate()}
              disabled={!emailBody.trim() || improveMutation.isPending}
              data-testid="button-improve-email"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              {improveMutation.isPending ? "Improving..." : "AI Improve"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Email Composer */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Draft</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="subject">Subject Line</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter email subject..."
                    data-testid="input-email-subject"
                  />
                </div>
                <div>
                  <Label htmlFor="body">Email Body</Label>
                  <Textarea
                    id="body"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="h-64 resize-none"
                    placeholder="Start writing your email..."
                    data-testid="textarea-email-body"
                  />
                </div>
                <div className="flex space-x-3">
                  <Button variant="outline" data-testid="button-save-draft">
                    <Save className="h-4 w-4 mr-2" />
                    Save Draft
                  </Button>
                  <Button variant="outline" onClick={() => copyToClipboard(emailBody)} data-testid="button-copy-email">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Improved Version */}
            {improvedContent && (
              <Card className="border-chart-1">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-chart-1">AI Improved Version</CardTitle>
                    <Button onClick={applyImprovement} data-testid="button-apply-improvement">
                      Apply Changes
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Improved Subject</Label>
                    <div className="p-3 bg-muted rounded-md">
                      <p className="text-sm font-medium">{improvedContent.subject}</p>
                    </div>
                  </div>
                  <div>
                    <Label>Improved Body</Label>
                    <div className="p-3 bg-muted rounded-md">
                      <pre className="text-sm whitespace-pre-wrap font-sans">{improvedContent.body}</pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Analysis Panel */}
          <div className="space-y-6">
            {/* Overall Score */}
            <Card>
              <CardHeader>
                <CardTitle>Email Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                {analyzing ? (
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 animate-pulse" />
                    <span className="text-sm">Analyzing email...</span>
                  </div>
                ) : analysis ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Overall Score</span>
                      <Badge className={getScoreBadgeColor(analysis.score)}>
                        {analysis.score}/100
                      </Badge>
                    </div>
                    <Progress value={analysis.score} className="h-3" />
                    
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Readability</span>
                        <div className="flex items-center mt-1">
                          <Progress value={analysis.readabilityScore || 75} className="h-2 flex-1 mr-2" />
                          <span className="text-xs">{analysis.readabilityScore || 75}/100</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Spam Risk</span>
                        <div className="flex items-center mt-1">
                          <Progress value={100 - (analysis.spamScore || 0)} className="h-2 flex-1 mr-2" />
                          <span className="text-xs">{analysis.spamScore || 0}/100</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Start typing to see analysis...</p>
                )}
              </CardContent>
            </Card>

            {/* Suggestions */}
            <Card>
              <CardHeader>
                <CardTitle>Suggestions</CardTitle>
              </CardHeader>
              <CardContent>
                {analysis?.suggestions?.length ? (
                  <div className="space-y-3">
                    {analysis.suggestions.map((suggestion: string, index: number) => (
                      <div key={index} className="flex items-start space-x-3">
                        <CheckCircle className="h-4 w-4 text-chart-1 mt-0.5 flex-shrink-0" />
                        <p className="text-sm">{suggestion}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No suggestions available yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Detailed Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Detailed Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="personalization">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="personalization" data-testid="tab-personalization">Personalization</TabsTrigger>
                    <TabsTrigger value="spam" data-testid="tab-spam">Spam Check</TabsTrigger>
                    <TabsTrigger value="subject" data-testid="tab-subject">Subject Line</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="personalization" className="space-y-3">
                    {analysis?.personalizedElements?.length ? (
                      analysis.personalizedElements.map((element: string, index: number) => (
                        <div key={index} className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-chart-1" />
                          <span className="text-sm">{element}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No personalization elements detected.</p>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="spam" className="space-y-3">
                    {spamCheck ? (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium">Spam Score</span>
                          <Badge variant={spamCheck.score > 50 ? "destructive" : "secondary"}>
                            {spamCheck.score}/100
                          </Badge>
                        </div>
                        {spamCheck.flaggedWords?.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Flagged Words:</p>
                            <div className="flex flex-wrap gap-1">
                              {spamCheck.flaggedWords.map((word: string, index: number) => (
                                <Badge key={index} variant="destructive" className="text-xs">
                                  {word}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {spamCheck.suggestions?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium mb-2">Suggestions:</p>
                            {spamCheck.suggestions.map((suggestion: string, index: number) => (
                              <div key={index} className="flex items-start space-x-2">
                                <AlertTriangle className="h-4 w-4 text-chart-4 mt-0.5 flex-shrink-0" />
                                <p className="text-sm">{suggestion}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No spam analysis available.</p>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="subject" className="space-y-3">
                    {subjectAnalysis ? (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium">Subject Score</span>
                          <Badge className={getScoreBadgeColor(subjectAnalysis.score)}>
                            {subjectAnalysis.score}/100
                          </Badge>
                        </div>
                        {subjectAnalysis.suggestions?.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Suggestions:</p>
                            {subjectAnalysis.suggestions.map((suggestion: string, index: number) => (
                              <div key={index} className="flex items-start space-x-2">
                                <CheckCircle className="h-4 w-4 text-chart-1 mt-0.5 flex-shrink-0" />
                                <p className="text-sm">{suggestion}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No subject line analysis available.</p>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
