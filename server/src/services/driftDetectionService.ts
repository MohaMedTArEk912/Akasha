/**
 * Blueprint vs. Code Drift Detection Radar
 *
 * Compares Akasha's Living Blueprint (DataModels & REST APIs) against actual source code
 * (either a local workspace directory or a linked GitHub repository) and reports:
 * - matchedEntities / missingInCode / undocumentedInBlueprint / fieldMismatches
 * - matchedApis / missingApisInCode / undocumentedApisInBlueprint
 *
 * Also supports 1-click "Adopt from Code into Blueprint" to eliminate spec staleness.
 */

import fs from 'fs-extra';
import path from 'node:path';
import prisma from '../lib/prisma.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';
import { compileProjectBlueprint } from './structuredBlueprintService.js';
import { analyzeRepositoryFiles, type RepoCodeIntelligence } from './repoSearchEngine.js';
import { randomUUID } from 'node:crypto';

export interface DriftFieldMismatch {
    entityName: string;
    missingInCode: string[];
    extraInCode: string[];
}

export interface BlueprintDriftReport {
    id: string;
    projectId: string;
    source: string;
    healthScore: number; // 0-100
    matchedEntities: string[];
    missingInCode: string[];
    undocumentedInBlueprint: string[];
    fieldMismatches: DriftFieldMismatch[];
    matchedApis: string[];
    missingApisInCode: string[];
    undocumentedApisInBlueprint: string[];
    scannedFileCount: number;
    scannedBytes: number;
    createdAt: string;
}

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.akasha', 'coverage']);

async function collectWorkspaceSourceFiles(rootDir: string, maxFiles = 120): Promise<Array<{ path: string; content: string; size: number }>> {
    const results: Array<{ path: string; content: string; size: number }> = [];
    if (!(await fs.pathExists(rootDir))) return results;

    const allowedExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.prisma', '.sql', '.json', '.py']);

    async function walk(currentDir: string) {
        if (results.length >= maxFiles) return;
        const entries = await fs.readdir(currentDir, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
            if (results.length >= maxFiles) break;
            if (IGNORED_DIRS.has(entry.name)) continue;
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
            } else {
                const ext = path.extname(entry.name).toLowerCase();
                if (!allowedExts.has(ext) || entry.name === 'package-lock.json') continue;
                try {
                    const stat = await fs.stat(fullPath);
                    if (stat.size > 200_000) continue;
                    const content = await fs.readFile(fullPath, 'utf-8');
                    const rel = path.relative(rootDir, fullPath).replace(/\\/g, '/');
                    results.push({ path: rel, content, size: stat.size });
                } catch {}
            }
        }
    }

    await walk(rootDir);
    return results;
}

function normalizeApiKey(method: string, routePath: string): string {
    const cleanPath = routePath
        .toLowerCase()
        .replace(/^\/api\/v\d+/, '')
        .replace(/^\/api/, '')
        .replace(/\/+$/, '') || '/';
    return `${method.toUpperCase()} ${cleanPath}`;
}

