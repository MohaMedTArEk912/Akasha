/**
 * Release Readiness Service
 *
 * Computes a transparent, actionable 6-pillar Launch Readiness Score (0-100%)
 * tailored for small teams shipping real sites, tools, e-commerce stores, and web apps.
 */

import prisma from '../lib/prisma.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';

export interface ReadinessCheck {
    id: string;
    label: string;
    category: 'scope' | 'edge_cases' | 'contracts' | 'prototype' | 'alignment' | 'shipping';
    status: 'pass' | 'warn' | 'fail';
    weight: number;
    earned: number;
    detail: string;
    actionTab: 'scope' | 'studio' | 'blueprint' | 'build';
}

export interface ReleaseReadinessReport {
    projectId: string;
    score: number;
    stage: 'Ideation' | 'Prototyping' | 'In Build' | 'Ready to Ship';
    checks: ReadinessCheck[];
    counts: {
        slices: number;
        mvpSlices: number;
        models: number;
        apis: number;
        pages: number;
        mockRecords: number;
        decisions: number;
        unresolvedComments: number;
        tasksDone: number;
        tasksTotal: number;
    };
}

export async function computeReleaseReadiness(projectId: string): Promise<ReleaseReadinessReport> {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error(`Project ${projectId} not found`);

    const [slices, models, apis, pages, mockRecords, decisions, comments, latestDrift] = await Promise.all([
        prisma.featureSlice.findMany({ where: { projectId } }).catch(() => []),
        prisma.dataModel.findMany({ where: { projectId } }).catch(() => []),
        prisma.apiEndpoint.findMany({ where: { projectId } }).catch(() => []),
        prisma.page.findMany({ where: { projectId } }).catch(() => []),
        prisma.mockRecord.findMany({ where: { projectId } }).catch(() => []),
        prisma.projectDecision.findMany({ where: { projectId } }).catch(() => []),
        prisma.projectComment.findMany({ where: { projectId } }).catch(() => []),
        prisma.driftReport.findFirst({ where: { projectId }, orderBy: { createdAt: 'desc' } }).catch(() => null),
    ]);

    const activeModels = (models || []).filter((m: any) => m.archived !== true);
    const activeApis = (apis || []).filter((a: any) => a.archived !== true);
    const activePages = (pages || []).filter((p: any) => p.archived !== true);
    const mvpSlices = (slices || []).filter((s: any) => s.lane === 'mvp');
    const unresolvedComments = (comments || []).filter((c: any) => !c.resolved);

    const settings = safeJsonParse<Record<string, any>>(project.settings, {});
    const tasks: any[] = Array.isArray(settings.teamTasks) ? settings.teamTasks : [];
    const tasksDone = tasks.filter(t => t.status === 'done').length;

    // 1. Scope & MVP Slices Locked (20 pts)
    const slicesWithCriteria = mvpSlices.filter((s: any) => Array.isArray(s.acceptanceCriteria) && s.acceptanceCriteria.length > 0);
    const scopeEarned = mvpSlices.length > 0
        ? Math.round((slicesWithCriteria.length / mvpSlices.length) * 20)
        : ((project.description || '').trim().length > 20 ? 8 : 0);

    // 2. Domain Edge Cases Reviewed (15 pts)
    const allEdgeCases = (slices || []).flatMap((s: any) => Array.isArray(s.edgeCases) ? s.edgeCases : []);
    const coveredEdgeCases = allEdgeCases.filter((e: any) => e.covered);
    const edgeEarned = allEdgeCases.length > 0
        ? Math.min(15, 6 + Math.round((coveredEdgeCases.length / allEdgeCases.length) * 9))
        : 0;

    // 3. Data Models & API Contracts Shaped (20 pts)
    const contractsEarned =
        (activeModels.length > 0 ? 10 : 0) +
        (activeApis.length > 0 ? 10 : 0);

    // 4. Interactive Prototype & Live Mock Data Ready (20 pts)
    const prototypeEarned =
        (activePages.length > 0 ? 10 : 0) +
        ((mockRecords || []).length > 0 ? 10 : 0);

    // 5. Team Alignment (Decisions logged & no blocking feedback) (10 pts)
    const needsSyncSlices = (slices || []).filter((s: any) => s.status === 'needs_sync');
    const alignEarned =
        ((decisions || []).length > 0 ? 5 : 0) +
        (needsSyncSlices.length === 0 && unresolvedComments.length === 0 ? 5 : unresolvedComments.length <= 2 ? 3 : 1);

    // 6. Shipping & Drift Hygiene (15 pts)
    const hasDriftIssues = latestDrift && ((latestDrift.missingInCode?.length || 0) > 0 || (latestDrift.fieldMismatches?.length || 0) > 0);
    const taskCompletionRatio = tasks.length > 0 ? tasksDone / tasks.length : 0;
    const shipEarned = Math.min(
        15,
        Math.round(taskCompletionRatio * 10) + (hasDriftIssues ? 2 : 5)
    );

    const checks: ReadinessCheck[] = [
        {
            id: 'scope-mvp',
            label: 'MVP Feature Slices & Acceptance Criteria',
            category: 'scope',
            status: scopeEarned >= 16 ? 'pass' : scopeEarned > 0 ? 'warn' : 'fail',
            weight: 20,
            earned: scopeEarned,
            detail: mvpSlices.length > 0
                ? `${slicesWithCriteria.length}/${mvpSlices.length} MVP slices have acceptance criteria`
                : 'No MVP slices created yet — pick an Archetype Playbook or add a Feature Slice',
            actionTab: 'scope',
        },
        {
            id: 'edge-cases',
            label: 'Domain Edge Cases Covered',
            category: 'edge_cases',
            status: coveredEdgeCases.length > 0 && coveredEdgeCases.length === allEdgeCases.length ? 'pass' : allEdgeCases.length > 0 ? 'warn' : 'fail',
            weight: 15,
            earned: edgeEarned,
            detail: allEdgeCases.length > 0
                ? `${coveredEdgeCases.length}/${allEdgeCases.length} domain edge cases verified`
                : 'Add edge cases (empty states, out-of-stock, auth, refunds) to your slices',
            actionTab: 'scope',
        },
        {
            id: 'contracts',
            label: 'Data Models & REST API Contracts',
            category: 'contracts',
            status: contractsEarned === 20 ? 'pass' : contractsEarned > 0 ? 'warn' : 'fail',
            weight: 20,
            earned: contractsEarned,
            detail: `${activeModels.length} data model(s) · ${activeApis.length} REST endpoint(s)`,
            actionTab: 'blueprint',
        },
        {
            id: 'prototype',
            label: 'Live Mock API & Clickable Prototype',
            category: 'prototype',
            status: prototypeEarned === 20 ? 'pass' : prototypeEarned > 0 ? 'warn' : 'fail',
            weight: 20,
            earned: prototypeEarned,
            detail: `${activePages.length} interactive screen(s) · ${(mockRecords || []).length} live mock record(s)`,
            actionTab: 'studio',
        },
        {
            id: 'alignment',
            label: 'Team Decisions & Sync Hygiene',
            category: 'alignment',
            status: alignEarned >= 8 ? 'pass' : alignEarned >= 5 ? 'warn' : 'fail',
            weight: 10,
            earned: alignEarned,
            detail: `${(decisions || []).length} ADR(s) · ${needsSyncSlices.length} slice(s) need sync · ${unresolvedComments.length} open comment(s)`,
            actionTab: 'scope',
        },
        {
            id: 'shipping',
            label: 'Delivery Progress & Repo Drift',
            category: 'shipping',
            status: shipEarned >= 12 ? 'pass' : shipEarned >= 5 ? 'warn' : 'fail',
            weight: 15,
            earned: shipEarned,
            detail: `${tasksDone}/${tasks.length} tasks done${hasDriftIssues ? ' · Drift detected in repo' : ' · Zero critical drift'}`,
            actionTab: 'build',
        },
    ];

    const score = Math.min(100, checks.reduce((sum, c) => sum + c.earned, 0));
    const stage: ReleaseReadinessReport['stage'] =
        score >= 85 ? 'Ready to Ship' : score >= 60 ? 'In Build' : score >= 35 ? 'Prototyping' : 'Ideation';

    return {
        projectId,
        score,
        stage,
        checks,
        counts: {
            slices: (slices || []).length,
            mvpSlices: mvpSlices.length,
            models: activeModels.length,
            apis: activeApis.length,
            pages: activePages.length,
            mockRecords: (mockRecords || []).length,
            decisions: (decisions || []).length,
            unresolvedComments: unresolvedComments.length,
            tasksDone,
            tasksTotal: tasks.length,
        },
    };
}
