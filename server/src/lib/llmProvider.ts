/**
 * LLM Provider Abstraction Layer
 * Uses any OpenAI-compatible API endpoint with runtime/API key overrides.
 */

import './env.js';
import OpenAI from 'openai';
import { AsyncLocalStorage } from 'async_hooks';
import { GoogleGenAI } from '@google/genai';

export const aiConfigStorage = new AsyncLocalStorage<{ apiKey?: string; apiBaseUrl?: string; model?: string }>();

export interface LLMMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface LLMCompletionOptions {
    model?: string;
    messages: LLMMessage[];
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    apiKey?: string;
    apiBaseUrl?: string;
    bypassStore?: boolean;
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
    private defaultModel: string;

    constructor() {
        const geminiKey = process.env.GEMINI_API_KEY;
        const openrouterKey = process.env.OPENROUTER_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;

        if (geminiKey) {
            // Use Google's OpenAI-compatible Gemini endpoint
            this.defaultApiKey = geminiKey;
            this.defaultBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
            this.defaultModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
        } else {
            this.defaultApiKey = openrouterKey || openaiKey || '';
            this.defaultBaseUrl =
                process.env.OPENAI_BASE_URL ||
                process.env.OPENROUTER_BASE_URL ||
                'https://openrouter.ai/api/v1';
            this.defaultModel = process.env.OPENROUTER_MODEL || 'openrouter/free';
        }
    }

    private getClient(apiKey?: string, apiBaseUrl?: string, bypassStore?: boolean): OpenAI {
        const store = bypassStore ? undefined : aiConfigStorage.getStore();
        let baseURL = apiBaseUrl || store?.apiBaseUrl || this.defaultBaseUrl;
        
        let key = apiKey || store?.apiKey;
        if (!key && baseURL === this.defaultBaseUrl) {
            key = this.defaultApiKey;
        }

        // Strip Bearer prefix if the user accidentally pasted it
        if (key && key.toLowerCase().startsWith('bearer ')) {
            key = key.slice(7).trim();
        }

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
        const store = options.bypassStore ? undefined : aiConfigStorage.getStore();
        let baseURL = options.apiBaseUrl || store?.apiBaseUrl || this.defaultBaseUrl;
        let apiKey = options.apiKey || store?.apiKey;
        if (!apiKey && baseURL === this.defaultBaseUrl) {
            apiKey = this.defaultApiKey;
        }

        // Clean up API key Bearer prefix
        if (apiKey && apiKey.toLowerCase().startsWith('bearer ')) {
            apiKey = apiKey.slice(7).trim();
        }

        if (baseURL.endsWith('/')) {
            baseURL = baseURL.slice(0, -1);
        }

        const activeModel = options.model || (options.bypassStore ? undefined : store?.model) || this.defaultModel;

        // Auto-detect base URL from model name when no explicit URL is provided
        if (!options.apiBaseUrl && !store?.apiBaseUrl) {
            if (activeModel.startsWith('openrouter/')) {
                baseURL = 'https://openrouter.ai/api/v1';
            } else if (activeModel.startsWith('openai/') || activeModel.startsWith('gpt-')) {
                baseURL = 'https://api.openai.com/v1';
            }
        }

        const isNativeGemini = baseURL.includes('generativelanguage.googleapis.com') && !baseURL.endsWith('/openai');

        if (isNativeGemini) {
            if (!apiKey) {
                throw new Error('Missing API key. Set one in Settings or environment.');
            }
            const cleanedModel = activeModel.replace(/^models\//, '').replace(/^google\//, '');

            const systemMessage = options.messages.find(m => m.role === 'system');
            const userMessages = options.messages.filter(m => m.role !== 'system');

            const contents = userMessages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

            const initConfig: any = { apiKey };
            if (baseURL && !baseURL.includes('generativelanguage.googleapis.com')) {
                initConfig.baseUrl = baseURL;
            }

            const ai = new GoogleGenAI(initConfig);
            const config: any = {
                temperature: options.temperature ?? 0.3,
                maxOutputTokens: options.max_tokens ?? 2048,
            };

            if (systemMessage) {
                config.systemInstruction = systemMessage.content;
            }

            const response = await ai.models.generateContent({
                model: cleanedModel,
                contents,
                config
            });

            if (!response.text) {
                throw new Error('No response text received from Google AI SDK');
            }
            return response.text;
        }

        try {
            const client = this.getClient(apiKey || options.apiKey, baseURL || options.apiBaseUrl, options.bypassStore);
            const completion = await client.chat.completions.create({
                model: activeModel,
                messages: options.messages as any,
                temperature: options.temperature ?? 0.3,
                max_tokens: options.max_tokens ?? 2048,
                top_p: options.top_p,
            });

            if (!completion.choices || completion.choices.length === 0) {
                throw new Error(`Invalid response schema. Raw response: ${JSON.stringify(completion)}`);
            }
            return completion.choices[0]?.message?.content || '';
        } catch (error: any) {
            throw new Error(`LLM API error: ${error.message}`);
        }
    }

    async *chatStream(options: LLMCompletionOptions): AsyncGenerator<string, void, undefined> {
        const store = options.bypassStore ? undefined : aiConfigStorage.getStore();
        let baseURL = options.apiBaseUrl || store?.apiBaseUrl || this.defaultBaseUrl;
        let apiKey = options.apiKey || store?.apiKey;
        if (!apiKey && baseURL === this.defaultBaseUrl) {
            apiKey = this.defaultApiKey;
        }

        // Clean up API key Bearer prefix
        if (apiKey && apiKey.toLowerCase().startsWith('bearer ')) {
            apiKey = apiKey.slice(7).trim();
        }

        if (baseURL.endsWith('/')) {
            baseURL = baseURL.slice(0, -1);
        }

        const activeModel = options.model || (options.bypassStore ? undefined : store?.model) || this.defaultModel;

        // Auto-detect base URL from model name when no explicit URL is provided
        if (!options.apiBaseUrl && !store?.apiBaseUrl) {
            if (activeModel.startsWith('openrouter/')) {
                baseURL = 'https://openrouter.ai/api/v1';
            } else if (activeModel.startsWith('openai/') || activeModel.startsWith('gpt-')) {
                baseURL = 'https://api.openai.com/v1';
            }
        }

        const isNativeGemini = baseURL.includes('generativelanguage.googleapis.com') && !baseURL.endsWith('/openai');

        if (isNativeGemini) {
            if (!apiKey) {
                throw new Error('Missing API key. Set one in Settings or environment.');
            }
            const cleanedModel = activeModel.replace(/^models\//, '').replace(/^google\//, '');

            const systemMessage = options.messages.find(m => m.role === 'system');
            const userMessages = options.messages.filter(m => m.role !== 'system');

            const contents = userMessages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

            const initConfig: any = { apiKey };
            if (baseURL && !baseURL.includes('generativelanguage.googleapis.com')) {
                initConfig.baseUrl = baseURL;
            }

            const ai = new GoogleGenAI(initConfig);
            const config: any = {
                temperature: options.temperature ?? 0.3,
                maxOutputTokens: options.max_tokens ?? 2048,
            };

            if (systemMessage) {
                config.systemInstruction = systemMessage.content;
            }

            const responseStream = await ai.models.generateContentStream({
                model: cleanedModel,
                contents,
                config
            });

            for await (const chunk of responseStream) {
                const text = chunk.text;
                if (text) {
                    yield text;
                }
            }
            return;
        }

        const client = this.getClient(apiKey || options.apiKey, baseURL || options.apiBaseUrl, options.bypassStore);
        const stream = await client.chat.completions.create({
            model: activeModel,
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
