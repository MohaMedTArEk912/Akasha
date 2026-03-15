/**
 * LLM Provider Abstraction Layer
 * Supports OpenRouter and local Qwen with fallback logic
 */

import 'dotenv/config';
import OpenAI from 'openai';
import { checkQwenHealth, getQwenUrl } from './qwenHealth.js';

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
}

export interface LLMProvider {
    chat(options: LLMCompletionOptions): Promise<string>;
    chatStream(options: LLMCompletionOptions): AsyncGenerator<string, void, undefined>;
    isAvailable(): Promise<boolean>;
    getName(): string;
}

/**
 * OpenRouter Provider - Uses OpenRouter API as fallback
 */
class OpenRouterProvider implements LLMProvider {
    private client: OpenAI;

    constructor() {
        this.client = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: process.env.OPENROUTER_API_KEY,
        });
    }

    async chat(options: LLMCompletionOptions): Promise<string> {
        try {
            const completion = await this.client.chat.completions.create({
                model: options.model || 'google/gemma-3-4b-it:free',
                messages: options.messages as any,
                temperature: options.temperature || 0.3,
                max_tokens: options.max_tokens || 2048,
                top_p: options.top_p,
            });

            return completion.choices[0]?.message?.content || '';
        } catch (error: any) {
            throw new Error(`OpenRouter API error: ${error.message}`);
        }
    }

    async *chatStream(options: LLMCompletionOptions): AsyncGenerator<string, void, undefined> {
        const stream = await this.client.chat.completions.create({
            model: options.model || 'google/gemma-3-4b-it:free',
            messages: options.messages as any,
            temperature: options.temperature ?? 0.3,
            max_tokens: options.max_tokens ?? 2048,
            top_p: options.top_p,
            stream: true,
        });
        for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? '';
            if (text) yield text;
        }
    }

    async isAvailable(): Promise<boolean> {
        return !!process.env.OPENROUTER_API_KEY;
    }

    getName(): string {
        return 'OpenRouter';
    }
}

/**
 * Qwen Provider - Uses local Qwen server
 */
class QwenProvider implements LLMProvider {
    private qwenUrl: string;

    constructor() {
        this.qwenUrl = getQwenUrl();
    }

