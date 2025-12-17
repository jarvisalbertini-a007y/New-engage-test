import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Target, Zap, TrendingUp, Users, Mail, Bot, 
  BarChart, Shield, CheckCircle, ArrowRight
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center space-y-8">
            <h1 className="font-display text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              AI-First Sales Engagement Platform
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Transform your sales process with intelligent automation, real-time visitor tracking, 
              and AI-powered personalization. Close more deals with less effort.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button 
                size="lg" 
                onClick={() => window.location.href = "/api/login"}
                data-testid="button-login"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => window.location.href = "/api/login"}
              >
                View Demo
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="py-20 bg-background/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold mb-4">
              Everything You Need to Accelerate Sales
            </h2>
            <p className="text-muted-foreground text-lg">
              Powered by AI, built for sales teams
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 space-y-3">
                <Target className="h-10 w-10 text-primary" />
                <h3 className="font-semibold text-lg">Visitor Intelligence</h3>
                <p className="text-muted-foreground">
                  De-anonymize website visitors and track intent in real-time
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 space-y-3">
                <Bot className="h-10 w-10 text-primary" />
                <h3 className="font-semibold text-lg">AI Autopilot</h3>
                <p className="text-muted-foreground">
                  Autonomous prospecting and engagement with smart workflows
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 space-y-3">
                <Mail className="h-10 w-10 text-primary" />
                <h3 className="font-semibold text-lg">Email Coach</h3>
                <p className="text-muted-foreground">
                  AI-powered email analysis and improvement suggestions
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 space-y-3">
                <Zap className="h-10 w-10 text-primary" />
                <h3 className="font-semibold text-lg">Multi-Channel Sequences</h3>
                <p className="text-muted-foreground">
                  Orchestrate email, calls, and LinkedIn outreach automatically
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 space-y-3">
                <TrendingUp className="h-10 w-10 text-primary" />
                <h3 className="font-semibold text-lg">Lead Scoring</h3>
                <p className="text-muted-foreground">
                  AI-powered lead prioritization and predictive scoring
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 space-y-3">
                <BarChart className="h-10 w-10 text-primary" />
                <h3 className="font-semibold text-lg">Analytics Dashboard</h3>
                <p className="text-muted-foreground">
                  Real-time insights into performance and conversion metrics
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="font-display text-3xl font-bold">
                Why Sales Teams Choose Our Platform
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-semibold">10x Productivity</h4>
                    <p className="text-muted-foreground">
                      Automate repetitive tasks and focus on closing deals
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Higher Conversion Rates</h4>
                    <p className="text-muted-foreground">
                      AI-powered personalization increases response rates by 40%
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Complete Visibility</h4>
                    <p className="text-muted-foreground">
                      Track every interaction and measure what matters
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-6 w-6 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Team Collaboration</h4>
                    <p className="text-muted-foreground">
                      Real-time workspaces and shared deal management
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-primary/5">
                  <CardContent className="p-6 text-center">
                    <div className="text-3xl font-bold text-primary">95%</div>
                    <div className="text-sm text-muted-foreground">Email Deliverability</div>
                  </CardContent>
                </Card>
                <Card className="bg-primary/5">
                  <CardContent className="p-6 text-center">
                    <div className="text-3xl font-bold text-primary">3.2x</div>
                    <div className="text-sm text-muted-foreground">More Meetings</div>
                  </CardContent>
                </Card>
                <Card className="bg-primary/5">
                  <CardContent className="p-6 text-center">
                    <div className="text-3xl font-bold text-primary">45%</div>
                    <div className="text-sm text-muted-foreground">Time Saved</div>
                  </CardContent>
                </Card>
                <Card className="bg-primary/5">
                  <CardContent className="p-6 text-center">
                    <div className="text-3xl font-bold text-primary">2.5x</div>
                    <div className="text-sm text-muted-foreground">ROI Increase</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="py-20 bg-background/50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-6" />
          <h2 className="font-display text-3xl font-bold mb-4">
            Enterprise-Grade Security
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
            Your data is protected with industry-leading security measures and compliance standards
          </p>
          <div className="flex items-center justify-center gap-8 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span>SOC 2 Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span>GDPR Ready</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span>256-bit Encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <span>99.9% Uptime</span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl font-bold mb-4">
            Ready to Transform Your Sales Process?
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Join thousands of sales teams using AI to close more deals
          </p>
          <Button 
            size="lg" 
            onClick={() => window.location.href = "/api/login"}
            data-testid="button-cta-login"
          >
            Start Free Trial
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              <span className="font-semibold">Sales AI Pro</span>
            </div>
            <div className="text-sm text-muted-foreground">
              © 2024 Sales AI Pro. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}