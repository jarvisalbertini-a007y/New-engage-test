import { DollarSign, UserPlus, Rocket, Briefcase, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InsightCardProps {
  id: string;
  type: string;
  title: string;
  description: string;
  timeAgo?: string;
  onGenerateMessage?: (insightId: string) => void;
}

const getInsightIcon = (type: string) => {
  switch (type) {
    case 'funding':
      return DollarSign;
    case 'leadership_change':
      return UserPlus;
    case 'product_launch':
      return Rocket;
    case 'hiring':
      return Briefcase;
    default:
      return TrendingUp;
  }
};

const getInsightColor = (type: string) => {
  switch (type) {
    case 'funding':
      return 'bg-chart-1/10 text-chart-1';
    case 'leadership_change':
      return 'bg-chart-2/10 text-chart-2';
    case 'product_launch':
      return 'bg-chart-4/10 text-chart-4';
    case 'hiring':
      return 'bg-chart-3/10 text-chart-3';
    default:
      return 'bg-chart-5/10 text-chart-5';
  }
};

export default function InsightCard({ id, type, title, description, timeAgo, onGenerateMessage }: InsightCardProps) {
  const Icon = getInsightIcon(type);
  const colorClass = getInsightColor(type);

  return (
    <div className="p-4" data-testid={`card-insight-${id}`}>
      <div className="flex items-start space-x-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm" data-testid={`text-insight-title-${id}`}>
            {title}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
          {timeAgo && (
            <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
          )}
          <div className="mt-2">
            <Button
              size="sm"
              onClick={() => onGenerateMessage?.(id)}
              data-testid={`button-generate-message-${id}`}
            >
              Generate Message
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
