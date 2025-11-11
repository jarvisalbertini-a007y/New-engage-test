import OpenAI from 'openai';
import PQueue from 'p-queue';
import type { 
  OpenAIResponse, 
  OpenAIClientOptions, 
  RateLimitConfig,
  FallbackPolicy,
  FALLBACK_POLICIES
} from '@shared/ai';

// Rate limit configuration per OpenAI model tier
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'gpt-4': {
    maxRequestsPerMinute: 60,
    maxTokensPerMinute: 10000,
    maxConcurrent: 5,
    retryAttempts: 3,
    retryDelayMs: 1000
  },
  'gpt-3.5-turbo': {
    maxRequestsPerMinute: 90,
    maxTokensPerMinute: 90000,
    maxConcurrent: 10,
    retryAttempts: 3,
    retryDelayMs: 500
  }
};

// Telemetry tracking
interface TelemetryData {
  feature: string;
  model: string;
  requestId: string;
  startTime: number;
  endTime?: number;
  success: boolean;
  tokensUsed?: number;
  error?: string;
}

class OpenAIClient {
  private client: OpenAI | null = null;
  private queue: PQueue;
  private telemetry: TelemetryData[] = [];
  private requestCount = 0;
  private lastResetTime = Date.now();
  private apiKeyAvailable = false;

  constructor() {
    // Initialize queue with conservative defaults
    this.queue = new PQueue({ 
      concurrency: 5,
      interval: 60000, // 1 minute
      intervalCap: 60 // 60 requests per minute max
    });
    
    this.initializeClient();
  }

  private initializeClient() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey.startsWith('sk-')) {
      this.client = new OpenAI({ apiKey });
      this.apiKeyAvailable = true;
      console.log('OpenAI client initialized successfully');
    } else {
      console.log('OpenAI API key not configured - AI features will use fallbacks');
      this.apiKeyAvailable = false;
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async logTelemetry(data: TelemetryData) {
    this.telemetry.push(data);
    
    // Keep only last 1000 entries
    if (this.telemetry.length > 1000) {
      this.telemetry = this.telemetry.slice(-1000);
    }
    
    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      const duration = data.endTime ? data.endTime - data.startTime : 0;
      console.log(`[OpenAI] ${data.feature} - ${data.success ? 'SUCCESS' : 'FAILED'} - ${duration}ms`);
    }
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number,
    delay: number
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (retries === 0) throw error;
      
      // Check for rate limit error
      if (error?.status === 429) {
        const retryAfter = error?.headers?.['retry-after'] || delay / 1000;
        console.log(`Rate limited. Retrying after ${retryAfter} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      } else {
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
      }
      
      return this.retryWithBackoff(fn, retries - 1, delay * 2);
    }
  }

  async withAI<T>(
    operation: (client: OpenAI) => Promise<T>,
    options: OpenAIClientOptions
  ): Promise<OpenAIResponse<T>> {
    const requestId = this.generateRequestId();
    const telemetry: TelemetryData = {
      feature: options.feature,
      model: 'gpt-3.5-turbo', // Default, will be updated if different
      requestId,
      startTime: Date.now(),
      success: false
    };

    try {
      // Check if API key is available
      if (!this.apiKeyAvailable || !this.client) {
        telemetry.error = 'OpenAI API key not configured';
        telemetry.endTime = Date.now();
        await this.logTelemetry(telemetry);
        
        if (options.fallback !== undefined) {
          return { 
            success: false, 
            error: 'OpenAI API key not configured',
            fallback: options.fallback 
          };
        }
        
        return { 
          success: false, 
          error: 'OpenAI API key not configured. Please add your OpenAI API key to enable AI features.'
        };
      }

      // Queue the operation with priority
      const priority = options.priority === 'high' ? 1 : 
                      options.priority === 'low' ? 3 : 2;
      
      const result = await this.queue.add(
        async () => {
          return this.retryWithBackoff(
            async () => {
              const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('OpenAI request timeout')), 
                          options.timeout || 30000);
              });
              
              const operationPromise = operation(this.client!);
              
              return Promise.race([operationPromise, timeoutPromise]);
            },
            RATE_LIMITS['gpt-3.5-turbo'].retryAttempts,
            RATE_LIMITS['gpt-3.5-turbo'].retryDelayMs
          );
        },
        { priority }
      );

      telemetry.success = true;
      telemetry.endTime = Date.now();
      await this.logTelemetry(telemetry);

      return { success: true, data: result as T };
    } catch (error: any) {
      telemetry.success = false;
      telemetry.error = error.message;
      telemetry.endTime = Date.now();
      await this.logTelemetry(telemetry);

      // Call error handler if provided
      if (options.onError) {
        options.onError(error);
      }

      // Return fallback if available
      if (options.fallback !== undefined) {
        return { 
          success: false, 
          error: error.message,
          fallback: options.fallback 
        };
      }

      return { 
        success: false, 
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  async generateText(
    prompt: string,
    systemPrompt?: string,
    options?: Partial<OpenAIClientOptions>
  ): Promise<OpenAIResponse<string>> {
    return this.withAI(
      async (client) => {
        const response = await client.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
            { role: 'user' as const, content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 1000
        });
        
        return response.choices[0]?.message?.content || '';
      },
      { feature: 'text-generation', ...options }
    );
  }

  async generateJSON<T = any>(
    prompt: string,
    systemPrompt?: string,
    options?: Partial<OpenAIClientOptions>
  ): Promise<OpenAIResponse<T>> {
    return this.withAI(
      async (client) => {
        const response = await client.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { 
              role: 'system' as const, 
              content: systemPrompt || 'You are a helpful assistant that returns valid JSON responses.'
            },
            { role: 'user' as const, content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        });
        
        const content = response.choices[0]?.message?.content || '{}';
        try {
          return JSON.parse(content) as T;
        } catch {
          throw new Error('Failed to parse JSON response from OpenAI');
        }
      },
      { feature: 'json-generation', ...options }
    );
  }

  // Get telemetry data for monitoring
  getTelemetry(): TelemetryData[] {
    return [...this.telemetry];
  }

  // Get queue statistics
  getQueueStats() {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      isPaused: this.queue.isPaused
    };
  }

  // Check if API is available
  isAvailable(): boolean {
    return this.apiKeyAvailable;
  }
}

// Export singleton instance
export const openAIClient = new OpenAIClient();

// Helper function for backwards compatibility
export async function withOpenAI<T>(
  operation: (client: OpenAI) => Promise<T>,
  options: OpenAIClientOptions
): Promise<OpenAIResponse<T>> {
  return openAIClient.withAI(operation, options);
}