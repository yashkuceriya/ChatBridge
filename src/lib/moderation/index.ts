import OpenAI from "openai";

const client = new OpenAI();

export interface ModerationResult {
  flagged: boolean;
  categories: string[];
  message?: string;
}

/**
 * Moderate content using OpenAI's moderation endpoint.
 * Runs on both user input and model output for K-12 safety.
 */
export async function moderateContent(text: string): Promise<ModerationResult> {
  try {
    const response = await client.moderations.create({ input: text });
    const result = response.results[0];

    if (result.flagged) {
      const flaggedCategories = Object.entries(result.categories)
        .filter(([, flagged]) => flagged)
        .map(([category]) => category);

      return {
        flagged: true,
        categories: flaggedCategories,
        message: "I can't respond to that. Let's keep our conversation appropriate for learning! Is there something else I can help you with?",
      };
    }

    return { flagged: false, categories: [] };
  } catch {
    // Fail open in dev, fail closed in production
    if (process.env.NODE_ENV === "production") {
      return { flagged: true, categories: ["error"], message: "Safety check unavailable. Please try again." };
    }
    return { flagged: false, categories: [] };
  }
}

/**
 * K-12 specific content checks beyond OpenAI moderation.
 * Catches things the general moderation API might miss that are
 * specifically inappropriate in a K-12 educational context.
 */
export function k12ContentCheck(text: string): ModerationResult {
  const lower = text.toLowerCase();

  // --- Personal information requests ---
  const personalInfoPatterns = [
    /what('s| is) (your|my|their|his|her) (phone|email|address|social security)/i,
    /give me .*(phone|email|address|social security|credit card)/i,
    /where do (you|they|i) live/i,
    /how old (are you|is|am i)/i,
    /what school (do|does)/i,
    /what('s| is) (your|my) (last name|full name|real name)/i,
  ];

  for (const pattern of personalInfoPatterns) {
    if (pattern.test(text)) {
      return {
        flagged: true,
        categories: ["personal_info"],
        message: "I can't share or ask for personal information. Your safety is important! Let's focus on learning together.",
      };
    }
  }

  // --- Attempts to bypass safety / jailbreak ---
  const jailbreakPatterns = [
    /ignore (your|all|previous) (instructions|rules|programming|guidelines)/i,
    /pretend (you are|to be|you're) (not|a different)/i,
    /act as (if|though) you (have no|don't have|aren't)/i,
    /you are now (in|a) .*(mode|character)/i,
    /from now on.*(ignore|forget|disregard)/i,
    /override (your|the|all) (safety|content|moderation)/i,
    /DAN|do anything now|jailbreak/i,
    /bypass .*(filter|safety|moderation|restriction)/i,
    /system prompt|your instructions|your programming/i,
    /repeat (your|the) (system|initial) (prompt|message|instructions)/i,
  ];

  for (const pattern of jailbreakPatterns) {
    if (pattern.test(text)) {
      return {
        flagged: true,
        categories: ["jailbreak_attempt"],
        message: "I'm here to help you learn! Let's get back to our lesson. Would you like to play a game or work on something together?",
      };
    }
  }

  // --- Off-limits topics for K-12 (ORDER MATTERS — most specific first) ---
  const offLimitsTopics = [
    // CRITICAL: Self-harm checked FIRST — must show crisis resources, not generic violence refusal
    { pattern: /\b(suicide|suicidal|self.?harm|cut myself|cutting myself|end my life|kill myself|hurt myself|don'?t want to live|want to die)\b/i, category: "self_harm", message: "It sounds like you might be going through something difficult. Please talk to a trusted adult — a parent, teacher, or school counselor. You can also call the 988 Suicide & Crisis Lifeline (call or text 988). You matter, and people care about you." },
    { pattern: /\b(drug|cocaine|heroin|marijuana|weed|meth|alcohol|beer|wine|vodka|drunk|high)\b/i, category: "substances", message: "That's not something I can help with. Let's focus on learning! Want to try a game?" },
    { pattern: /\b(kill|murder|shoot|stab|weapon|gun|bomb|explod)/i, category: "violence", message: "Let's talk about something more positive! Would you like to play a game?" },
    { pattern: /\b(sexy|porn|nude|naked|sex)\b/i, category: "sexual_content", message: "That's not appropriate for our learning environment. Let's get back to something fun — want to play chess or tic tac toe?" },
    { pattern: /\b(hate|stupid|idiot|dumb|loser|ugly|fat)\b.*\b(you|they|he|she|them)\b/i, category: "bullying", message: "Let's be kind to everyone! Words matter. Want to channel that energy into a game instead?" },
  ];

  for (const { pattern, category, message } of offLimitsTopics) {
    if (pattern.test(text)) {
      return { flagged: true, categories: [category], message };
    }
  }

  // --- Excessive caps (shouting) ---
  const words = text.split(/\s+/);
  const capsWords = words.filter(w => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w));
  if (words.length > 3 && capsWords.length / words.length > 0.6) {
    // Don't flag, but note — the AI's personality handles this
  }

  return { flagged: false, categories: [] };
}
