import { Link, useLocation } from "wouter";
import { Brain, ChartLine, Users, Lightbulb, NotebookPen, Wand2, Edit, Inbox, Database, Bot, UsersRound, Shield, BarChart, Settings, Phone, BookOpen, Zap, MessageSquare, GraduationCap, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navigation = [
  {
    name: "Intelligence",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: ChartLine },
      { name: "Role Views", href: "/role-views", icon: Users },
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
      { name: "Setup Assistant", href: "/setup-assistant", icon: MessageSquare },
      { name: "Performance Coaching", href: "/performance-coaching", icon: GraduationCap },
      { name: "Team Collaboration", href: "/team-collaboration", icon: Users },
      { name: "Lead Scoring", href: "/lead-scoring", icon: Brain },
      { name: "Workflow Builder", href: "/workflows", icon: Zap },
      { name: "Workflow Triggers", href: "/workflow-triggers", icon: Zap },
      { name: "Deliverability", href: "/deliverability", icon: Shield },
      { name: "Analytics", href: "/analytics", icon: BarChart },
    ],
  },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

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
                <Link key={item.name} href={item.href}
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
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start p-0">
              <div className="flex items-center space-x-3 w-full">
                {user?.profileImageUrl ? (
                  <img 
                    src={user.profileImageUrl} 
                    alt="User profile" 
                    className="w-10 h-10 rounded-full object-cover" 
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-semibold">
                      {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate">
                    {user?.firstName && user?.lastName 
                      ? `${user.firstName} ${user.lastName}`
                      : user?.email || 'User'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.location.href = '/settings'}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
