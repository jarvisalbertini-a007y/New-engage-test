import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, Users, DollarSign, Send, Clock, Target,
  Building2, Zap, Calendar, Filter
} from "lucide-react";
import { AiCommandBar } from "@/components/ui/ai-command-bar";
import { Fab } from "@/components/ui/fab";
import { AiCard } from "@/components/ui/ai-card";
import { AiToast } from "@/components/ui/ai-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
// import type { SelectEmail } from "@shared/schema";

// KPI Card Component
function KpiCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  trend 
}: { 
  title: string; 
  value: string | number; 
  change: string;
  icon: React.ElementType;
  trend: "up" | "down" | "neutral";
}) {
  const trendColor = trend === "up" ? "text-positive" : trend === "down" ? "text-danger" : "text-muted-foreground";
  
  return (
    <Card className="p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          <p className={cn("text-xs mt-2", trendColor)}>{change}</p>
        </div>
        <div className="p-3 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </Card>
  );
}

export default function DashboardAi() {
  const [showCommandSheet, setShowCommandSheet] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [cards, setCards] = useState<any[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  // Fetch recent emails for AI cards
  const { data: emails } = useQuery<any[]>({
    queryKey: ["/api/emails"],
    refetchInterval: 30000
  });

  // Fetch visitor sessions
  const { data: visitors } = useQuery({
    queryKey: ["/api/visitors/recent"]
  });

  // Generate AI drafts based on command
  const generateDrafts = async (command: string) => {
    // In production, this would call your AI service
    const mockDrafts = [
      {
        id: "1",
        title: "Draft to CFO at Acme",
        meta: "Pricing page visit · High intent",
        preview: "Saw your pricing page—quick idea on consolidating tools and reducing spend by 30%...",
        avatar: { fallback: "AC" },
        badges: [{ label: "Funding Signal", variant: "default" as const }]
      },
      {
        id: "2",
        title: "Follow-up to VP Sales at TechCorp",
        meta: "Job change · Medium intent",
        preview: "Congrats on the new role—here's how we helped similar companies achieve 40% pipeline growth...",
        avatar: { fallback: "TC" },
        badges: [{ label: "Leadership Change" }]
      },
      {
        id: "3",
        title: "Sequence Step 2 - DataFlow Inc",
        meta: "Email opened 3x · High engagement",
        preview: "Following up on my previous note about your data pipeline challenges...",
        avatar: { fallback: "DF" },
        badges: [{ label: "Engaged", variant: "secondary" as const }]
      }
    ];
    
    setCards(mockDrafts);
    setShowCommandSheet(false);
  };

  const handleCardAction = (action: "skip" | "edit" | "approve", cardId: string) => {
    if (action === "approve") {
      setToastMessage("Approved & sent via Outreach");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
    
    // Remove the card from stack
    setCards(prev => prev.filter(c => c.id !== cardId));
  };

  const handleSwipe = (direction: "left" | "right" | "up", cardId: string) => {
    if (direction === "right") {
      handleCardAction("approve", cardId);
    } else if (direction === "left") {
      handleCardAction("skip", cardId);
    } else if (direction === "up") {
      handleCardAction("edit", cardId);
    }
  };

  const filters = ["Persona", "Industry", "Channel", "Signal Type", "Date Range"];

  return (
    <div className="min-h-screen bg-background">
      {/* Top Section with AI Command Bar */}
      <div className="px-6 pt-6 pb-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="font-display text-3xl mb-2">Welcome back, Alex</h1>
            <p className="text-muted-foreground">Here's what your AI copilot found today</p>
          </div>
          
          <AiCommandBar
            onSubmit={generateDrafts}
            className="mb-6"
          />
          
          {/* KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              title="Replies Today"
              value="12"
              change="↑ 20% vs yesterday"
              icon={Send}
              trend="up"
            />
            <KpiCard
              title="Meetings Booked"
              value="3"
              change="↑ 50% vs last week"
              icon={Calendar}
              trend="up"
            />
            <KpiCard
              title="Pipeline Generated"
              value="$45K"
              change="↑ 15% vs target"
              icon={DollarSign}
              trend="up"
            />
            <KpiCard
              title="Active Sequences"
              value="8"
              change="2 need review"
              icon={Zap}
              trend="neutral"
            />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="px-6 pb-4 sticky top-0 bg-background/95 backdrop-blur z-20 border-b">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            {filters.map((filter) => (
              <Button
                key={filter}
                variant={selectedFilters.includes(filter) ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedFilters(prev =>
                    prev.includes(filter)
                      ? prev.filter(f => f !== filter)
                      : [...prev, filter]
                  );
                }}
                className="flex-shrink-0"
                data-testid={`filter-${filter.toLowerCase()}`}
              >
                {filter}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* AI Cards Section */}
      <div className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-4">
            <h2 className="font-h2 text-xl mb-1">AI Drafts Ready for Review</h2>
            <p className="text-sm text-muted-foreground">
              Swipe right to approve, left to skip, up to edit
            </p>
          </div>

          {/* Card Stack */}
          <div className="relative h-[400px] flex items-center justify-center">
            {cards.length > 0 ? (
              <div className="relative w-full max-w-[560px]">
                <AnimatePresence>
                  {cards.map((card, index) => (
                    <AiCard
                      key={card.id}
                      {...card}
                      index={index}
                      isTop={index === 0}
                      onSkip={() => handleCardAction("skip", card.id)}
                      onEdit={() => handleCardAction("edit", card.id)}
                      onApprove={() => handleCardAction("approve", card.id)}
                      onSwipe={(direction) => handleSwipe(direction, card.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="text-center py-12">
                <Zap className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No AI drafts to review right now
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Use the command bar above or tap the FAB to generate new drafts
                </p>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="mt-12">
            <h2 className="font-h2 text-xl mb-4">Live Visitor Intelligence</h2>
            <div className="grid gap-3">
              {Array.isArray(visitors) ? visitors.slice(0, 3).map((visitor: any) => (
                <Card key={visitor.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold">{visitor.companyName}</p>
                        <p className="text-sm text-muted-foreground">
                          {visitor.page} · {visitor.timeAgo}
                        </p>
                      </div>
                    </div>
                    <Badge variant={visitor.intent === "high" ? "default" : "secondary"}>
                      {visitor.intent} intent
                    </Badge>
                  </div>
                </Card>
              )) : (
                <Card className="p-8 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No recent visitors</p>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FAB */}
      <Fab
        onClick={() => setShowCommandSheet(true)}
        onLongPress={() => {
          // Quick action menu
          console.log("Long press - show quick actions");
        }}
      />

      {/* Command Sheet Overlay */}
      <AnimatePresence>
        {showCommandSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setShowCommandSheet(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-6" />
              <h2 className="font-h2 text-xl mb-4">What do you want to do?</h2>
              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  "Draft 3-step sequence",
                  "Find hot accounts", 
                  "Analyze performance",
                  "Review AI suggestions"
                ].map((action) => (
                  <Button
                    key={action}
                    variant="outline"
                    size="sm"
                    onClick={() => generateDrafts(action)}
                    className="rounded-full"
                  >
                    {action}
                  </Button>
                ))}
              </div>
              <AiCommandBar
                onSubmit={generateDrafts}
                placeholder="e.g., Draft a 3-step sequence for CFOs at funded accounts"
                autoFocus
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <AiToast
        variant="success"
        message={toastMessage}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}