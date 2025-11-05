import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  Brain, ChartLine, Users, Lightbulb, NotebookPen, Wand2, Edit, 
  Inbox, Database, Bot, UsersRound, Shield, BarChart, Settings, 
  Phone, BookOpen, Zap, MessageSquare, GraduationCap, LogOut,
  Menu, X, ChevronLeft, ChevronRight, Store, Sparkles, GitBranch, TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

// Type definition for user object
interface User {
  profileImageUrl?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navigation = [
  {
    name: "Intelligence",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: ChartLine },
      { name: "Deal Intelligence", href: "/deal-intelligence", icon: Brain },
      { name: "Revenue Operations", href: "/revenue-ops", icon: TrendingUp },
      { name: "Role Views", href: "/role-views", icon: Users },
      { name: "Visitor Intelligence", href: "/visitors", icon: Users },
      { name: "Insights Engine", href: "/insights", icon: Lightbulb },
    ],
  },
  {
    name: "Outreach",
    items: [
      { name: "Multi-Channel", href: "/multi-channel", icon: GitBranch },
      { name: "Voice AI", href: "/voice-ai", icon: Phone },
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
      { name: "Digital Twins", href: "/digital-twins", icon: Sparkles },
      { name: "AI Agents", href: "/agents", icon: Bot },
      { name: "Agent Marketplace", href: "/marketplace", icon: Store },
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

export default function CollapsibleSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Initialize from localStorage or default based on screen size
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved !== null) return saved === "true";
    return window.innerWidth < 1024; // Collapsed on tablets and mobile
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Save preference to localStorage
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", isCollapsed.toString());
  }, [isCollapsed]);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
    if (window.innerWidth < 768) {
      setIsMobileMenuOpen(!isMobileMenuOpen);
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden transition-all-soft"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div
        className={cn(
          "relative bg-sidebar border-r border-sidebar-border flex flex-col transition-all-soft soft-shadow",
          isCollapsed ? "w-16" : "w-64",
          // Mobile: overlay drawer
          "md:relative fixed md:static z-50 h-full",
          isMobileMenuOpen && !isCollapsed ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Toggle Button - Always visible */}
        <button
          onClick={toggleSidebar}
          className={cn(
            "absolute -right-10 md:-right-4 top-20 md:top-6 z-50",
            "w-8 h-8 rounded-lg bg-background border border-border",
            "flex items-center justify-center transition-all-soft soft-shadow-hover",
            "hover:bg-accent hover:text-accent-foreground"
          )}
          aria-label="Toggle sidebar"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        {/* Logo */}
        <div className={cn(
          "border-b border-sidebar-border transition-all-soft",
          isCollapsed ? "p-4" : "p-6"
        )}>
          <div className={cn(
            "flex items-center",
            isCollapsed ? "justify-center" : "space-x-3"
          )}>
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center soft-shadow">
              <Brain className="h-4 w-4 text-primary-foreground" />
            </div>
            {!isCollapsed && (
              <span className="font-bold text-lg text-foreground">SalesAI Pro</span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className={cn(
          "flex-1 space-y-2 overflow-y-auto scrollbar-hide",
          isCollapsed ? "p-2" : "p-4"
        )}>
          {navigation.map((section) => (
            <div key={section.name} className="space-y-1">
              {!isCollapsed && (
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">
                  {section.name}
                </div>
              )}
              {section.items.map((item) => {
                const isActive = location === item.href || (item.href === "/dashboard" && location === "/");
                const LinkContent = (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center rounded-lg transition-all-soft",
                      isCollapsed ? "p-3 justify-center" : "px-3 py-2.5 space-x-3",
                      isActive
                        ? "bg-primary/10 text-primary border-l-4 border-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                    data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <item.icon className={cn(
                      "transition-all-soft",
                      isCollapsed ? "h-5 w-5" : "h-4 w-4"
                    )} />
                    {!isCollapsed && (
                      <>
                        <span className="text-sm">{item.name}</span>
                        {item.badge && (
                          <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full ml-auto">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );

                return isCollapsed ? (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>
                      {LinkContent}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="soft-shadow">
                      {item.name}
                      {item.badge && (
                        <span className="ml-2 bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  LinkContent
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Profile */}
        <div className={cn(
          "border-t border-sidebar-border",
          isCollapsed ? "p-2" : "p-4"
        )}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className={cn(
                "w-full justify-start p-0 h-auto hover:bg-muted/50",
                isCollapsed && "justify-center"
              )}>
                <div className={cn(
                  "flex items-center w-full",
                  isCollapsed ? "justify-center" : "space-x-3"
                )}>
                  {user?.profileImageUrl ? (
                    <img
                      src={user.profileImageUrl}
                      alt="User profile"
                      className={cn(
                        "rounded-full object-cover transition-all-soft",
                        isCollapsed ? "w-8 h-8" : "w-10 h-10"
                      )}
                    />
                  ) : (
                    <div className={cn(
                      "rounded-full bg-primary/10 flex items-center justify-center transition-all-soft",
                      isCollapsed ? "w-8 h-8" : "w-10 h-10"
                    )}>
                      <span className="text-primary font-semibold text-sm">
                        {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                  {!isCollapsed && (
                    <>
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
                    </>
                  )}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isCollapsed ? "center" : "end"} className="w-56 soft-shadow">
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

      {/* Mobile Menu Button - Fixed Position */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className={cn(
          "fixed top-4 left-4 z-40 md:hidden",
          "w-10 h-10 rounded-lg bg-background/90 backdrop-blur-sm border border-border",
          "flex items-center justify-center transition-all-soft soft-shadow-hover",
          "hover:bg-accent hover:text-accent-foreground"
        )}
        aria-label="Toggle mobile menu"
      >
        {isMobileMenuOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>
    </>
  );
}