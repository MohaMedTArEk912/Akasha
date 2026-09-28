import { getLLMProvider } from '../lib/llmProvider.js';

// --- 1. Extract JSON helper ---
function extractJsonObject(raw: string): string {
    let text = raw.trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error('No JSON object found in model output');
    }
    return text.slice(start, end + 1);
}

// --- 2. Dynamic Domain Classification ---
export function detectCategories(idea: string): string[] {
    const text = idea.toLowerCase();
    const categories: string[] = [];

    const domainIndicators: Record<string, string[]> = {
        identity_security: ["login", "auth", "security", "permissions", "roles", "sso", "mfa", "rbac", "identity"],
        ecommerce: ["shop", "store", "buy", "sell", "cart", "checkout", "product", "inventory", "payment"],
        healthcare: ["patient", "doctor", "health", "hospital", "clinic", "medical", "appointment", "prescription"],
        ai_productivity: ["ai", "bot", "assistant", "generate", "smart", "summarize", "automation", "workflow", "copilot"],
        data_analytics: ["analytics", "dashboard", "metric", "telemetry", "report", "kpi", "pipeline", "chart"],
        collaboration: ["team", "chat", "message", "project", "workspace", "task", "board", "collaborate"]
    };

    for (const [category, keywords] of Object.entries(domainIndicators)) {
        for (const kw of keywords) {
            if (new RegExp('\\b' + kw + '\\b').test(text)) {
                categories.push(category);
                break;
            }
        }
    }
    return categories.length > 0 ? categories : ["general_application"];
}

// --- 3. Light Idea Scoring (Pipeline Step 1 replacement) ---
export async function lightScoreIdea(idea: string, options?: { apiKey?: string; model?: string; apiBaseUrl?: string }) {
    const prompt = `You are a professional innovation evaluator.
Evaluate the startup idea for Feasibility (1-10), Innovation (1-10), MarketPotential (1-10), and Complexity (1-10).
Respond ONLY in JSON matching this structure exactly:
{
  "feasibility": 8,
  "innovation": 7,
  "marketPotential": 9,
  "complexity": 5,
  "strengths": ["point1", "point2"],
  "weaknesses": ["point1", "point2"],
  "summary": "short paragraph",
  "recommendedNextSteps": ["step1", "step2"]
}

IDEA TO EVALUATE:
${idea}`;

    const llmProvider = getLLMProvider();
    const response = await llmProvider.chat({
        model: options?.model || 'openrouter/free',
        temperature: 0.2,
        apiKey: options?.apiKey,
        apiBaseUrl: options?.apiBaseUrl,
        messages: [{ role: 'user', content: prompt }]
    });

    try {
        const parsed = JSON.parse(extractJsonObject(response));
        // Calculate safe scores
        const f = Number(parsed.feasibility) || 5;
        const i = Number(parsed.innovation) || 5;
        const m = Number(parsed.marketPotential) || 5;
        const c = Number(parsed.complexity) || 5;
        
        // Final score: high feat, inn, market; low complexity
        const final_score = parseFloat(((f + i + m + (10 - c)) / 4).toFixed(1));
        
        return {
            ...parsed,
            feasibility: f,
            innovation: i,
            marketPotential: m,
            complexity: c,
            overallScore: final_score, // backwards compat
            final_score
        };
    } catch {
        return {
            feasibility: 5, innovation: 5, marketPotential: 5, complexity: 5,
            overallScore: 5.0, final_score: 5.0,
            summary: "Failed to parse AI evaluation.",
            strengths: [], weaknesses: [], recommendedNextSteps: []
        };
    }
}

