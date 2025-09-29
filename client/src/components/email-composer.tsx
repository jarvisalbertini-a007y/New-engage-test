import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wand2, Send, Save, Eye, Type, Bold, Italic, Underline, Link, List, ListOrdered, Palette, Image, Paperclip } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface EmailComposerProps {
  initialSubject?: string;
  initialBody?: string;
  recipients?: Array<{ email: string; name: string }>;
  onSend?: (email: { subject: string; body: string; recipients: string[] }) => void;
  onSave?: (email: { subject: string; body: string; recipients: string[] }) => void;
  onAIAssist?: (content: string) => void;
  showTemplates?: boolean;
}

const emailTemplates = [
  {
    id: "cold-outreach",
    name: "Cold Outreach",
    subject: "Quick question about {{company}}'s {{industry}} strategy",
    body: `Hi {{firstName}},

I noticed {{company}} has been {{recent_insight}}. Companies in the {{industry}} space often struggle with {{pain_point}}.

Our platform has helped similar companies like {{competitor}} achieve {{benefit}} within {{timeframe}}.

Would you be open to a brief 15-minute conversation to explore how this might apply to {{company}}?

Best regards,
{{sender_name}}`
  },
  {
    id: "follow-up",
    name: "Follow-up",
    subject: "Following up on our conversation",
    body: `Hi {{firstName}},

I wanted to follow up on our previous conversation about {{topic}}.

I've put together some specific examples of how companies like {{company}} have used our solution to {{specific_benefit}}.

Would next week work for a quick demo?

Best,
{{sender_name}}`
  },
  {
    id: "insight-based",
    name: "Insight-Based",
    subject: "Congratulations on {{company}}'s {{achievement}}",
    body: `Hi {{firstName}},

Congratulations on {{company}}'s recent {{achievement}}! This is exciting news.

With this growth, you're probably looking at scaling {{specific_area}}. We've helped other fast-growing {{industry}} companies navigate similar challenges.

I'd love to share some insights that might be relevant. Are you available for a brief call this week?

Best regards,
{{sender_name}}`
  }
];

