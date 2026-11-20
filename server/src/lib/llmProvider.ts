/**
 * Akasha V2 Explicit Hybrid AI Provider Layer
 *
 * Supports:
 * 1. Live cloud LLMs: Gemini (@google/genai), OpenRouter, OpenAI, and any OpenAI-compatible endpoint.
 * 2. Local LLMs: Ollama (http://localhost:11434/v1) with zero external API keys.
 * 3. Honest Offline Blueprint Mode: deterministic archetype-aware responses clearly badged as `offline`
 *    so users always know when live AI vs. deterministic offline synthesis is active.
 */

import './env.js';
import OpenAI from 'openai';
import { AsyncLocalStorage } from 'async_hooks';
import { GoogleGenAI } from '@google/genai';

export interface RequestAiConfig {
    apiKey?: string;
    apiBaseUrl?: string;
    model?: string;
    provider?: string;
}

export const aiConfigStorage = new AsyncLocalStorage<RequestAiConfig>();

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
    provider?: string;
    bypassStore?: boolean;
}

export interface ProviderHealth {
    mode: 'live' | 'offline';
    provider: 'gemini' | 'openrouter' | 'openai' | 'ollama' | 'offline';
    model: string;
    baseUrl?: string;
    configured: boolean;
    reason?: string;
}

export interface LLMCompletionResult {
    text: string;
    mode: 'live' | 'offline';
    provider: ProviderHealth['provider'];
    model: string;
    fallbackReason?: string;
}

export interface LLMProvider {
    chat(options: LLMCompletionOptions): Promise<string>;
    chatWithMeta(options: LLMCompletionOptions): Promise<LLMCompletionResult>;
    chatStream(options: LLMCompletionOptions): AsyncGenerator<string, void, undefined>;
    getHealth(override?: Partial<RequestAiConfig>): ProviderHealth;
    isAvailable(): Promise<boolean>;
    getName(): string;
}

const PLACEHOLDER_KEYS = new Set([
    '',
    'antigravity-embedded',
    'antigravity-brain-active',
    'offline',
    'none',
]);

function normalizeBaseUrl(rawUrl: string): string {
    let url = (rawUrl || '').trim();
    if (!url || url === '/api/akasha') return '';

    while (url.endsWith('/')) {
        url = url.slice(0, -1);
    }

    if (url.includes('agentrouter.org')) {
        url = url.replace(/\/console(?:\/.*)?$/, '');
        if (!url.endsWith('/v1')) url = `${url}/v1`;
    } else if (url === 'https://openrouter.ai' || url === 'https://openrouter.ai/api') {
        url = 'https://openrouter.ai/api/v1';
    } else if (url === 'https://api.openai.com') {
        url = 'https://api.openai.com/v1';
    } else if (url === 'https://api.groq.com' || url === 'https://api.groq.com/openai') {
        url = 'https://api.groq.com/openai/v1';
    } else if (url === 'http://localhost:11434' || url === 'http://127.0.0.1:11434') {
        url = `${url}/v1`;
    }

    return url;
}

function cleanKey(raw?: string): string {
    let key = (raw || '').trim();
    if (key.toLowerCase().startsWith('bearer ')) {
        key = key.slice(7).trim();
    }
    return key;
}

function isUsableKey(key: string): boolean {
    if (!key) return false;
    if (PLACEHOLDER_KEYS.has(key.toLowerCase())) return false;
    if (key.startsWith('AQ.')) return false;
    return true;
}

/**
 * Deterministic Offline Blueprint Responder
 * Used strictly when provider is explicitly `offline` or no valid API key/local Ollama endpoint is available.
 * Never claims to be a live LLM response; callers can inspect `mode: 'offline'`.
 */
