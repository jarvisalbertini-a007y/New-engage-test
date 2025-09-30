import { storage } from "../storage";

// Track daily email sends per user
const dailySendTracker = new Map<string, { count: number; date: string }>();

/**
 * Check if user can send more emails today based on their daily limit
 */
export async function canSendEmail(userId: string): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const config = await storage.getPlatformConfig(userId);
  const limit = config?.dailySendLimit || 50;
  
  const today = new Date().toISOString().split('T')[0];
  const tracker = dailySendTracker.get(userId);
  
  // Reset counter if it's a new day
  if (!tracker || tracker.date !== today) {
    dailySendTracker.set(userId, { count: 0, date: today });
  }
  
  const currentCount = dailySendTracker.get(userId)!.count;
  const remaining = Math.max(0, limit - currentCount);
  
  return {
    allowed: currentCount < limit,
    remaining,
    limit
  };
}

/**
 * Increment the send counter for a user
 */
export function incrementSendCount(userId: string): void {
  const today = new Date().toISOString().split('T')[0];
  const tracker = dailySendTracker.get(userId);
  
  if (!tracker || tracker.date !== today) {
    dailySendTracker.set(userId, { count: 1, date: today });
  } else {
    tracker.count++;
  }
}

/**
 * Get email warmup schedule based on account age and settings
 */
export async function getWarmupSchedule(userId: string): Promise<{
  currentLimit: number;
  targetLimit: number;
  daysRemaining: number;
  warmupRate: number;
}> {
  const config = await storage.getPlatformConfig(userId);
  
  if (!config?.warmupEnabled) {
    return {
      currentLimit: config?.dailySendLimit || 50,
      targetLimit: config?.dailySendLimit || 50,
      daysRemaining: 0,
      warmupRate: 0
    };
  }
  
  // Calculate warmup based on account creation date
  const accountAge = 15; // Mock: days since account creation
  const targetLimit = config.dailySendLimit || 50;
  const warmupDuration = 30; // 30 days to reach full capacity
  
  // Start at 10% and gradually increase
  const warmupProgress = Math.min(1, accountAge / warmupDuration);
  const currentLimit = Math.floor(targetLimit * 0.1 + (targetLimit * 0.9 * warmupProgress));
  const daysRemaining = Math.max(0, warmupDuration - accountAge);
  const warmupRate = targetLimit / warmupDuration;
  
  return {
    currentLimit,
    targetLimit,
    daysRemaining,
    warmupRate
  };
}

/**
 * Check domain reputation and provide recommendations
 */
export async function checkDomainReputation(domain: string): Promise<{
  score: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  recommendations: string[];
}> {
  // Mock reputation check - in production would check actual reputation services
  const score = 85 + Math.random() * 10;
  
  let status: 'excellent' | 'good' | 'warning' | 'critical';
  const recommendations: string[] = [];
  
  if (score >= 90) {
    status = 'excellent';
    recommendations.push("Keep up the excellent sending practices");
  } else if (score >= 80) {
    status = 'good';
    recommendations.push("Monitor bounce rates closely");
    recommendations.push("Ensure consistent engagement rates");
  } else if (score >= 60) {
    status = 'warning';
    recommendations.push("Reduce sending volume temporarily");
    recommendations.push("Clean your email list of inactive contacts");
    recommendations.push("Implement double opt-in for new subscribers");
  } else {
    status = 'critical';
    recommendations.push("Immediately pause all campaigns");
    recommendations.push("Audit your email list for invalid addresses");
    recommendations.push("Review content for spam triggers");
    recommendations.push("Consider using a dedicated IP");
  }
  
  return {
    score: Math.round(score),
    status,
    recommendations
  };
}

/**
 * Apply rate limiting to protect domain reputation
 */
export async function applyRateLimit(userId: string, recipientDomain: string): Promise<{
  shouldDelay: boolean;
  delayMs: number;
  reason?: string;
}> {
  // Rate limit per recipient domain to avoid spam filters
  const domainsPerHour = new Map<string, number>();
  const maxPerDomainPerHour = 5;
  
  const currentHour = new Date().getHours();
  const key = `${recipientDomain}-${currentHour}`;
  
  const currentCount = domainsPerHour.get(key) || 0;
  
  if (currentCount >= maxPerDomainPerHour) {
    return {
      shouldDelay: true,
      delayMs: 3600000, // 1 hour
      reason: `Rate limit for ${recipientDomain} domain reached`
    };
  }
  
  domainsPerHour.set(key, currentCount + 1);
  
  // Also apply general rate limiting - max 1 email per 30 seconds
  return {
    shouldDelay: true,
    delayMs: 30000,
    reason: "Standard rate limiting to maintain reputation"
  };
}

/**
 * Validate email content for spam triggers
 */
export function validateEmailContent(content: string): {
  isValid: boolean;
  spamScore: number;
  issues: string[];
} {
  const issues: string[] = [];
  let spamScore = 0;
  
  // Check for common spam triggers
  const spamPhrases = [
    'act now', 'limited time', 'click here', 'buy now', 'free money',
    'guarantee', 'no obligation', 'risk-free', 'urgent', 'winner',
    'congratulations', 'prize', 'lottery', 'viagra', 'casino'
  ];
  
  const lowerContent = content.toLowerCase();
  
  for (const phrase of spamPhrases) {
    if (lowerContent.includes(phrase)) {
      issues.push(`Contains spam trigger: "${phrase}"`);
      spamScore += 10;
    }
  }
  
  // Check for excessive caps
  const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
  if (capsRatio > 0.3) {
    issues.push("Excessive use of capital letters");
    spamScore += 15;
  }
  
  // Check for too many exclamation marks
  const exclamationCount = (content.match(/!/g) || []).length;
  if (exclamationCount > 2) {
    issues.push("Too many exclamation marks");
    spamScore += 10;
  }
  
  // Check for suspicious links
  const linkCount = (content.match(/https?:\/\//g) || []).length;
  if (linkCount > 3) {
    issues.push("Too many links");
    spamScore += 20;
  }
  
  return {
    isValid: spamScore < 30,
    spamScore: Math.min(100, spamScore),
    issues
  };
}

/**
 * Get sending recommendations based on current performance
 */
export async function getSendingRecommendations(userId: string): Promise<string[]> {
  const recommendations: string[] = [];
  const config = await storage.getPlatformConfig(userId);
  
  if (!config) {
    recommendations.push("Complete Magic Setup to optimize your sending configuration");
    return recommendations;
  }
  
  const warmup = await getWarmupSchedule(userId);
  
  if (warmup.daysRemaining > 0) {
    recommendations.push(`Email warming in progress: ${warmup.daysRemaining} days remaining`);
    recommendations.push(`Current daily limit: ${warmup.currentLimit} emails`);
  }
  
  const { remaining } = await canSendEmail(userId);
  if (remaining < 10) {
    recommendations.push(`Only ${remaining} emails remaining today`);
  }
  
  if (!config.emailDomain) {
    recommendations.push("Configure your email domain for better deliverability");
  }
  
  // Add general best practices
  recommendations.push("Send emails between 10 AM - 2 PM recipient time for best engagement");
  recommendations.push("Personalize subject lines to improve open rates");
  recommendations.push("Keep email content under 150 words for better readability");
  
  return recommendations;
}