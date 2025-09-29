import { Building, Clock } from "lucide-react";

interface VisitorCardProps {
  company: string;
  location: string;
  visitors: number;
  intentScore: number;
  timeAgo: string;
  pages: string[];
  industry?: string;
  size?: string;
}

export default function VisitorCard({ 
  company, 
  location, 
  visitors, 
  intentScore, 
  timeAgo, 
  pages, 
  industry, 
  size 
}: VisitorCardProps) {
  const getIntentColor = (score: number) => {
    if (score >= 80) return "bg-chart-1 text-background";
    if (score >= 60) return "bg-chart-2 text-background";
    return "bg-chart-4 text-background";
  };

  const getIntentLabel = (score: number) => {
    if (score >= 80) return "High Intent";
    if (score >= 60) return "Medium Intent";
    return "Low Intent";
  };

  return (
    <div className="p-4 hover:bg-muted/50 transition-colors" data-testid={`card-visitor-${company.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Building className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium" data-testid={`text-company-${company.toLowerCase().replace(/\s+/g, '-')}`}>
              {company}
            </p>
            <p className="text-sm text-muted-foreground">
              {location} • {visitors} visitor{visitors !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getIntentColor(intentScore)}`}>
            {getIntentLabel(intentScore)}: {intentScore}
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {timeAgo}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center space-x-2 flex-wrap">
        {pages.map((page, index) => (
          <span key={index} className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs">
            {page}
          </span>
        ))}
        {industry && (
          <span className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs">
            {industry}
          </span>
        )}
        {size && (
          <span className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs">
            {size}
          </span>
        )}
      </div>
    </div>
  );
}