function synthesizeOfflineResponse(options: LLMCompletionOptions): string {
    const userPrompt = options.messages.map(m => m.content).join('\n').toLowerCase();
    const systemPrompt = options.messages.find(m => m.role === 'system')?.content?.toLowerCase() || '';
    const fullContext = `${systemPrompt}\n${userPrompt}`;

    if (fullContext.includes('respond with exactly the word "ok"') || fullContext.includes('ping') || userPrompt.trim() === 'ok') {
        return 'ok';
    }

    if (fullContext.includes('schema') || fullContext.includes('prisma') || fullContext.includes('collections') || fullContext.includes('generate-schema')) {
        return JSON.stringify({
            models: [
                {
                    name: 'Product',
                    fields: [
                        { name: 'id', type: 'String', isId: true, isRequired: true },
                        { name: 'title', type: 'String', isRequired: true },
                        { name: 'price', type: 'Float', isRequired: true },
                        { name: 'stock', type: 'Int', isRequired: true },
                        { name: 'status', type: 'String', defaultValue: 'active', isRequired: true },
                    ]
                },
                {
                    name: 'Order',
                    fields: [
                        { name: 'id', type: 'String', isId: true, isRequired: true },
                        { name: 'customerEmail', type: 'String', isRequired: true },
                        { name: 'totalAmount', type: 'Float', isRequired: true },
                        { name: 'status', type: 'String', defaultValue: 'pending', isRequired: true },
                        { name: 'createdAt', type: 'DateTime', isRequired: true },
                    ]
                },
            ],
            enums: [
                { name: 'OrderStatus', values: ['PENDING', 'PAID', 'FULFILLED', 'REFUNDED'] }
            ]
        }, null, 2);
    }

    if (fullContext.includes('feasibility') || fullContext.includes('innovation') || fullContext.includes('marketpotential')) {
        return JSON.stringify({
            feasibility: 8.2,
            innovation: 7.8,
            marketPotential: 8.5,
            complexity: 4.5,
            overallScore: 8.1,
            final_score: 8.1,
            summary: '[Offline Blueprint Analysis] Well-scoped small-team product concept. Configure Gemini, OpenRouter, OpenAI, or local Ollama in Settings for deep live AI market critique.',
            strengths: [
                'Clear MVP vertical slice boundaries suitable for a 2-6 person team',
                'Direct mapping from domain entities to live stateful mock API & clickable prototype'
            ],
            weaknesses: [
                'Offline deterministic evaluation active — connect a live LLM provider for competitor and domain-specific risk analysis'
            ],
            recommendedNextSteps: [
                'Choose a Product Archetype Playbook to seed Feature Slices & edge cases',
                'Vote on MVP vs. V1.1 slices with your team',
                'Test the clickable prototype against the live Mock API before production build'
            ]
        }, null, 2);
    }

    if (fullContext.includes('answer_markdown') && fullContext.includes('next_actions')) {
        return JSON.stringify({
            answer_markdown: '**Offline Blueprint Mode Active.** No live LLM API key or local Ollama endpoint is currently configured.\n\nYou can still use Akasha\'s **Archetype Playbooks**, **Vertical Feature Slices**, **Live Stateful Mock API**, **Clickable Prototypes**, **Change Impact Ripple**, **Full-Stack Code Export**, and **MCP IDE Agent Handoff** at 100% capacity. Connect Gemini, OpenRouter, OpenAI, or Ollama in **Settings** to unlock live AI generation.',
            summary: 'Offline Blueprint Mode is active; configure a live AI provider in Settings for generative chat.',
            highlights: [
                'Deterministic Archetype Playbooks & Mock API work fully offline',
                'External IDE agents (Antigravity, Cursor, Claude Code) can connect via MCP without server keys'
            ],
            next_actions: [
                'Open Settings to configure Gemini, OpenRouter, OpenAI, or local Ollama',
                'Or dispatch a Feature Build Pack to your IDE agent via MCP'
            ],
            warnings: ['Running in deterministic Offline Blueprint Mode (no live LLM provider configured)']
        });
    }

    return '[Offline Blueprint Mode] No live LLM provider is configured. Configure Gemini, OpenRouter, OpenAI, or local Ollama in Settings for live AI responses—or continue building with Akasha\'s deterministic Playbooks, Live Mock API, Impact Ripple, Full-Stack Export, and MCP Agent Handoff.';
}

export class HybridLLMProvider implements LLMProvider {
    private envGeminiKey: string;
    private envOpenRouterKey: string;
    private envOpenAiKey: string;
    private envOllamaUrl: string;
    private envOllamaModel: string;

    constructor() {
        this.envGeminiKey = cleanKey(process.env.GEMINI_API_KEY);
        this.envOpenRouterKey = cleanKey(process.env.OPENROUTER_API_KEY);
        this.envOpenAiKey = cleanKey(process.env.OPENAI_API_KEY);
        this.envOllamaUrl = normalizeBaseUrl(process.env.OLLAMA_BASE_URL || '');
        this.envOllamaModel = process.env.OLLAMA_MODEL || 'llama3.1';
    }

