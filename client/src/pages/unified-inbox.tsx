import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Inbox, Search, Filter, Reply, Archive, Star, MoreHorizontal, CheckCircle, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

// Mock email data for demonstration
const mockEmails = [
  {
    id: "1",
    from: "sarah.chen@dataflow.com",
    fromName: "Sarah Chen",
    subject: "Re: Partnership Opportunity",
    preview: "Thanks for reaching out! I'm definitely interested in learning more about your platform...",
    content: "Thanks for reaching out! I'm definitely interested in learning more about your platform. Would you be available for a call next week to discuss how we could integrate this with our current workflow?",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    category: "interested",
    isRead: false,
    isStarred: false,
    company: "DataFlow Inc",
    avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=32&h=32&fit=crop&crop=face",
  },
  {
    id: "2",
    from: "mike.johnson@techcorp.com",
    fromName: "Mike Johnson",
    subject: "Re: Sales Automation Demo",
    preview: "Hi Alex, I appreciate you reaching out, but we're not currently in the market for...",
    content: "Hi Alex, I appreciate you reaching out, but we're not currently in the market for new sales tools. We just implemented a new system last quarter. Perhaps you could check back with us in 6 months?",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    category: "follow_up",
    isRead: true,
    isStarred: true,
    company: "TechCorp Solutions",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face",
  },
  {
    id: "3",
    from: "lisa.rodriguez@nextgen.com",
    fromName: "Lisa Rodriguez",
    subject: "Unsubscribe Request",
    preview: "Please remove me from your mailing list...",
    content: "Please remove me from your mailing list. I'm not interested in receiving further communications.",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    category: "unsubscribe",
    isRead: true,
    isStarred: false,
    company: "NextGen Analytics",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face",
  },
];

