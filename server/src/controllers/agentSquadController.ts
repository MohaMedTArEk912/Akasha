import type { Request, Response } from 'express';
import {
    compileProjectBlueprint,
    persistBlueprintToFile,
} from '../services/structuredBlueprintService.js';
import {
    getSquadConfig,
    updateSquadConfig,
    getActiveMission,
    dispatchSquadMission,
    reportAgentAction,
    type AgentRole,
    type ExecutionMode,
    type DispatchStrategy,
} from '../services/agentSquadOrchestrator.js';
import { attachProjectSseStream } from '../services/telemetryBus.js';
import { runProjectDriftCheck, getLatestDriftReport } from '../services/driftDetectionService.js';

function paramStr(val: string | string[] | undefined): string {
    return Array.isArray(val) ? (val[0] || '') : (val || '');
}

export async function getBlueprint(req: Request, res: Response) {
    try {
        const projectId = paramStr(req.params.projectId);
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });
        const blueprint = await compileProjectBlueprint(projectId);
        return res.json({ success: true, blueprint });
    } catch (err: any) {
        console.error('[getBlueprint error]:', err);
        return res.status(500).json({ error: err?.message || 'Failed to compile blueprint' });
    }
}

export async function syncBlueprintFile(req: Request, res: Response) {
    try {
        const { projectId, workspacePath } = req.body || {};
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });

        const targetPath = workspacePath || process.cwd();
        const blueprint = await compileProjectBlueprint(projectId);
        const writtenPath = await persistBlueprintToFile(targetPath, blueprint);

        return res.json({
            success: true,
            message: 'Structured Blueprint successfully persisted to workspace',
            filePath: writtenPath,
            tokenMetrics: blueprint.tokenMetrics,
        });
    } catch (err: any) {
        console.error('[syncBlueprintFile error]:', err);
        return res.status(500).json({ error: err?.message || 'Sync failed' });
    }
}

export async function getSquadConfiguration(req: Request, res: Response) {
    try {
        const projectId = paramStr(req.params.projectId);
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });
        return res.json({ success: true, config: getSquadConfig(projectId) });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message });
    }
}

export async function updateSquadConfiguration(req: Request, res: Response) {
    try {
        const projectId = paramStr(req.params.projectId);
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });
        const updated = updateSquadConfig(projectId, req.body || {});
        return res.json({ success: true, config: updated });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message });
    }
}

export async function dispatchMission(req: Request, res: Response) {
    try {
        const { projectId, prompt, executionMode, dispatchStrategy, sliceId, taskIds } = req.body || {};
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });
        if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'prompt is required' });

        const mission = await dispatchSquadMission(projectId, {
            prompt,
            executionMode: executionMode as ExecutionMode,
            dispatchStrategy: dispatchStrategy as DispatchStrategy,
            sliceId,
            taskIds,
        });

        return res.json({
            success: true,
            message: `Mission dispatched (${mission.dispatchStrategy})`,
            mission,
        });
    } catch (err: any) {
        console.error('[dispatchMission error]:', err);
        return res.status(500).json({ error: err?.message });
    }
}

export async function getMissionStatus(req: Request, res: Response) {
    try {
        const projectId = paramStr(req.params.projectId);
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });

        const mission = await getActiveMission(projectId);
        const config = getSquadConfig(projectId);
        return res.json({ success: true, mission, config });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message });
    }
}

export async function streamMissionEvents(req: Request, res: Response) {
    const projectId = paramStr(req.params.projectId);
    if (!projectId) {
        res.status(400).json({ error: 'projectId is required' });
        return;
    }
    attachProjectSseStream(projectId, res, async () => {
        const mission = await getActiveMission(projectId);
        const config = getSquadConfig(projectId);
        return { mission, config };
    });
}

export async function reportTelemetry(req: Request, res: Response) {
    try {
        const {
            projectId,
            missionId,
            agentRole,
            stepName,
            thought,
            activeTool,
            toolArgsSnippet,
            fileCreatedOrModified,
            type,
            progress,
            tokensUsedDelta,
        } = req.body || {};

        if (!projectId || !agentRole || !stepName || !thought) {
            return res.status(400).json({ error: 'projectId, agentRole, stepName, and thought are required' });
        }

        const entry = await reportAgentAction(projectId, {
            missionId,
            agentRole: agentRole as AgentRole,
            stepName,
            thought,
            activeTool,
            toolArgsSnippet,
            fileCreatedOrModified,
            type,
            progress,
            tokensUsedDelta,
            source: 'mcp_http',
        });

        return res.json({ success: true, message: 'Telemetry persisted & streamed', telemetry: entry });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message });
    }
}

export async function runDriftCheck(req: Request, res: Response) {
    try {
        const projectId = paramStr(req.params.projectId);
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });
        const { workspaceDir, files } = req.body || {};
        const report = await runProjectDriftCheck({ projectId, workspaceDir, files });
        return res.json({ success: true, report });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message || 'Drift check failed' });
    }
}

export async function getDriftStatus(req: Request, res: Response) {
    try {
        const projectId = paramStr(req.params.projectId);
        if (!projectId) return res.status(400).json({ error: 'projectId is required' });
        const report = await getLatestDriftReport(projectId);
        return res.json({ success: true, report });
    } catch (err: any) {
        return res.status(500).json({ error: err?.message });
    }
}