    private resolveRuntime(options?: Partial<LLMCompletionOptions>): {
        provider: ProviderHealth['provider'];
        apiKey: string;
        baseUrl: string;
        model: string;
        configured: boolean;
        reason?: string;
    } {
        const store = options?.bypassStore ? undefined : aiConfigStorage.getStore();
        const requestedProvider = (options?.provider || store?.provider || '').trim().toLowerCase();
        const reqKey = cleanKey(options?.apiKey || store?.apiKey);
        const reqBase = normalizeBaseUrl(options?.apiBaseUrl || store?.apiBaseUrl || '');
        const reqModel = (options?.model || store?.model || '').trim();

        // Explicit offline mode requested
        if (requestedProvider === 'offline') {
            return {
                provider: 'offline',
                apiKey: '',
                baseUrl: '',
                model: 'deterministic-playbook',
                configured: false,
                reason: 'Offline Blueprint Mode explicitly selected',
            };
        }

        // Local Ollama (no API key required)
        if (requestedProvider === 'ollama' || reqBase.includes('11434') || (!isUsableKey(reqKey) && this.envOllamaUrl)) {
            const ollamaUrl = reqBase || this.envOllamaUrl || 'http://localhost:11434/v1';
            const ollamaModel = (reqModel && reqModel !== 'antigravity-brain') ? reqModel : this.envOllamaModel;
            return {
                provider: 'ollama',
                apiKey: 'ollama',
                baseUrl: ollamaUrl,
                model: ollamaModel,
                configured: true,
            };
        }

        // Request-supplied live API key
        if (isUsableKey(reqKey)) {
            if (requestedProvider === 'gemini' || reqBase.includes('generativelanguage.googleapis.com')) {
                return {
                    provider: 'gemini',
                    apiKey: reqKey,
                    baseUrl: reqBase || 'https://generativelanguage.googleapis.com/v1beta',
                    model: (reqModel && reqModel !== 'antigravity-brain') ? reqModel : (process.env.GEMINI_MODEL || 'gemini-2.5-flash'),
                    configured: true,
                };
            }
            if (requestedProvider === 'openai' || reqBase.includes('api.openai.com')) {
                return {
                    provider: 'openai',
                    apiKey: reqKey,
                    baseUrl: reqBase || 'https://api.openai.com/v1',
                    model: (reqModel && reqModel !== 'antigravity-brain') ? reqModel : 'gpt-4o-mini',
                    configured: true,
                };
            }
            return {
                provider: 'openrouter',
                apiKey: reqKey,
                baseUrl: reqBase || 'https://openrouter.ai/api/v1',
                model: (reqModel && reqModel !== 'antigravity-brain') ? reqModel : 'openrouter/free',
                configured: true,
            };
        }

        // Server environment fallback keys
        if (isUsableKey(this.envGeminiKey)) {
            return {
                provider: 'gemini',
                apiKey: this.envGeminiKey,
                baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
                model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
                configured: true,
            };
        }
        if (isUsableKey(this.envOpenRouterKey)) {
            return {
                provider: 'openrouter',
                apiKey: this.envOpenRouterKey,
                baseUrl: normalizeBaseUrl(process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'),
                model: process.env.OPENROUTER_MODEL || 'openrouter/free',
                configured: true,
            };
        }
        if (isUsableKey(this.envOpenAiKey)) {
            return {
                provider: 'openai',
                apiKey: this.envOpenAiKey,
                baseUrl: normalizeBaseUrl(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'),
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                configured: true,
            };
        }

        return {
            provider: 'offline',
            apiKey: '',
            baseUrl: '',
            model: 'deterministic-playbook',
            configured: false,
            reason: 'No live LLM API key or Ollama endpoint configured',
        };
    }

    getHealth(override?: Partial<RequestAiConfig>): ProviderHealth {
        const resolved = this.resolveRuntime(override);
        return {
            mode: resolved.configured ? 'live' : 'offline',
            provider: resolved.provider,
            model: resolved.model,
            baseUrl: resolved.baseUrl || undefined,
            configured: resolved.configured,
            reason: resolved.reason,
        };
    }

    async chatWithMeta(options: LLMCompletionOptions): Promise<LLMCompletionResult> {
        const resolved = this.resolveRuntime(options);

        if (!resolved.configured || resolved.provider === 'offline') {
            return {
                text: synthesizeOfflineResponse(options),
                mode: 'offline',
                provider: 'offline',
                model: 'deterministic-playbook',
                fallbackReason: resolved.reason,
            };
        }

        // 1. Native Gemini SDK path
        if (resolved.provider === 'gemini' && !resolved.baseUrl.endsWith('/openai')) {
            try {
                const cleanedModel = resolved.model.replace(/^models\//, '').replace(/^google\//, '');
                const systemMessage = options.messages.find(m => m.role === 'system');
                const userMessages = options.messages.filter(m => m.role !== 'system');
                const contents = userMessages.map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                }));

                const ai = new GoogleGenAI({ apiKey: resolved.apiKey });
                const config: Record<string, unknown> = {
                    temperature: options.temperature ?? 0.3,
                    maxOutputTokens: options.max_tokens ?? 2048,
                };
                if (systemMessage) config.systemInstruction = systemMessage.content;

                const response = await ai.models.generateContent({
                    model: cleanedModel,
                    contents,
                    config,
                });

                if (response.text && response.text.trim()) {
                    return {
                        text: response.text,
                        mode: 'live',
                        provider: 'gemini',
                        model: cleanedModel,
                    };
                }
            } catch (err: any) {
                console.warn('[HybridLLM] Gemini call failed, falling back to offline deterministic mode:', err?.message || err);
                return {
                    text: synthesizeOfflineResponse(options),
                    mode: 'offline',
                    provider: 'offline',
                    model: 'deterministic-playbook',
                    fallbackReason: `Gemini error: ${err?.message || 'request failed'}`,
                };
            }
        }

        // 2. OpenAI-compatible path (OpenRouter, OpenAI, Ollama, Gemini OpenAI-compat)
        try {
            const client = new OpenAI({
                baseURL: resolved.baseUrl,
                apiKey: resolved.apiKey,
            });
            const completion = await client.chat.completions.create({
                model: resolved.model,
                messages: options.messages as any,
                temperature: options.temperature ?? 0.3,
                max_tokens: options.max_tokens ?? 2048,
                top_p: options.top_p,
            });

            const content = completion.choices[0]?.message?.content;
            if (content && content.trim().length > 0) {
                return {
                    text: content,
                    mode: 'live',
                    provider: resolved.provider,
                    model: resolved.model,
                };
            }
        } catch (err: any) {
            console.warn(`[HybridLLM] ${resolved.provider} call failed, falling back to offline deterministic mode:`, err?.message || err);
            return {
                text: synthesizeOfflineResponse(options),
                mode: 'offline',
                provider: 'offline',
                model: 'deterministic-playbook',
                fallbackReason: `${resolved.provider} error: ${err?.message || 'request failed'}`,
            };
        }

        return {
            text: synthesizeOfflineResponse(options),
            mode: 'offline',
            provider: 'offline',
            model: 'deterministic-playbook',
            fallbackReason: 'Empty model response',
        };
    }

