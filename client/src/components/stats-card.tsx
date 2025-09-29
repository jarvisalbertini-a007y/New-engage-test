import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeLabel?: string;
  icon: LucideIcon;
  color: "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5";
}

export default function StatsCard({ title, value, change, changeLabel, icon: Icon, color }: StatsCardProps) {
  const colorClasses = {
    "chart-1": "text-chart-1 bg-chart-1/10",
    "chart-2": "text-chart-2 bg-chart-2/10", 
    "chart-3": "text-chart-3 bg-chart-3/10",
    "chart-4": "text-chart-4 bg-chart-4/10",
    "chart-5": "text-chart-5 bg-chart-5/10",
  };

  const textColorClasses = {
    "chart-1": "text-chart-1",
    "chart-2": "text-chart-2",
    "chart-3": "text-chart-3", 
    "chart-4": "text-chart-4",
    "chart-5": "text-chart-5",
  };

  return (
    <div className="bg-card p-6 rounded-lg border border-border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={`text-3xl font-bold ${textColorClasses[color]}`} data-testid={`text-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            {value}
          </p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className={`h-6 w-6 ${textColorClasses[color]}`} />
        </div>
      </div>
      {change && changeLabel && (
        <div className="mt-4 flex items-center text-sm">
          <span className={`font-medium ${textColorClasses[color]}`}>↗ {change}</span>
          <span className="text-muted-foreground ml-2">{changeLabel}</span>
        </div>
      )}
    </div>
  );
}
