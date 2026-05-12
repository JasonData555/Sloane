import Anthropic from '@anthropic-ai/sdk';
import type { Intent, IntentResult } from '@/types/sloane';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Lightweight intent classification — uses a fast, low-token call
export async function classifyIntent(
  message: string,
  context: { activeSearchId?: string; stage?: string; lastAssistantMessage?: string }
): Promise<IntentResult> {
  const promptTemplate = process.env.INTENT_CLASSIFICATION_PROMPT;
  if (!promptTemplate) throw new Error('INTENT_CLASSIFICATION_PROMPT is not set');

  const systemPrompt = promptTemplate
    .replace('{ACTIVE_SEARCH_ID}', context.activeSearchId ?? 'none')
    .replace('{CURRENT_STAGE}', context.stage ?? 'none');

  // Build messages: include last assistant turn as context when available
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];
  if (context.lastAssistantMessage) {
    messages.push({ role: 'user', content: '[previous user message]' });
    messages.push({ role: 'assistant', content: context.lastAssistantMessage });
  }
  messages.push({ role: 'user', content: message });

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: systemPrompt,
      messages,
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = parseIntentResponse(text);
    return parsed;
  } catch {
    // On any failure, return unknown — do not block the message handler
    return { intent: 'unknown', confidence: 'low', entities: {} };
  }
}

function parseIntentResponse(text: string): IntentResult {
  // Expected format: JSON object { intent, confidence, entities }
  try {
    const clean = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    const parsed = JSON.parse(clean) as {
      intent?: string;
      confidence?: string;
      entities?: Record<string, string>;
    };

    const validIntents: Intent[] = [
      'kickoff', 'generate_jd', 'generate_pdf', 'run_vault_sweep',
      'run_scout', 'refine_search', 'status_request', 'help', 'unknown',
    ];

    const intent = validIntents.includes(parsed.intent as Intent)
      ? (parsed.intent as Intent)
      : 'unknown';

    const confidence = parsed.confidence === 'high' ? 'high' : 'low';

    return {
      intent,
      confidence,
      entities: parsed.entities ?? {},
    };
  } catch {
    return { intent: 'unknown', confidence: 'low', entities: {} };
  }
}