export default function EmailComposer({ 
  initialSubject = "", 
  initialBody = "", 
  recipients = [],
  onSend,
  onSave,
  onAIAssist,
  showTemplates = true 
}: EmailComposerProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>(recipients.map(r => r.email));
  const [showPreview, setShowPreview] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<string>("");
  const [fontSize, setFontSize] = useState("14");
  const [fontFamily, setFontFamily] = useState("Arial");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const handleSend = () => {
    if (!subject.trim() || !body.trim() || selectedRecipients.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in subject, body, and select at least one recipient.",
        variant: "destructive",
      });
      return;
    }

    if (onSend) {
      onSend({
        subject,
        body,
        recipients: selectedRecipients,
      });
    }
    
    toast({
      title: "Email Sent",
      description: `Email sent to ${selectedRecipients.length} recipient(s)`,
    });
  };

  const handleSave = () => {
    if (onSave) {
      onSave({
        subject,
        body,
        recipients: selectedRecipients,
      });
    }
    
    toast({
      title: "Draft Saved",
      description: "Your email draft has been saved successfully.",
    });
  };

  const handleAIAssist = () => {
    if (onAIAssist) {
      onAIAssist(body);
    }
  };

  const applyTemplate = (template: any) => {
    setSubject(template.subject);
    setBody(template.body);
    setActiveTemplate(template.id);
    toast({
      title: "Template Applied",
      description: `${template.name} template has been applied.`,
    });
  };

  const insertText = (text: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newBody = body.substring(0, start) + text + body.substring(end);
      setBody(newBody);
      
      // Restore cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + text.length;
          textareaRef.current.selectionEnd = start + text.length;
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  const insertVariable = (variable: string) => {
    insertText(`{{${variable}}}`);
  };

  const variables = [
    "firstName", "lastName", "company", "title", "industry", 
    "recent_insight", "pain_point", "benefit", "competitor"
  ];

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Compose Email</CardTitle>
          <div className="flex items-center space-x-2">
            {showTemplates && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-templates">
                    Templates
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Email Templates</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    {emailTemplates.map((template) => (
                      <div key={template.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{template.name}</p>
                            <p className="text-sm text-muted-foreground">{template.subject}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => applyTemplate(template)}
                            data-testid={`button-apply-template-${template.id}`}
                          >
                            Use Template
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowPreview(!showPreview)}
              data-testid="button-preview"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="compose" className="space-y-4">
          <TabsList>
            <TabsTrigger value="compose" data-testid="tab-compose">Compose</TabsTrigger>
            <TabsTrigger value="formatting" data-testid="tab-formatting">Formatting</TabsTrigger>
            <TabsTrigger value="variables" data-testid="tab-variables">Variables</TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-4">
            {/* Recipients */}
            <div>
              <Label htmlFor="recipients">To</Label>
              <div className="flex flex-wrap gap-2 mt-1 p-2 border rounded-md min-h-[40px]">
                {recipients.map((recipient) => (
                  <Badge key={recipient.email} variant="secondary" className="flex items-center gap-1">
                    {recipient.name} &lt;{recipient.email}&gt;
                    <button
                      onClick={() => setSelectedRecipients(prev => prev.filter(r => r !== recipient.email))}
                      className="ml-1 hover:text-destructive"
                      data-testid={`button-remove-recipient-${recipient.email}`}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter email subject..."
                data-testid="input-email-subject"
              />
            </div>

            {/* Body */}
            <div>
              <Label htmlFor="body">Message</Label>
              <Textarea
                ref={textareaRef}
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="h-64 resize-none"
                placeholder="Start typing your email..."
                data-testid="textarea-email-body"
                style={{ fontSize: `${fontSize}px`, fontFamily }}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAIAssist}
                  data-testid="button-ai-assist"
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  AI Assist
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  data-testid="button-save-draft"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>
              </div>
              <Button onClick={handleSend} data-testid="button-send-email">
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="formatting" className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Label>Font Size:</Label>
                <Select value={fontSize} onValueChange={setFontSize}>
                  <SelectTrigger className="w-20" data-testid="select-font-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12px</SelectItem>
                    <SelectItem value="14">14px</SelectItem>
                    <SelectItem value="16">16px</SelectItem>
                    <SelectItem value="18">18px</SelectItem>
                    <SelectItem value="20">20px</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-1">
                <Label>Font:</Label>
                <Select value={fontFamily} onValueChange={setFontFamily}>
                  <SelectTrigger className="w-32" data-testid="select-font-family">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Arial">Arial</SelectItem>
                    <SelectItem value="Helvetica">Helvetica</SelectItem>
                    <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                    <SelectItem value="Georgia">Georgia</SelectItem>
                    <SelectItem value="Verdana">Verdana</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" data-testid="button-bold">
                <Bold className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" data-testid="button-italic">
                <Italic className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" data-testid="button-underline">
                <Underline className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" data-testid="button-link">
                <Link className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" data-testid="button-list">
                <List className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" data-testid="button-ordered-list">
                <ListOrdered className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="variables" className="space-y-4">
            <div>
              <Label>Insert Variables</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Click to insert personalization variables into your email
              </p>
              <div className="grid grid-cols-3 gap-2">
                {variables.map((variable) => (
                  <Button
                    key={variable}
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(variable)}
                    data-testid={`button-insert-${variable}`}
                  >
                    {`{{${variable}}}`}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Preview Modal */}
        {showPreview && (
          <div className="mt-6 p-4 border rounded-lg bg-muted/50">
            <h4 className="font-medium mb-2">Email Preview</h4>
            <div className="space-y-2">
              <div>
                <span className="text-sm font-medium">Subject: </span>
                <span>{subject}</span>
              </div>
              <div>
                <span className="text-sm font-medium">To: </span>
                <span>{selectedRecipients.join(", ")}</span>
              </div>
              <div className="mt-4 p-3 bg-background rounded border">
                <pre className="whitespace-pre-wrap font-sans text-sm">{body}</pre>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
