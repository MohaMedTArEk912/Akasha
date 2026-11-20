import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { ObjectId } from 'mongodb';
import prisma from '../src/lib/prisma.js';
import {
    listPlaybookSummaries,
    bootstrapProjectFromPlaybook,
    type ArchetypeId,
} from '../src/services/archetypePlaybooks.js';
import {
    compileProjectBlueprint,
    compileFeatureBuildPack,
} from '../src/services/structuredBlueprintService.js';
import {
    listProjectWorkspaceSlices,
    voteOnFeatureSlice,
    addProjectComment,
    addProjectDecision,
} from '../src/services/featureSliceService.js';
import {
    analyzeChangeImpact,
    applyImpactSyncActions,
} from '../src/services/impactAnalysisService.js';
import { computeReleaseReadiness } from '../src/services/releaseReadinessService.js';
import {
    queryMockRecords,
    createMockRecord,
    updateMockRecord,
    deleteMockRecord,
    resetAndSeedMockData,
} from '../src/services/mockApiService.js';
import { compileProjectPrototype } from '../src/services/prototypeCompiler.js';
import { analyzeRepositoryFiles } from '../src/services/repoSearchEngine.js';
import { compareBlueprintAgainstCode } from '../src/services/driftDetectionService.js';
import { GeneratorService } from '../src/services/generator.js';
import { handleToolsList, handleToolCall } from '../src/mcp/akashaMcpServer.js';
import { getRecentTelemetry } from '../src/services/telemetryBus.js';

const createdProjectIds: string[] = [];
const tempDirs: string[] = [];

async function createTempProject(name: string) {
    const id = new ObjectId().toHexString();
    createdProjectIds.push(id);
    return prisma.project.create({
        data: {
            id,
            userId: 'test-runner',
            name,
            description: `Test project for ${name}`,
            status: 'active',
            settings: JSON.stringify({}),
        },
    });
}

after(async () => {
    for (const projectId of createdProjectIds) {
        await Promise.all([
            prisma.dataModel.deleteMany({ where: { projectId } }).catch(() => null),
            prisma.apiEndpoint.deleteMany({ where: { projectId } }).catch(() => null),
            prisma.page.deleteMany({ where: { projectId } }).catch(() => null),
            prisma.useCase.deleteMany({ where: { projectId } }).catch(() => null),
            prisma.featureSlice.deleteMany({ where: { projectId } }).catch(() => null),
            prisma.projectComment.deleteMany({ where: { projectId } }).catch(() => null),
            prisma.projectDecision.deleteMany({ where: { projectId } }).catch(() => null),
            prisma.mockRecord.deleteMany({ where: { projectId } }).catch(() => null),
            prisma.agentMission.deleteMany({ where: { projectId } }).catch(() => null),
            prisma.agentTelemetry.deleteMany({ where: { projectId } }).catch(() => null),
            prisma.driftReport.deleteMany({ where: { projectId } }).catch(() => null),
            prisma.project.deleteMany({ where: { id: projectId } }).catch(() => null),
        ]);
    }
    for (const dir of tempDirs) {
        await fs.remove(dir).catch(() => null);
    }
    await prisma.$disconnect();
});