// --- 4. Full Pipeline Implementation ---
export async function runFullPipeline(idea: string, options?: { apiKey?: string; model?: string; apiBaseUrl?: string }) {
    const llmProvider = getLLMProvider();

    // Stage 1 & 2: First-principles Feature Extraction
    const categories = detectCategories(idea);

    const featurePrompt = `You are an enterprise system architect.
Perform a first-principles architectural decomposition of this startup/system idea.
Extract comprehensive core, secondary, and administrative capabilities tailored specifically to this domain.

IDEA: ${idea}
CATEGORIES: ${categories.join(', ')}

Return ONLY valid JSON:
{
  "core": ["string"],
  "secondary": ["string"],
  "admin": ["string"]
}`;

    let mergedFeatures: any = { core: [], secondary: [], admin: [] };
    try {
        const res = await llmProvider.chat({
            model: options?.model || 'openrouter/free',
            temperature: 0.2,
            apiKey: options?.apiKey,
            apiBaseUrl: options?.apiBaseUrl,
            messages: [{ role: 'user', content: featurePrompt }]
        });
        mergedFeatures = JSON.parse(extractJsonObject(res));
    } catch (e) {
        console.warn("Feature extraction failed, extracting dynamic baseline", e);
        const words = idea.split(/[\s,.-]+/).filter(w => w.length > 3).slice(0, 4);
        mergedFeatures.core = words.map(w => `${w.charAt(0).toUpperCase() + w.slice(1)} Management Engine`);
        mergedFeatures.secondary = ["Audit Logging & Telemetry", "User Access Governance"];
        mergedFeatures.admin = ["System Configuration", "API Key Management"];
    }

    // Stage 3: Requirements & Use Cases
    const reqPrompt = `Based on this idea and these mapped features, generate system requirements and use cases.
IDEA: ${idea}
FEATURES: ${JSON.stringify(mergedFeatures)}

Return ONLY valid JSON:
{
  "requirements": {
    "functional": ["string"],
    "non_functional": ["string"]
  },
  "use_cases": [
    { "name": "string", "actors": ["string"], "scenario": "string" }
  ]
}`;

    let reqsAndCases: any = { requirements: { functional: [], non_functional: [] }, use_cases: [] };
    try {
        const res = await llmProvider.chat({
            model: options?.model || 'openrouter/free',
            temperature: 0.2,
            apiKey: options?.apiKey,
            apiBaseUrl: options?.apiBaseUrl,
            messages: [{ role: 'user', content: reqPrompt }]
        });
        reqsAndCases = JSON.parse(extractJsonObject(res));
    } catch (e) {
        console.warn("Requirements gen failed", e);
    }

    // Stage 4: Verification Loop
    let isComplete = false;
    let loopCount = 0;
    const MAX_LOOPS = 2;
    
    let currentSpec = {
        idea,
        categories,
        features: mergedFeatures,
        requirements: reqsAndCases.requirements,
        use_cases: reqsAndCases.use_cases
    };

    while (!isComplete && loopCount < MAX_LOOPS) {
        const verifyPrompt = `You are a strict QA verifier. Review this spec for completeness. 
Are there missing core features? Missing essential requirements?
Return ONLY JSON:
{
  "missing_features": ["string"],
  "missing_requirements": ["string"],
  "issues": ["string"],
  "is_complete": boolean
}

SPECIFICATION:
${JSON.stringify(currentSpec)}`;

        try {
            const res = await llmProvider.chat({
                model: options?.model || 'openrouter/free',
                temperature: 0.1,
                apiKey: options?.apiKey,
                apiBaseUrl: options?.apiBaseUrl,
                messages: [{ role: 'user', content: verifyPrompt }]
            });
            const verification = JSON.parse(extractJsonObject(res));
            
            if (verification.is_complete) {
                isComplete = true;
            } else {
                if (verification.missing_features?.length) {
                    currentSpec.features.core.push(...verification.missing_features.slice(0, 3));
                }
                if (verification.missing_requirements?.length) {
                    currentSpec.requirements.functional.push(...verification.missing_requirements.slice(0, 3));
                }
            }
        } catch (e) {
            isComplete = true;
        }
        loopCount++;
    }

    return currentSpec;
}
