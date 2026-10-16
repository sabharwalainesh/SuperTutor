import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-5-5';
const TIMEOUT_MS = 20_000;

let client: Anthropic | null = null;

/** No key => offline mode. Routes fall back to fixtures instead of failing. */
export const hasApiKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

const getClient = () => {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: TIMEOUT_MS,
    });
  }
  return client;
};

/** Strip a ```json fence if the model adds one anyway, then parse. */
const parseJson = (raw: string): unknown => {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model returned no JSON object.');
  return JSON.parse(cleaned.slice(start, end + 1));
};

/** One call, one retry. Returns parsed JSON or throws a message fit for the UI. */
export const askForJson = async (prompt: string, maxTokens = 1500): Promise<unknown> => {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await getClient().messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return parseJson(text);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    lastError instanceof Error ? `Model call failed: ${lastError.message}` : 'Model call failed.',
  );
};