export function compareBlueprintAgainstCode(
    projectId: string,
    blueprint: {
        entities: Array<{ name: string; fields: Array<{ name: string }> }>;
        apiContracts: Array<{ method: string; path: string }>;
    },
    codeIntel: RepoCodeIntelligence,
    sourceLabel: string
): BlueprintDriftReport {
    const bpModelMap = new Map(blueprint.entities.map(e => [e.name.toLowerCase(), e]));
    const codeModelMap = new Map(codeIntel.models.map(m => [m.name.toLowerCase(), m]));

    const matchedEntities: string[] = [];
    const missingInCode: string[] = [];
    const undocumentedInBlueprint: string[] = [];
    const fieldMismatches: DriftFieldMismatch[] = [];

    for (const [key, bpModel] of bpModelMap.entries()) {
        const codeModel = codeModelMap.get(key);
        if (!codeModel) {
            missingInCode.push(bpModel.name);
        } else {
            matchedEntities.push(bpModel.name);
            const bpFields = new Set(bpModel.fields.map(f => f.name.toLowerCase()).filter(n => n !== 'id' && n !== '_id'));
            const codeFields = new Set(codeModel.fields.map(f => f.name.toLowerCase()).filter(n => n !== 'id' && n !== '_id'));
            const missingFields = Array.from(bpFields).filter(f => !codeFields.has(f));
            const extraFields = Array.from(codeFields).filter(f => !bpFields.has(f));
            if (missingFields.length > 0 || extraFields.length > 0) {
                fieldMismatches.push({
                    entityName: bpModel.name,
                    missingInCode: missingFields,
                    extraInCode: extraFields,
                });
            }
        }
    }

    for (const [key, codeModel] of codeModelMap.entries()) {
        if (!bpModelMap.has(key)) {
            undocumentedInBlueprint.push(codeModel.name);
        }
    }

    const bpApiMap = new Map(blueprint.apiContracts.map(a => [normalizeApiKey(a.method, a.path), `${a.method} ${a.path}`]));
    const codeApiMap = new Map(codeIntel.apis.map(a => [normalizeApiKey(a.method, a.path), `${a.method} ${a.path}`]));

    const matchedApis: string[] = [];
    const missingApisInCode: string[] = [];
    const undocumentedApisInBlueprint: string[] = [];

    for (const [key, label] of bpApiMap.entries()) {
        if (codeApiMap.has(key)) matchedApis.push(label);
        else missingApisInCode.push(label);
    }
    for (const [key, label] of codeApiMap.entries()) {
        if (!bpApiMap.has(key)) undocumentedApisInBlueprint.push(label);
    }

    const totalItems =
        bpModelMap.size + bpApiMap.size + undocumentedInBlueprint.length + undocumentedApisInBlueprint.length;
    const alignedItems = matchedEntities.length + matchedApis.length;
    const mismatchPenalty = fieldMismatches.length * 8;
    const healthScore = totalItems === 0
        ? 100
        : Math.max(0, Math.min(100, Math.round((alignedItems / totalItems) * 100) - mismatchPenalty));

    return {
        id: `drift-${randomUUID().slice(0, 8)}`,
        projectId,
        source: sourceLabel,
        healthScore,
        matchedEntities,
        missingInCode,
        undocumentedInBlueprint,
        fieldMismatches,
        matchedApis,
        missingApisInCode,
        undocumentedApisInBlueprint,
        scannedFileCount: codeIntel.rawFileCount,
        scannedBytes: codeIntel.totalBytes,
        createdAt: new Date().toISOString(),
    };
}

export async function runProjectDriftCheck(params: {
    projectId: string;
    workspaceDir?: string;
    files?: Array<{ path: string; content: string }>;
}): Promise<BlueprintDriftReport> {
    const { projectId, workspaceDir, files } = params;
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error(`Project ${projectId} not found`);

    const blueprint = await compileProjectBlueprint(projectId);
    const targetDir = workspaceDir || project.rootPath || path.join(process.cwd(), 'projects', projectId);

    const sourceFiles = Array.isArray(files) && files.length > 0
        ? files
        : await collectWorkspaceSourceFiles(targetDir);

    const codeIntel = analyzeRepositoryFiles(sourceFiles);
    const report = compareBlueprintAgainstCode(
        projectId,
        blueprint,
        codeIntel,
        Array.isArray(files) ? 'inline-files' : targetDir
    );

    // Store real measured repo metrics on project settings so token savings math is honest
    if (codeIntel.totalBytes > 0) {
        const settings = safeJsonParse<Record<string, any>>(project.settings, {});
        settings.repoMetrics = {
            fileCount: codeIntel.rawFileCount,
            totalBytes: codeIntel.totalBytes,
            measuredAt: new Date().toISOString(),
        };
        await prisma.project.update({
            where: { id: projectId },
            data: { settings: JSON.stringify(settings) },
        }).catch(() => null);
    }

    await prisma.driftReport.create({
        data: {
            ...report,
            createdAt: new Date(),
        },
    }).catch(() => null);

    return report;
}

export async function getLatestDriftReport(projectId: string): Promise<BlueprintDriftReport | null> {
    const doc = await prisma.driftReport.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
    }).catch(() => null);
    if (!doc) return null;
    return {
        ...doc,
        createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt || ''),
    } as BlueprintDriftReport;
}
