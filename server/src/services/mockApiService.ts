/**
 * Live Stateful Mock API Server Engine
 *
 * Every Akasha project automatically gets a working MongoDB-backed REST API at:
 *   /api/mock/:projectId/:resource
 *   /api/mock/:projectId/:resource/:recordId
 *
 * Unblocks frontend engineers & lets founders/clients click through real working
 * apps on Day 1 before production backend code is written.
 */

import prisma from '../lib/prisma.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';
import { getPlaybook, type ArchetypeId } from './archetypePlaybooks.js';
import { randomUUID } from 'node:crypto';

export interface MockRequestLog {
    id: string;
    timestamp: string;
    method: string;
    path: string;
    status: number;
    durationMs: number;
    summary: string;
}

const requestLogsByProject = new Map<string, MockRequestLog[]>();

export function recordMockLog(projectId: string, entry: Omit<MockRequestLog, 'id' | 'timestamp'>) {
    const existing = requestLogsByProject.get(projectId) || [];
    const log: MockRequestLog = {
        id: `mlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        ...entry,
    };
    requestLogsByProject.set(projectId, [log, ...existing].slice(0, 80));
}

export function getMockRequestLogs(projectId: string): MockRequestLog[] {
    return requestLogsByProject.get(projectId) || [];
}

function normalizeResource(raw: string): string {
    return raw.trim().toLowerCase().replace(/^\/+|\/+$/g, '').replace(/^api\/v\d+\//, '');
}

async function findMatchingModel(projectId: string, resource: string) {
    const models = await prisma.dataModel.findMany({ where: { projectId } }).catch(() => []);
    const active = (models || []).filter((m: any) => m.archived !== true);
    const norm = normalizeResource(resource);
    const singular = norm.endsWith('s') ? norm.slice(0, -1) : norm;

    return active.find((m: any) => {
        const schema = safeJsonParse<Record<string, any>>(m.schema, {});
        const explicitRes = String(schema.resource || '').toLowerCase();
        const nameLower = String(m.name || '').toLowerCase();
        return explicitRes === norm || nameLower === norm || nameLower === singular || `${nameLower}s` === norm;
    }) || null;
}

function validateAgainstModel(model: any, payload: Record<string, unknown>, isPartial: boolean): string[] {
    if (!model) return [];
    const schema = safeJsonParse<{ fields?: any[] }>(model.schema, {});
    const fields = Array.isArray(schema.fields) ? schema.fields : [];
    const errors: string[] = [];

    if (!isPartial) {
        for (const f of fields) {
            if (!f.required || f.primary_key || f.name === 'id' || f.name === 'createdAt' || f.name === 'updatedAt' || f.name === 'timestamp' || f.name === 'status') {
                continue;
            }
            const val = payload[f.name];
            if (val === undefined || val === null || val === '') {
                errors.push(`Field "${f.name}" (${f.field_type || 'string'}) is required`);
            }
        }
    }
    return errors;
}

export async function listMockResources(projectId: string) {
    const [models, records] = await Promise.all([
        prisma.dataModel.findMany({ where: { projectId } }).catch(() => []),
        prisma.mockRecord.findMany({ where: { projectId } }).catch(() => []),
    ]);

    const counts = new Map<string, number>();
    for (const r of records || []) {
        const res = String(r.resource || '').toLowerCase();
        counts.set(res, (counts.get(res) || 0) + 1);
    }

    const resources = new Map<string, { resource: string; modelName: string; count: number; endpoint: string }>();
    for (const m of (models || []).filter((x: any) => x.archived !== true)) {
        const schema = safeJsonParse<Record<string, any>>(m.schema, {});
        const resName = String(schema.resource || `${String(m.name).toLowerCase()}s`).toLowerCase();
        resources.set(resName, {
            resource: resName,
            modelName: m.name,
            count: counts.get(resName) || 0,
            endpoint: `/api/mock/${projectId}/${resName}`,
        });
    }

    for (const [resName, count] of counts.entries()) {
        if (!resources.has(resName)) {
            resources.set(resName, {
                resource: resName,
                modelName: resName,
                count,
                endpoint: `/api/mock/${projectId}/${resName}`,
            });
        }
    }

    return Array.from(resources.values());
}

export async function queryMockRecords(
    projectId: string,
    resourceRaw: string,
    query: Record<string, unknown> = {}
) {
    const resource = normalizeResource(resourceRaw);
    const docs = await prisma.mockRecord.findMany({
        where: { projectId, resource },
        orderBy: { createdAt: 'desc' },
    });

    let items = (docs || []).map((d: any) => ({
        ...(typeof d.data === 'object' && d.data ? d.data : {}),
        id: d.recordId || d.data?.id || d.id,
        _updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : d.updatedAt,
    }));

    const search = typeof query.search === 'string' ? query.search.trim().toLowerCase() : '';
    if (search) {
        items = items.filter((item) => JSON.stringify(item).toLowerCase().includes(search));
    }

    const status = typeof query.status === 'string' ? query.status.trim().toLowerCase() : '';
    if (status && status !== 'all') {
        items = items.filter((item) => String(item.status || '').toLowerCase() === status);
    }

    const category = typeof query.category === 'string' ? query.category.trim().toLowerCase() : '';
    if (category && category !== 'all') {
        items = items.filter((item) => String(item.category || '').toLowerCase() === category);
    }

    const limit = Number(query.limit);
    if (!Number.isNaN(limit) && limit > 0) {
        items = items.slice(0, limit);
    }

    return items;
}

export async function getMockRecord(projectId: string, resourceRaw: string, recordId: string) {
    const resource = normalizeResource(resourceRaw);
    const doc = await prisma.mockRecord.findFirst({
        where: { projectId, resource, recordId },
    });
    if (!doc) return null;
    return {
        ...(typeof doc.data === 'object' && doc.data ? doc.data : {}),
        id: doc.recordId,
    };
}

export async function createMockRecord(
    projectId: string,
    resourceRaw: string,
    body: Record<string, unknown>
) {
    const resource = normalizeResource(resourceRaw);
    const model = await findMatchingModel(projectId, resource);

    // Smart E-Commerce Cart Behavior: merge quantity if same productId already exists in cart
    if (resource === 'cart' && body.productId) {
        const existingCartDocs = await prisma.mockRecord.findMany({ where: { projectId, resource: 'cart' } });
        const existingMatch = (existingCartDocs || []).find(
            (d: any) => String(d.data?.productId) === String(body.productId)
        );
        if (existingMatch) {
            const nextQty = Number(existingMatch.data?.quantity || 1) + Number(body.quantity || 1);
            const merged = { ...existingMatch.data, quantity: nextQty };
            await prisma.mockRecord.update({
                where: { id: existingMatch.id },
                data: { data: merged },
            });
            return { record: merged, status: 200 };
        }
    }

    // Smart E-Commerce Order Placement: apply coupon, decrement stock, clear cart
    const prepared: Record<string, unknown> = { ...body };
    if (resource === 'orders') {
        const cartDocs = await prisma.mockRecord.findMany({ where: { projectId, resource: 'cart' } }).catch(() => []);
        const cartItems = (cartDocs || []).map((d: any) => d.data || {});

        if ((!prepared.items || !Array.isArray(prepared.items)) && cartItems.length > 0) {
            prepared.items = cartItems.map((c: any) => ({
                productId: c.productId,
                title: c.title,
                qty: Number(c.quantity || 1),
                unitPrice: Number(c.unitPrice || 0),
            }));
        }

        if (prepared.totalAmount === undefined && cartItems.length > 0) {
            let subtotal = cartItems.reduce(
                (sum: number, c: any) => sum + Number(c.unitPrice || 0) * Number(c.quantity || 1),
                0
            );
            const couponCode = String(prepared.couponCode || '').trim().toUpperCase();
            if (couponCode) {
                const couponDocs = await prisma.mockRecord.findMany({ where: { projectId, resource: 'coupons' } }).catch(() => []);
                const validCoupon = (couponDocs || []).find(
                    (c: any) => String(c.data?.code || '').toUpperCase() === couponCode && c.data?.active !== false
                );
                if (validCoupon) {
                    const pct = Number(validCoupon.data?.discountPercent || 0);
                    subtotal = Number((subtotal * (1 - pct / 100)).toFixed(2));
                    prepared.discountApplied = `${pct}% (${couponCode})`;
                }
            }
            prepared.totalAmount = Number(subtotal.toFixed(2));
        }

        // Decrement product stock
        if (Array.isArray(prepared.items)) {
            const productDocs = await prisma.mockRecord.findMany({ where: { projectId, resource: 'products' } }).catch(() => []);
            for (const item of prepared.items as any[]) {
                const prodDoc = (productDocs || []).find(
                    (p: any) => p.recordId === item.productId || p.data?.title === item.title
                );
                if (prodDoc && typeof prodDoc.data?.stock === 'number') {
                    const newStock = Math.max(0, prodDoc.data.stock - Number(item.qty || 1));
                    await prisma.mockRecord.update({
                        where: { id: prodDoc.id },
                        data: {
                            data: {
                                ...prodDoc.data,
                                stock: newStock,
                                status: newStock === 0 ? 'out_of_stock' : prodDoc.data.status,
                            },
                        },
                    }).catch(() => null);
                }
            }
        }

        // Clear cart after order submission
        if (cartItems.length > 0) {
            await prisma.mockRecord.deleteMany({ where: { projectId, resource: 'cart' } }).catch(() => null);
        }
    }

    if (prepared.status === undefined) {
        prepared.status = resource === 'orders' || resource === 'approvals' || resource === 'bookings' ? 'pending' : 'active';
    }

    const validationErrors = validateAgainstModel(model, prepared, false);
    if (validationErrors.length > 0) {
        return { error: 'Validation failed', details: validationErrors, status: 400 };
    }

    const recordId = String(prepared.id || `${resource.slice(0, 3)}-${randomUUID().slice(0, 6)}`);
    const recordData = {
        ...prepared,
        id: recordId,
        createdAt: prepared.createdAt || new Date().toISOString(),
    };

    await prisma.mockRecord.create({
        data: {
            projectId,
            resource,
            recordId,
            data: recordData,
        },
    });

    // Auto-append audit entry for internal tool mutations
    if (resource === 'assets' || resource === 'approvals') {
        await prisma.mockRecord.create({
            data: {
                projectId,
                resource: 'audit-logs',
                recordId: `aud-${randomUUID().slice(0, 6)}`,
                data: {
                    id: `aud-${randomUUID().slice(0, 6)}`,
                    actor: String(prepared.requester || prepared.assignee || 'Operator'),
                    action: `${resource.toUpperCase()}_CREATED`,
                    target: String(prepared.tagCode || prepared.title || prepared.name || recordId),
                    timestamp: new Date().toISOString(),
                },
            },
        }).catch(() => null);
    }

    return { record: recordData, status: 201 };
}

export async function updateMockRecord(
    projectId: string,
    resourceRaw: string,
    recordId: string,
    updates: Record<string, unknown>
) {
    const resource = normalizeResource(resourceRaw);
    const existing = await prisma.mockRecord.findFirst({
        where: { projectId, resource, recordId },
    });
    if (!existing) return null;

    const merged = {
        ...(typeof existing.data === 'object' && existing.data ? existing.data : {}),
        ...updates,
        id: recordId,
        updatedAt: new Date().toISOString(),
    };

    await prisma.mockRecord.update({
        where: { id: existing.id },
        data: { data: merged },
    });

    if (resource === 'assets' || resource === 'approvals') {
        await prisma.mockRecord.create({
            data: {
                projectId,
                resource: 'audit-logs',
                recordId: `aud-${randomUUID().slice(0, 6)}`,
                data: {
                    id: `aud-${randomUUID().slice(0, 6)}`,
                    actor: 'Operator',
                    action: `${resource.toUpperCase()}_UPDATED`,
                    target: `${recordId} -> ${String(merged.status || 'updated')}`,
                    timestamp: new Date().toISOString(),
                },
            },
        }).catch(() => null);
    }

    return merged;
}

export async function deleteMockRecord(projectId: string, resourceRaw: string, recordId: string) {
    const resource = normalizeResource(resourceRaw);
    const existing = await prisma.mockRecord.findFirst({
        where: { projectId, resource, recordId },
    });
    if (!existing) return false;

    await prisma.mockRecord.delete({ where: { id: existing.id } });
    return true;
}

/**
 * Seeds (or resets) realistic domain records for a project from its archetype playbook or custom DataModels.
 */
export async function resetAndSeedMockData(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error(`Project ${projectId} not found`);

    await prisma.mockRecord.deleteMany({ where: { projectId } });

    const settings = safeJsonParse<Record<string, any>>(project.settings, {});
    const archetype = settings.archetype as ArchetypeId | undefined;
    let seededCount = 0;

    if (archetype) {
        const playbook = getPlaybook(archetype);
        for (const [resource, rows] of Object.entries(playbook.seedData)) {
            for (const row of rows) {
                await prisma.mockRecord.create({
                    data: {
                        projectId,
                        resource: resource.toLowerCase(),
                        recordId: String(row.id || randomUUID().slice(0, 8)),
                        data: row,
                    },
                });
                seededCount += 1;
            }
        }
    } else {
        // Derive realistic sample records directly from DataModels
        const models = await prisma.dataModel.findMany({ where: { projectId } }).catch(() => []);
        for (const m of (models || []).filter((x: any) => x.archived !== true)) {
            const schema = safeJsonParse<{ fields?: any[]; resource?: string }>(m.schema, {});
            const resource = String(schema.resource || `${String(m.name).toLowerCase()}s`).toLowerCase();
            const fields = Array.isArray(schema.fields) ? schema.fields : [];

            for (let idx = 1; idx <= 3; idx++) {
                const recordId = `${resource.slice(0, 3)}-${100 + idx}`;
                const row: Record<string, unknown> = { id: recordId };
                for (const f of fields) {
                    if (f.name === 'id') continue;
                    const t = String(f.field_type || 'string').toLowerCase();
                    if (t === 'integer' || t === 'float') row[f.name] = idx * 25;
                    else if (t === 'boolean') row[f.name] = idx !== 3;
                    else if (t === 'datetime') row[f.name] = new Date().toISOString();
                    else if (f.name.toLowerCase().includes('status')) row[f.name] = idx === 1 ? 'active' : idx === 2 ? 'pending' : 'completed';
                    else if (f.name.toLowerCase().includes('email')) row[f.name] = `team${idx}@${project.name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'app'}.io`;
                    else row[f.name] = `${m.name} Sample ${idx}`;
                }
                await prisma.mockRecord.create({
                    data: { projectId, resource, recordId, data: row },
                });
                seededCount += 1;
            }
        }
    }

    return { success: true, seededCount };
}
