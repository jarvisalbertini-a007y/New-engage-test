import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { X, Filter } from "lucide-react";

interface LeadFiltersProps {
  filters: {
    industry: string;
    size: string;
    location: string;
    technologies: string[];
  };
  onFiltersChange: (filters: any) => void;
  companies: Array<any>;
}

const companySizes = [
  "1-10",
  "11-50", 
  "51-200",
  "201-500",
  "501-1000",
  "1000+",
];

const technologies = [
  "React",
  "Node.js", 
  "Python",
  "AWS",
  "Azure",
  "Google Cloud",
  "Kubernetes",
  "Docker",
  "PostgreSQL",
  "MongoDB",
  "Redis",
  "Elasticsearch",
  "Salesforce",
  "HubSpot",
  "Slack",
  "Microsoft Teams",
  "Zoom",
  "Stripe",
  "PayPal",
  "Shopify",
];

const buyingSignals = [
  "Recently funded",
  "Hiring actively", 
  "New leadership",
  "Product launch",
  "Expanding internationally",
  "Technology adoption",
  "Competitor mentions",
  "Pricing page visits",
];

export default function LeadFilters({ filters, onFiltersChange, companies }: LeadFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);
  const [revenueRange, setRevenueRange] = useState([0, 100]);
  const [employeeRange, setEmployeeRange] = useState([1, 10000]);
  const [selectedBuyingSignals, setSelectedBuyingSignals] = useState<string[]>([]);

  // Get unique industries from companies
  const industries = [...new Set(companies.map(c => c.industry).filter(Boolean))];
  
  // Get unique locations from companies
  const locations = [...new Set(companies.map(c => c.location).filter(Boolean))];

  const updateFilter = (key: string, value: any) => {
    const updated = { ...localFilters, [key]: value };
    setLocalFilters(updated);
    onFiltersChange(updated);
  };

  const addTechnology = (tech: string) => {
    if (!localFilters.technologies.includes(tech)) {
      const updated = [...localFilters.technologies, tech];
      updateFilter("technologies", updated);
    }
  };

  const removeTechnology = (tech: string) => {
    const updated = localFilters.technologies.filter(t => t !== tech);
    updateFilter("technologies", updated);
  };

  const clearAllFilters = () => {
    const cleared = {
      industry: "",
      size: "",
      location: "",
      technologies: [],
    };
    setLocalFilters(cleared);
    setSelectedBuyingSignals([]);
    setRevenueRange([0, 100]);
    setEmployeeRange([1, 10000]);
    onFiltersChange(cleared);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (localFilters.industry) count++;
    if (localFilters.size) count++;
    if (localFilters.location) count++;
    if (localFilters.technologies.length > 0) count++;
    if (selectedBuyingSignals.length > 0) count++;
    if (revenueRange[0] > 0 || revenueRange[1] < 100) count++;
    if (employeeRange[0] > 1 || employeeRange[1] < 10000) count++;
    return count;
  };

  return (
    <div className="space-y-6">
      {/* Filter Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Filters</h3>
          {getActiveFilterCount() > 0 && (
            <Badge variant="secondary">{getActiveFilterCount()} active</Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={clearAllFilters} data-testid="button-clear-filters">
          Clear All
        </Button>
      </div>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Company Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Industry</Label>
              <Select value={localFilters.industry} onValueChange={(value) => updateFilter("industry", value)}>
                <SelectTrigger data-testid="select-industry-filter">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Industries</SelectItem>
                  {industries.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Company Size</Label>
              <Select value={localFilters.size} onValueChange={(value) => updateFilter("size", value)}>
                <SelectTrigger data-testid="select-size-filter">
                  <SelectValue placeholder="Select company size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Sizes</SelectItem>
                  {companySizes.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size} employees
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Location</Label>
            <Select value={localFilters.location} onValueChange={(value) => updateFilter("location", value)}>
              <SelectTrigger data-testid="select-location-filter">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Locations</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Employee Count Range</Label>
            <div className="px-2 py-4">
              <Slider
                value={employeeRange}
                onValueChange={setEmployeeRange}
                max={10000}
                min={1}
                step={50}
                className="w-full"
                data-testid="slider-employee-range"
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>{employeeRange[0]} employees</span>
                <span>{employeeRange[1]}+ employees</span>
              </div>
            </div>
          </div>

          <div>
            <Label>Revenue Range (Millions)</Label>
            <div className="px-2 py-4">
              <Slider
                value={revenueRange}
                onValueChange={setRevenueRange}
                max={100}
                min={0}
                step={5}
                className="w-full"
                data-testid="slider-revenue-range"
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-2">
                <span>${revenueRange[0]}M</span>
                <span>${revenueRange[1]}M+</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technology Stack */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Technology Stack</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Technologies Used</Label>
            <Select onValueChange={addTechnology}>
              <SelectTrigger data-testid="select-technology">
                <SelectValue placeholder="Add technology filter" />
              </SelectTrigger>
              <SelectContent>
                {technologies
                  .filter(tech => !localFilters.technologies.includes(tech))
                  .map((tech) => (
                    <SelectItem key={tech} value={tech}>
                      {tech}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {localFilters.technologies.length > 0 && (
            <div>
              <Label className="text-sm text-muted-foreground">Selected Technologies</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {localFilters.technologies.map((tech) => (
                  <Badge key={tech} variant="secondary" className="flex items-center gap-1">
                    {tech}
                    <button
                      onClick={() => removeTechnology(tech)}
                      className="ml-1 hover:text-destructive"
                      data-testid={`button-remove-tech-${tech}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Buying Signals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buying Signals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {buyingSignals.map((signal) => (
              <div key={signal} className="flex items-center space-x-2">
                <Checkbox
                  id={signal}
                  checked={selectedBuyingSignals.includes(signal)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedBuyingSignals([...selectedBuyingSignals, signal]);
                    } else {
                      setSelectedBuyingSignals(selectedBuyingSignals.filter(s => s !== signal));
                    }
                  }}
                  data-testid={`checkbox-signal-${signal}`}
                />
                <Label htmlFor={signal} className="text-sm">
                  {signal}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Advanced Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="verified-emails" data-testid="checkbox-verified-emails" />
              <Label htmlFor="verified-emails" className="text-sm">
                Verified emails only
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="has-phone" data-testid="checkbox-has-phone" />
              <Label htmlFor="has-phone" className="text-sm">
                Has phone number
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="has-linkedin" data-testid="checkbox-has-linkedin" />
              <Label htmlFor="has-linkedin" className="text-sm">
                Has LinkedIn profile
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="active-website" data-testid="checkbox-active-website" />
              <Label htmlFor="active-website" className="text-sm">
                Active website
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Apply Filters */}
      <div className="flex items-center justify-between pt-4">
        <p className="text-sm text-muted-foreground">
          {getActiveFilterCount()} filter{getActiveFilterCount() !== 1 ? 's' : ''} applied
        </p>
        <Button data-testid="button-apply-filters">
          Apply Filters
        </Button>
      </div>
    </div>
  );
}
