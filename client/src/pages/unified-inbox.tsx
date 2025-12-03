import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Inbox, Search, Filter, Reply, Archive, Star, MoreHorizontal, CheckCircle, Clock, X, Wand2, Loader2 } from "lucide-react";
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

// InboxMessage type definition
interface InboxMessage {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  preview: string;
  content: string;
  timestamp: Date;
  category: string;
  isRead: boolean;
  isStarred: boolean;
  company: string;
  avatar?: string;
}

export default function UnifiedInbox() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedEmail, setSelectedEmail] = useState<InboxMessage | null>(null);
  const [replyText, setReplyText] = useState("");
  const { toast } = useToast();
  
  // Fetch inbox messages from API
  const { data: emails = [], isLoading } = useQuery<InboxMessage[]>({
    queryKey: ["/api/inbox"],
  });

  // Mutations for message actions
  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await fetch(`/api/inbox/${messageId}/read`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to mark as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
    },
  });

  const toggleStarMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await fetch(`/api/inbox/${messageId}/star`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to toggle star");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
    },
  });

  const archiveMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await fetch(`/api/inbox/${messageId}/archive`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to archive message");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Message Archived",
        description: "Message has been moved to archive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
    },
  });

  const sendReplyMutation = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      const response = await fetch(`/api/inbox/${messageId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error("Failed to send reply");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reply Sent",
        description: "Your reply has been sent successfully",
      });
      setReplyText("");
      setSelectedEmail(null);
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
    },
  });

  const filteredEmails = emails.filter((email: InboxMessage) => {
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

  const markAsRead = (messageId: string) => {
    markAsReadMutation.mutate(messageId);
  };

  const toggleStar = (messageId: string) => {
    toggleStarMutation.mutate(messageId);
  };

  const handleReply = () => {
    if (replyText.trim() && selectedEmail) {
      sendReplyMutation.mutate({ 
        messageId: selectedEmail.id, 
        content: replyText 
      });
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
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredEmails.length > 0 ? (
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
