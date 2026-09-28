import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';
import { getDb } from './prisma.js';

const buckets = new Map<string, GridFSBucket>();

export async function getGridFSBucket(bucketName: string = 'cloud_files'): Promise<GridFSBucket> {
    const db = await getDb();
    let bucket = buckets.get(bucketName);
    if (!bucket) {
        bucket = new GridFSBucket(db, { bucketName });
        buckets.set(bucketName, bucket);
    }
    return bucket;
}

export interface GridFSUploadOptions {
    filename: string;
    buffer: Buffer;
    mimeType?: string;
    metadata?: Record<string, any>;
    bucketName?: string;
}

export async function uploadBufferToGridFS(options: GridFSUploadOptions): Promise<ObjectId> {
    const { filename, buffer, mimeType = 'application/octet-stream', metadata = {}, bucketName = 'cloud_files' } = options;
    const bucket = await getGridFSBucket(bucketName);

    return new Promise((resolve, reject) => {
        const uploadStream = bucket.openUploadStream(filename, {
            contentType: mimeType,
            metadata: {
                ...metadata,
                contentType: mimeType,
                uploadedAt: new Date(),
                size: buffer.length
            }
        } as any);

        const readable = Readable.from(buffer);
        readable.pipe(uploadStream)
            .on('error', (err) => reject(err))
            .on('finish', () => resolve(uploadStream.id));
    });
}

export async function openDownloadStream(
    gridfsId: ObjectId | string,
    options?: { start?: number; end?: number },
    bucketName: string = 'cloud_files'
) {
    const bucket = await getGridFSBucket(bucketName);
    const id = typeof gridfsId === 'string' ? new ObjectId(gridfsId) : gridfsId;
    return bucket.openDownloadStream(id, options);
}

export async function getGridFSFileInfo(
    gridfsId: ObjectId | string,
    bucketName: string = 'cloud_files'
) {
    const bucket = await getGridFSBucket(bucketName);
    const id = typeof gridfsId === 'string' ? new ObjectId(gridfsId) : gridfsId;
    const cursor = bucket.find({ _id: id });
    const files = await cursor.toArray();
    return files[0] || null;
}

export async function deleteFromGridFS(
    gridfsId: ObjectId | string,
    bucketName: string = 'cloud_files'
): Promise<void> {
    try {
        const bucket = await getGridFSBucket(bucketName);
        const id = typeof gridfsId === 'string' ? new ObjectId(gridfsId) : gridfsId;
        await bucket.delete(id);
    } catch (err: any) {
        if (!err.message?.includes('FileNotFound')) {
            console.warn('[GridFS] Delete warning:', err.message);
        }
    }
}
