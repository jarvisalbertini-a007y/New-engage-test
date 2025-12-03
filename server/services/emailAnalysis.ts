import { openAIClient } from './openaiClient';
import type { 
  EmailRubric, 
  MEDDICScore, 
  CommandOfMessageScore, 
  NeverSplitDifferenceScore,
  EmailSuggestion,
  EmailAnalysisResult 
} from '@shared/ai';

// Legacy interface for backwards compatibility
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

// Helper to count words
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

// Helper to calculate reading level (Flesch-Kincaid Grade Level)
function calculateReadingLevel(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  const syllables = words.reduce((count, word) => {
    // Simplified syllable counting
    const vowelGroups = word.toLowerCase().match(/[aeiouy]+/g);
    return count + (vowelGroups ? vowelGroups.length : 1);
  }, 0);

  if (sentences.length === 0 || words.length === 0) return 8;

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;
  
  // Flesch-Kincaid Grade Level formula
  const gradeLevel = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
  return Math.max(1, Math.min(20, Math.round(gradeLevel)));
}

// Helper to count "you" vs "I" usage
function calculateYouToIRatio(text: string): number {
  const youCount = (text.match(/\b(you|your|yours)\b/gi) || []).length;
  const iCount = (text.match(/\b(i|me|my|mine|we|our|ours|us)\b/gi) || []).length;
  
  if (iCount === 0) return youCount > 0 ? 10 : 0;
  return Math.round((youCount / iCount) * 10) / 10;
}

// MEDDIC Analysis
function analyzeMEDDIC(emailContent: string): MEDDICScore {
  const content = emailContent.toLowerCase();
  
  const metrics = {
    present: /(\d+%|roi|revenue|cost|savings|increase|decrease|improve|reduce)/i.test(emailContent),
    score: 0,
    details: ''
  };
  
  const economicBuyer = {
    present: /(decision maker|budget|approval|executive|director|vp|ceo|cfo|cto)/i.test(emailContent),
    score: 0,
    details: ''
  };
  
  const decisionCriteria = {
    present: /(requirement|criteria|need|must have|priority|important|critical)/i.test(emailContent),
    score: 0,
    details: ''
  };
  
  const decisionProcess = {
    present: /(process|timeline|steps|evaluation|review|approval)/i.test(emailContent),
    score: 0,
    details: ''
  };
  
  const identifyPain = {
    present: /(challenge|problem|issue|pain|struggle|difficulty|frustrat)/i.test(emailContent),
    score: 0,
    details: ''
  };
  
  const champion = {
    present: /(champion|advocate|supporter|sponsor|help us|work with us)/i.test(emailContent),
    score: 0,
    details: ''
  };

  // Calculate scores
  if (metrics.present) {
    const matches = emailContent.match(/\d+%|\$[\d,]+|[\d,]+\s*(hours|days|weeks)/gi) || [];
    metrics.score = Math.min(100, matches.length * 25);
    metrics.details = matches.length > 0 ? 'Specific metrics mentioned' : 'Vague metrics';
  }

  if (economicBuyer.present) {
    economicBuyer.score = 75;
    economicBuyer.details = 'Economic buyer referenced';
  }

  if (decisionCriteria.present) {
    decisionCriteria.score = 75;
    decisionCriteria.details = 'Decision criteria mentioned';
  }

  if (decisionProcess.present) {
    decisionProcess.score = 75;
    decisionProcess.details = 'Process steps outlined';
  }

  if (identifyPain.present) {
    const painPoints = emailContent.match(/(challenge|problem|issue|pain|struggle)/gi) || [];
    identifyPain.score = Math.min(100, painPoints.length * 30);
    identifyPain.details = `${painPoints.length} pain point(s) identified`;
  }

  if (champion.present) {
    champion.score = 75;
    champion.details = 'Champion identification attempted';
  }

  const totalScore = Math.round(
    (metrics.score + economicBuyer.score + decisionCriteria.score + 
     decisionProcess.score + identifyPain.score + champion.score) / 6
  );

  return {
    metrics,
    economicBuyer,
    decisionCriteria,
    decisionProcess,
    identifyPain,
    champion,
    totalScore
  };
}

