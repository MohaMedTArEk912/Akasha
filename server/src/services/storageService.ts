import path from 'path';
import mime from 'mime-types';
import { ObjectId } from 'mongodb';
import { Readable } from 'stream';
import prisma, { getDb } from '../lib/prisma.js';
import {
    uploadBufferToGridFS,
    openDownloadStream,
    getGridFSFileInfo,
    deleteFromGridFS,
} from '../lib/gridfs.js';

export interface FileEntry {
    name: string;
    path: string;
    is_directory: boolean;
    size?: number;
    extension?: string;
    mimeType?: string;
    url?: string;
    updated_at?: string;
}

export function normalizeStoragePath(rawPath: string): string {
    if (!rawPath) return '';
    return rawPath
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
}

export function detectFileType(mimetype: string, filename: string): string {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';

    const ext = path.extname(filename).toLowerCase();
    const codeExts = [
        '.ts', '.tsx', '.js', '.jsx', '.json', '.html', '.css', '.scss',
        '.py', '.rs', '.go', '.cpp', '.c', '.h', '.sql', '.sh', '.yaml', '.yml'
    ];
    if (codeExts.includes(ext) || mimetype.includes('javascript') || mimetype.includes('typescript') || mimetype.includes('json')) {
        return 'code';
    }
    if (ext === '.pdf' || ext === '.doc' || ext === '.docx' || ext === '.txt' || ext === '.md') {
        return 'document';
    }
    if (['.zip', '.tar', '.gz', '.rar', '.7z'].includes(ext)) {
        return 'archive';
    }
    return 'other';
}

export class StorageService {
    /**
     * Save a file to MongoDB (GridFS for binary/large, with inline content for text/code)
     */
    async saveFile(
        projectId: string,
        filePath: string,
        contentOrBuffer: string | Buffer,
        customMime?: string
    ) {
        const normPath = normalizeStoragePath(filePath);
        if (!normPath) throw new Error('File path cannot be empty');

        const db = await getDb();
        const filesColl = db.collection('files');
        const filename = path.basename(normPath);
        const ext = path.extname(filename);

        const mimeType = customMime || (mime.lookup(filename) as string) || 'application/octet-stream';
        const fileType = detectFileType(mimeType, filename);

        const buffer = Buffer.isBuffer(contentOrBuffer)
            ? contentOrBuffer
            : Buffer.from(contentOrBuffer || '', 'utf-8');

        const size = buffer.length;
        const isTextLike = fileType === 'code' || fileType === 'document' || mimeType.startsWith('text/');
        const inlineContent = isTextLike && size < 2 * 1024 * 1024 ? buffer.toString('utf-8') : '';

        // Find existing file record to clean up previous GridFS chunks if replacing
        const existing = await filesColl.findOne({ projectId, path: normPath });
        let oldGridfsId = existing?.gridfsId;

        // Upload to MongoDB GridFS
        const gridfsId = await uploadBufferToGridFS({
            filename,
            buffer,
            mimeType,
            metadata: {
                projectId,
                path: normPath,
                fileType,
            }
        });

        // If replacing an existing GridFS file, delete old chunks
        if (oldGridfsId) {
            await deleteFromGridFS(oldGridfsId);
        }

        const now = new Date();
        const doc = {
            projectId,
            path: normPath,
            name: filename,
            extension: ext,
            fileType,
            mimeType,
            size,
            storageType: 'gridfs',
            gridfsId,
            content: inlineContent,
            updatedAt: now,
        };

        if (existing) {
            await filesColl.updateOne({ _id: existing._id }, { $set: doc });
        } else {
            (doc as any).createdAt = now;
            await filesColl.insertOne(doc);
        }

        // Ensure parent directories exist in folders collection
        await this.ensureParentFolders(projectId, normPath);

        return {
            id: existing ? String(existing._id) : (doc as any)._id?.toString(),
            path: normPath,
            name: filename,
            size,
            mimeType,
            fileType,
            updatedAt: now.toISOString(),
        };
    }

    /**
     * Upload ANY file directly to MongoDB GridFS via multer
     */
    async uploadFile(
        projectId: string,
        targetDir: string,
        file: Express.Multer.File,
        customName?: string
    ) {
        const cleanDir = normalizeStoragePath(targetDir);
        const filename = customName || file.originalname || 'file';
        const targetPath = cleanDir ? `${cleanDir}/${filename}` : filename;

        return this.saveFile(projectId, targetPath, file.buffer, file.mimetype);
    }

    /**
     * Read file content as string from MongoDB
     */
    async readFile(projectId: string, filePath: string): Promise<string> {
        const normPath = normalizeStoragePath(filePath);
        const db = await getDb();
        const filesColl = db.collection('files');

        const file = await filesColl.findOne({ projectId, path: normPath });
        if (!file) {
            throw new Error(`File not found: ${filePath}`);
        }

        // If inline content is cached, return it directly
        if (file.content !== undefined && file.content !== null) {
            return file.content;
        }

        // Otherwise read from GridFS stream
        if (file.gridfsId) {
            const stream = await openDownloadStream(file.gridfsId);
            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
                chunks.push(Buffer.from(chunk));
            }
            return Buffer.concat(chunks).toString('utf-8');
        }

