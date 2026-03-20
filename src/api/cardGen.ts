// ============================================================
// Adaptive Learning AI Card Generation
// Calls Anthropic API with 5s timeout, never blocks session
// ============================================================

import { Card, Deck, ComplexityTag, generateId } from '../core/models';

export interface DeckGenParams {
  topic: string;
  course: string;
  numCards: number;
  complexityMix?: ComplexityTag[];
  biometricSummary?: string;
}

export interface GeneratedDeck {
  deck: Deck;
  cards: Card[];
}

export interface CardGenParams {
  topic: string;
  course: string;
  complexity: string;
  style: string;
  biometricSummary: string;
  sessionPosition: number;
}

export interface CardGenResult {
  question: string;
  hint: string;
  style: string;
}

const FALLBACK_TEMPLATES: Record<string, (topic: string) => CardGenResult> = {
  socratic: (t) => ({
    question: `What is your current understanding of "${t}"? What do you think you know, and what are you uncertain about?`,
    hint: 'Start with what you are most confident about, then identify gaps.',
    style: 'socratic',
  }),
  analogy: (t) => ({
    question: `Can you think of something from everyday life that works similarly to "${t}"? Describe the comparison.`,
    hint: 'Think about structural or functional similarities.',
    style: 'analogy',
  }),
  example: (t) => ({
    question: `Give a concrete example that demonstrates "${t}" in action.`,
    hint: 'Make it specific — avoid abstract examples.',
    style: 'example',
  }),
  definition: (t) => ({
    question: `Define "${t}" in your own words without looking it up.`,
    hint: 'Focus on the core meaning, not memorised phrasing.',
    style: 'definition',
  }),
  mnemonic: (t) => ({
    question: `Create a mnemonic, acronym, or memory aid to help you remember the key aspects of "${t}".`,
    hint: 'The sillier or more vivid, the more memorable.',
    style: 'mnemonic',
  }),
  'step-by-step': (t) => ({
    question: `Walk through the steps or stages involved in "${t}" in the correct order.`,
    hint: 'Number each step and be specific about transitions.',
    style: 'step-by-step',
  }),
  contrast: (t) => ({
    question: `How is "${t}" different from concepts that seem similar? What distinguishes it?`,
    hint: 'Pick the closest look-alike concept and compare directly.',
    style: 'contrast',
  }),
  real_life_example: (t) => ({
    question: `Describe a real-world scenario where "${t}" is directly relevant or applied.`,
    hint: 'Think about professional or everyday contexts you have encountered.',
    style: 'real_life_example',
  }),
  clinical_example: (t) => ({
    question: `Describe a clinical or professional case where "${t}" would be the key concept.`,
    hint: 'Consider presentation, mechanism, and outcome.',
    style: 'clinical_example',
  }),
  visual: (t) => ({
    question: `Describe a diagram or visual representation you could draw to explain "${t}".`,
    hint: 'Think about what spatial layout would best capture the relationships.',
    style: 'visual',
  }),
  story: (t) => ({
    question: `Tell a short story (3–5 sentences) that naturally demonstrates "${t}".`,
    hint: 'Give your story a character, a problem, and a resolution involving the concept.',
    style: 'story',
  }),
};

