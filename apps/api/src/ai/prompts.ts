import { MAX_SOURCE_CHARS } from '../../../../packages/types.js';

export const LESSON_PROMPT = (text: string, count: number) => `
You are a learning coach. Turn the study material below into a compact lesson.

Return ONLY JSON matching this shape, no prose, no markdown fence:
{
  "sourceTitle": string,          // 2-6 words naming the material
  "summary": string[],            // 3-5 bullets, one idea each, plain language
  "concepts": string[],           // 3-6 short concept names
  "questions": [                  // exactly ${count} questions
    { "prompt": string, "topic": string, "difficulty": "easy" | "medium" | "hard" }
  ]
}

Rules:
- Questions must require explaining or applying an idea, never yes/no or one-word recall.
- Every "topic" must come from "concepts", spelled identically. Weak-spot tracking depends on this.
- Spread difficulty across the set.

Study material:
"""
${text.slice(0, MAX_SOURCE_CHARS)}
"""
`.trim();

export const GRADE_PROMPT = (prompt: string, topic: string, answer: string) => `
You are a learning coach grading one answer. Be specific and kind; never vague praise.

Question: ${prompt}
Topic: ${topic}
Learner's answer: """${answer}"""

Return ONLY JSON matching this shape, no prose, no markdown fence:
{
  "score": number,                // 0-100
  "verdict": "correct" | "partial" | "incorrect",
  "explanation": string,          // 1-3 sentences: what is right, what is missing, why it matters
  "improvedAnswer": string,       // the answer they should have written, 2-4 sentences
  "missedTopics": string[]        // [] if nothing was missed, else the concepts they did not demonstrate
}
`.trim();
