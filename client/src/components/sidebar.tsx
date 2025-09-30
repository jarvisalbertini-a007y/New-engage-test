import { Link, useLocation } from "wouter";
import { Brain, ChartLine, Users, Lightbulb, NotebookPen, Wand2, Edit, Inbox, Database, Bot, UsersRound, Shield, BarChart, Settings, Phone, BookOpen, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  {
    name: "Intelligence",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: ChartLine },
      { name: "Visitor Intelligence", href: "/visitors", icon: Users },
      { name: "Insights Engine", href: "/insights", icon: Lightbulb },
    ],
  },
  {
    name: "Outreach",
    items: [
      { name: "AI Autopilot", href: "/autopilot", icon: Zap },
      { name: "Playbooks", href: "/playbooks", icon: BookOpen },
      { name: "Sequences", href: "/sequences", icon: NotebookPen },
      { name: "AI Email Coach", href: "/email-coach", icon: Wand2 },
      { name: "Cloud Dialer", href: "/dialer", icon: Phone },
      { name: "Content Studio", href: "/content-studio", icon: Edit },
      { name: "Unified Inbox", href: "/inbox", icon: Inbox, badge: 3 },
    ],
  },
  {
    name: "Database",
    items: [
      { name: "Lead Database", href: "/leads", icon: Database },
      { name: "AI Agents", href: "/agents", icon: Bot },
      { name: "Personas", href: "/personas", icon: UsersRound },
    ],
  },
  {
    name: "Tools",
    items: [
      { name: "Workflow Triggers", href: "/workflow-triggers", icon: Zap },
      { name: "Deliverability", href: "/deliverability", icon: Shield },
      { name: "Analytics", href: "/analytics", icon: BarChart },
    ],
  },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Brain className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">SalesAI Pro</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((section) => (
          <div key={section.name} className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">
              {section.name}
            </div>
            {section.items.map((item) => {
              const isActive = location === item.href || (item.href === "/dashboard" && location === "/");
              return (
                <Link key={item.name} href={item.href}>
                  <a
                    className={cn(
                      "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full ml-auto">
                        {item.badge}
                      </span>
                    )}
                  </a>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3">
          <img 
            src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=80&h=80" 
            alt="User profile" 
            className="w-10 h-10 rounded-full object-cover" 
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Alex Thompson</p>
            <p className="text-xs text-muted-foreground truncate">Sales Manager</p>
          </div>
          <button 
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
