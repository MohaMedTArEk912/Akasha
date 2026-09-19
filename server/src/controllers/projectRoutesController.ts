import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import path from "node:path";
import { ObjectId } from "mongodb";
import prisma from "../lib/prisma.js";
async function getOrgMemberModel(): Promise<any> {
  try {
    const modPath = "../../models/OrgMember.js";
    const mod = await import(modPath);
    return mod.default;
  } catch {
    return null;
  }
}
import { getLLMProvider, aiConfigStorage } from "../lib/llmProvider.js";
import {
  buildProjectImportSample,
  importProjectFromPayload,
  parseJsonValue,
  serializeProjectById,
  serializeProjectTransferById,
  toProjectSchema,
} from "../services/projectTransfer.js";

export async function listProjects(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    let whereClause: any = undefined;
    if (user?.id) {
      const OrgMember = await getOrgMemberModel();
      if (OrgMember) {
        const memberships = await OrgMember.find({ userId: user.id, status: 'accepted' });
        const myOrgIds = memberships.map((m: any) => m.orgId.toString());
        whereClause = {
          OR: [
            { userId: user.id },
            { orgId: { in: myOrgIds } }
          ]
        };
      } else {
        whereClause = { userId: user.id };
      }
    }
    const projects = await prisma.project.findMany({
      where: whereClause,
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

    const user = (req as any).user;
    if (user?.id) {
      const OrgMember = await getOrgMemberModel();
      if (OrgMember) {
        const memberships = await OrgMember.find({ userId: user.id, status: 'accepted' });
        const myOrgIds = memberships.map((m: any) => m.orgId.toString());
        const isOwner = String(project.userId) === String(user.id);
        const isOrgMember = project.orgId && myOrgIds.includes(project.orgId.toString());
        if (!isOwner && !isOrgMember) {
          return res.status(403).json({ error: "Forbidden: Access denied to this project" });
        }
      }
    }

    res.json(project);
  } catch (error) {
    console.error("Error getting project:", error);
    res.status(500).json({ error: "Failed to get project" });
  }
}

export async function createProject(req: Request, res: Response) {
  try {
    const { name, description, orgId } = req.body;
    const user = (req as any).user;
    const userId = user?.id || 'standalone-dev';

    if (orgId) {
      const OrgMember = await getOrgMemberModel();
      if (OrgMember) {
        const member = await OrgMember.findOne({ orgId, userId, status: 'accepted' });
        if (!member) {
          return res.status(403).json({ error: "Forbidden: Not an active member of this organization" });
        }
      }
    }

    const projectIdStr = new ObjectId().toHexString();

    const project = await prisma.project.create({
      data: {
        id: projectIdStr,
        userId,
        orgId: orgId || null,
        name,
        description,
        status: 'initializing',
        checkpoint: 1,
        rootPath: path.join(process.cwd(), 'projects', projectIdStr),
        pipelineData: JSON.stringify({
          questions: [
            { id: 1, question: "What is the name and tagline of the product?", answer: name, comments: [] },
            { id: 2, question: "What is the key problem this project solves?", answer: "", comments: [] },
            { id: 3, question: "Who is the target audience/users?", answer: "", comments: [] },
            { id: 4, question: "What is the core value proposition?", answer: "", comments: [] },
            { id: 5, question: "What is the critical MVP scope?", answer: "", comments: [] }
          ]
        }),
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

    res.json({
      title: requestedName,
      summary:
        "Describe the product vision in plain language. Include what the system does, who it serves, and why it matters.",
      target_audience: [
        "Primary users (e.g. patients, doctors, nurses)",
        "Secondary users (e.g. admins, finance, support)",
      ],
      core_value_proposition: [
        "What key value this product delivers",
        "How it improves current workflows",
      ],
      problem_statement: [
        "What is broken today",
        "What pain points must be solved first",
      ],
      decision_summary: [],
      key_features: [
        "Feature 1",
        "Feature 2",
        "Feature 3",
      ],
      user_flows: [
        "User flow 1",
        "User flow 2",
      ],
      technical_architecture: [
        "Frontend",
        "Backend",
        "Database",
        "Integrations",
      ],
      data_api_requirements: [
        "Entities and data model notes",
        "API endpoint requirements",
      ],
      milestones: [
        "Milestone 1",
        "Milestone 2",
      ],
      success_metrics: [
        "KPI 1",
        "KPI 2",
      ],
      risks: [
        "Risk 1",
        "Risk 2",
      ],
      implementation_checklist: [
        "Task 1",
        "Task 2",
      ],
      open_questions: [
        "Question 1",
      ],
    });
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
    const store = aiConfigStorage.getStore();
    const apiKey = store?.apiKey || req.body.apiKey || undefined;
    const modelOverride = store?.model || req.body.model || undefined;
    const apiBaseUrl = store?.apiBaseUrl || req.body.apiBaseUrl || undefined;
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
      model: modelOverride || process.env.OPENROUTER_MODEL || undefined,
      temperature: 0.2,
      max_tokens: 1400,
      apiKey,
      apiBaseUrl,
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
          model: modelOverride || process.env.OPENROUTER_MODEL || undefined,
          temperature: 0,
          max_tokens: 1800,
          apiKey,
          apiBaseUrl,
          messages: [
            {
              role: "system",
              content:
                "You repair malformed JSON. Return ONLY valid JSON with the same keys and values. Do not add markdown fences or commentary.",
            },
            { role: "user", content: completion },
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

async function getUserRoleInProjectOrg(projectId: string, userId?: string): Promise<'leader' | 'member' | null> {
  if (!userId) return 'leader';
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return null;
  if (!project.orgId) {
    return 'leader';
  }
  const OrgMember = await getOrgMemberModel();
  if (!OrgMember) return 'leader';
  const member = await OrgMember.findOne({ orgId: project.orgId.toString(), userId, status: 'accepted' });
  return member ? (member.role as 'leader' | 'member') : 'leader';
}

export async function getProjectRole(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const user = (req as any).user; const userId = user?.id || 'standalone-dev';
    const role = await getUserRoleInProjectOrg(id as string, userId);
    res.json({ role });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateCheckpoint(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { checkpoint, pipelineData, status } = req.body;
    const user = (req as any).user; const userId = user?.id || 'standalone-dev';

    const role = await getUserRoleInProjectOrg(id as string, userId);
    if (!role) {
      return res.status(403).json({ error: "Forbidden: You do not have access to this project" });
    }

    if (role !== 'leader') {
      return res.status(403).json({ error: "Forbidden: Only the team leader can update checkpoint or status" });
    }

    const updateData: any = {};
    if (checkpoint !== undefined) updateData.checkpoint = Number(checkpoint);
    if (status !== undefined) updateData.status = status;
    if (pipelineData !== undefined) {
      updateData.pipelineData = typeof pipelineData === 'string' ? pipelineData : JSON.stringify(pipelineData);
    }

    await prisma.project.update({
      where: { id },
      data: updateData,
    });

    const project = await serializeProjectById(id as string);

    const io = req.app.get('io');
    if (io) {
      io.to(`project:${id}`).emit('project:updated', project);
    }

    res.json(project);
  } catch (error: any) {
    console.error("Error updating checkpoint:", error);
    res.status(500).json({ error: error.message || "Failed to update checkpoint" });
  }
}

export async function addComment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { questionId, text } = req.body;
    const user = (req as any).user; const userId = user?.id || 'standalone-dev';
    const username = user?.username || 'Developer';
    const displayName = user?.displayName || username;

    const role = await getUserRoleInProjectOrg(id as string, userId);
    if (!role) {
      return res.status(403).json({ error: "Forbidden: Access denied" });
    }

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const pipelineData = typeof project.pipelineData === 'string'
      ? JSON.parse(project.pipelineData)
      : (project.pipelineData || {});

    if (!pipelineData.questions) {
      pipelineData.questions = [];
    }

    const q = pipelineData.questions.find((question: any) => question.id === Number(questionId));
    if (!q) {
      return res.status(400).json({ error: "Question not found" });
    }

    const newComment = {
      id: randomUUID(),
      userId,
      username,
      displayName,
      text,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    if (!q.comments) {
      q.comments = [];
    }
    q.comments.push(newComment);

    await prisma.project.update({
      where: { id },
      data: { pipelineData: JSON.stringify(pipelineData) }
    });

    const updatedProject = await serializeProjectById(id as string);

    const io = req.app.get('io');
    if (io) {
      io.to(`project:${id}`).emit('project:updated', updatedProject);
    }

    res.json(updatedProject);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function handleComment(req: Request, res: Response) {
  try {
    const { id, commentId } = req.params;
    const { action } = req.body; // 'accepted' | 'rejected'
    const user = (req as any).user; const userId = user?.id || 'standalone-dev';

    const role = await getUserRoleInProjectOrg(id as string, userId);
    if (role !== 'leader') {
      return res.status(403).json({ error: "Forbidden: Only the team leader can handle comments" });
    }

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ error: "Project not found" });

    const pipelineData = typeof project.pipelineData === 'string'
      ? JSON.parse(project.pipelineData)
      : (project.pipelineData || {});

    let commentFound = false;
    if (pipelineData.questions) {
      for (const q of pipelineData.questions) {
        if (q.comments) {
          const c = q.comments.find((comment: any) => comment.id === commentId);
          if (c) {
            c.status = action;
            commentFound = true;
            break;
          }
        }
      }
    }

    if (!commentFound) {
      return res.status(404).json({ error: "Comment not found" });
    }

    await prisma.project.update({
      where: { id },
      data: { pipelineData: JSON.stringify(pipelineData) }
    });

    const updatedProject = await serializeProjectById(id as string);

    const io = req.app.get('io');
    if (io) {
      io.to(`project:${id}`).emit('project:updated', updatedProject);
    }

    res.json(updatedProject);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