        return '';
    }

    /**
     * Get a readable stream for ANY file from MongoDB GridFS
     * Supports Range headers for streaming video/audio and downloads
     */
    async getFileStream(projectId: string, fileIdOrPath: string, rangeHeader?: string) {
        const db = await getDb();
        const filesColl = db.collection('files');

        let file: any = null;
        if (ObjectId.isValid(fileIdOrPath)) {
            file = await filesColl.findOne({ _id: new ObjectId(fileIdOrPath) });
        }
        if (!file) {
            const normPath = normalizeStoragePath(fileIdOrPath);
            file = await filesColl.findOne({ projectId, path: normPath });
        }
        if (!file) {
            throw new Error(`File not found: ${fileIdOrPath}`);
        }

        const mimeType = file.mimeType || 'application/octet-stream';
        const filename = file.name || 'file';

        if (file.gridfsId) {
            const info = await getGridFSFileInfo(file.gridfsId);
            const totalSize = info?.length ?? file.size ?? 0;

            if (rangeHeader && totalSize > 0) {
                const parts = rangeHeader.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0] || '0', 10);
                const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

                if (start >= totalSize || end >= totalSize) {
                    throw Object.assign(new Error('Requested range not satisfiable'), { status: 416 });
                }

                const chunksize = end - start + 1;
                const stream = await openDownloadStream(file.gridfsId, { start, end: end + 1 });

                return {
                    stream,
                    mimeType,
                    filename,
                    statusCode: 206,
                    headers: {
                        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
                        'Accept-Ranges': 'bytes',
                        'Content-Length': chunksize,
                        'Content-Type': mimeType,
                    },
                };
            }

            const stream = await openDownloadStream(file.gridfsId);
            return {
                stream,
                mimeType,
                filename,
                statusCode: 200,
                headers: {
                    'Content-Length': totalSize,
                    'Content-Type': mimeType,
                    'Accept-Ranges': 'bytes',
                },
            };
        }

        const buffer = Buffer.from(file.content || '', 'utf-8');
        const stream = Readable.from(buffer);
        return {
            stream,
            mimeType,
            filename,
            statusCode: 200,
            headers: {
                'Content-Length': buffer.length,
                'Content-Type': mimeType,
            },
        };
    }

    /**
     * Delete a file or folder from MongoDB and clean up GridFS
     */
    async deleteFile(projectId: string, filePath: string) {
        const normPath = normalizeStoragePath(filePath);
        const db = await getDb();
        const filesColl = db.collection('files');
        const foldersColl = db.collection('folders');

        const file = await filesColl.findOne({ projectId, path: normPath });
        if (file) {
            if (file.gridfsId) {
                await deleteFromGridFS(file.gridfsId);
            }
            await filesColl.deleteOne({ _id: file._id });
        }

        // Also clean up any sub-files or folders if this was a directory
        const escaped = normPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const childFiles = await filesColl.find({ projectId, path: { $regex: `^${escaped}/` } }).toArray();
        for (const cf of childFiles) {
            if (cf.gridfsId) {
                await deleteFromGridFS(cf.gridfsId);
            }
        }
        if (childFiles.length > 0) {
            await filesColl.deleteMany({ projectId, path: { $regex: `^${escaped}/` } });
        }
        await foldersColl.deleteMany({
            projectId,
            $or: [{ path: normPath }, { path: { $regex: `^${escaped}/` } }]
        });

        return { success: true };
    }

    /**
     * Create a folder in MongoDB
     */
    async createFolder(projectId: string, folderPath: string) {
        const normPath = normalizeStoragePath(folderPath);
        if (!normPath) return { success: true };

        const db = await getDb();
        const foldersColl = db.collection('folders');

        const existing = await foldersColl.findOne({ projectId, path: normPath });
        if (!existing) {
            await foldersColl.insertOne({
                projectId,
                path: normPath,
                name: path.basename(normPath),
                createdAt: new Date(),
            });
        }
        await this.ensureParentFolders(projectId, normPath);
        return { success: true, path: normPath };
    }

    /**
     * List all direct child files and folders within dirPath
     */
    async listDirectory(projectId: string, dirPath: string = ''): Promise<{ path: string; entries: FileEntry[] }> {
        const cleanDir = normalizeStoragePath(dirPath);
        const db = await getDb();
        const filesColl = db.collection('files');
        const foldersColl = db.collection('folders');

        const escaped = cleanDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const prefix = cleanDir ? `^${escaped}/` : '^';
        const files = await filesColl.find({ projectId, path: { $regex: prefix } }).toArray();
        const folders = await foldersColl.find({ projectId, path: { $regex: prefix } }).toArray();

        const entriesMap = new Map<string, FileEntry>();

        // Process folders
        for (const f of folders) {
            const rel = cleanDir ? f.path.slice(cleanDir.length + 1) : f.path;
            if (!rel) continue;
            const segments = rel.split('/');
            const immediateName = segments[0]!;
            const immediatePath = cleanDir ? `${cleanDir}/${immediateName}` : immediateName;

            if (!entriesMap.has(immediateName)) {
                entriesMap.set(immediateName, {
                    name: immediateName,
                    path: immediatePath,
                    is_directory: true,
                });
            }
        }

        // Process files
        for (const file of files) {
            const rel = cleanDir ? file.path.slice(cleanDir.length + 1) : file.path;
            if (!rel) continue;
            const segments = rel.split('/');

            if (segments.length === 1) {
                // Direct file child
                const fileName = segments[0]!;
                entriesMap.set(fileName, {
                    name: fileName,
                    path: file.path,
                    is_directory: false,
                    size: file.size || 0,
                    extension: file.extension || path.extname(fileName),
                    mimeType: file.mimeType,
                    url: `/api/akasha/storage/raw/${file._id}`,
                    updated_at: file.updatedAt ? new Date(file.updatedAt).toISOString() : undefined,
                });
            } else {
                // Nested inside a subdirectory
                const subDirName = segments[0]!;
                const subDirPath = cleanDir ? `${cleanDir}/${subDirName}` : subDirName;
                if (!entriesMap.has(subDirName)) {
                    entriesMap.set(subDirName, {
                        name: subDirName,
                        path: subDirPath,
                        is_directory: true,
                    });
                }
            }
        }

        const entries = Array.from(entriesMap.values()).sort((a, b) => {
            if (a.is_directory !== b.is_directory) {
                return a.is_directory ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        return { path: cleanDir, entries };
    }

    /**
     * Helper to recursively ensure all ancestor folders exist
     */
    private async ensureParentFolders(projectId: string, filePath: string) {
        const parts = filePath.split('/');
        parts.pop(); // Remove the file/deepest folder name

        if (parts.length === 0) return;

        const db = await getDb();
        const foldersColl = db.collection('folders');

        let current = '';
        for (const part of parts) {
            current = current ? `${current}/${part}` : part;
            const found = await foldersColl.findOne({ projectId, path: current });
            if (!found) {
                await foldersColl.insertOne({
                    projectId,
                    path: current,
                    name: part,
                    createdAt: new Date(),
                });
            }
        }
    }

    /**
     * Cloud Sync: Synthesize and store all pages and components for a project in MongoDB
     */
    async syncProjectToCloud(projectId: string) {
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) throw new Error('Project not found');

        const pages = await prisma.page.findMany({ where: { projectId } });

        // Save boilerplate package.json in MongoDB
        const packageJson = {
            name: (project.name || 'project').toLowerCase().replace(/\s+/g, '-'),
            private: true,
            version: '0.1.0',
            type: 'module',
            dependencies: {
                react: '^18.2.0',
                'react-dom': '^18.2.0',
                'react-router-dom': '^6.21.0',
            },
        };
        await this.saveFile(projectId, 'package.json', JSON.stringify(packageJson, null, 2), 'application/json');

        // Sync each page
        for (const page of pages) {
            const pageName = page.name.replace(/[^a-zA-Z0-9]/g, '');
            const pageCode = `import React from 'react';

export default function ${pageName}() {
  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-3xl font-bold mb-4">${page.name}</h1>
      <p className="text-gray-600">Page path: ${page.path || '/'}</p>
    </div>
  );
}
`;
            await this.saveFile(projectId, `src/pages/${pageName}.tsx`, pageCode, 'text/typescript');
        }

        // Sync App.tsx
        const pageImports = pages.map((p) => {
            const pageName = p.name.replace(/[^a-zA-Z0-9]/g, '');
            return `import ${pageName} from './pages/${pageName}';`;
        }).join('\n');

        const routes = pages.map((p) => {
            const pageName = p.name.replace(/[^a-zA-Z0-9]/g, '');
            const pathStr = p.path || (p.name === 'Home' ? '/' : `/${p.name.toLowerCase()}`);
            return `<Route path="${pathStr}" element={<${pageName} />} />`;
        }).join('\n          ');

        const appTsx = `import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
${pageImports}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <Routes>
          ${routes}
        </Routes>
      </div>
    </BrowserRouter>
  );
}
`;
        await this.saveFile(projectId, 'src/App.tsx', appTsx, 'text/typescript');

        return {
            success: true,
            message: 'All project files successfully synchronized to MongoDB Cloud Storage',
            pageCount: pages.length,
        };
    }
}

export const storageService = new StorageService();