    async chat(options: LLMCompletionOptions): Promise<string> {
        const res = await this.chatWithMeta(options);
        return res.text;
    }

    async *chatStream(options: LLMCompletionOptions): AsyncGenerator<string, void, undefined> {
        const resolved = this.resolveRuntime(options);

        if (resolved.configured && resolved.provider !== 'offline' && resolved.provider !== 'gemini') {
            try {
                const client = new OpenAI({
                    baseURL: resolved.baseUrl,
                    apiKey: resolved.apiKey,
                });
                const stream = await client.chat.completions.create({
                    model: resolved.model,
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
                return;
            } catch (err: any) {
                console.warn('[HybridLLM] Stream failed, falling back to offline output:', err?.message || err);
            }
        }

        const result = await this.chatWithMeta(options);
        const words = result.text.split(/(\s+)/);
        for (const word of words) {
            yield word;
        }
    }

    async isAvailable(): Promise<boolean> {
        return true;
    }

    getName(): string {
        const health = this.getHealth();
        return health.mode === 'live'
            ? `${health.provider.toUpperCase()} (${health.model})`
            : 'Offline Blueprint Mode';
    }
}

class UnifiedLLMProvider {
    private provider: HybridLLMProvider;

    constructor() {
        this.provider = new HybridLLMProvider();
    }

    async initialize(): Promise<void> {
        const health = this.provider.getHealth();
        console.log(
            health.mode === 'live'
                ? `[LLM] Explicit Hybrid AI initialized: LIVE via ${health.provider} (${health.model})`
                : `[LLM] Explicit Hybrid AI initialized: OFFLINE BLUEPRINT MODE (${health.reason || 'no API key'})`
        );
    }

    async *chatStream(options: LLMCompletionOptions): AsyncGenerator<string, void, undefined> {
        yield* this.provider.chatStream(options);
    }

    async chat(options: LLMCompletionOptions): Promise<string> {
        return this.provider.chat(options);
    }

    async chatWithMeta(options: LLMCompletionOptions): Promise<LLMCompletionResult> {
        return this.provider.chatWithMeta(options);
    }

    getHealth(override?: Partial<RequestAiConfig>): ProviderHealth {
        return this.provider.getHealth(override);
    }

    getActiveProvider(): string {
        return this.provider.getName();
    }
}

let unifiedProvider: UnifiedLLMProvider | null = null;

export async function initializeLLMProvider(): Promise<void> {
    unifiedProvider = new UnifiedLLMProvider();
    await unifiedProvider.initialize();
}

export function getLLMProvider(): UnifiedLLMProvider {
    if (!unifiedProvider) {
        unifiedProvider = new UnifiedLLMProvider();
    }
    return unifiedProvider;
}
