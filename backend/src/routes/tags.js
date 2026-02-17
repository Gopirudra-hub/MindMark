import { Router } from 'express';
import { z } from 'zod';
import { prisma, logger } from '../index.js';

const router = Router();

// Get all tags
router.get('/', async (req, res, next) => {
    try {
        const tags = await prisma.tag.findMany({
            include: {
                _count: {
                    select: { bookmarks: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        res.json(tags);
    } catch (error) {
        next(error);
    }
});

// Get single tag with bookmarks
router.get('/:id', async (req, res, next) => {
    try {
        const tag = await prisma.tag.findUnique({
            where: { id: req.params.id },
            include: {
                bookmarks: {
                    include: {
                        bookmark: {
                            include: {
                                category: true
                            }
                        }
                    }
                }
            }
        });

        if (!tag) {
            return res.status(404).json({ error: 'Tag not found' });
        }

        // Flatten the response
        const bookmarks = tag.bookmarks.map(bt => bt.bookmark);

        res.json({
            ...tag,
            bookmarks
        });
    } catch (error) {
        next(error);
    }
});

// Create tag
router.post('/', async (req, res, next) => {
    try {
        const { name } = req.body;

        if (!name || typeof name !== 'string' || name.length < 1) {
            return res.status(400).json({ error: 'Tag name is required' });
        }

        const existing = await prisma.tag.findUnique({
            where: { name }
        });

        if (existing) {
            return res.status(409).json({ error: 'Tag already exists', tag: existing });
        }

        const tag = await prisma.tag.create({
            data: { name }
        });

        logger.info(`Created tag: ${tag.id}`);
        res.status(201).json(tag);
    } catch (error) {
        next(error);
    }
});

// Update tag
router.put('/:id', async (req, res, next) => {
    try {
        const { name } = req.body;

        if (!name || typeof name !== 'string' || name.length < 1) {
            return res.status(400).json({ error: 'Tag name is required' });
        }

        const existing = await prisma.tag.findFirst({
            where: {
                name,
                NOT: { id: req.params.id }
            }
        });

        if (existing) {
            return res.status(409).json({ error: 'Tag name already exists' });
        }

        const tag = await prisma.tag.update({
            where: { id: req.params.id },
            data: { name }
        });

        logger.info(`Updated tag: ${tag.id}`);
        res.json(tag);
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Tag not found' });
        }
        next(error);
    }
});

// Delete tag
router.delete('/:id', async (req, res, next) => {
    try {
        await prisma.tag.delete({
            where: { id: req.params.id }
        });

        logger.info(`Deleted tag: ${req.params.id}`);
        res.status(204).send();
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Tag not found' });
        }
        next(error);
    }
});

export default router;
