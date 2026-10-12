import type { Request, Response } from 'express';
import {
    compileProjectBlueprint,
    persistBlueprintToFile
} from '../services/structuredBlueprintService.js';
import {
    getSquadConfig,
    updateSquadConfig,
    getActiveMission,
    dispatchSquadMission,
    reportAgentAction
} from '../services/agentSquadOrchestrator.js';
import type { AgentRole, ExecutionMode } from '../services/agentSquadOrchestrator.js';

export async function getBlueprint(req: Request, res: Response) {
    try {
        const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }

        const blueprint = await compileProjectBlueprint(projectId);
        res.json({ success: true, blueprint });
    } catch (err: any) {
        console.error('[getBlueprint error]:', err);
        res.status(500).json({ error: err.message });
    }
}

export async function syncBlueprintFile(req: Request, res: Response) {
    try {
        const { projectId, workspacePath } = req.body;
        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }

        const targetPath = workspacePath || process.cwd();
        const blueprint = await compileProjectBlueprint(projectId);
        const writtenPath = await persistBlueprintToFile(targetPath, blueprint);

        res.json({
            success: true,
            message: 'Structured Blueprint successfully persisted to workspace',
            filePath: writtenPath,
            tokenMetrics: blueprint.tokenMetrics
        });
    } catch (err: any) {
        console.error('[syncBlueprintFile error]:', err);
        res.status(500).json({ error: err.message });
    }
}

export async function getSquadConfiguration(req: Request, res: Response) {
    try {
        const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }

        const config = getSquadConfig(projectId);
        res.json({ success: true, config });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
}

export async function updateSquadConfiguration(req: Request, res: Response) {
    try {
        const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }

        const updated = updateSquadConfig(projectId, req.body);
        res.json({ success: true, config: updated });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
}

export async function dispatchMission(req: Request, res: Response) {
    try {
        const { projectId, prompt, executionMode, taskIds, apiKey, model, apiBaseUrl } = req.body;
        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: 'prompt is required' });
        }

        const mission = await dispatchSquadMission(projectId, {
            prompt,
            executionMode: executionMode as ExecutionMode,
            taskIds,
            apiKey,
            model,
            apiBaseUrl
        });

        res.json({
            success: true,
            message: `Mission dispatched in ${mission.executionMode.toUpperCase()} mode`,
            mission
        });
    } catch (err: any) {
        console.error('[dispatchMission error]:', err);
        res.status(500).json({ error: err.message });
    }
}

export async function getMissionStatus(req: Request, res: Response) {
    try {
        const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required' });
        }

        const mission = getActiveMission(projectId);
        const config = getSquadConfig(projectId);

        res.json({
            success: true,
            mission,
            config
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
}

export async function reportTelemetry(req: Request, res: Response) {
    try {
        const {
            projectId,
            agentRole,
            stepName,
            thought,
            activeTool,
            toolArgsSnippet,
            fileCreatedOrModified,
            type,
            progress,
            tokensUsedDelta
        } = req.body;

        if (!projectId || !agentRole || !stepName || !thought) {
            return res.status(400).json({ error: 'projectId, agentRole, stepName, and thought are required' });
        }

        reportAgentAction(projectId, {
            agentRole: agentRole as AgentRole,
            stepName,
            thought,
            activeTool,
            toolArgsSnippet,
            fileCreatedOrModified,
            type,
            progress,
            tokensUsedDelta
        });

        res.json({ success: true, message: 'Telemetry logged' });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
}
