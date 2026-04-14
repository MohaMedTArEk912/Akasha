import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import prisma from "../lib/prisma.js";
import { getLLMProvider } from "../lib/llmProvider.js";
import {
  buildProjectImportSample,
  importProjectFromPayload,
  parseJsonValue,
  serializeProjectById,
  serializeProjectTransferById,
  toProjectSchema,
} from "../services/projectTransfer.js";

export async function listProjects(_req: Request, res: Response) {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
    });
    res.json(projects);
  } catch (error) {
    console.error("Error listing projects:", error);
    res.status(500).json({ error: "Failed to list projects" });
  }
}

export async function getProject(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const project = await serializeProjectById(id as string);

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json(project);
  } catch (error) {
    console.error("Error getting project:", error);
    res.status(500).json({ error: "Failed to get project" });
  }
}

export async function createProject(req: Request, res: Response) {
  try {
    const { name, description } = req.body;
    const project = await prisma.project.create({
      data: {
        name,
        description,
        settings: JSON.stringify({
          theme: { primary_color: "#3b82f6" },
        }),
      },
    });

    const homePage = await prisma.page.create({
      data: {
        id: randomUUID(),
        projectId: project.id,
        name: "Home",
        path: "/",
        isDynamic: false,
      },
    });

    const rootBlock = await prisma.block.create({
      data: {
        projectId: project.id,
        pageId: homePage.idRoot,
        parentId: null,
        blockType: "canvas",
        name: "Page Root",
        properties: JSON.stringify({}),
        styles: JSON.stringify({}),
        responsiveStyles: JSON.stringify({}),
        classes: JSON.stringify([]),
        events: JSON.stringify([]),
        bindings: JSON.stringify({}),
        children: JSON.stringify([]),
        order: 0,
      },
    });

    const updatedHomePage = await prisma.page.update({
      where: { id: homePage.id },
      data: {
        meta: JSON.stringify({
          root_block_id: rootBlock.id,
        }),
      },
    });

    const serializedProject = await serializeProjectById(project.id);
    res.json(
      serializedProject ||
        toProjectSchema(project, [updatedHomePage], [rootBlock]),
    );
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
}

export async function getProjectImportTemplate(req: Request, res: Response) {
  try {
    const requestedName =
      typeof req.query.name === "string" && req.query.name.trim()
        ? req.query.name.trim()
        : "Sample Project";

    res.json(buildProjectImportSample(requestedName));
  } catch (error) {
    console.error("Error generating project template:", error);
    res.status(500).json({ error: "Failed to generate project template" });
  }
}

export async function importProject(req: Request, res: Response) {
  try {
    const projectId = await importProjectFromPayload(req.body);
    const project = await serializeProjectById(projectId);
    res.json(project);
  } catch (error: any) {
    console.error("Error importing project:", error);
    res
      .status(400)
      .json({ error: error?.message || "Failed to import project" });
  }
}

export async function exportProject(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const payload = await serializeProjectTransferById(id as string);

    if (!payload) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json(payload);
  } catch (error: any) {
    console.error("Error exporting project:", error);
    res
      .status(500)
      .json({ error: error?.message || "Failed to export project" });
  }
}

export async function updateProject(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description, settings } = req.body;

    await prisma.project.update({
      where: { id: id as string },
      data: {
        name,
        description,
        ...(settings && { settings: JSON.stringify(settings) }),
      },
    });

    const project = await serializeProjectById(id as string);
    res.json(project);
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ error: "Failed to update project" });
  }
}

export async function deleteProject(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await prisma.project.delete({ where: { id: id as string } });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
}

export async function updateProjectIdea(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { idea } = req.body;

    await prisma.project.update({
      where: { id: id as string },
      data: { description: idea || "" },
    });

    const project = await serializeProjectById(id as string);
    res.json(project);
  } catch (error) {
    console.error("Error updating project idea:", error);
    res.status(500).json({ error: "Failed to update project idea" });
  }
}

function extractJsonObject(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output");
  }
  return text.slice(start, end + 1);
}