export default function UnifiedInbox() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [emails, setEmails] = useState(mockEmails);
  const { toast } = useToast();

  const categorizeEmailMutation = useMutation({
    mutationFn: api.categorizeEmail,
    onSuccess: (data, variables) => {
      // Update email category based on AI analysis
      setEmails(prev => prev.map(email => 
        email.id === variables.emailId 
          ? { ...email, category: data.category }
          : email
      ));
      toast({
        title: "Email Categorized",
        description: `Email categorized as ${data.category}`,
      });
    },
  });

  const filteredEmails = emails.filter(email => {
    const matchesSearch = email.fromName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         email.company.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || email.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryStats = () => {
    return emails.reduce((acc, email) => {
      acc[email.category] = (acc[email.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };

  const stats = getCategoryStats();

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'interested': return 'bg-chart-1 text-background';
      case 'follow_up': return 'bg-chart-2 text-background';
      case 'objection': return 'bg-chart-4 text-background';
      case 'unsubscribe': return 'bg-destructive text-destructive-foreground';
      case 'out_of_office': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'interested': return CheckCircle;
      case 'follow_up': return Clock;
      case 'objection': return X;
      case 'unsubscribe': return X;
      default: return Inbox;
    }
  };

  const markAsRead = (emailId: string) => {
    setEmails(prev => prev.map(email => 
      email.id === emailId ? { ...email, isRead: true } : email
    ));
  };

  const toggleStar = (emailId: string) => {
    setEmails(prev => prev.map(email => 
      email.id === emailId ? { ...email, isStarred: !email.isStarred } : email
    ));
  };

  const handleReply = () => {
    if (replyText.trim() && selectedEmail) {
      toast({
        title: "Reply Sent",
        description: `Reply sent to ${selectedEmail.fromName}`,
      });
      setReplyText("");
      setSelectedEmail(null);
    }
  };

  const getTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Unified Inbox</h1>
            <p className="text-muted-foreground">AI-powered email response management</p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="secondary">
              {emails.filter(e => !e.isRead).length} unread
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full flex">
          {/* Email List */}
          <div className="w-1/2 border-r border-border flex flex-col">
            {/* Stats and Filters */}
            <div className="p-4 border-b border-border space-y-4">
              {/* Category Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="text-center">
                  <p className="text-2xl font-bold text-chart-1">{stats.interested || 0}</p>
                  <p className="text-xs text-muted-foreground">Interested</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-chart-2">{stats.follow_up || 0}</p>
                  <p className="text-xs text-muted-foreground">Follow-up</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-chart-4">{stats.objection || 0}</p>
                  <p className="text-xs text-muted-foreground">Objections</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-destructive">{stats.unsubscribe || 0}</p>
                  <p className="text-xs text-muted-foreground">Unsubscribe</p>
                </div>
              </div>

              {/* Search and Filter */}
              <div className="flex space-x-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search emails..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-emails"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-40" data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="interested">Interested</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                    <SelectItem value="objection">Objections</SelectItem>
                    <SelectItem value="unsubscribe">Unsubscribe</SelectItem>
                    <SelectItem value="out_of_office">Out of Office</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Email List */}
            <div className="flex-1 overflow-auto">
              {filteredEmails.length > 0 ? (
                filteredEmails.map((email) => {
                  const CategoryIcon = getCategoryIcon(email.category);
                  return (
                    <div
                      key={email.id}
                      className={`p-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedEmail?.id === email.id ? 'bg-muted' : ''
                      } ${!email.isRead ? 'bg-accent/5' : ''}`}
                      onClick={() => {
                        setSelectedEmail(email);
                        markAsRead(email.id);
                      }}
                      data-testid={`email-item-${email.id}`}
                    >
                      <div className="flex items-start space-x-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={email.avatar} />
                          <AvatarFallback>
                            {email.fromName.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <p className={`text-sm font-medium ${!email.isRead ? 'font-bold' : ''}`}>
                                {email.fromName}
                              </p>
                              <Badge className={`text-xs ${getCategoryColor(email.category)}`}>
                                {email.category}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-2">
                              <p className="text-xs text-muted-foreground">
                                {getTimeAgo(email.timestamp)}
                              </p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleStar(email.id);
                                }}
                                className={`${email.isStarred ? 'text-yellow-500' : 'text-muted-foreground'}`}
                                data-testid={`button-star-${email.id}`}
                              >
                                <Star className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">{email.company}</p>
                          <p className={`text-sm ${!email.isRead ? 'font-semibold' : ''} line-clamp-1`}>
                            {email.subject}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {email.preview}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <Inbox className="mx-auto h-12 w-12 mb-4" />
                  <p>No emails found</p>
                </div>
              )}
            </div>
          </div>

          {/* Email Detail */}
          <div className="w-1/2 flex flex-col">
            {selectedEmail ? (
              <>
                {/* Email Header */}
                <div className="p-6 border-b border-border">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={selectedEmail.avatar} />
                        <AvatarFallback>
                          {selectedEmail.fromName.split(' ').map((n: string) => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-lg">{selectedEmail.fromName}</h3>
                        <p className="text-sm text-muted-foreground">{selectedEmail.from}</p>
                        <p className="text-sm text-muted-foreground">{selectedEmail.company}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getCategoryColor(selectedEmail.category)}>
                        {selectedEmail.category}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid="button-email-actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem>
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            Add to Sequence
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            Create Task
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="mt-4">
                    <h2 className="text-xl font-semibold">{selectedEmail.subject}</h2>
                    <p className="text-sm text-muted-foreground">
                      {getTimeAgo(selectedEmail.timestamp)}
                    </p>
                  </div>
                </div>

                {/* Email Content */}
                <div className="flex-1 p-6 overflow-auto">
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{selectedEmail.content}</p>
                  </div>
                </div>

                {/* Reply Section */}
                <div className="p-6 border-t border-border">
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Type your reply..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="h-24"
                      data-testid="textarea-reply"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Button size="sm" variant="outline" data-testid="button-ai-reply">
                          <Wand2 className="h-4 w-4 mr-2" />
                          AI Reply
                        </Button>
                        <Button size="sm" variant="outline" data-testid="button-template">
                          Template
                        </Button>
                      </div>
                      <Button onClick={handleReply} disabled={!replyText.trim()} data-testid="button-send-reply">
                        <Reply className="h-4 w-4 mr-2" />
                        Send Reply
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Inbox className="mx-auto h-24 w-24 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Select an email</h3>
                  <p className="text-muted-foreground">
                    Choose an email from the list to view its content
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
