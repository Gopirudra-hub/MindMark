import { Router } from 'express';
import { prisma, logger } from '../index.js';
import analyticsService from '../services/analyticsService.js';

const router = Router();

// Get global analytics
router.get('/', async (req, res, next) => {
    try {
        const analytics = await analyticsService.getGlobalAnalytics();
        res.json(analytics);
    } catch (error) {
        next(error);
    }
});

// Get performance trend
router.get('/trend', async (req, res, next) => {
    try {
        const { days = 30 } = req.query;
        const trend = await analyticsService.getPerformanceTrend(parseInt(days));
        res.json(trend);
    } catch (error) {
        next(error);
    }
});

// Get category analytics
router.get('/category/:id', async (req, res, next) => {
    try {
        const analytics = await analyticsService.getCategoryAnalytics(req.params.id);

        if (!analytics) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json(analytics);
    } catch (error) {
        next(error);
    }
});

// Get bookmark analytics
router.get('/bookmark/:id', async (req, res, next) => {
    try {
        const analytics = await analyticsService.getBookmarkAnalytics(req.params.id);

        if (!analytics) {
            return res.status(404).json({ error: 'Bookmark not found' });
        }

        res.json(analytics);
    } catch (error) {
        next(error);
    }
});

// Get all categories analytics summary
router.get('/categories', async (req, res, next) => {
    try {
        const categories = await prisma.category.findMany();

        const categoryAnalytics = await Promise.all(
            categories.map(async (category) => {
                const analytics = await analyticsService.getCategoryAnalytics(category.id);
                return analytics;
            })
        );

        // Sort by average score (ascending to show weakest first)
        categoryAnalytics.sort((a, b) => (a?.avgScore || 0) - (b?.avgScore || 0));

        res.json(categoryAnalytics.filter(Boolean));
    } catch (error) {
        next(error);
    }
});

// Get weakest bookmarks
router.get('/weakest', async (req, res, next) => {
    try {
        const { limit = 10 } = req.query;

        const bookmarks = await prisma.bookmark.findMany({
            include: {
                category: true,
                quizAttempts: {
                    orderBy: { attemptedAt: 'desc' },
                    take: 5
                }
            }
        });

        const scored = bookmarks.map(bookmark => {
            const attempts = bookmark.quizAttempts;
            const avgScore = attempts.length > 0
                ? attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length
                : null;

            return {
                id: bookmark.id,
                title: bookmark.title,
                category: bookmark.category?.name,
                avgScore: avgScore !== null ? Math.round(avgScore * 100) / 100 : null,
                attemptCount: attempts.length,
                lastAttempt: attempts[0]?.attemptedAt || null
            };
        });

        // Filter to only those with attempts and sort by score
        const weakest = scored
            .filter(b => b.avgScore !== null)
            .sort((a, b) => a.avgScore - b.avgScore)
            .slice(0, parseInt(limit));

        res.json(weakest);
    } catch (error) {
        next(error);
    }
});

// Get review statistics
router.get('/reviews', async (req, res, next) => {
    try {
        const now = new Date();
        const today = new Date(now);
        today.setHours(23, 59, 59, 999);

        const dueToday = await prisma.bookmark.count({
            where: {
                nextReviewAt: { lte: today }
            }
        });

        const overdue = await prisma.bookmark.count({
            where: {
                nextReviewAt: { lt: now }
            }
        });

        const neverReviewed = await prisma.bookmark.count({
            where: {
                lastReviewedAt: null
            }
        });

        const reviewedThisWeek = await prisma.bookmark.count({
            where: {
                lastReviewedAt: {
                    gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                }
            }
        });

        res.json({
            dueToday,
            overdue,
            neverReviewed,
            reviewedThisWeek
        });
    } catch (error) {
        next(error);
    }
});

export default router;
