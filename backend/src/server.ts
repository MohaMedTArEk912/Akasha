import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import projectRoutes from './routes/project.routes';
import authRoutes from './routes/auth.routes';
import symbolRoutes from './routes/symbol.routes';
import formRoutes from './routes/form.routes';
import cmsRoutes from './routes/cms.routes';
import pageRoutes from './routes/page.routes';
import sharedRoutes from './routes/shared.routes';
import { protect } from './middleware/auth.middleware';

dotenv.config();

// Connect to Database
connectDB();

const app = express();
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

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
