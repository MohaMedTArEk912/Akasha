import { Request, Response } from 'express';
import crypto from 'crypto';
import PublishSchedule from '../models/PublishSchedule';

const buildStaticHtml = (html: string, css: string) => {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>${css || ''}</style>
  </head>
  <body>${html || ''}</body>
</html>`;
};

/**
 * @desc    Deploy a static build to Vercel
 * @route   POST /api/publish/vercel
 * @access  Private
 */
const deployVercelInternal = async (name: string, html: string, css: string) => {
    const token = process.env.VERCEL_TOKEN;
    if (!token) {
        throw new Error('VERCEL_TOKEN is not configured');
    }

    const indexHtml = buildStaticHtml(html || '', css || '');

    const response = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name,
            files: [
                {
                    file: 'index.html',
                    data: indexHtml,
                },
            ],
            projectSettings: {
                framework: null,
            },
        }),
    });

    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload?.error?.message || 'Failed to deploy to Vercel');
    }

    return { url: payload?.url, id: payload?.id };
};

const deployNetlifyInternal = async (name: string, html: string, css: string) => {
    const token = process.env.NETLIFY_TOKEN;
    if (!token) {
        throw new Error('NETLIFY_TOKEN is not configured');
    }

    const indexHtml = buildStaticHtml(html || '', css || '');
    const siteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
    });

    const sitePayload = await siteResponse.json();
    if (!siteResponse.ok) {
        throw new Error(sitePayload?.message || 'Failed to create Netlify site');
    }

    const siteId = sitePayload?.id;
    const sha = crypto.createHash('sha1').update(indexHtml).digest('hex');

    const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            files: {
                'index.html': sha,
            },
        }),
    });

    const deployPayload = await deployResponse.json();
    if (!deployResponse.ok) {
        throw new Error(deployPayload?.message || 'Failed to create Netlify deploy');
    }

    const uploadUrl = deployPayload?.upload_url || deployPayload?.uploadUrl;
    if (uploadUrl) {
        const uploadResponse = await fetch(`${uploadUrl}/index.html`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'text/html',
            },
            body: indexHtml,
        });
        if (!uploadResponse.ok) {
            throw new Error('Failed to upload Netlify files');
        }
    }

    return {
        url: deployPayload?.deploy_ssl_url || deployPayload?.deploy_url,
        id: deployPayload?.id,
        siteUrl: sitePayload?.ssl_url || sitePayload?.url,
    };
};

export const deployVercel = async (req: Request, res: Response) => {
    try {
        const { name, html, css } = req.body as { name?: string; html?: string; css?: string };
        if (!name) {
            return res.status(400).json({ message: 'Deployment name is required' });
        }
        const deployment = await deployVercelInternal(name, html || '', css || '');
        res.json(deployment);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to deploy to Vercel' });
    }
};

/**
 * @desc    Deploy a static build to Netlify
 * @route   POST /api/publish/netlify
 * @access  Private
 */
export const deployNetlify = async (req: Request, res: Response) => {
    try {
        const { name, html, css } = req.body as { name?: string; html?: string; css?: string };
        if (!name) {
            return res.status(400).json({ message: 'Deployment name is required' });
        }

        const deployment = await deployNetlifyInternal(name, html || '', css || '');
        res.json(deployment);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to deploy to Netlify' });
    }
};

/**
 * @desc    Create scheduled Vercel deploy
 * @route   POST /api/publish/vercel/schedule
 * @access  Private
 */
export const scheduleVercel = async (req: Request, res: Response) => {
    try {
        const { projectId, name, html, css, scheduledAt } = req.body as {
            projectId?: string;
            name?: string;
            html?: string;
            css?: string;
            scheduledAt?: string;
        };

        if (!projectId || !name || !scheduledAt) {
            return res.status(400).json({ message: 'projectId, name, and scheduledAt are required' });
        }

        const schedule = await PublishSchedule.create({
            projectId,
            provider: 'vercel',
            name,
            html: html || '',
            css: css || '',
            scheduledAt: new Date(scheduledAt),
        });

        res.status(201).json(schedule);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to schedule deployment' });
    }
};

/**
 * @desc    List schedules for project
 * @route   GET /api/publish/schedules/:projectId
 * @access  Private
 */
export const getSchedules = async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const schedules = await PublishSchedule.find({ projectId }).sort({ scheduledAt: -1 });
        res.json(schedules);
    } catch (error: any) {
        res.status(500).json({ message: error.message || 'Failed to fetch schedules' });
    }
};

export const runDueSchedules = async () => {
    const now = new Date();
    const schedules = await PublishSchedule.find({
        status: 'scheduled',
        scheduledAt: { $lte: now }
    }).limit(5);

    for (const schedule of schedules) {
        schedule.status = 'running';
        schedule.lastRunAt = new Date();
        await schedule.save();

        try {
            if (schedule.provider === 'vercel') {
                const deployment = await deployVercelInternal(schedule.name, schedule.html, schedule.css);
                schedule.status = 'completed';
                schedule.resultUrl = deployment.url ? `https://${deployment.url}` : undefined;
            } else if (schedule.provider === 'netlify') {
                const deployment = await deployNetlifyInternal(schedule.name, schedule.html, schedule.css);
                schedule.status = 'completed';
                schedule.resultUrl = deployment.url || deployment.siteUrl;
            }
        } catch (err: any) {
            schedule.status = 'failed';
            schedule.errorMessage = err.message || 'Deployment failed';
        }

        await schedule.save();
    }
};