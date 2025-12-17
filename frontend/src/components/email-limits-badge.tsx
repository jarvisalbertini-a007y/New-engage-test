import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Mail, TrendingUp, Shield, Zap } from "lucide-react";

export function EmailLimitsBadge() {
  const { data: limits, isLoading } = useQuery<any>({
    queryKey: ["/api/emails/limits"],
    refetchInterval: 60000 // Refresh every minute
  });

  if (isLoading || !limits) {
    return null;
  }

  const percentage = ((limits.limit - limits.remaining) / limits.limit) * 100;
  const isWarning = limits.remaining < 10;
  const isDanger = limits.remaining === 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {limits.remaining}/{limits.limit}
                </span>
                <Badge 
                  variant={isDanger ? "destructive" : isWarning ? "outline" : "secondary"}
                  className="text-xs"
                >
                  {isDanger ? "Limit Reached" : isWarning ? "Low" : "Available"}
                </Badge>
              </div>
              <Progress 
                value={percentage} 
                className="h-1 w-24 mt-1"
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="w-80 p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="font-semibold">Email Sending Limits</span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Daily Limit:</span>
                <span className="font-medium">{limits.limit} emails</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sent Today:</span>
                <span className="font-medium">{limits.limit - limits.remaining}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remaining:</span>
                <span className="font-medium text-primary">{limits.remaining}</span>
              </div>
            </div>

            {limits.warmup && limits.warmup.daysRemaining > 0 && (
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Warming Up</span>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Current limit: {limits.warmup.currentLimit} emails/day</p>
                  <p>Target limit: {limits.warmup.targetLimit} emails/day</p>
                  <p>{limits.warmup.daysRemaining} days remaining</p>
                </div>
              </div>
            )}

            {limits.recommendations && limits.recommendations.length > 0 && (
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">Recommendations</span>
                </div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {limits.recommendations.slice(0, 3).map((rec: string, i: number) => (
                    <li key={i} className="flex items-start gap-1">
                      <span className="text-muted-foreground">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function EmailReputationIndicator() {
  const { data: config } = useQuery<any>({
    queryKey: ["/api/platform-config"]
  });
  
  const { data: reputation, isLoading } = useQuery({
    queryKey: ["/api/emails/check-reputation", config?.emailDomain],
    enabled: !!config?.emailDomain,
    queryFn: async () => {
      if (!config?.emailDomain) return null;
      const res = await fetch("/api/emails/check-reputation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: config.emailDomain }),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to check reputation");
      return res.json();
    },
    refetchInterval: 300000 // Refresh every 5 minutes
  });

  if (isLoading || !reputation) {
    return null;
  }

  const statusColors: Record<string, string> = {
    excellent: "text-green-500",
    good: "text-blue-500", 
    warning: "text-yellow-500",
    critical: "text-red-500"
  };

  const statusIcons: Record<string, string> = {
    excellent: "✓",
    good: "↗",
    warning: "!",
    critical: "✗"
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card cursor-help">
            <Shield className={`h-4 w-4 ${statusColors[reputation.status]}`} />
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">{reputation.score}%</span>
              <span className={`text-lg ${statusColors[reputation.status]}`}>
                {statusIcons[reputation.status]}
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="w-80 p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Domain Reputation</span>
              <Badge variant={
                reputation.status === 'excellent' ? 'default' :
                reputation.status === 'good' ? 'secondary' :
                reputation.status === 'warning' ? 'outline' :
                'destructive'
              }>
                {reputation.status.toUpperCase()}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <Progress value={reputation.score} className="flex-1" />
              <span className="text-sm font-medium">{reputation.score}%</span>
            </div>

            {reputation.recommendations && reputation.recommendations.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium">Recommendations:</span>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {reputation.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="flex items-start gap-1">
                      <AlertCircle className="h-3 w-3 mt-0.5 text-muted-foreground" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}