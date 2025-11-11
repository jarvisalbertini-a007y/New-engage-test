// Shared AI contracts for standardized AI-enhanced responses across the platform

export interface AIEnhancedResponse<T = any> {
  result: T; // The actual result
  aiGenerated: boolean; // Whether AI was used
  confidence?: number; // Confidence score if applicable (0-100)
  metadata?: {
    model?: string;
    processingTime?: number;
    fallbackUsed?: boolean;
    error?: string;
  };
}

export interface OpenAIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  fallback?: T; // Mock data when OpenAI fails
}

// Email Coach Rubric Types
export interface EmailRubric {
  meddic: MEDDICScore;
  commandOfMessage: CommandOfMessageScore;
  neverSplitDifference: NeverSplitDifferenceScore;
  overallScore: number; // 0-100
}

export interface MEDDICScore {
  metrics: { present: boolean; score: number; details: string };
  economicBuyer: { present: boolean; score: number; details: string };
  decisionCriteria: { present: boolean; score: number; details: string };
  decisionProcess: { present: boolean; score: number; details: string };
  identifyPain: { present: boolean; score: number; details: string };
  champion: { present: boolean; score: number; details: string };
  totalScore: number; // 0-100
}

export interface CommandOfMessageScore {
  conciseness: { wordCount: number; score: number; target: number }; // Target: <200 words
  readingLevel: { level: number; score: number; target: number }; // Target: 8th grade
  youToIRatio: { ratio: number; score: number; target: number }; // Target: 2:1
  paragraphLength: { avgWords: number; score: number; target: number }; // Target: <30 words
  totalScore: number; // 0-100
}

export interface NeverSplitDifferenceScore {
  mirroring: { present: boolean; score: number; examples: string[] };
  labeling: { present: boolean; score: number; examples: string[] };
  calibratedQuestions: { present: boolean; score: number; examples: string[] };
  empathy: { present: boolean; score: number; examples: string[] };
  totalScore: number; // 0-100
}

export interface EmailAnalysisResult extends AIEnhancedResponse<{
  rubric: EmailRubric;
  suggestions: EmailSuggestion[];
  improvedVersion?: string;
  qualitativeFeedback: string;
}> {}

export interface EmailSuggestion {
  type: 'critical' | 'improvement' | 'enhancement';
  category: 'meddic' | 'command' | 'negotiation' | 'general';
  issue: string;
  suggestion: string;
  example?: string;
}

// Content Generation Types
export interface GeneratedContent {
  subject?: string;
  body: string;
  tone: string;
  personalizationElements: string[];
  confidence: number;
}

export interface SequenceStep {
  stepNumber: number;
  type: 'email' | 'linkedin' | 'phone' | 'wait';
  delay: number; // days
  subject?: string;
  template: string;
  aiEnhanced?: boolean;
}

// Workflow Types
export interface WorkflowExecutionResult extends AIEnhancedResponse<{
  workflowId: string;
  executionId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  steps: WorkflowStepResult[];
}> {}

export interface WorkflowStepResult {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  output?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// Rate Limiting Types
export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxTokensPerMinute: number;
  maxConcurrent: number;
  retryAttempts: number;
  retryDelayMs: number;
}

export interface OpenAIClientOptions {
  feature: string; // Feature name for telemetry
  fallback?: any; // Fallback response if OpenAI fails
  onError?: (error: Error) => void; // Error callback
  timeout?: number; // Request timeout in ms
  priority?: 'high' | 'normal' | 'low'; // Queue priority
}

// Prompt Templates
export interface PromptTemplate {
  system: string;
  user: string;
  variables: Record<string, any>;
  temperature?: number;
  maxTokens?: number;
}

export const FALLBACK_POLICIES = {
  CRITICAL: 'error', // Return error, no fallback
  ENHANCED: 'fallback', // Use fallback data
  OPTIONAL: 'skip' // Skip AI enhancement, return base result
} as const;

export type FallbackPolicy = typeof FALLBACK_POLICIES[keyof typeof FALLBACK_POLICIES];