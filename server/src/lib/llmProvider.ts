/**
 * LLM Provider Abstraction Layer
 * Uses any OpenAI-compatible API endpoint with runtime/API key overrides.
 */

import './env.js';
import OpenAI from 'openai';

export interface LLMMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface LLMCompletionOptions {
    model: string;
    messages: LLMMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    apiKey?: string;
    apiBaseUrl?: string;
}

export interface LLMProvider {
    chat(options: LLMCompletionOptions): Promise<string>;
    chatStream(options: LLMCompletionOptions): AsyncGenerator<string, void, undefined>;
    isAvailable(): Promise<boolean>;
    getName(): string;
}

class OpenAICompatibleProvider implements LLMProvider {
    private defaultApiKey: string;
    private defaultBaseUrl: string;

    constructor() {
        this.defaultApiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
        this.defaultBaseUrl =
            process.env.OPENAI_BASE_URL ||
            process.env.OPENROUTER_BASE_URL ||
            'https://openrouter.ai/api/v1';
    }

    private getClient(apiKey?: string, apiBaseUrl?: string): OpenAI {
        const key = apiKey || this.defaultApiKey;
        let baseURL = apiBaseUrl || this.defaultBaseUrl;
        if (baseURL.endsWith('/')) {
            baseURL = baseURL.slice(0, -1);
        }
        if (!key) {
            throw new Error('Missing API key. Set one in Settings or environment.');
        }
        return new OpenAI({
            baseURL,
            apiKey: key,
        });
    }

    async chat(options: LLMCompletionOptions): Promise<string> {
        try {
            const client = this.getClient(options.apiKey, options.apiBaseUrl);
            const completion = await client.chat.completions.create({
                model: options.model || 'google/gemma-3-4b-it:free',
                messages: options.messages as any,
                temperature: options.temperature ?? 0.3,
                max_tokens: options.max_tokens ?? 2048,
                top_p: options.top_p,
            });

            return completion.choices[0]?.message?.content || '';
        } catch (error: any) {
            throw new Error(`LLM API error: ${error.message}`);
        }
    }

    async *chatStream(options: LLMCompletionOptions): AsyncGenerator<string, void, undefined> {
        const client = this.getClient(options.apiKey, options.apiBaseUrl);
        const stream = await client.chat.completions.create({
            model: options.model || 'google/gemma-3-4b-it:free',
            messages: options.messages as any,
            temperature: options.temperature ?? 0.3,
            max_tokens: options.max_tokens ?? 2048,
            top_p: options.top_p,
            stream: true,
        });

        for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? '';
            if (text) {
                yield text;
            }
        }
    }

    async isAvailable(): Promise<boolean> {
        return true;
    }

    getName(): string {
        return 'OpenAI-Compatible';
    }
}

class UnifiedLLMProvider {
    private provider: OpenAICompatibleProvider;
    private activeProvider: LLMProvider | null = null;

    constructor() {
        this.provider = new OpenAICompatibleProvider();
    }

    async initialize(): Promise<void> {
        const available = await this.provider.isAvailable();
        if (!available) {
            throw new Error('No LLM provider available.');
        }

        this.activeProvider = this.provider;
        console.log('[LLM] Using OpenAI-compatible provider');
    }

    async *chatStream(options: LLMCompletionOptions): AsyncGenerator<string, void, undefined> {
        if (!this.activeProvider) {
            throw new Error('LLM provider not initialized');
        }

        yield* this.activeProvider.chatStream(options);
    }

    async chat(options: LLMCompletionOptions): Promise<string> {
        if (!this.activeProvider) {
            throw new Error('LLM provider not initialized');
        }

        return await this.activeProvider.chat(options);
    }

    getActiveProvider(): string {
        return this.activeProvider?.getName() || 'None';
    }
}

let unifiedProvider: UnifiedLLMProvider | null = null;

export async function initializeLLMProvider(): Promise<void> {
    unifiedProvider = new UnifiedLLMProvider();
    await unifiedProvider.initialize();
}

export function getLLMProvider(): UnifiedLLMProvider {
    if (!unifiedProvider) {
        throw new Error('LLM provider not initialized. Call initializeLLMProvider() first.');
    }

    return unifiedProvider;
}