export async function generateCardQuestion(params: CardGenParams): Promise<CardGenResult> {
  const apiKey = (import.meta as unknown as { env: Record<string, string> }).env
    ?.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    return fallback(params);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const prompt = `You are a spaced repetition card generator. Generate a single study question.

Topic: ${params.topic}
Course: ${params.course}
Complexity: ${params.complexity}
Presentation style: ${params.style}
Biometric context: ${params.biometricSummary}
Position in session: card #${params.sessionPosition}

Generate a question using the "${params.style}" presentation style. The question should:
- Be specific to the topic
- Match the complexity level
- Be appropriate given the biometric context
- Be a single question (not multiple questions)

Respond with JSON only, no markdown, no preamble:
{"question": "...", "hint": "..."}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return fallback(params);
    }

    const data = await response.json() as {
      content: { type: string; text: string }[];
    };

    const text = data.content?.find(b => b.type === 'text')?.text ?? '';
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim()) as {
      question: string;
      hint: string;
    };

    return {
      question: parsed.question,
      hint: parsed.hint,
      style: params.style,
    };
  } catch {
    clearTimeout(timeout);
    return fallback(params);
  }
}

function fallback(params: CardGenParams): CardGenResult {
  const template =
    FALLBACK_TEMPLATES[params.style] ?? FALLBACK_TEMPLATES['definition'];
  return template(params.topic);
}

// ── Deck Generation ─────────────────────────────────────────

interface RawCardJSON {
  front: string;
  back: string;
  complexity?: ComplexityTag;
  tags?: string[];
  presentations?: Record<string, { front: string; back: string }>;
}

function buildDeckFromRaw(raw: RawCardJSON[], deckId: string): Card[] {
  const validComplexity = new Set<ComplexityTag>([
    'vocabulary', 'concept', 'procedure', 'application', 'analysis',
  ]);
  return raw.map((r) => ({
    id: generateId(),
    deckId,
    front: r.front ?? '',
    back: r.back ?? '',
    complexity: validComplexity.has(r.complexity as ComplexityTag)
      ? (r.complexity as ComplexityTag)
      : 'concept',
    tags: Array.isArray(r.tags) ? r.tags : [],
    presentations: r.presentations as Card['presentations'] ?? undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
}

function fallbackDeck(topic: string, course: string, numCards: number): GeneratedDeck {
  const deckId = generateId();
  const styles = Object.keys(FALLBACK_TEMPLATES);
  const cards: Card[] = Array.from({ length: numCards }, (_, i) => {
    const style = styles[i % styles.length];
    const result = FALLBACK_TEMPLATES[style](topic);
    return {
      id: generateId(),
      deckId,
      front: result.question,
      back: result.hint,
      complexity: 'concept' as ComplexityTag,
      tags: [topic.toLowerCase().replace(/\s+/g, '-')],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });
  const deck: Deck = {
    id: deckId,
    name: topic,
    description: `${course} — generated deck`,
    cards,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return { deck, cards };
}

async function callClaudeForCards(
  prompt: string,
  deckName: string,
  course: string,
  fallbackFn: () => GeneratedDeck,
): Promise<GeneratedDeck> {
  const apiKey = (import.meta as unknown as { env: Record<string, string> }).env
    ?.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) return fallbackFn();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    clearTimeout(timeout);
    if (!response.ok) return fallbackFn();

    const data = await response.json() as { content: { type: string; text: string }[] };
    const text = data.content?.find(b => b.type === 'text')?.text ?? '';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const raw = JSON.parse(cleaned) as RawCardJSON[];

    if (!Array.isArray(raw) || raw.length === 0) return fallbackFn();

    const deckId = generateId();
    const cards = buildDeckFromRaw(raw, deckId);
    const deck: Deck = {
      id: deckId,
      name: deckName,
      description: `${course} — AI-generated deck`,
      cards,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return { deck, cards };
  } catch {
    clearTimeout(timeout);
    return fallbackFn();
  }
}

/**
 * Generate a full deck of flashcards on a topic using Claude.
 * Falls back to template-based cards if no API key or on timeout.
 */
export async function generateDeck(params: DeckGenParams): Promise<GeneratedDeck> {
  const {
    topic,
    course,
    numCards,
    complexityMix = ['vocabulary', 'concept', 'application'],
    biometricSummary = 'normal',
  } = params;

  const prompt = `You are a spaced repetition card generator. Generate ${numCards} flashcards on "${topic}" for the course "${course}".

Vary complexity across the set using these tags: ${complexityMix.join(', ')}.
Biometric context: ${biometricSummary}

Return a JSON array only (no markdown, no preamble). Each item:
{
  "front": "question text",
  "back": "answer text",
  "complexity": "${complexityMix[0]}",
  "tags": ["tag1"],
  "presentations": {
    "analogy": { "front": "...", "back": "..." },
    "mnemonic": { "front": "...", "back": "..." }
  }
}`;

  return callClaudeForCards(prompt, topic, course, () => fallbackDeck(topic, course, numCards));
}

/**
 * Generate flashcards by extracting key concepts from pasted study material.
 * Falls back to template-based cards if no API key or on timeout.
 */
export async function generateDeckFromContent(
  content: string,
  deckName: string,
  course: string,
  numCards = 8,
): Promise<GeneratedDeck> {
  const excerpt = content.slice(0, 4000);

  const prompt = `You are a spaced repetition card generator. Read the following study material and generate ${numCards} flashcards covering its most important concepts. Focus on ideas that require understanding, not trivial facts. Vary complexity.

MATERIAL:
"""
${excerpt}
"""

Return a JSON array only (no markdown, no preamble). Each item:
{
  "front": "question text",
  "back": "answer text",
  "complexity": "concept",
  "tags": ["tag1"],
  "presentations": {
    "analogy": { "front": "...", "back": "..." },
    "example": { "front": "...", "back": "..." }
  }
}`;

  return callClaudeForCards(
    prompt,
    deckName,
    course,
    () => fallbackDeck(deckName, course, numCards),
  );
}
