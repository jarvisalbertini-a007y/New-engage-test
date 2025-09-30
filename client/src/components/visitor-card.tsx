import { Building, Clock, Globe, DollarSign, Cpu, MapPin } from "lucide-react";

interface VisitorCardProps {
  company: string;
  domain?: string;
  location: string;
  visitors: number;
  intentScore: number;
  timeAgo: string;
  pages: string[];
  industry?: string;
  size?: string;
  revenue?: string;
  technologies?: string[];
  ipAddress?: string;
}

export default function VisitorCard({ 
  company, 
  domain,
  location, 
  visitors, 
  intentScore, 
  timeAgo, 
  pages, 
  industry, 
  size,
  revenue,
  technologies,
  ipAddress
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
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium" data-testid={`text-company-${company.toLowerCase().replace(/\s+/g, '-')}`}>
                {company}
              </p>
              {domain && (
                <a 
                  href={`https://${domain}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Globe className="h-3 w-3" />
                  {domain}
                </a>
              )}
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-3">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {location}
              </span>
              <span>{visitors} visitor{visitors !== 1 ? 's' : ''}</span>
              {revenue && (
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  {revenue}
                </span>
              )}
              {ipAddress && (
                <span className="text-xs">IP: {ipAddress}</span>
              )}
            </div>
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
      <div className="mt-3 flex items-center gap-2 flex-wrap">
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
            {size} employees
          </span>
        )}
        {technologies && technologies.length > 0 && (
          <>
            <Cpu className="h-3 w-3 text-muted-foreground" />
            {technologies.slice(0, 3).map((tech, index) => (
              <span key={index} className="bg-primary/10 text-primary px-2 py-1 rounded text-xs">
                {tech}
              </span>
            ))}
            {technologies.length > 3 && (
              <span className="text-xs text-muted-foreground">+{technologies.length - 3} more</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
