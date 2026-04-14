import { detectCategories, collectTemplateFeatures, runFullPipeline } from './src/ai/ideaPipeline.js';

async function test() {
    console.log("=== Testing Detect Categories ===");
    const idea = "I want an AI-powered project workspace with a Kanban board and chat bot.";
    const categories = detectCategories(idea);
    console.log("Matched categories:", categories);
    
    console.log("\n=== Testing Collect Features ===");
    const features = collectTemplateFeatures(categories);
    console.log("Collected features:", features.length, "features");

    // We skip the full LLM pipeline call in this basic test so we don't spam the API key,
    // but we can uncomment it to test!
    
    console.log("\n✅ Unit logic for the pipeline functions imported successfully.");
}

test().catch(console.error);