// Command of the Message Analysis
function analyzeCommandOfMessage(emailContent: string): CommandOfMessageScore {
  const wordCount = countWords(emailContent);
  const readingLevel = calculateReadingLevel(emailContent);
  const youToIRatio = calculateYouToIRatio(emailContent);
  
  const paragraphs = emailContent.split('\n\n').filter(p => p.trim().length > 0);
  const avgWordsPerParagraph = paragraphs.length > 0 ? 
    Math.round(wordCount / paragraphs.length) : wordCount;

  const conciseness = {
    wordCount,
    score: wordCount <= 200 ? 100 : wordCount <= 300 ? 75 : wordCount <= 400 ? 50 : 25,
    target: 200
  };

  const readingLevelScore = {
    level: readingLevel,
    score: readingLevel <= 8 ? 100 : readingLevel <= 10 ? 75 : readingLevel <= 12 ? 50 : 25,
    target: 8
  };

  const youToIScore = {
    ratio: youToIRatio,
    score: youToIRatio >= 2 ? 100 : youToIRatio >= 1.5 ? 75 : youToIRatio >= 1 ? 50 : 25,
    target: 2
  };

  const paragraphScore = {
    avgWords: avgWordsPerParagraph,
    score: avgWordsPerParagraph <= 30 ? 100 : avgWordsPerParagraph <= 50 ? 75 : 
           avgWordsPerParagraph <= 70 ? 50 : 25,
    target: 30
  };

  const totalScore = Math.round(
    (conciseness.score + readingLevelScore.score + youToIScore.score + paragraphScore.score) / 4
  );

  return {
    conciseness,
    readingLevel: readingLevelScore,
    youToIRatio: youToIScore,
    paragraphLength: paragraphScore,
    totalScore
  };
}

// Never Split the Difference Analysis
function analyzeNeverSplitDifference(emailContent: string): NeverSplitDifferenceScore {
  const content = emailContent.toLowerCase();
  
  // Mirroring detection
  const mirroringPhrases = [
    'sounds like',
    'it seems like',
    'it feels like',
    'what I\'m hearing is',
    'correct me if I\'m wrong'
  ];
  const mirroringExamples = mirroringPhrases.filter(phrase => content.includes(phrase));
  
  // Labeling detection
  const labelingPhrases = [
    'it sounds like',
    'it seems like you',
    'it looks like',
    'it appears that'
  ];
  const labelingExamples = labelingPhrases.filter(phrase => content.includes(phrase));
  
  // Calibrated questions detection
  const calibratedPatterns = [
    /how\s+would\s+you/i,
    /what\s+would\s+it\s+take/i,
    /what\s+makes\s+this/i,
    /how\s+am\s+i\s+supposed/i,
    /what\s+about\s+this/i
  ];
  const calibratedExamples = calibratedPatterns
    .filter(pattern => pattern.test(emailContent))
    .map(pattern => {
      const match = emailContent.match(pattern);
      return match ? match[0] : '';
    })
    .filter(Boolean);

  // Empathy detection
  const empathyPhrases = [
    'I understand',
    'I appreciate',
    'I recognize',
    'must be',
    'that sounds'
  ];
  const empathyExamples = empathyPhrases.filter(phrase => content.includes(phrase.toLowerCase()));

  const mirroring = {
    present: mirroringExamples.length > 0,
    score: Math.min(100, mirroringExamples.length * 40),
    examples: mirroringExamples
  };

  const labeling = {
    present: labelingExamples.length > 0,
    score: Math.min(100, labelingExamples.length * 40),
    examples: labelingExamples
  };

  const calibratedQuestions = {
    present: calibratedExamples.length > 0,
    score: Math.min(100, calibratedExamples.length * 35),
    examples: calibratedExamples
  };

  const empathy = {
    present: empathyExamples.length > 0,
    score: Math.min(100, empathyExamples.length * 30),
    examples: empathyExamples
  };

  const totalScore = Math.round(
    (mirroring.score + labeling.score + calibratedQuestions.score + empathy.score) / 4
  );

  return {
    mirroring,
    labeling,
    calibratedQuestions,
    empathy,
    totalScore
  };
}

