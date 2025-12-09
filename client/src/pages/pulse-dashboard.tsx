import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  Trophy,
  Sparkles,
  CheckCircle2,
  Clock,
  Users,
  ThumbsUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DecisionCard {
  id: string;
  type: 'opportunity' | 'optimization' | 'alert' | 'milestone';
  title: string;
  description: string;
  aiInsight: string;
  actions: { label: string; action: string; variant: 'primary' | 'secondary' }[];
  timestamp: Date;
  priority: 'high' | 'medium' | 'low';
  dismissed: boolean;
}

const mockDecisionCards: DecisionCard[] = [
  {
    id: "1",
    type: "opportunity",
    title: "50 Series B CFOs Found",
    description: "I found 50 CFOs at Series B companies in FinTech. They match your 'Finance Automation' angle perfectly.",
    aiInsight: "These contacts have 3x higher conversion rates based on your historical data. Best time to reach them is Tuesday-Thursday, 10-11am.",
    actions: [
      { label: "Start Outreach", action: "start", variant: "primary" },
      { label: "Dismiss", action: "dismiss", variant: "secondary" }
    ],
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    priority: "high",
    dismissed: false
  },
  {
    id: "2",
    type: "optimization",
    title: "Open Rates Dropped 15%",
    description: "Your email open rates declined this week. I've analyzed top-performing subject lines and have suggestions.",
    aiInsight: "Shorter subject lines (under 40 chars) are getting 23% higher opens. Consider adding personalization tokens.",
    actions: [
      { label: "Apply Fix", action: "apply", variant: "primary" },
      { label: "Ignore", action: "ignore", variant: "secondary" }
    ],
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    priority: "medium",
    dismissed: false
  },
  {
    id: "3",
    type: "alert",
    title: "Buying Signal: Acme Corp Raised $40M",
    description: "Acme Corp just announced a $40M Series C round. You have 3 contacts there who went cold 2 months ago.",
    aiInsight: "Funding announcements are the best time to re-engage. Companies typically expand sales teams within 60 days.",
    actions: [
      { label: "Engage Now", action: "engage", variant: "primary" },
      { label: "Skip", action: "skip", variant: "secondary" }
    ],
    timestamp: new Date(Date.now() - 32 * 60 * 1000),
    priority: "high",
    dismissed: false
  },
  {
    id: "4",
    type: "milestone",
    title: "100 Emails Sent This Week",
    description: "Congratulations! You've hit your weekly email target. Your sequences are running smoothly.",
    aiInsight: "Your reply rate is 12% above benchmark. Keep up the momentum!",
    actions: [
      { label: "View Report", action: "view", variant: "primary" },
      { label: "Continue", action: "continue", variant: "secondary" }
    ],
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    priority: "low",
    dismissed: false
  },
  {
    id: "5",
    type: "opportunity",
    title: "New ICP Match: DataFlow Inc",
    description: "DataFlow Inc's VP of Sales just viewed your pricing page twice. They're actively evaluating solutions.",
    aiInsight: "Website visitors who view pricing 2+ times convert 4x higher. They're also in your target industry.",
    actions: [
      { label: "Send Intro", action: "intro", variant: "primary" },
      { label: "Add to List", action: "list", variant: "secondary" }
    ],
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    priority: "high",
    dismissed: false
  },
  {
    id: "6",
    type: "optimization",
    title: "Best Send Time Identified",
    description: "Based on your data, Tuesday 10am EST gets the highest engagement. Want to optimize your schedule?",
    aiInsight: "Emails sent at this time see 35% higher open rates compared to your current random scheduling.",
    actions: [
      { label: "Optimize Schedule", action: "optimize", variant: "primary" },
      { label: "Later", action: "later", variant: "secondary" }
    ],
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
    priority: "medium",
    dismissed: false
  }
];

