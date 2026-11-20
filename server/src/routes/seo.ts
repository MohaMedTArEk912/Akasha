/**
 * SEO & Discovery Routes — Dynamic `/sitemap.xml` and `/robots.txt`
 *
 * Serves a standards-compliant XML sitemap that automatically includes
 * the Akasha Studio entry route plus any publicly enabled shareable prototypes
 * (with real last-modified timestamps from MongoDB).
 */

import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';

const router = Router();

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function resolveBaseUrl(req: { protocol: string; get(name: string): string | undefined }): string {
    const configured = process.env.PUBLIC_BASE_URL || process.env.APP_URL || process.env.CLIENT_URL;
    if (configured && configured.trim()) {
        return configured.trim().replace(/\/+$/, '');
    }
    const forwardedProto = req.get('x-forwarded-proto');
    const forwardedHost = req.get('x-forwarded-host');
    const proto = forwardedProto ? forwardedProto.split(',')[0]?.trim() : req.protocol || 'http';
    const host = forwardedHost || req.get('host') || 'localhost:5173';
    return `${proto}://${host}`;
}

router.get('/robots.txt', (req, res) => {
    const baseUrl = resolveBaseUrl(req);
    const content = [
        'User-agent: *',
        'Allow: /',
        'Allow: /preview/',
        'Disallow: /api/',
        '',
        `Sitemap: ${baseUrl}/sitemap.xml`,
        '',
    ].join('\n');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(content);
});

router.get('/sitemap.xml', async (req, res) => {
    try {
        const baseUrl = resolveBaseUrl(req);
        const today = new Date().toISOString().split('T')[0]!;

        const urls: Array<{ loc: string; lastmod: string; changefreq: string; priority: string }> = [
            {
                loc: `${baseUrl}/`,
                lastmod: today,
                changefreq: 'weekly',
                priority: '1.0',
            },
        ];

        // Include publicly shareable prototype preview pages (only when explicitly enabled and not token-restricted)
        const projects = await prisma.project.findMany({ orderBy: { updated_at: 'desc' } }).catch(() => []);
        for (const project of projects as any[]) {
            const settings = safeJsonParse<Record<string, any>>(project.settings, {});
            const isPublicPreview = settings.shareEnabled === true && !settings.shareToken;
            if (!isPublicPreview) continue;

            const updatedIso = project.updated_at
                ? new Date(project.updated_at).toISOString().split('T')[0] || today
                : today;

            urls.push({
                loc: `${baseUrl}/preview/${encodeURIComponent(project.id)}`,
                lastmod: updatedIso,
                changefreq: 'daily',
                priority: '0.8',
            });
        }

        const xml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            ...urls.map(
                (u) =>
                    `  <url>\n` +
                    `    <loc>${escapeXml(u.loc)}</loc>\n` +
                    `    <lastmod>${escapeXml(u.lastmod)}</lastmod>\n` +
                    `    <changefreq>${u.changefreq}</changefreq>\n` +
                    `    <priority>${u.priority}</priority>\n` +
                    `  </url>`
            ),
            '</urlset>',
            '',
        ].join('\n');

        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(xml);
    } catch (error: any) {
        console.error('[SEO] Sitemap generation failed:', error);
        res.status(500).setHeader('Content-Type', 'text/plain; charset=utf-8').send('Failed to generate sitemap');
    }
});

export default router;
