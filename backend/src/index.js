import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';

// Import routes
import bookmarkRoutes from './routes/bookmarks.js';
import categoryRoutes from './routes/categories.js';
import tagRoutes from './routes/tags.js';
import quizRoutes from './routes/quiz.js';
import analyticsRoutes from './routes/analytics.js';
import insightsRoutes from './routes/insights.js';
import aiRoutes from './routes/ai.js';

// Initialize logger
export const logger = pino({
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true
        }
    }
});

// Initialize Prisma
export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'chrome-extension://*'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting for AI endpoints
const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: { error: 'Too many AI requests, please try again later' }
});

// General rate limiter
const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later' }
});

app.use('/api/ai', aiLimiter);
app.use('/api', generalLimiter);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/ai', aiRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error(err);

    // Handle Zod validation errors
    if (err.name === 'ZodError') {
        return res.status(400).json({
            error: 'Validation error',
            details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
        });
    }

    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await prisma.$disconnect();
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});

export default app;
