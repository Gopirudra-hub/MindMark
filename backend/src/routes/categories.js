import { Router } from 'express';
import { z } from 'zod';
import { prisma, logger } from '../index.js';

const router = Router();

// Validation schemas
const createCategorySchema = z.object({
    name: z.string().min(1).max(100)
});

const updateCategorySchema = z.object({
    name: z.string().min(1).max(100).optional()
});

// Get all categories with stats
router.get('/', async (req, res, next) => {
    try {
        const categories = await prisma.category.findMany({
            include: {
                _count: {
                    select: { bookmarks: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        // Add performance stats
        const categoriesWithStats = await Promise.all(
            categories.map(async (category) => {
                const attempts = await prisma.quizAttempt.findMany({
                    where: {
                        bookmark: { categoryId: category.id }
                    }
                });

                const avgScore = attempts.length > 0
                    ? attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length
                    : null;

                return {
                    ...category,
                    avgScore: avgScore ? Math.round(avgScore * 100) / 100 : null,
                    totalAttempts: attempts.length
                };
            })
        );

        res.json(categoriesWithStats);
    } catch (error) {
        next(error);
    }
});

// Get single category with bookmarks
router.get('/:id', async (req, res, next) => {
    try {
        const category = await prisma.category.findUnique({
            where: { id: req.params.id },
            include: {
                bookmarks: {
                    include: {
                        tags: {
                            include: { tag: true }
                        },
                        quizAttempts: {
                            orderBy: { attemptedAt: 'desc' },
                            take: 1
                        },
                        _count: {
                            select: { questions: true, quizAttempts: true }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json(category);
    } catch (error) {
        next(error);
    }
});

// Create category
router.post('/', async (req, res, next) => {
    try {
        const data = createCategorySchema.parse(req.body);

        const existing = await prisma.category.findUnique({
            where: { name: data.name }
        });

        if (existing) {
            return res.status(409).json({ error: 'Category already exists' });
        }

        const category = await prisma.category.create({
            data: { name: data.name }
        });

        logger.info(`Created category: ${category.id}`);
        res.status(201).json(category);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        next(error);
    }
});

// Update category (rename)
router.put('/:id', async (req, res, next) => {
    try {
        const data = updateCategorySchema.parse(req.body);

        if (data.name) {
            const existing = await prisma.category.findFirst({
                where: {
                    name: data.name,
                    NOT: { id: req.params.id }
                }
            });

            if (existing) {
                return res.status(409).json({ error: 'Category name already exists' });
            }
        }

        const category = await prisma.category.update({
            where: { id: req.params.id },
            data
        });

        logger.info(`Updated category: ${category.id}`);
        res.json(category);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Category not found' });
        }
        next(error);
    }
});

// Delete category
router.delete('/:id', async (req, res, next) => {
    try {
        // Check if category has bookmarks
        const category = await prisma.category.findUnique({
            where: { id: req.params.id },
            include: {
                _count: { select: { bookmarks: true } }
            }
        });

        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        if (category._count.bookmarks > 0) {
            // Option: Set bookmarks' categoryId to null
            await prisma.bookmark.updateMany({
                where: { categoryId: req.params.id },
                data: { categoryId: null }
            });
        }

        await prisma.category.delete({
            where: { id: req.params.id }
        });

        logger.info(`Deleted category: ${req.params.id}`);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// Merge categories
router.post('/merge', async (req, res, next) => {
    try {
        const { sourceId, targetId } = req.body;

        if (!sourceId || !targetId) {
            return res.status(400).json({ error: 'sourceId and targetId are required' });
        }

        if (sourceId === targetId) {
            return res.status(400).json({ error: 'Cannot merge category into itself' });
        }

        // Move all bookmarks from source to target
        await prisma.bookmark.updateMany({
            where: { categoryId: sourceId },
            data: { categoryId: targetId }
        });

        // Delete source category
        await prisma.category.delete({
            where: { id: sourceId }
        });

        const targetCategory = await prisma.category.findUnique({
            where: { id: targetId },
            include: {
                _count: { select: { bookmarks: true } }
            }
        });

        logger.info(`Merged category ${sourceId} into ${targetId}`);
        res.json({ message: 'Categories merged', category: targetCategory });
    } catch (error) {
        next(error);
    }
});

// Get category performance
router.get('/:id/performance', async (req, res, next) => {
    try {
        const category = await prisma.category.findUnique({
            where: { id: req.params.id }
        });

        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const attempts = await prisma.quizAttempt.findMany({
            where: {
                bookmark: { categoryId: req.params.id }
            },
            orderBy: { attemptedAt: 'asc' },
            include: {
                bookmark: true
            }
        });

        const avgScore = attempts.length > 0
            ? attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length
            : 0;

        // Daily performance for last 30 days
        const now = new Date();
        const dailyPerformance = [];

        for (let i = 29; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const dayAttempts = attempts.filter(a =>
                new Date(a.attemptedAt).toISOString().split('T')[0] === dateStr
            );

            dailyPerformance.push({
                date: dateStr,
                avgScore: dayAttempts.length > 0
                    ? dayAttempts.reduce((sum, a) => sum + a.score, 0) / dayAttempts.length
                    : null,
                attempts: dayAttempts.length
            });
        }

        res.json({
            category: category.name,
            totalAttempts: attempts.length,
            avgScore: Math.round(avgScore * 100) / 100,
            dailyPerformance
        });
    } catch (error) {
        next(error);
    }
});

export default router;