// Generate suggestions based on rubric scores
function generateSuggestions(rubric: EmailRubric, emailContent: string): EmailSuggestion[] {
  const suggestions: EmailSuggestion[] = [];

  // MEDDIC suggestions
  if (rubric.meddic.totalScore < 70) {
    if (!rubric.meddic.metrics.present) {
      suggestions.push({
        type: 'critical',
        category: 'meddic',
        issue: 'No specific metrics mentioned',
        suggestion: 'Include quantifiable metrics like "reduce costs by 30%" or "save 10 hours per week"',
        example: 'Our solution has helped similar companies reduce operational costs by 35% within 6 months'
      });
    }
    
    if (!rubric.meddic.identifyPain.present) {
      suggestions.push({
        type: 'critical',
        category: 'meddic',
        issue: 'No pain points identified',
        suggestion: 'Ask about or acknowledge specific challenges they face',
        example: 'I noticed many companies in your industry struggle with [specific challenge]. Is this something your team faces?'
      });
    }
  }

  // Command of Message suggestions
  if (rubric.commandOfMessage.totalScore < 70) {
    if (rubric.commandOfMessage.conciseness.wordCount > 200) {
      suggestions.push({
        type: 'improvement',
        category: 'command',
        issue: `Email is ${rubric.commandOfMessage.conciseness.wordCount} words (target: 200)`,
        suggestion: 'Shorten your email by removing unnecessary words and focusing on one clear message',
        example: 'Remove filler phrases and get straight to the point'
      });
    }
    
    if (rubric.commandOfMessage.youToIRatio.ratio < 2) {
      suggestions.push({
        type: 'improvement',
        category: 'command',
        issue: `You-to-I ratio is ${rubric.commandOfMessage.youToIRatio.ratio}:1 (target: 2:1)`,
        suggestion: 'Focus more on the prospect and less on yourself/your company',
        example: 'Instead of "We help companies..." try "You can achieve..."'
      });
    }
  }

  // Never Split the Difference suggestions
  if (rubric.neverSplitDifference.totalScore < 70) {
    if (!rubric.neverSplitDifference.calibratedQuestions.present) {
      suggestions.push({
        type: 'enhancement',
        category: 'negotiation',
        issue: 'No calibrated questions used',
        suggestion: 'Add open-ended "how" or "what" questions to engage the prospect',
        example: 'What would need to happen for this to become a priority for you?'
      });
    }
  }

  return suggestions;
}