const typeConfig = {
  opportunity: {
    icon: Target,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    glowColor: "shadow-emerald-500/20"
  },
  optimization: {
    icon: TrendingUp,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    glowColor: "shadow-purple-500/20"
  },
  alert: {
    icon: AlertTriangle,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    glowColor: "shadow-orange-500/20"
  },
  milestone: {
    icon: Trophy,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    glowColor: "shadow-blue-500/20"
  }
};

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function DecisionCardComponent({ 
  card, 
  onAction 
}: { 
  card: DecisionCard; 
  onAction: (cardId: string, action: string) => void;
}) {
  const config = typeConfig[card.type];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -100, scale: 0.9 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      data-testid={`card-decision-${card.id}`}
    >
      <Card className={`
        relative overflow-hidden rounded-xl border
        bg-card/80 backdrop-blur-md
        ${config.borderColor}
        hover:shadow-lg hover:${config.glowColor}
        transition-all duration-300
      `}>
        {card.priority === "high" && (
          <div className="absolute top-4 right-4">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.bgColor} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${config.bgColor}`}></span>
            </span>
          </div>
        )}
        
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center`}>
              <Icon className={`h-5 w-5 ${config.color}`} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground" data-testid={`text-title-${card.id}`}>
                  {card.title}
                </h3>
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${config.bgColor} ${config.color} border-0`}
                >
                  {card.type}
                </Badge>
              </div>
              
              <p className="text-sm text-muted-foreground mb-3" data-testid={`text-description-${card.id}`}>
                {card.description}
              </p>
              
              <div className={`p-3 rounded-lg ${config.bgColor} border ${config.borderColor} mb-4`}>
                <div className="flex items-start gap-2">
                  <Sparkles className={`h-4 w-4 ${config.color} mt-0.5 flex-shrink-0`} />
                  <p className="text-sm text-foreground/80" data-testid={`text-insight-${card.id}`}>
                    {card.aiInsight}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimeAgo(card.timestamp)}
                </span>
                
                <div className="flex items-center gap-2">
                  {card.actions.map((action, idx) => (
                    <Button
                      key={idx}
                      variant={action.variant === "primary" ? "default" : "outline"}
                      size="sm"
                      onClick={() => onAction(card.id, action.action)}
                      className="rounded-lg"
                      data-testid={`button-${action.action}-${card.id}`}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatsSummaryBar({ 
  decisionsToday, 
  leadsEngaged, 
  approvalRate 
}: { 
  decisionsToday: number;
  leadsEngaged: number;
  approvalRate: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
    >
      <Card className="bg-card/80 backdrop-blur-md border rounded-xl" data-testid="stat-decisions">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold font-mono" data-testid="text-decisions-count">{decisionsToday}</p>
            <p className="text-xs text-muted-foreground">decisions made today</p>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-card/80 backdrop-blur-md border rounded-xl" data-testid="stat-leads">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-bold font-mono" data-testid="text-leads-count">{leadsEngaged}</p>
            <p className="text-xs text-muted-foreground">leads engaged by AI</p>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-card/80 backdrop-blur-md border rounded-xl" data-testid="stat-approval">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <ThumbsUp className="h-5 w-5 text-purple-500" />
          </div>
          <div>
            <p className="text-2xl font-bold font-mono" data-testid="text-approval-rate">{approvalRate}%</p>
            <p className="text-xs text-muted-foreground">approval rate</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center"
      data-testid="empty-state"
    >
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
      <p className="text-sm text-muted-foreground max-w-md">
        Your AI agents are working in the background. New decisions will appear here when they need your input.
      </p>
    </motion.div>
  );
}

export default function PulseDashboard() {
  const [cards, setCards] = useState<DecisionCard[]>(mockDecisionCards);
  const [stats, setStats] = useState({
    decisionsToday: 12,
    leadsEngaged: 34,
    approvalRate: 87
  });

  const handleAction = (cardId: string, action: string) => {
    if (action === "dismiss" || action === "ignore" || action === "skip" || action === "continue" || action === "later") {
      setCards(prev => prev.filter(c => c.id !== cardId));
    } else {
      setCards(prev => prev.filter(c => c.id !== cardId));
      setStats(prev => ({
        ...prev,
        decisionsToday: prev.decisionsToday + 1,
        leadsEngaged: action === "start" || action === "engage" || action === "intro" ? prev.leadsEngaged + 1 : prev.leadsEngaged
      }));
    }
  };

  const activeCards = cards.filter(c => !c.dismissed);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="bg-card border-b border-border px-4 md:px-6 lg:px-8 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </span>
                Pulse
              </h1>
              <p className="text-sm md:text-base text-muted-foreground">
                AI-powered decisions awaiting your approval
              </p>
            </div>
            <Badge variant="secondary" className="rounded-lg px-3 py-1" data-testid="badge-pending-count">
              {activeCards.length} pending
            </Badge>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="max-w-4xl mx-auto">
          <StatsSummaryBar 
            decisionsToday={stats.decisionsToday}
            leadsEngaged={stats.leadsEngaged}
            approvalRate={stats.approvalRate}
          />

          <AnimatePresence mode="popLayout">
            {activeCards.length > 0 ? (
              <div className="space-y-4">
                {activeCards.map(card => (
                  <DecisionCardComponent
                    key={card.id}
                    card={card}
                    onAction={handleAction}
                  />
                ))}
              </div>
            ) : (
              <EmptyState />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