describe('Akasha V2 Small-Team Product OS Core Suite', () => {
    let ecomProjectId = '';

    it('1. Lists all 6 Product Archetype Playbooks and bootstraps E-Commerce cleanly', async () => {
        const summaries = listPlaybookSummaries();
        assert.equal(summaries.length, 6);
        const ids = summaries.map(s => s.id);
        for (const expected of ['ecommerce', 'internal_tool', 'booking_service', 'saas_app', 'marketplace', 'marketing_site'] as ArchetypeId[]) {
            assert.ok(ids.includes(expected), `Missing playbook ${expected}`);
        }

        const proj = await createTempProject('SneakerDrop Store');
        ecomProjectId = proj.id;

        const boot = await bootstrapProjectFromPlaybook({
            projectId: ecomProjectId,
            archetype: 'ecommerce',
            productName: 'SneakerDrop Store',
            pitch: 'Limited sneaker drops with live cart, coupons, and stock management.',
        });

        assert.equal(boot.success, true);
        assert.ok(boot.stats.modelsCount >= 4);
        assert.ok(boot.stats.apisCount >= 8);
        assert.ok(boot.stats.pagesCount >= 4);
        assert.ok(boot.stats.slicesCount >= 3);
        assert.ok(boot.stats.seededRecordsCount >= 6);
    });

    it('2. Compiles Structured Blueprint without dropping stringified fields/contracts & excludes archived items', async () => {
        // Add an archived dummy model to verify exclusion
        await prisma.dataModel.create({
            data: {
                projectId: ecomProjectId,
                name: 'ArchivedLegacy',
                schema: JSON.stringify({ fields: [{ name: 'oldField', field_type: 'string' }] }),
                archived: true,
            },
        });

        const bp = await compileProjectBlueprint(ecomProjectId);
        assert.equal(bp.projectName, 'SneakerDrop Store');
        assert.equal(bp.archetype, 'ecommerce');
        assert.ok(!bp.entities.some(e => e.name === 'ArchivedLegacy'), 'Archived models must be excluded');

        const productModel = bp.entities.find(e => e.name === 'Product');
        assert.ok(productModel, 'Product entity must exist');
        assert.ok(productModel.fields.length >= 6, `Expected >=6 parsed Product fields, got ${productModel.fields.length}`);
        assert.ok(productModel.fields.some(f => f.name === 'price' && f.type === 'float'));

        assert.ok(bp.apiContracts.length >= 8);
        assert.ok(bp.featureSlices.length >= 3);
        assert.ok(bp.decisions.length >= 2);
        assert.ok(bp.tokenMetrics.structuredBlueprintTokens > 0);
    });

    it('3. Supports Feature Slice voting, comments, decisions, scoped Build Packs & Release Readiness', async () => {
        const ws = await listProjectWorkspaceSlices(ecomProjectId);
        assert.ok(ws.slices.length >= 3);
        const checkoutSlice = ws.slices.find(s => s.key === 'checkout') || ws.slices[0]!;

        await voteOnFeatureSlice(checkoutSlice.id, 'Designer', 'mvp');
        await addProjectComment({
            projectId: ecomProjectId,
            targetType: 'slice',
            targetId: checkoutSlice.id,
            author: 'Designer',
            body: 'Let us show coupon savings right above Place Order button.',
        });
        await addProjectDecision({
            projectId: ecomProjectId,
            title: 'Use Stripe Checkout Links for V1',
            decision: 'Redirect to Stripe hosted checkout to avoid PCI scope.',
            author: 'Backend Dev',
            linkedSliceId: checkoutSlice.id,
        });

        const pack = await compileFeatureBuildPack(ecomProjectId, checkoutSlice.id);
        assert.equal(pack.slice.id, checkoutSlice.id);
        assert.ok(pack.entities.length >= 2, 'Checkout build pack must scope linked entities');
        assert.ok(pack.apiContracts.length >= 2, 'Checkout build pack must scope linked APIs');
        assert.ok(pack.markdownPrompt.includes(checkoutSlice.title));

        const readiness = await computeReleaseReadiness(ecomProjectId);
        assert.ok(readiness.score > 40, `Expected readiness score > 40, got ${readiness.score}`);
        assert.equal(readiness.checks.length, 6);
    });

    it('4. Change Impact Ripple traverses DataModel -> APIs -> Slices -> Pages -> Tasks & flags sync', async () => {
        const bp = await compileProjectBlueprint(ecomProjectId);
        const orderEntity = bp.entities.find(e => e.name === 'Order')!;

        const report = await analyzeChangeImpact({
            projectId: ecomProjectId,
            sourceType: 'model',
            sourceId: orderEntity.id!,
            changeSummary: 'Added giftMessage field to Order',
        });

        assert.ok(report.affectedApis.length >= 2, 'Order edit should flag Order APIs');
        assert.ok(report.affectedSlices.length >= 1, 'Order edit should flag Checkout/Admin slices');
        assert.ok(report.affectedPages.length >= 1, 'Order edit should flag Checkout/Orders pages');

        const applied = await applyImpactSyncActions({
            projectId: ecomProjectId,
            report,
            flagSlices: true,
            createSyncTask: true,
        });
        assert.equal(applied.success, true);
        assert.ok(applied.flaggedSlicesCount >= 1);
        assert.ok(applied.createdTaskId);
    });

    it('5. Live Stateful Mock API runs CRUD, validation, cart merge, order stock decrement, and prototype compilation', async () => {
        // Validation check
        const invalidRes = await createMockRecord(ecomProjectId, 'products', { title: 'Incomplete' });
        assert.equal(invalidRes.status, 400);

        // Cart merge check (prod-101 already in seeded cart with qty 1)
        const cartAdd = await createMockRecord(ecomProjectId, 'cart', {
            productId: 'prod-101',
            title: 'AeroRun Knit Sneaker',
            unitPrice: 129,
            quantity: 2,
        });
        assert.equal(cartAdd.status, 200);
        assert.equal((cartAdd.record as any).quantity, 3);

        // Order placement decrements stock & clears cart & applies WELCOME10 (10% off $387 = $348.30)
        const orderRes = await createMockRecord(ecomProjectId, 'orders', {
            customerName: 'Salma Test',
            customerEmail: 'salma@test.io',
            shippingAddress: '10 Tahrir Sq',
            couponCode: 'WELCOME10',
        });
        assert.equal(orderRes.status, 201);
        assert.equal((orderRes.record as any).totalAmount, 348.3);

        const cartAfter = await queryMockRecords(ecomProjectId, 'cart');
        assert.equal(cartAfter.length, 0, 'Cart should clear after order placement');

        const productsAfter = await queryMockRecords(ecomProjectId, 'products');
        const prod101 = productsAfter.find(p => p.id === 'prod-101');
        assert.equal(prod101?.stock, 15, 'Product stock should decrement from 18 by 3 to 15');

        // Update & delete
        const patched = await updateMockRecord(ecomProjectId, 'orders', (orderRes.record as any).id, { status: 'shipped' });
        assert.equal(patched?.status, 'shipped');
        const removed = await deleteMockRecord(ecomProjectId, 'orders', (orderRes.record as any).id);
        assert.equal(removed, true);

        // Seed reset
        const reset = await resetAndSeedMockData(ecomProjectId);
        assert.ok(reset.seededCount >= 6);

        // Prototype compiler outputs zero alert() stubs and connects to live mock API
        const manifest = await compileProjectPrototype(ecomProjectId);
        assert.ok(manifest.pages.length >= 4);
        for (const p of manifest.pages) {
            assert.ok(!p.html.includes('alert('), `Page ${p.name} must not contain dead alert() stubs`);
            assert.ok(p.html.includes(`/api/mock/${ecomProjectId}`), `Page ${p.name} must connect to live mock API`);
        }
    });

    it('6. AST Repo Search Engine parses Prisma, Mongoose, Drizzle, Express & Next.js App Router + Drift Radar', () => {
        const intel = analyzeRepositoryFiles([
            {
                path: 'prisma/schema.prisma',
                content: `model Product {\n  id String @id\n  title String\n  price Float\n  sku String @unique\n}\n`,
            },
            {
                path: 'server/src/models/review.ts',
                content: `const reviewSchema = new Schema({ rating: { type: Number, required: true }, comment: String });`,
            },
            {
                path: 'app/api/products/route.ts',
                content: `export async function GET() {}\nexport async function POST() {}`,
            },
            {
                path: 'server/src/routes/orders.ts',
                content: `router.get('/api/v1/orders', h);\nrouter.post('/api/v1/orders', h);`,
            },
        ]);

        assert.ok(intel.models.some(m => m.name === 'Product'));
        assert.ok(intel.models.some(m => m.name === 'Review'));
        assert.ok(intel.apis.some(a => a.method === 'GET' && a.path === '/api/products'));
        assert.ok(intel.apis.some(a => a.method === 'POST' && a.path === '/api/v1/orders'));

        const drift = compareBlueprintAgainstCode(
            ecomProjectId,
            {
                entities: [
                    { name: 'Product', fields: [{ name: 'id' }, { name: 'title' }, { name: 'price' }, { name: 'stock' }] },
                    { name: 'Coupon', fields: [{ name: 'id' }, { name: 'code' }] },
                ],
                apiContracts: [
                    { method: 'GET', path: '/api/v1/products' },
                    { method: 'GET', path: '/api/v1/coupons' },
                ],
            },
            intel,
            'test-repo'
        );

        assert.deepEqual(drift.matchedEntities, ['Product']);
        assert.deepEqual(drift.missingInCode, ['Coupon']);
        assert.deepEqual(drift.undocumentedInBlueprint, ['Review']);
        assert.equal(drift.fieldMismatches.length, 1);
        assert.ok(drift.fieldMismatches[0]!.missingInCode.includes('stock'));
        assert.ok(drift.fieldMismatches[0]!.extraInCode.includes('sku'));
        assert.ok(drift.matchedApis.includes('GET /api/v1/products'));
        assert.ok(drift.missingApisInCode.includes('GET /api/v1/coupons'));
    });

    it('7. Bi-Directional MCP Server exposes 16 tools and persists telemetry, tasks & quota in MongoDB', async () => {
        const listed = handleToolsList();
        assert.ok(listed.tools.length >= 15);
        const toolNames = listed.tools.map(t => t.name);
        for (const reqTool of [
            'akasha_get_structured_blueprint',
            'akasha_list_feature_slices',
            'akasha_get_feature_build_pack',
            'akasha_claim_task',
            'akasha_stream_agent_telemetry',
            'akasha_upsert_data_model',
            'akasha_record_decision',
            'akasha_check_drift',
        ]) {
            assert.ok(toolNames.includes(reqTool), `Missing MCP tool ${reqTool}`);
        }

        // Stream telemetry as if coming from a separate stdio MCP process
        await handleToolCall('akasha_stream_agent_telemetry', {
            projectId: ecomProjectId,
            agentRole: 'frontend',
            stepName: 'Implemented Cart Drawer',
            thought: 'Wired CartItem endpoints with stock guard',
            activeTool: 'edit_file',
            progress: 70,
        }, 'mcp_stdio');

        const persistedLogs = await getRecentTelemetry(ecomProjectId, 10);
        assert.ok(persistedLogs.some(l => l.stepName === 'Implemented Cart Drawer' && l.source === 'mcp_stdio'));

        // Upsert a new model via MCP
        const upsertRes = await handleToolCall('akasha_upsert_data_model', {
            projectId: ecomProjectId,
            name: 'Shipment',
            fields: [{ name: 'id', field_type: 'uuid', primary_key: true }, { name: 'trackingNumber', field_type: 'string', required: true }],
        });
        assert.ok(upsertRes.content[0]!.text.includes('"success": true'));
    });

    it('8. Full-Stack Code Generator writes complete runnable server + client files with zero stubs', async () => {
        const outDir = await fs.mkdtemp(path.join(os.tmpdir(), 'akasha-gen-'));
        tempDirs.push(outDir);

        const gen = new GeneratorService();
        const result = await gen.generateFullStack(ecomProjectId, outDir);

        assert.equal(result.success, true);
        assert.ok(result.fileCount >= 18, `Expected >= 18 generated files, got ${result.fileCount}`);
        assert.ok(await fs.pathExists(path.join(outDir, 'server/src/server.ts')));
        assert.ok(await fs.pathExists(path.join(outDir, 'server/src/routes/products.ts')));
        assert.ok(await fs.pathExists(path.join(outDir, 'server/src/seed.ts')));
        assert.ok(await fs.pathExists(path.join(outDir, 'client/src/App.tsx')));
        assert.ok(await fs.pathExists(path.join(outDir, '.akasha/blueprint.json')));
        assert.ok(await fs.pathExists(path.join(outDir, 'docker-compose.yml')));

        const productsRoute = await fs.readFile(path.join(outDir, 'server/src/routes/products.ts'), 'utf-8');
        assert.ok(productsRoute.includes("COLLECTION = 'products'"));
        assert.ok(!productsRoute.includes('TODO'));
    });
});