// New comprehensive email analysis with rubrics
export async function analyzeEmailWithRubrics(emailContent: string): Promise<EmailAnalysisResult> {
  const startTime = Date.now();
  
  // Step 1: Calculate deterministic rubric scores
  const meddic = analyzeMEDDIC(emailContent);
  const commandOfMessage = analyzeCommandOfMessage(emailContent);
  const neverSplitDifference = analyzeNeverSplitDifference(emailContent);
  
  const overallScore = Math.round(
    (meddic.totalScore + commandOfMessage.totalScore + neverSplitDifference.totalScore) / 3
  );
  
  const rubric: EmailRubric = {
    meddic,
    commandOfMessage,
    neverSplitDifference,
    overallScore
  };
  
  // Step 2: Generate suggestions based on rubric
  const suggestions = generateSuggestions(rubric, emailContent);
  
  // Step 3: Use OpenAI for qualitative feedback and improved version
  let qualitativeFeedback = 'Unable to generate AI feedback';
  let improvedVersion: string | undefined = undefined;
  let aiGenerated = false;
  
  // Prepare context for OpenAI
  const lowScoreAreas = [];
  if (meddic.totalScore < 70) lowScoreAreas.push('MEDDIC framework');
  if (commandOfMessage.totalScore < 70) lowScoreAreas.push('Command of the Message');
  if (neverSplitDifference.totalScore < 70) lowScoreAreas.push('Never Split the Difference techniques');
  
  if (openAIClient.isAvailable() && overallScore < 80) {
    const systemPrompt = `You are an expert sales email coach. Analyze the email based on:
- MEDDIC (Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion)
- Command of the Message (conciseness, clarity, you-focused)
- Never Split the Difference (tactical empathy, calibrated questions)

Provide specific, actionable feedback focusing on the weakest areas.`;

    const userPrompt = `Email to analyze:
${emailContent}

Rubric Scores:
- MEDDIC: ${meddic.totalScore}/100
- Command of Message: ${commandOfMessage.totalScore}/100  
- Negotiation Techniques: ${neverSplitDifference.totalScore}/100

Low-scoring areas: ${lowScoreAreas.length > 0 ? lowScoreAreas.join(', ') : 'None'}

Provide:
1. Brief qualitative feedback (2-3 sentences) on the biggest improvement opportunity
2. A rewritten version that addresses the main issues while maintaining the original intent`;

    const aiResponse = await openAIClient.generateJSON<{
      feedback: string;
      improvedVersion: string;
    }>(userPrompt, systemPrompt, {
      feature: 'email-coach-analysis',
      fallback: null
    });

    if (aiResponse.success && aiResponse.data) {
      qualitativeFeedback = aiResponse.data.feedback;
      improvedVersion = aiResponse.data.improvedVersion;
      aiGenerated = true;
    }
  } else if (overallScore >= 80) {
    qualitativeFeedback = 'Excellent email! Your message effectively uses proven sales frameworks and maintains strong engagement techniques.';
  }
  
  const processingTime = Date.now() - startTime;
  
  return {
    result: {
      rubric,
      suggestions,
      improvedVersion,
      qualitativeFeedback
    },
    aiGenerated,
    confidence: overallScore,
    metadata: {
      model: aiGenerated ? 'gpt-3.5-turbo' : undefined,
      processingTime,
      fallbackUsed: !aiGenerated
    }
  };
}

// Legacy function for backwards compatibility
export async function analyzeEmail(emailContent: string): Promise<EmailAnalysis> {
  const result = await analyzeEmailWithRubrics(emailContent);
  const { rubric, suggestions, qualitativeFeedback } = result.result;
  
  // Map new format to legacy format
  const legacySuggestions = suggestions.map(s => s.suggestion);
  const improvements = suggestions.map(s => ({
    type: s.type,
    message: s.suggestion
  }));
  
  // Calculate readability score using Flesch Reading Ease
  const readabilityScore = calculateReadabilityScore(emailContent);
  const spamAnalysis = analyzeSpamRisk(emailContent);
  const personalizedElements = identifyPersonalizedElements(emailContent);
  
  return {
    score: rubric.overallScore,
    suggestions: legacySuggestions,
    improvements,
    readabilityScore,
    spamScore: spamAnalysis.score,
    personalizedElements
  };
}

