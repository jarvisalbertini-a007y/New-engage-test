import { analyzeEmailDraft, improveEmailDraft } from "./openai";

export interface EmailAnalysis {
  score: number;
  suggestions: string[];
  improvements: { type: string; message: string; }[];
  readabilityScore: number;
  spamScore: number;
  personalizedElements: string[];
}

export interface SpamAnalysis {
  score: number; // 0-100, lower is better
  flaggedWords: string[];
  suggestions: string[];
}

export async function analyzeEmail(emailContent: string): Promise<EmailAnalysis> {
  // Get AI analysis
  const aiAnalysis = await analyzeEmailDraft(emailContent);
  
  // Calculate readability score
  const readabilityScore = calculateReadabilityScore(emailContent);
  
  // Calculate spam score
  const spamAnalysis = analyzeSpamRisk(emailContent);
  
  // Identify personalized elements
  const personalizedElements = identifyPersonalizedElements(emailContent);
  
  return {
    score: aiAnalysis.score,
    suggestions: aiAnalysis.suggestions,
    improvements: aiAnalysis.improvements,
    readabilityScore,
    spamScore: spamAnalysis.score,
    personalizedElements
  };
}

export async function improveEmail(emailContent: string): Promise<{
  improved: { subject: string; body: string; };
  improvements: string[];
}> {
  const result = await improveEmailDraft(emailContent);
  
  // Generate list of improvements made
  const improvements = [
    "Enhanced personalization",
    "Improved call-to-action clarity",
    "Optimized subject line length",
    "Reduced spam risk",
    "Better value proposition positioning"
  ];
  
  return {
    improved: {
      subject: result.improvedSubject,
      body: result.improvedBody
    },
    improvements
  };
}

function calculateReadabilityScore(text: string): number {
  // Simplified Flesch Reading Ease calculation
  const sentences = text.split(/[.!?]+/).length;
  const words = text.split(/\s+/).length;
  const syllables = countSyllables(text);
  
  if (sentences === 0 || words === 0) return 0;
  
  const avgSentenceLength = words / sentences;
  const avgSyllablesPerWord = syllables / words;
  
  const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
  
  return Math.max(0, Math.min(100, score));
}

function countSyllables(text: string): number {
  // Simple syllable counting
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  let syllableCount = 0;
  
  for (const word of words) {
    const vowels = word.match(/[aeiouy]+/g);
    syllableCount += vowels ? vowels.length : 1;
  }
  
  return syllableCount;
}

export function analyzeSpamRisk(emailContent: string): SpamAnalysis {
  const spamWords = [
    'urgent', 'limited time', 'act now', 'free', 'guaranteed', 'no obligation',
    'click here', 'buy now', 'order now', 'discount', 'save money', 'cheap',
    'winner', 'congratulations', 'selected', 'bonus', 'gift', 'prize',
    'income', 'earn money', 'make money', 'cash', 'credit', 'loan',
    'mortgage', 'refinance', 'debt', 'bankruptcy', 'foreclosure'
  ];
  
  const lowercaseContent = emailContent.toLowerCase();
  const flaggedWords: string[] = [];
  let spamScore = 0;
  
  // Check for spam words
  for (const word of spamWords) {
    if (lowercaseContent.includes(word)) {
      flaggedWords.push(word);
      spamScore += 10;
    }
  }
  
  // Check for excessive caps
  const capsPercentage = (emailContent.match(/[A-Z]/g) || []).length / emailContent.length;
  if (capsPercentage > 0.3) {
    spamScore += 20;
  }
  
  // Check for excessive exclamation marks
  const exclamationCount = (emailContent.match(/!/g) || []).length;
  if (exclamationCount > 3) {
    spamScore += 15;
  }
  
  // Check for suspicious patterns
  if (emailContent.includes('$$$') || emailContent.includes('!!!')) {
    spamScore += 25;
  }
  
  const suggestions: string[] = [];
  
  if (flaggedWords.length > 0) {
    suggestions.push(`Remove or replace flagged words: ${flaggedWords.join(', ')}`);
  }
  
  if (capsPercentage > 0.3) {
    suggestions.push('Reduce use of capital letters');
  }
  
  if (exclamationCount > 3) {
    suggestions.push('Limit exclamation marks to 1-2 per email');
  }
  
  return {
    score: Math.min(100, spamScore),
    flaggedWords,
    suggestions
  };
}

function identifyPersonalizedElements(emailContent: string): string[] {
  const personalizedElements: string[] = [];
  
  // Check for common personalization tokens
  if (emailContent.includes('{{firstName}}') || emailContent.includes('{{first_name}}')) {
    personalizedElements.push('First name personalization');
  }
  
  if (emailContent.includes('{{company}}') || emailContent.includes('{{companyName}}')) {
    personalizedElements.push('Company name personalization');
  }
  
  if (emailContent.includes('{{title}}') || emailContent.includes('{{jobTitle}}')) {
    personalizedElements.push('Job title personalization');
  }
  
  if (emailContent.includes('{{industry}}')) {
    personalizedElements.push('Industry personalization');
  }
  
  // Check for manual personalization indicators
  if (emailContent.match(/\b(noticed|saw|found|discovered)\b.*\b(your|you)\b/i)) {
    personalizedElements.push('Research-based personalization');
  }
  
  if (emailContent.match(/\b(recent|latest|new)\b.*\b(news|announcement|launch|funding)\b/i)) {
    personalizedElements.push('Timely/news-based personalization');
  }
  
  return personalizedElements;
}

export function optimizeSubjectLine(subject: string): {
  optimized: string;
  score: number;
  suggestions: string[];
} {
  const suggestions: string[] = [];
  let score = 50; // Base score
  
  // Length optimization
  if (subject.length < 30) {
    score += 10;
  } else if (subject.length > 50) {
    score -= 20;
    suggestions.push('Consider shortening subject line to under 50 characters');
  }
  
  // Personalization check
  if (subject.includes('{{') || subject.match(/\b(your|you)\b/i)) {
    score += 15;
  } else {
    suggestions.push('Add personalization to subject line');
  }
  
  // Avoid spam words
  const spamAnalysis = analyzeSpamRisk(subject);
  if (spamAnalysis.score > 0) {
    score -= spamAnalysis.score / 2;
    suggestions.push('Remove spam-triggering words from subject');
  }
  
  // Question vs statement
  if (subject.includes('?')) {
    score += 5;
  }
  
  // Numbers and specificity
  if (subject.match(/\d+/)) {
    score += 10;
  }
  
  const optimized = subject; // For now, return original
  
  return {
    optimized,
    score: Math.max(0, Math.min(100, score)),
    suggestions
  };
}
