import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import { connectDB } from './config/db';
import projectRoutes from './routes/project.routes';
import authRoutes from './routes/auth.routes';
import symbolRoutes from './routes/symbol.routes';
import formRoutes from './routes/form.routes';
import cmsRoutes from './routes/cms.routes';
import pageRoutes from './routes/page.routes';
import sharedRoutes from './routes/shared.routes';
import vfsRoutes from './routes/vfs.routes';
import productRoutes from './routes/product.routes';
import publishRoutes from './routes/publish.routes';
import { runDueSchedules } from './controllers/publish.controller';
import { protect } from './middleware/auth.middleware';

dotenv.config();

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cors());
app.use(helmet());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', protect, projectRoutes);
app.use('/api/symbols', protect, symbolRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/cms', protect, cmsRoutes);
app.use('/api/pages', protect, pageRoutes);
app.use('/api/shared', protect, sharedRoutes);
app.use('/api/vfs', vfsRoutes); // VFS routes (auth handled internally)
app.use('/api/products', protect, productRoutes);
app.use('/api/publish', protect, publishRoutes);

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Start Server
// ============================
// Realtime Collaboration (WS)
// ============================
const wss = new WebSocketServer({ server, path: '/ws' });

type Presence = {
    userId: string;
    username: string;
};

type RoomState = {
    users: Map<string, Presence>;
};

const rooms = new Map<string, RoomState>();

const getRoom = (projectId: string) => {
    if (!rooms.has(projectId)) {
        rooms.set(projectId, { users: new Map() });
    }
    return rooms.get(projectId)!;
};

const broadcast = (projectId: string, payload: unknown) => {
    const room = getRoom(projectId);
    const message = JSON.stringify(payload);
    wss.clients.forEach((client: any) => {
        if (client.readyState === 1 && client.projectId === projectId) {
            client.send(message);
        }
    });
};

wss.on('connection', (ws: any, req) => {
    try {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const token = url.searchParams.get('token');
        const projectId = url.searchParams.get('projectId');

        if (!token || !projectId) {
            ws.close(1008, 'Missing token or projectId');
            return;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123') as { id: string; username?: string; };
        const userId = decoded.id;
        const username = decoded.username || 'User';

        ws.projectId = projectId;
        ws.userId = userId;

        const room = getRoom(projectId);
        room.users.set(userId, { userId, username });

        broadcast(projectId, { type: 'presence', users: Array.from(room.users.values()) });

        ws.on('message', (data: Buffer) => {
            try {
                const message = JSON.parse(data.toString());
                if (message.type === 'cursor') {
                    broadcast(projectId, { type: 'cursor', userId, x: message.x, y: message.y });
                }
            } catch (err) {
                console.error('WS message error', err);
            }
        });

        ws.on('close', () => {
            const activeRoom = getRoom(projectId);
            activeRoom.users.delete(userId);
            broadcast(projectId, { type: 'presence', users: Array.from(activeRoom.users.values()) });
        });
    } catch (err) {
        ws.close(1011, 'Unauthorized');
    }
});

// Start Server
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Schedule runner (checks every minute)
setInterval(() => {
    runDueSchedules().catch((err) => console.error('Schedule runner error', err));
}, 60_000);
