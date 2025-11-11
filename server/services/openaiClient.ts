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
  tokensUsed?: {
    prompt: number;
    completion: number;
    total: number;
  };
  error?: string;
}

interface ModelQueue {
  queue: PQueue;
  tokenCount: number;
  lastReset: number;
  mutexLocked: boolean;
  mutexQueue: Array<() => void>;
}

class OpenAIClient {
  private client: OpenAI | null = null;
  private modelQueues: Map<string, ModelQueue> = new Map();
  private telemetry: TelemetryData[] = [];
  private apiKeyAvailable = false;

  constructor() {
    this.initializeClient();
    this.initializeQueues();
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

  private initializeQueues() {
    // Initialize separate queue for each model with proper rate limits
    for (const [model, limits] of Object.entries(RATE_LIMITS)) {
      this.modelQueues.set(model, {
        queue: new PQueue({
          concurrency: limits.maxConcurrent,
          interval: 60000, // 1 minute
          intervalCap: limits.maxRequestsPerMinute
        }),
        tokenCount: 0,
        lastReset: Date.now(),
        mutexLocked: false,
        mutexQueue: []
      });
    }
  }

  private getQueueForModel(model: string): ModelQueue {
    // Default to gpt-3.5-turbo if model not found
    return this.modelQueues.get(model) || this.modelQueues.get('gpt-3.5-turbo')!;
  }

  private resetTokenCountIfNeeded(modelQueue: ModelQueue) {
    const now = Date.now();
    // Reset token count every minute (use >= instead of >)
    if (now - modelQueue.lastReset >= 60000) {
      modelQueue.tokenCount = 0;
      modelQueue.lastReset = now;
    }
  }

  // Atomic check and reserve tokens with mutex
  private async checkAndReserveTokens(
    model: string, 
    estimatedTokens: number
  ): Promise<{ reserved: boolean; waitTime?: number }> {
    const modelQueue = this.getQueueForModel(model);
    const limits = RATE_LIMITS[model] || RATE_LIMITS['gpt-3.5-turbo'];

    // Use mutex to ensure atomic check and reserve
    const result = await this.withModelMutex(modelQueue, async () => {
      this.resetTokenCountIfNeeded(modelQueue);
      
      const newCount = modelQueue.tokenCount + estimatedTokens;
      
      if (newCount <= limits.maxTokensPerMinute) {
        modelQueue.tokenCount = newCount;
        return { reserved: true };
      }
      
      const waitTime = 60000 - (Date.now() - modelQueue.lastReset);
      return { reserved: false, waitTime };
    });
    
    return result;
  }

  // Release reserved tokens (for rollback)
  private async releaseReservedTokens(model: string, tokens: number) {
    const modelQueue = this.getQueueForModel(model);
    
    await this.withModelMutex(modelQueue, async () => {
      modelQueue.tokenCount = Math.max(0, modelQueue.tokenCount - tokens);
    });
  }

  // Adjust token count after getting actual usage
  private async adjustTokenCount(model: string, estimatedTokens: number, actualTokens: number) {
    const modelQueue = this.getQueueForModel(model);
    
    await this.withModelMutex(modelQueue, async () => {
      const adjustment = actualTokens - estimatedTokens;
      if (adjustment !== 0) {
        modelQueue.tokenCount = Math.max(0, modelQueue.tokenCount + adjustment);
      }
    });
  }

  // Per-model mutex wrapper
  private async withModelMutex<T>(
    modelQueue: ModelQueue, 
    fn: () => Promise<T>
  ): Promise<T> {
    // If mutex is locked OR there are waiters in queue, join the queue
    // This prevents new callers from bypassing existing waiters
    if (modelQueue.mutexLocked || modelQueue.mutexQueue.length > 0) {
      await new Promise<void>(resolve => {
        modelQueue.mutexQueue.push(resolve);
      });
    }
    
    // Acquire mutex lock
    modelQueue.mutexLocked = true;
    
    try {
      const result = await fn();
      return result;
    } finally {
      // Release mutex lock
      modelQueue.mutexLocked = false;
      
      // Wake next waiter if any
      const nextResolver = modelQueue.mutexQueue.shift();
      if (nextResolver) {
        // Set lock immediately for next waiter to prevent races
        modelQueue.mutexLocked = true;
        nextResolver();
      }
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
      const tokens = data.tokensUsed ? ` | Tokens: ${data.tokensUsed.total}` : '';
      console.log(`[OpenAI] ${data.feature} - ${data.model} - ${data.success ? 'SUCCESS' : 'FAILED'} - ${duration}ms${tokens}`);
    }
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    model: string,
    retries?: number,
    delay?: number
  ): Promise<T> {
    const limits = RATE_LIMITS[model] || RATE_LIMITS['gpt-3.5-turbo'];
    const maxRetries = retries ?? limits.retryAttempts;
    const baseDelay = delay ?? limits.retryDelayMs;
    
    try {
      return await fn();
    } catch (error: any) {
      if (maxRetries === 0) throw error;
      
      // Check for rate limit error
      if (error?.status === 429) {
        const retryAfter = error?.headers?.['retry-after'] || baseDelay / 1000;
        console.log(`Rate limited on ${model}. Retrying after ${retryAfter} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      } else {
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
      }
      
      return this.retryWithBackoff(fn, model, maxRetries - 1, baseDelay * 2);
    }
  }

  async withAI<T>(
    operation: (client: OpenAI) => Promise<T>,
    options: OpenAIClientOptions & { model?: string; estimatedTokens?: number }
  ): Promise<OpenAIResponse<T>> {
    const model = options.model || 'gpt-3.5-turbo';
    const estimatedTokens = options.estimatedTokens || 2000; // Default estimate
    const requestId = this.generateRequestId();
    const telemetry: TelemetryData = {
      feature: options.feature,
      model,
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

      // Atomically check and reserve tokens
      let reservationResult = await this.checkAndReserveTokens(model, estimatedTokens);
      
      // If tokens not available, handle wait or fallback
      if (!reservationResult.reserved) {
        const waitTime = reservationResult.waitTime || 60000;
        
        telemetry.error = `Token limit exceeded for ${model}. Would need to wait ${waitTime}ms`;
        telemetry.endTime = Date.now();
        await this.logTelemetry(telemetry);
        
        if (options.fallback !== undefined) {
          return {
            success: false,
            error: `Token limit exceeded. Using fallback.`,
            fallback: options.fallback
          };
        }
        
        // Wait for token budget to reset
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        // Re-check after waiting
        reservationResult = await this.checkAndReserveTokens(model, estimatedTokens);
        if (!reservationResult.reserved) {
          return {
            success: false,
            error: 'Token limit still exceeded after waiting'
          };
        }
      }

      // Get the appropriate queue for this model
      const modelQueue = this.getQueueForModel(model);
      
      // Queue the operation with priority
      const priority = options.priority === 'high' ? 1 : 
                      options.priority === 'low' ? 3 : 2;
      
      const result = await modelQueue.queue.add(
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
            model
          );
        },
        { priority }
      );

      // Extract token usage if available from the response
      if (result && typeof result === 'object' && 'usage' in result) {
        const usage = (result as any).usage;
        if (usage) {
          telemetry.tokensUsed = {
            prompt: usage.prompt_tokens || 0,
            completion: usage.completion_tokens || 0,
            total: usage.total_tokens || 0
          };
          
          // Adjust token count to actual usage
          await this.adjustTokenCount(model, estimatedTokens, usage.total_tokens || 0);
        }
      }

      telemetry.success = true;
      telemetry.endTime = Date.now();
      await this.logTelemetry(telemetry);

      return { success: true, data: result as T };
    } catch (error: any) {
      // Roll back reserved tokens on failure
      await this.releaseReservedTokens(model, estimatedTokens);
      
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
    options?: Partial<OpenAIClientOptions> & { 
      model?: 'gpt-3.5-turbo' | 'gpt-4';
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<OpenAIResponse<string>> {
    const model = options?.model || 'gpt-3.5-turbo';
    
    // Estimate tokens for the request
    const promptTokens = this.estimateTokens(prompt) + 
                        (systemPrompt ? this.estimateTokens(systemPrompt) : 0);
    const estimatedTokens = promptTokens + (options?.maxTokens ?? 1000);
    
    const response = await this.withAI(
      async (client) => {
        const completion = await client.chat.completions.create({
          model,
          messages: [
            ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
            { role: 'user' as const, content: prompt }
          ],
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 1000
        });
        
        return completion;
      },
      { 
        feature: 'text-generation', 
        model,
        estimatedTokens,
        ...options 
      }
    );
    
    if (response.success && response.data) {
      const content = (response.data as any).choices[0]?.message?.content || '';
      return { success: true, data: content };
    }
    
    // Ensure fallback is a string if provided
    const fallback = response.fallback !== undefined ? 
                    (typeof response.fallback === 'string' ? response.fallback : String(response.fallback)) : 
                    undefined;
    
    return {
      success: false,
      error: response.error,
      fallback
    };
  }

  async generateJSON<T = any>(
    prompt: string,
    systemPrompt?: string,
    options?: Partial<OpenAIClientOptions> & { 
      model?: 'gpt-3.5-turbo' | 'gpt-4';
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<OpenAIResponse<T>> {
    const model = options?.model || 'gpt-3.5-turbo';
    
    // Estimate tokens for the request
    const promptTokens = this.estimateTokens(prompt) + 
                        this.estimateTokens(systemPrompt || 'You are a helpful assistant that returns valid JSON responses.');
    const estimatedTokens = promptTokens + (options?.maxTokens ?? 2000);
    
    const response = await this.withAI(
      async (client) => {
        const completion = await client.chat.completions.create({
          model,
          messages: [
            { 
              role: 'system' as const, 
              content: systemPrompt || 'You are a helpful assistant that returns valid JSON responses.'
            },
            { role: 'user' as const, content: prompt }
          ],
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2000,
          response_format: { type: 'json_object' }
        });
        
        return completion;
      },
      { 
        feature: 'json-generation',
        model,
        estimatedTokens,
        ...options 
      }
    );
    
    if (response.success && response.data) {
      const content = (response.data as any).choices[0]?.message?.content || '{}';
      try {
        const parsed = JSON.parse(content) as T;
        return { success: true, data: parsed };
      } catch {
        return { 
          success: false, 
          error: 'Failed to parse JSON response from OpenAI',
          fallback: options?.fallback
        };
      }
    }
    
    return {
      success: false,
      error: response.error,
      fallback: response.fallback as T | undefined
    };
  }

  // Estimate token count for a text (rough approximation)
  estimateTokens(text: string): number {
    // Rough estimation: ~1 token per 4 characters
    return Math.ceil(text.length / 4);
  }

  // Get telemetry data for monitoring
  getTelemetry(): TelemetryData[] {
    return [...this.telemetry];
  }

  // Get queue statistics
  getQueueStats() {
    const stats: Record<string, any> = {};
    
    // Use Array.from to iterate over Map entries
    for (const [model, modelQueue] of Array.from(this.modelQueues.entries())) {
      stats[model] = {
        size: modelQueue.queue.size,
        pending: modelQueue.queue.pending,
        isPaused: modelQueue.queue.isPaused,
        tokenCount: modelQueue.tokenCount,
        limits: RATE_LIMITS[model]
      };
    }
    
    return stats;
  }

  // Check if API is available
  isAvailable(): boolean {
    return this.apiKeyAvailable;
  }

  // Get model-specific rate limit config
  getRateLimitForModel(model: string): RateLimitConfig {
    return RATE_LIMITS[model] || RATE_LIMITS['gpt-3.5-turbo'];
  }
}

// Export singleton instance
export const openAIClient = new OpenAIClient();

// Helper function for backwards compatibility
export async function withOpenAI<T>(
  operation: (client: OpenAI) => Promise<T>,
  options: OpenAIClientOptions & { model?: string }
): Promise<OpenAIResponse<T>> {
  return openAIClient.withAI(operation, options);
}