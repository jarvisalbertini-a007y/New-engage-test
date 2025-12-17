import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-20">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <span className="text-white text-xl">⚡</span>
            </div>
            <span className="text-white text-xl font-bold">EngageAI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10">
                Login
              </Button>
            </Link>
            <Link to="/register">
              <Button className="bg-white text-gray-900 hover:bg-gray-100">
                Get Started
              </Button>
            </Link>
          </div>
        </header>

        {/* Hero */}
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            The Fully Autonomous
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"> Sales Engine</span>
          </h1>
          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
            1000+ AI agents that research, qualify, and engage prospects while you focus on closing deals. Self-improving workflows powered by your company strategy.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="bg-white text-gray-900 hover:bg-gray-100 px-8">
                Start Free Trial
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-white border-white/20 hover:bg-white/10">
              Watch Demo
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-32">
          <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center mb-4">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">1000+ AI Agents</h3>
            <p className="text-gray-400">
              Comprehensive library of specialized agents for every sales task - prospecting, research, outreach, qualification, and more.
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-4">
              <span className="text-2xl">⚡</span>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Self-Improving Workflows</h3>
            <p className="text-gray-400">
              AI-powered workflows that learn from your success patterns and continuously optimize for better results.
            </p>
          </div>
          <div className="bg-white/5 rounded-2xl p-8 border border-white/10">
            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center mb-4">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Smart Onboarding</h3>
            <p className="text-gray-400">
              AI researches your company and automatically suggests ICP and strategy based on your domain.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-16 mt-32">
          <div className="text-center">
            <div className="text-4xl font-bold text-white">1000+</div>
            <div className="text-gray-400">AI Agents</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-white">10x</div>
            <div className="text-gray-400">Productivity</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-white">24/7</div>
            <div className="text-gray-400">Automation</div>
          </div>
        </div>
      </div>
    </div>
  );
}