// Helper to apply rule-based improvements when AI is unavailable
function applyDeterministicImprovements(emailContent: string): { subject: string; body: string } {
  let improved = emailContent;
  
  const improvementRules = [
    { pattern: /\bI think\b/gi, replacement: 'I believe' },
    { pattern: /\bvery\b/gi, replacement: '' },
    { pattern: /\bjust\b/gi, replacement: '' },
    { pattern: /\bbasically\b/gi, replacement: '' },
    { pattern: /\bactually\b/gi, replacement: '' },
    { pattern: /\breally\b/gi, replacement: '' },
    { pattern: /\bquick\b/gi, replacement: 'brief' },
    { pattern: /\bhelp\b/gi, replacement: 'support' },
    { pattern: /\bWould you be interested\b/gi, replacement: 'Would it be worth exploring' },
    { pattern: /\bI wanted to\b/gi, replacement: 'I\'d like to' },
    { pattern: /\bI was wondering\b/gi, replacement: 'I\'m curious' },
    { pattern: /\bLet me know\b/gi, replacement: 'Share your thoughts' },
    { pattern: /\bfeel free to\b/gi, replacement: 'please' },
    { pattern: /\btouch base\b/gi, replacement: 'connect' },
    { pattern: /\bCircling back\b/gi, replacement: 'Following up' },
    { pattern: /\bPer my last email\b/gi, replacement: 'As mentioned' },
    { pattern: /\bAs per our discussion\b/gi, replacement: 'As we discussed' },
  ];
  
  for (const rule of improvementRules) {
    improved = improved.replace(rule.pattern, rule.replacement);
  }
  
  improved = improved.replace(/\s{2,}/g, ' ').trim();
  
  const lines = improved.split('\n');
  const improvedLines = lines.map(line => {
    if (line.startsWith('Hi ') || line.startsWith('Hello ') || line.startsWith('Dear ')) {
      return line;
    }
    if (line.length > 100) {
      const midPoint = line.lastIndexOf(' ', 80);
      if (midPoint > 40) {
        return line;
      }
    }
    return line;
  });
  improved = improvedLines.join('\n');
  
  const callToActions = [
    "Would a 15-minute call this week work for you?",
    "Can we schedule a brief conversation to explore this?",
    "What does your calendar look like for a quick chat?",
    "Shall I send over some times that work for a call?",
    "Would you be open to a short discovery call?"
  ];
  
  const ctaIndex = Math.floor(Date.now() / 1000) % callToActions.length;
  const selectedCTA = callToActions[ctaIndex];
  
  if (!improved.toLowerCase().includes('schedule') && 
      !improved.toLowerCase().includes('call') &&
      !improved.toLowerCase().includes('chat')) {
    const signOffPatterns = [/Best regards,?/i, /Best,?/i, /Thanks,?/i, /Regards,?/i];
    let inserted = false;
    for (const pattern of signOffPatterns) {
      if (pattern.test(improved)) {
        improved = improved.replace(pattern, `\n${selectedCTA}\n\n$&`);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      improved += `\n\n${selectedCTA}`;
    }
  }
  
  const subjectPrefixes = [
    "Quick insight:",
    "Thought for",
    "Idea for",
    "Question about",
    "Opportunity:"
  ];
  const prefixIndex = Math.floor(Date.now() / 1000) % subjectPrefixes.length;
  const generatedSubject = `${subjectPrefixes[prefixIndex]} {{company}}'s growth`;
  
  return {
    subject: generatedSubject,
    body: improved
  };
}

// Legacy improve email function
export async function improveEmail(emailContent: string): Promise<{
  improved: { subject: string; body: string; };
  improvements: string[];
}> {
  const analysis = await analyzeEmailWithRubrics(emailContent);
  const { suggestions, rubric } = analysis.result;
  
  if (openAIClient.isAvailable()) {
    const systemPrompt = `You are an expert sales email copywriter. Your task is to completely rewrite emails to make them:
- More concise (under 150 words)
- More personalized and prospect-focused
- Following MEDDIC principles (address pain, value proposition)
- Mobile-friendly with short paragraphs
- Using "you" more than "I/we"

IMPORTANT: Generate a COMPLETELY DIFFERENT version - not just minor edits. The rewritten email should feel fresh and new.`;

    const userPrompt = `Rewrite this email to be significantly better. Make substantial changes, not just minor tweaks.

Original email:
${emailContent}

Current issues (score: ${rubric.overallScore}/100):
${suggestions.slice(0, 3).map(s => `- ${s.issue}: ${s.suggestion}`).join('\n')}

Respond ONLY with a valid JSON object in this exact format:
{
  "subject": "New compelling subject line",
  "body": "Completely rewritten email body that is substantially different from the original"
}`;

    const response = await openAIClient.generateJSON<{ subject: string; body: string }>(
      userPrompt,
      systemPrompt,
      {
        feature: 'email-improve',
        temperature: 0.9,
        maxTokens: 1000
      }
    );

    if (response.success && response.data && response.data.body && response.data.body !== emailContent) {
      return {
        improved: {
          subject: response.data.subject || 'Follow-up: Quick question',
          body: response.data.body
        },
        improvements: suggestions.map(s => s.suggestion)
      };
    }
  }
  
  const deterministicResult = applyDeterministicImprovements(emailContent);
  
  return {
    improved: deterministicResult,
    improvements: suggestions.map(s => s.suggestion)
  };
}

// Legacy helper functions
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