    async chat(options: LLMCompletionOptions): Promise<string> {
        try {
            // Convert messages to Qwen format
            const history = options.messages.slice(0, -1).map(msg => ({
                role: msg.role,
                content: msg.content,
            }));
            const currentMessage = options.messages[options.messages.length - 1]?.content || '';

            const response = await fetch(`${this.qwenUrl}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: currentMessage,
                    history,
                    stream: false,
                }),
            });

            if (!response.ok) {
                throw new Error(`Qwen server error: ${response.statusText}`);
            }

            const data = await response.json() as any;
            return data.response || '';
        } catch (error: any) {
            throw new Error(`Qwen provider error: ${error.message}`);
        }
    }

    async *chatStream(options: LLMCompletionOptions): AsyncGenerator<string, void, undefined> {
        const history = options.messages.slice(0, -1).map(msg => ({ role: msg.role, content: msg.content }));
        const currentMessage = options.messages[options.messages.length - 1]?.content ?? '';

        const response = await fetch(`${this.qwenUrl}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: currentMessage, history, stream: true }),
        });

        if (!response.ok || !response.body) {
            throw new Error(`Qwen stream error: ${response.statusText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    // Qwen local app emits Server-Sent Events lines like: "data: token"
                    if (!trimmed.startsWith('data:')) {
                        continue;
                    }

                    const payload = trimmed.slice(5).trim();
                    if (!payload) continue;
                    if (payload === '[DONE]') return;

                    if (payload.startsWith('[ERROR:')) {
                        throw new Error(payload);
                    }

                    // Support both plain token payloads and optional JSON payloads.
                    if (payload.startsWith('{') && payload.endsWith('}')) {
                        try {
                            const parsed = JSON.parse(payload) as { response?: string; done?: boolean };
                            if (parsed.response) yield parsed.response;
                            if (parsed.done) return;
                            continue;
                        } catch {
                            // fall through and emit raw payload
                        }
                    }

                    yield payload;
                }
            }
        } finally {
            reader.cancel();
        }
    }

    async isAvailable(): Promise<boolean> {
        return await checkQwenHealth();
    }

    getName(): string {
        return 'Qwen';
    }
}

/**
 * Unified LLM Interface - Handles provider selection and fallback
 */
class UnifiedLLMProvider {
    private qwenProvider: QwenProvider;
    private openrouterProvider: OpenRouterProvider;
    private useQwenFirst: boolean;
    private fallbackEnabled: boolean;
    private activeProvider: LLMProvider | null = null;

    constructor() {
        this.qwenProvider = new QwenProvider();
        this.openrouterProvider = new OpenRouterProvider();
        this.useQwenFirst = process.env.QWEN_ENABLED !== 'false';
        this.fallbackEnabled = process.env.FALLBACK_TO_OPENROUTER !== 'false';
    }

    async initialize(): Promise<void> {
        if (this.useQwenFirst) {
            const qwenAvailable = await this.qwenProvider.isAvailable();
            if (qwenAvailable) {
                this.activeProvider = this.qwenProvider;
                console.log('[LLM] Using Qwen local provider');
                return;
            } else {
                console.log('[LLM] Qwen not available, checking OpenRouter fallback');
            }
        }

        const openrouterAvailable = await this.openrouterProvider.isAvailable();
        if (openrouterAvailable) {
            this.activeProvider = this.openrouterProvider;
            console.log('[LLM] Using OpenRouter provider');
            return;
        }

        throw new Error('No LLM provider available. Set OPENROUTER_API_KEY or ensure Qwen is running.');
    }

    async *chatStream(options: LLMCompletionOptions): AsyncGenerator<string, void, undefined> {
        if (!this.activeProvider) {
            throw new Error('LLM provider not initialized');
        }

        if (this.useQwenFirst && this.activeProvider !== this.qwenProvider) {
            const qwenAvailable = await this.qwenProvider.isAvailable();
            if (qwenAvailable) {
                this.activeProvider = this.qwenProvider;
                console.log('[LLM] Switched active provider to Qwen (now healthy)');
            }
        }

        try {
            yield* this.activeProvider.chatStream(options);
            return;
        } catch (error: any) {
            if (!this.fallbackEnabled) throw error;
            console.log(`[LLM] Stream failed on ${this.activeProvider.getName()}, falling back to sync chat`);
        }

        // Graceful degradation: run sync chat on fallback provider and yield whole response as one chunk
        const fallbackProviders: LLMProvider[] = this.activeProvider === this.qwenProvider
            ? [this.openrouterProvider]
            : [this.qwenProvider, this.openrouterProvider];

        for (const provider of fallbackProviders) {
            try {
                const available = await provider.isAvailable();
                if (!available) continue;
                this.activeProvider = provider;
                const text = await provider.chat(options);
                if (text) yield text;
                return;
            } catch {
                // try next provider
            }
        }

        throw new Error('All LLM providers failed for streaming');
    }

    async chat(options: LLMCompletionOptions): Promise<string> {
        if (!this.activeProvider) {
            throw new Error('LLM provider not initialized');
        }

        if (this.useQwenFirst && this.activeProvider !== this.qwenProvider) {
            const qwenAvailable = await this.qwenProvider.isAvailable();
            if (qwenAvailable) {
                this.activeProvider = this.qwenProvider;
                console.log('[LLM] Switched active provider to Qwen (now healthy)');
            }
        }

        try {
            return await this.activeProvider.chat(options);
        } catch (error: any) {
            if (!this.fallbackEnabled) {
                throw error;
            }

            const primaryProvider = this.activeProvider.getName();
            console.log(`[LLM] ${primaryProvider} failed, attempting fallback`);

            const fallbackProviders: LLMProvider[] = this.activeProvider === this.qwenProvider
                ? [this.openrouterProvider]
                : [this.qwenProvider, this.openrouterProvider];

            for (const fallbackProvider of fallbackProviders) {
                try {
                    const fallbackAvailable = await fallbackProvider.isAvailable();
                    if (fallbackAvailable) {
                        console.log(`[LLM] Falling back to ${fallbackProvider.getName()}`);
                        this.activeProvider = fallbackProvider;
                        return await fallbackProvider.chat(options);
                    }
                } catch (fallbackError: any) {
                    console.error(`[LLM] Fallback ${fallbackProvider.getName()} failed: ${fallbackError.message}`);
                }
            }

            throw new Error(`LLM request failed: ${error.message}`);
        }
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
