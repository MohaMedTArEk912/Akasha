import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getLLMProvider } from '../lib/llmProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 1. Load Templates ---
let templates: Record<string, any> = {};
try {
    const templatePath = path.join(__dirname, 'templates', 'domainTemplates.json');
    const rawData = fs.readFileSync(templatePath, 'utf-8');
    templates = JSON.parse(rawData);
} catch (err) {
    console.error('Failed to load domain templates:', err);
}

// --- 2. Extract JSON helper ---
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

// --- 3. Category Detection ---
export function detectCategories(idea: string): string[] {
    const text = idea.toLowerCase();
    const matchedCategories: string[] = [];

    for (const [category, data] of Object.entries(templates)) {
        const keywords = data.keywords as string[];
        for (const kw of keywords) {
            // Using word boundary regex for precise keyword matching
            if (new RegExp('\\b' + kw.toLowerCase() + '\\b').test(text)) {
                matchedCategories.push(category);
                break; // One keyword match is enough for this category
            }
        }
    }
    return matchedCategories;
}

// --- 4. Template Features Aggregation ---
export function collectTemplateFeatures(categories: string[]): string[] {
    const allFeatures = new Set<string>();
    for (const cat of categories) {
        if (templates[cat] && Array.isArray(templates[cat].features)) {
            for (const f of templates[cat].features) {
                allFeatures.add(f);
            }
        }
    }
    return Array.from(allFeatures);
}

// --- 5. Light Idea Scoring (Pipeline Step 1 replacement) ---
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
        model: options?.model || 'google/gemma-3-4b-it:free',
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

// --- 6. Full Pipeline Implementation ---
export async function runFullPipeline(idea: string, options?: { apiKey?: string; model?: string; apiBaseUrl?: string }) {
    const llmProvider = getLLMProvider();

    // Stage 1 & 2 & 4: Deep Extraction & Merging
    // (We merge these conceptually to save LLM calls)
    const categories = detectCategories(idea);
    const templateFeatures = collectTemplateFeatures(categories);

    const featurePrompt = `You are an enterprise system architect.
I have a startup idea. I have also matched it to domain templates and extracted some baseline features.
Combine the AI-extracted specialized features with the template features, remove duplicates, and categorize them.

IDEA: ${idea}
MATCHED DOMAINS: ${categories.join(', ')}
TEMPLATE FEATURES: ${templateFeatures.join(', ')}

Return ONLY valid JSON:
{
  "core": ["string"],
  "secondary": ["string"],
  "admin": ["string"]
}`;

    let mergedFeatures: any = { core: [], secondary: [], admin: [] };
    try {
        const res = await llmProvider.chat({
            model: options?.model || 'google/gemini-2.5-flash',
            temperature: 0.2,
            apiKey: options?.apiKey,
            apiBaseUrl: options?.apiBaseUrl,
            messages: [{ role: 'user', content: featurePrompt }]
        });
        mergedFeatures = JSON.parse(extractJsonObject(res));
    } catch (e) {
        console.warn("Feature extraction failed, falling back to templates", e);
        mergedFeatures.core = templateFeatures;
    }

    // Stage 5 & 6: Requirements & Use Cases
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
            model: options?.model || 'google/gemini-2.5-flash',
            temperature: 0.2,
            apiKey: options?.apiKey,
            apiBaseUrl: options?.apiBaseUrl,
            messages: [{ role: 'user', content: reqPrompt }]
        });
        reqsAndCases = JSON.parse(extractJsonObject(res));
    } catch (e) {
        console.warn("Requirements gen failed", e);
    }

    // Stage 7: Verification Loop
    let isComplete = false;
    let loopCount = 0;
    const MAX_LOOPS = 2; // Keep loop small to save time/tokens
    
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
                model: options?.model || 'google/gemma-3-4b-it:free',
                temperature: 0.1,
                apiKey: options?.apiKey,
                apiBaseUrl: options?.apiBaseUrl,
                messages: [{ role: 'user', content: verifyPrompt }]
            });
            const verification = JSON.parse(extractJsonObject(res));
            
            if (verification.is_complete) {
                isComplete = true;
            } else {
                // In a real advanced system, we'd feed this back to generate additions.
                // Here we just append the missing lists for simplicity so the human can see it.
                if (verification.missing_features?.length) {
                    currentSpec.features.core.push(...verification.missing_features.slice(0, 3));
                }
                if (verification.missing_requirements?.length) {
                    currentSpec.requirements.functional.push(...verification.missing_requirements.slice(0, 3));
                }
                // we break to avoid infinite loops if it refuses to true the boolean,
                // but we incremented loop count so it will naturally terminate.
            }
        } catch (e) {
            isComplete = true; // Bail out on error
        }
        loopCount++;
    }

    return currentSpec;
}
