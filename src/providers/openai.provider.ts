import { IModelProvider, ModelUsageStats } from './model.provider';
import { MockModelProvider } from './mock.provider';

export class OpenAIProvider implements IModelProvider {
  public name = 'OpenAIProvider';
  private apiKey: string;
  private fallback: MockModelProvider;
  private stats: ModelUsageStats = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0
  };

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.fallback = new MockModelProvider();
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.startsWith('sk-'));
  }

  public async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.isAvailable()) {
      return this.fallback.generateText(prompt, systemPrompt);
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt }
          ],
          temperature: 0.2
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`);
      }

      const data: any = await response.json();
      const usage = data.usage;
      if (usage) {
        this.stats.promptTokens += usage.prompt_tokens;
        this.stats.completionTokens += usage.completion_tokens;
        this.stats.totalTokens += usage.total_tokens;
        this.stats.estimatedCostUsd += (usage.prompt_tokens * 0.00015 + usage.completion_tokens * 0.0006) / 1000;
      }
      return data.choices[0]?.message?.content || '';
    } catch (err) {
      console.warn('[OPENAI-WARN] API call failed, falling back to deterministic mock provider:', err);
      return this.fallback.generateText(prompt, systemPrompt);
    }
  }

  public async generateStructured<T>(prompt: string, schemaDescription: string, systemPrompt?: string): Promise<T> {
    if (!this.isAvailable()) {
      return this.fallback.generateStructured<T>(prompt, schemaDescription, systemPrompt);
    }

    try {
      const fullPrompt = `${prompt}\n\nYou MUST return raw JSON conforming to this schema:\n${schemaDescription}`;
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: fullPrompt }
          ],
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`);
      }

      const data: any = await response.json();
      const content = data.choices[0]?.message?.content || '{}';
      return JSON.parse(content) as T;
    } catch (err) {
      console.warn('[OPENAI-WARN] Structured API call failed, falling back to deterministic mock provider:', err);
      return this.fallback.generateStructured<T>(prompt, schemaDescription, systemPrompt);
    }
  }

  public getUsageStats(): ModelUsageStats {
    return { ...this.stats };
  }

  public resetUsage(): void {
    this.stats = { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCostUsd: 0 };
    this.fallback.resetUsage();
  }
}