function normalizeStringArray(value: unknown, maxItems = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function buildSummaryFromIdea(rawIdea: string): string {
  const compact = rawIdea.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  const firstSentence = compact.split(/[.!?]/)[0]?.trim() || compact;
  return firstSentence.slice(0, 160);
}

function buildFallbackStructuredIdea(rawIdea: string) {
  const summary = buildSummaryFromIdea(rawIdea);
  const trimmedIdea = rawIdea.trim();
  const ideaName = summary || trimmedIdea.split(/\r?\n/)[0]?.trim() || "Untitled Idea";

  return {
    ideaMetadata: {
      ideaName: ideaName.slice(0, 80),
      tagline: summary,
      summary,
      industry: "",
      category: "",
      innovationType: "",
      creationDate: new Date().toISOString(),
    },
    problem: {
      problemStatement: summary || trimmedIdea,
      problemContext: trimmedIdea,
      whoHasThisProblem: [],
      painPoints: [],
      currentSolutions: [],
      whyCurrentSolutionsFail: [],
      urgencyLevel: "medium",
    },
    solution: {
      productDescription: summary,
      coreInnovation: "",
      valueProposition: "",
      keyBenefits: [],
      useCases: [],
    },
    targetMarket: {
      primaryUsers: [],
      customerSegments: [],
      marketSize: { tam: "", sam: "", som: "" },
      geographicFocus: "",
      earlyAdopters: [],
    },
    competition: {
      directCompetitors: [],
      indirectCompetitors: [],
      competitiveAdvantages: [],
      weaknessesOfCompetitors: [],
      differentiationStrategy: "",
    },
    product: {
      coreFeatures: [],
      advancedFeatures: [],
      futureFeatures: [],
      platforms: [],
    },
    userExperience: {
      onboardingFlow: [],
      mainUserJourney: [],
      retentionMechanisms: [],
      viralityMechanisms: [],
    },
    monetization: {
      revenueModel: "",
      pricingStrategy: "",
      pricingTiers: { free: "", pro: "", enterprise: "" },
      estimatedLTV: "",
      estimatedCAC: "",
    },
    goToMarket: {
      launchStrategy: [],
      marketingChannels: [],
      growthLoops: [],
      partnerships: [],
    },
    technicalArchitecture: {
      frontend: "",
      backend: "",
      database: "",
      aiComponents: "",
      infrastructure: "",
      integrations: [],
      security: [],
      scalabilityPlan: "",
    },
    dataModel: {
      coreEntities: [],
      relationships: [],
      dataPrivacy: "",
    },
    aiStrategy: {
      aiRoleInProduct: "",
      modelsUsed: [],
      trainingDataSources: [],
      aiRisks: [],
    },
    mvpPlan: {
      mvpGoal: "",
      mustHaveFeatures: [],
      developmentTimeEstimate: "",
      teamRequired: [],
    },
    validation: {
      assumptions: [],
      validationMethods: [],
      successCriteria: [],
    },
    risks: {
      technicalRisks: [],
      marketRisks: [],
      legalRisks: [],
      businessRisks: [],
    },
    metrics: {
      northStarMetric: "",
      kpis: [],
    },
    roadmap: {
      phase1: "",
      phase2: "",
      phase3: "",
      phase4: "",
    },
    ideaScore: {
      marketPotential: "",
      technicalFeasibility: "",
      competitionLevel: "",
      buildDifficulty: "",
      overallScore: 0,
    },
  };
}

function normalizeStructuredIdea(parsed: unknown, rawIdea: string) {
  const fallback = buildFallbackStructuredIdea(rawIdea);
  const source = parsed && typeof parsed === "object" ? (parsed as Record<string, any>) : {};

  const mergeSection = (key: keyof typeof fallback) => {
    const value = source[key];
    return value && typeof value === "object" && !Array.isArray(value)
      ? { ...(fallback[key] as Record<string, unknown>), ...value }
      : fallback[key];
  };

  return {
    ...fallback,
    ideaMetadata: {
      ...fallback.ideaMetadata,
      ...(source.ideaMetadata && typeof source.ideaMetadata === "object" && !Array.isArray(source.ideaMetadata)
        ? source.ideaMetadata
        : {}),
    },
    problem: {
      ...fallback.problem,
      ...(source.problem && typeof source.problem === "object" && !Array.isArray(source.problem)
        ? source.problem
        : {}),
      whoHasThisProblem: normalizeStringArray(source.problem?.whoHasThisProblem ?? source.problem?.who_has_this_problem, 10),
      painPoints: normalizeStringArray(source.problem?.painPoints ?? source.problem?.pain_points, 10),
      currentSolutions: normalizeStringArray(source.problem?.currentSolutions ?? source.problem?.current_solutions, 10),
      whyCurrentSolutionsFail: normalizeStringArray(source.problem?.whyCurrentSolutionsFail ?? source.problem?.why_current_solutions_fail, 10),
    },
    solution: {
      ...fallback.solution,
      ...(source.solution && typeof source.solution === "object" && !Array.isArray(source.solution)
        ? source.solution
        : {}),
      keyBenefits: normalizeStringArray(source.solution?.keyBenefits ?? source.solution?.key_benefits, 10),
      useCases: normalizeStringArray(source.solution?.useCases ?? source.solution?.use_cases, 10),
    },
    targetMarket: {
      ...fallback.targetMarket,
      ...(source.targetMarket && typeof source.targetMarket === "object" && !Array.isArray(source.targetMarket)
        ? source.targetMarket
        : {}),
      primaryUsers: normalizeStringArray(source.targetMarket?.primaryUsers ?? source.targetMarket?.primary_users, 10),
      customerSegments: normalizeStringArray(source.targetMarket?.customerSegments ?? source.targetMarket?.customer_segments, 10),
      earlyAdopters: normalizeStringArray(source.targetMarket?.earlyAdopters ?? source.targetMarket?.early_adopters, 10),
      marketSize: {
        ...fallback.targetMarket.marketSize,
        ...(source.targetMarket?.marketSize && typeof source.targetMarket.marketSize === "object" && !Array.isArray(source.targetMarket.marketSize)
          ? source.targetMarket.marketSize
          : {}),
      },
    },
    competition: mergeSection("competition"),
    product: {
      ...fallback.product,
      ...(source.product && typeof source.product === "object" && !Array.isArray(source.product)
        ? source.product
        : {}),
      coreFeatures: normalizeStringArray(source.product?.coreFeatures ?? source.product?.core_features, 12),
      advancedFeatures: normalizeStringArray(source.product?.advancedFeatures ?? source.product?.advanced_features, 12),
      futureFeatures: normalizeStringArray(source.product?.futureFeatures ?? source.product?.future_features, 12),
      platforms: normalizeStringArray(source.product?.platforms, 8),
    },
    userExperience: mergeSection("userExperience"),
    monetization: mergeSection("monetization"),
    goToMarket: mergeSection("goToMarket"),
    technicalArchitecture: {
      ...fallback.technicalArchitecture,
      ...(source.technicalArchitecture && typeof source.technicalArchitecture === "object" && !Array.isArray(source.technicalArchitecture)
        ? source.technicalArchitecture
        : {}),
      integrations: normalizeStringArray(source.technicalArchitecture?.integrations, 10),
      security: normalizeStringArray(source.technicalArchitecture?.security, 10),
    },
    dataModel: mergeSection("dataModel"),
    aiStrategy: mergeSection("aiStrategy"),
    mvpPlan: {
      ...fallback.mvpPlan,
      ...(source.mvpPlan && typeof source.mvpPlan === "object" && !Array.isArray(source.mvpPlan)
        ? source.mvpPlan
        : {}),
      mustHaveFeatures: normalizeStringArray(source.mvpPlan?.mustHaveFeatures ?? source.mvpPlan?.must_have_features, 12),
      teamRequired: normalizeStringArray(source.mvpPlan?.teamRequired ?? source.mvpPlan?.team_required, 10),
    },
    validation: mergeSection("validation"),
    risks: mergeSection("risks"),
    metrics: mergeSection("metrics"),
    roadmap: mergeSection("roadmap"),
    ideaScore: {
      ...fallback.ideaScore,
      ...(source.ideaScore && typeof source.ideaScore === "object" && !Array.isArray(source.ideaScore)
        ? source.ideaScore
        : {}),
    },
  };
}

export async function generateStructuredIdea(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: id as string },
      include: {
        pages: true,
        blocks: true,
        variables: true,
        dataModels: true,
        logicFlows: true,
        apis: true,
        useCases: true,
      },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const rawIdea = req.body.ideaContent || project.description;
    if (!rawIdea || !rawIdea.trim()) {
      return res.status(400).json({
        error:
          "Project description/idea is empty. Please write an idea first.",
      });
    }

    const provider = getLLMProvider();
    const systemPrompt = `You are a product architect. Return ONLY valid JSON with this structure:
{
  "ideaMetadata": {
    "ideaName": "string",
    "tagline": "string",
    "summary": "string",
    "industry": "string",
    "category": "string",
    "innovationType": "string"
  },
  "problem": {
    "problemStatement": "string",
    "painPoints": ["string"],
    "whoHasThisProblem": ["string"],
    "urgencyLevel": "low | medium | high"
  },
  "solution": {
    "productDescription": "string",
    "coreInnovation": "string",
    "valueProposition": "string",
    "keyBenefits": ["string"]
  },
  "product": {
    "coreFeatures": ["string"],
    "platforms": ["string"]
  },
  "technicalArchitecture": {
    "frontend": "string",
    "backend": "string",
    "database": "string"
  },
  "mvpPlan": {
    "mvpGoal": "string",
    "mustHaveFeatures": ["string"],
    "developmentTimeEstimate": "string"
  },
  "ideaScore": {
    "marketPotential": "number 1-10",
    "technicalFeasibility": "number 1-10",
    "overallScore": "number 1-10"
  }
}`;

    const completion = await provider.chat({
      model: process.env.OPENROUTER_MODEL || "google/gemma-3-4b-it:free",
      temperature: 0.2,
      max_tokens: 1400,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: rawIdea },
      ],
    });

    let parsedCompletion: unknown;
    try {
      parsedCompletion = JSON.parse(extractJsonObject(completion));
    } catch (parseError) {
      console.warn("Structured idea output was not valid JSON, attempting repair:", parseError);
      try {
        const repairCompletion = await provider.chat({
          model: process.env.OPENROUTER_MODEL || "google/gemma-3-4b-it:free",
          temperature: 0,
          max_tokens: 1800,
          messages: [
            {
              role: "system",
              content:
                "You repair malformed JSON. Return ONLY valid JSON with the same keys and values. Do not add markdown fences or commentary.",
            },
            { role: "user", content: extractJsonObject(completion) },
          ],
        });

        parsedCompletion = JSON.parse(extractJsonObject(repairCompletion || completion));
      } catch (repairError) {
        console.warn("Structured idea repair failed, using fallback draft:", repairError);
        parsedCompletion = buildFallbackStructuredIdea(rawIdea);
      }
    }

    const structuredIdea = normalizeStructuredIdea(parsedCompletion, rawIdea);
    const settings =
      typeof project.settings === "string"
        ? parseJsonValue(project.settings, {})
        : project.settings || {};

    const updatedProject = await prisma.project.update({
      where: { id: id as string },
      data: {
        settings: JSON.stringify({
          ...settings,
          ideaDetails: structuredIdea,
        }),
      },
      include: {
        pages: true,
        blocks: true,
        variables: true,
        dataModels: true,
        logicFlows: true,
        apis: true,
        useCases: true,
      },
    });

    res.json(
      toProjectSchema(
        updatedProject,
        updatedProject.pages,
        updatedProject.blocks,
        updatedProject.variables,
        updatedProject.dataModels,
        updatedProject.logicFlows,
        updatedProject.apis,
        updatedProject.useCases,
      ),
    );
  } catch (error: any) {
    console.error("Error generating structured idea details:", error);
    res.status(500).json({
      error: "Failed to generate structured idea: " + error.message,
    });
  }
}
