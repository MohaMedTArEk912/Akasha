import type { Request, Response, NextFunction } from 'express';
import { storageService } from '../services/storageService.js';

export async function listFiles(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = (req.query.projectId as string) || (req.headers['x-project-id'] as string);
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }
        const dirPath = (req.query.path as string) || '';
        const result = await storageService.listDirectory(projectId, dirPath);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

export async function readFile(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = (req.query.projectId as string) || (req.headers['x-project-id'] as string);
        const filePath = (req.query.path as string);
        if (!projectId || !filePath) {
            return res.status(400).json({ error: 'Project ID and file path are required' });
        }
        const content = await storageService.readFile(projectId, filePath);
        res.json({ path: filePath, content });
    } catch (err: any) {
        if (err.message?.includes('File not found')) {
            return res.status(404).json({ error: err.message });
        }
        next(err);
    }
}

export async function writeFile(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = req.body.projectId || (req.query.projectId as string) || (req.headers['x-project-id'] as string);
        const filePath = req.body.path || (req.query.path as string);
        const { content, mimeType } = req.body;
        if (!projectId || !filePath) {
            return res.status(400).json({ error: 'Project ID and file path are required' });
        }
        const saved = await storageService.saveFile(projectId, filePath, content ?? '', mimeType);
        res.json({ success: true, file: saved });
    } catch (err) {
        next(err);
    }
}

export async function uploadFile(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = req.body.projectId || (req.query.projectId as string) || (req.headers['x-project-id'] as string);
        const targetPath = req.body.path || (req.query.path as string);
        const { name } = req.body;
        const file = req.file;
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const saved = await storageService.uploadFile(projectId, targetPath || '', file, name);
        res.status(201).json({ success: true, file: saved });
    } catch (err) {
        next(err);
    }
}

export async function createFolder(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = req.body.projectId || (req.query.projectId as string) || (req.headers['x-project-id'] as string);
        const folderPath = req.body.path || (req.query.path as string);
        if (!projectId || !folderPath) {
            return res.status(400).json({ error: 'Project ID and folder path are required' });
        }
        const result = await storageService.createFolder(projectId, folderPath);
        res.status(201).json(result);
    } catch (err) {
        next(err);
    }
}

export async function deleteFile(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = req.body.projectId || (req.query.projectId as string) || (req.headers['x-project-id'] as string);
        const filePath = req.body.path || (req.query.path as string);
        if (!projectId || !filePath) {
            return res.status(400).json({ error: 'Project ID and file path are required' });
        }
        const result = await storageService.deleteFile(projectId, filePath);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

export async function streamFile(req: Request, res: Response, next: NextFunction) {
    try {
        const rawFileId = req.params.fileId || req.query.id || req.query.path;
        const fileId = Array.isArray(rawFileId) ? String(rawFileId[0]) : String(rawFileId || '');
        const projectId = Array.isArray(req.query.projectId) ? String(req.query.projectId[0]) : String(req.query.projectId || '');
        const range = Array.isArray(req.headers.range) ? req.headers.range[0] : req.headers.range;

        const { stream, filename, statusCode, headers } = await storageService.getFileStream(
            projectId,
            fileId,
            range
        );

        res.writeHead(statusCode, {
            ...headers,
            'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        });
        stream.pipe(res);
    } catch (err: any) {
        if (err.message?.includes('File not found')) {
            return res.status(404).json({ error: err.message });
        }
        next(err);
    }
}

export async function downloadFile(req: Request, res: Response, next: NextFunction) {
    try {
        const rawFileId = req.params.fileId || req.query.id || req.query.path;
        const fileId = Array.isArray(rawFileId) ? String(rawFileId[0]) : String(rawFileId || '');
        const projectId = Array.isArray(req.query.projectId) ? String(req.query.projectId[0]) : String(req.query.projectId || '');

        const { stream, filename, statusCode, headers } = await storageService.getFileStream(
            projectId,
            fileId
        );

        res.writeHead(statusCode, {
            ...headers,
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        });
        stream.pipe(res);
    } catch (err: any) {
        if (err.message?.includes('File not found')) {
            return res.status(404).json({ error: err.message });
        }
        next(err);
    }
}

export async function syncCloudProject(req: Request, res: Response, next: NextFunction) {
    try {
        const projectId = req.body.projectId || (req.query.projectId as string) || (req.headers['x-project-id'] as string);
        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }
        const result = await storageService.syncProjectToCloud(projectId);
        res.json(result);
    } catch (err) {
        next(err);
    }
}
