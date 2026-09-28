import { Router } from 'express';
import multer from 'multer';
import * as ctrl from '../controllers/storageController.js';

const router = Router();

// In-memory multer storage for direct streaming into MongoDB GridFS
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 200 * 1024 * 1024, // 200 MB per file
    },
});

// File system directory & file operations (100% MongoDB Cloud-backed)
router.get('/files', ctrl.listFiles);
router.get('/file', ctrl.readFile);
router.post('/file', ctrl.writeFile);
router.delete('/file', ctrl.deleteFile);
router.post('/folder', ctrl.createFolder);

// Multipart upload for ANY file type (images, videos, audio, documents, archives, code)
router.post('/upload', upload.single('file'), ctrl.uploadFile);

// Streaming / viewing raw files: supports video/audio range streaming, image embeds
router.get('/raw/:fileId', ctrl.streamFile);
router.get('/stream', ctrl.streamFile);
router.get('/download/:fileId', ctrl.downloadFile);

// Cloud project sync
router.post('/sync', ctrl.syncCloudProject);

export default router;
