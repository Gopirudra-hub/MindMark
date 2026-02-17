import { Router } from 'express';
import { z } from 'zod';
import { prisma, logger } from '../index.js';

const router = Router();

// Helper to convert empty strings to undefined
const emptyToUndefined = z.literal('').transform(() => undefined);

// Validation schemas
const createBookmarkSchema = z.object({
    title: z.string().min(1).max(500),
    url: z.string().url(),
    content: z.string().max(100000).optional().nullable(),
    categoryId: z.string().uuid().optional().or(emptyToUndefined),
    tags: z.array(z.string()).optional()
});

const updateBookmarkSchema = z.object({
    title: z.string().min(1).max(500).optional(),
    url: z.string().url().optional(),
    content: z.string().max(100000).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    summary: z.string().optional(),
    detailedSummary: z.string().optional(),
    keyConcepts: z.string().optional()
});

// Get all bookmarks with filters
router.get('/', async (req, res, next) => {
    try {
        const {
            categoryId,
            search,
            tagId,
            dueToday,
            weakTopics,
            highScore,
            lowScore,
            notReviewed,
            limit = 50,
            offset = 0
        } = req.query;

        const where = {};
        const now = new Date();

        if (categoryId) {
            where.categoryId = categoryId;
        }

        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { url: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (tagId) {
            where.tags = {
                some: { tagId }
            };
        }

        if (dueToday === 'true') {
            const endOfDay = new Date(now);
            endOfDay.setHours(23, 59, 59, 999);
            where.nextReviewAt = { lte: endOfDay };
        }

        if (notReviewed === 'true') {
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            where.OR = [
                { lastReviewedAt: null },
                { lastReviewedAt: { lt: thirtyDaysAgo } }
            ];
        }

        const bookmarks = await prisma.bookmark.findMany({
            where,
            include: {
                category: true,
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
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            skip: parseInt(offset)
        });

        // Post-filter for score-based filters
        let filteredBookmarks = bookmarks;

        if (highScore === 'true' || lowScore === 'true' || weakTopics === 'true') {
            const bookmarksWithScores = await Promise.all(
                bookmarks.map(async (bookmark) => {
                    const attempts = await prisma.quizAttempt.findMany({
                        where: { bookmarkId: bookmark.id },
                        take: 5,
                        orderBy: { attemptedAt: 'desc' }
                    });
                    const avgScore = attempts.length > 0
                        ? attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length
                        : null;
                    return { ...bookmark, avgScore };
                })
            );

            if (highScore === 'true') {
                filteredBookmarks = bookmarksWithScores.filter(b => b.avgScore !== null && b.avgScore >= 80);
            } else if (lowScore === 'true' || weakTopics === 'true') {
                filteredBookmarks = bookmarksWithScores.filter(b => b.avgScore !== null && b.avgScore < 50);
            }
        }

        const total = await prisma.bookmark.count({ where });

        res.json({
            bookmarks: filteredBookmarks,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        next(error);
    }
});

// Get single bookmark
router.get('/:id', async (req, res, next) => {
    try {
        const bookmark = await prisma.bookmark.findUnique({
            where: { id: req.params.id },
            include: {
                category: true,
                tags: {
                    include: { tag: true }
                },
                questions: true,
                quizAttempts: {
                    orderBy: { attemptedAt: 'desc' },
                    take: 10,
                    include: {
                        userAnswers: {
                            include: { question: true }
                        }
                    }
                }
            }
        });

        if (!bookmark) {
            return res.status(404).json({ error: 'Bookmark not found' });
        }

        res.json(bookmark);
    } catch (error) {
        next(error);
    }
});

// Create bookmark
router.post('/', async (req, res, next) => {
    try {
        logger.info('Create bookmark request:', JSON.stringify(req.body));
        const data = createBookmarkSchema.parse(req.body);

        const bookmark = await prisma.bookmark.create({
            data: {
                title: data.title,
                url: data.url,
                content: data.content || null,
                categoryId: data.categoryId || null
            },
            include: {
                category: true
            }
        });

        // Add tags if provided
        if (data.tags && data.tags.length > 0) {
            for (const tagName of data.tags) {
                let tag = await prisma.tag.findUnique({ where: { name: tagName } });
                if (!tag) {
                    tag = await prisma.tag.create({ data: { name: tagName } });
                }
                await prisma.bookmarkTag.create({
                    data: { bookmarkId: bookmark.id, tagId: tag.id }
                });
            }
        }

        logger.info(`Created bookmark: ${bookmark.id}`);
        res.status(201).json(bookmark);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        next(error);
    }
});

// Update bookmark
router.put('/:id', async (req, res, next) => {
    try {
        const data = updateBookmarkSchema.parse(req.body);

        const bookmark = await prisma.bookmark.update({
            where: { id: req.params.id },
            data,
            include: {
                category: true,
                tags: {
                    include: { tag: true }
                }
            }
        });

        logger.info(`Updated bookmark: ${bookmark.id}`);
        res.json(bookmark);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Bookmark not found' });
        }
        next(error);
    }
});

// Delete bookmark
router.delete('/:id', async (req, res, next) => {
    try {
        await prisma.bookmark.delete({
            where: { id: req.params.id }
        });

        logger.info(`Deleted bookmark: ${req.params.id}`);
        res.status(204).send();
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Bookmark not found' });
        }
        next(error);
    }
});

// Add tag to bookmark
router.post('/:id/tags', async (req, res, next) => {
    try {
        const { tagName } = req.body;

        if (!tagName) {
            return res.status(400).json({ error: 'Tag name is required' });
        }

        // Find or create tag
        let tag = await prisma.tag.findUnique({ where: { name: tagName } });
        if (!tag) {
            tag = await prisma.tag.create({ data: { name: tagName } });
        }

        // Check if already exists
        const existing = await prisma.bookmarkTag.findUnique({
            where: {
                bookmarkId_tagId: {
                    bookmarkId: req.params.id,
                    tagId: tag.id
                }
            }
        });

        if (!existing) {
            await prisma.bookmarkTag.create({
                data: {
                    bookmarkId: req.params.id,
                    tagId: tag.id
                }
            });
        }

        res.status(201).json({ message: 'Tag added', tag });
    } catch (error) {
        next(error);
    }
});

// Remove tag from bookmark
router.delete('/:id/tags/:tagId', async (req, res, next) => {
    try {
        await prisma.bookmarkTag.delete({
            where: {
                bookmarkId_tagId: {
                    bookmarkId: req.params.id,
                    tagId: req.params.tagId
                }
            }
        });

        res.status(204).send();
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Tag not found on bookmark' });
        }
        next(error);
    }
});

// Get due bookmarks for review
router.get('/review/due', async (req, res, next) => {
    try {
        const now = new Date();
        const { limit = 10 } = req.query;

        const dueBookmarks = await prisma.bookmark.findMany({
            where: {
                OR: [
                    { nextReviewAt: { lte: now } },
                    { nextReviewAt: null, lastReviewedAt: null }
                ]
            },
            include: {
                category: true,
                questions: {
                    take: 5
                }
            },
            orderBy: [
                { nextReviewAt: 'asc' },
                { createdAt: 'asc' }
            ],
            take: parseInt(limit)
        });

        res.json(dueBookmarks);
    } catch (error) {
        next(error);
    }
});

export default router;
