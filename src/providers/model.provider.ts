export interface ModelUsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface IModelProvider {
  name: string;
  isAvailable(): boolean;
  generateText(prompt: string, systemPrompt?: string): Promise<string>;
  generateStructured<T>(prompt: string, schemaDescription: string, systemPrompt?: string): Promise<T>;
  getUsageStats(): ModelUsageStats;
  resetUsage(): void;
}
