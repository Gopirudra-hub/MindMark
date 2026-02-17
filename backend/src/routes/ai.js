import { Router } from 'express';
import { z } from 'zod';
import { prisma, logger } from '../index.js';
import aiProvider from '../services/aiProvider.js';

const router = Router();

// Validation schemas
const generateContentSchema = z.object({
    bookmarkId: z.string().uuid(),
    type: z.enum(['summary', 'detailed', 'concepts', 'all']).default('summary')
});

const generateQuestionsSchema = z.object({
    bookmarkId: z.string().uuid(),
    types: z.array(z.enum(['mcq', 'short', 'scenario', 'flashcard'])).optional(),
    count: z.number().min(1).max(20).optional()
});

// Generate summary for a bookmark
router.post('/generate-summary', async (req, res, next) => {
    try {
        const data = generateContentSchema.parse(req.body);

        const bookmark = await prisma.bookmark.findUnique({
            where: { id: data.bookmarkId }
        });

        if (!bookmark) {
            return res.status(404).json({ error: 'Bookmark not found' });
        }

        if (!bookmark.content) {
            return res.status(400).json({ error: 'Bookmark has no content to summarize' });
        }

        // Check if already generated
        if (bookmark.summary && data.type === 'summary') {
            return res.json({
                message: 'Summary already exists',
                summary: bookmark.summary,
                cached: true
            });
        }

        let result = {};

        if (data.type === 'summary' || data.type === 'all') {
            const summary = await aiProvider.generateSummary(bookmark.content);
            result.summary = summary;

            await prisma.bookmark.update({
                where: { id: data.bookmarkId },
                data: { summary }
            });
        }

        if (data.type === 'detailed' || data.type === 'all') {
            const detailedSummary = await aiProvider.generateDetailedSummary(bookmark.content);
            result.detailedSummary = detailedSummary;

            await prisma.bookmark.update({
                where: { id: data.bookmarkId },
                data: { detailedSummary }
            });
        }

        if (data.type === 'concepts' || data.type === 'all') {
            const keyConcepts = await aiProvider.generateKeyConcepts(bookmark.content);
            result.keyConcepts = keyConcepts;

            await prisma.bookmark.update({
                where: { id: data.bookmarkId },
                data: { keyConcepts: JSON.stringify(keyConcepts) }
            });
        }

        logger.info(`Generated ${data.type} content for bookmark ${data.bookmarkId}`);

        res.json({
            message: 'Content generated successfully',
            ...result,
            cached: false
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger.error('AI generation error:', error);
        next(error);
    }
});

// Generate questions for a bookmark
router.post('/generate-questions', async (req, res, next) => {
    try {
        const data = generateQuestionsSchema.parse(req.body);

        const bookmark = await prisma.bookmark.findUnique({
            where: { id: data.bookmarkId },
            include: {
                _count: { select: { questions: true } }
            }
        });

        if (!bookmark) {
            return res.status(404).json({ error: 'Bookmark not found' });
        }

        // Check if questions already exist
        if (bookmark._count.questions > 0) {
            const existingQuestions = await prisma.question.findMany({
                where: { bookmarkId: data.bookmarkId }
            });

            return res.json({
                message: 'Questions already exist',
                questions: existingQuestions,
                total: existingQuestions.length,
                cached: true
            });
        }

        // Need summary first
        let summary = bookmark.summary;
        if (!summary) {
            if (!bookmark.content) {
                return res.status(400).json({ error: 'Bookmark has no content. Generate summary first.' });
            }
            summary = await aiProvider.generateSummary(bookmark.content);
            await prisma.bookmark.update({
                where: { id: data.bookmarkId },
                data: { summary }
            });
        }

        // Generate questions based on requested types
        const types = data.types || ['mcq', 'short', 'scenario', 'flashcard'];
        const allQuestions = [];

        if (types.includes('mcq')) {
            const mcqs = await aiProvider.generateMCQs(summary, data.count || 5);
            allQuestions.push(...mcqs);
        }

        if (types.includes('short')) {
            const shortAnswers = await aiProvider.generateShortAnswerQuestions(summary, data.count || 3);
            allQuestions.push(...shortAnswers);
        }

        if (types.includes('scenario')) {
            const scenarios = await aiProvider.generateScenarioQuestions(summary, data.count || 2);
            allQuestions.push(...scenarios);
        }

        if (types.includes('flashcard')) {
            const flashcards = await aiProvider.generateFlashcards(summary, data.count || 5);
            allQuestions.push(...flashcards);
        }

        // Save questions to database
        const savedQuestions = [];
        for (const q of allQuestions) {
            const question = await prisma.question.create({
                data: {
                    bookmarkId: data.bookmarkId,
                    questionText: q.questionText,
                    type: q.type,
                    correctAnswer: q.correctAnswer,
                    options: q.options || null,
                    explanation: q.explanation || null,
                    difficulty: q.difficulty || 'medium'
                }
            });
            savedQuestions.push(question);
        }

        logger.info(`Generated ${savedQuestions.length} questions for bookmark ${data.bookmarkId}`);

        res.json({
            message: 'Questions generated successfully',
            questions: savedQuestions,
            total: savedQuestions.length,
            cached: false
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        logger.error('AI question generation error:', error);
        next(error);
    }
});

// Regenerate content (force regeneration)
router.post('/regenerate', async (req, res, next) => {
    try {
        const { bookmarkId, type } = req.body;

        if (!bookmarkId) {
            return res.status(400).json({ error: 'bookmarkId is required' });
        }

        const bookmark = await prisma.bookmark.findUnique({
            where: { id: bookmarkId }
        });

        if (!bookmark) {
            return res.status(404).json({ error: 'Bookmark not found' });
        }

        if (!bookmark.content) {
            return res.status(400).json({ error: 'Bookmark has no content' });
        }

        if (type === 'questions') {
            // Delete existing questions
            await prisma.question.deleteMany({
                where: { bookmarkId }
            });

            // Generate new questions
            const summary = bookmark.summary || await aiProvider.generateSummary(bookmark.content);
            const questions = await aiProvider.generateAllQuestions(summary);

            const allQuestions = [
                ...questions.mcqs,
                ...questions.shortAnswers,
                ...questions.scenarios,
                ...questions.flashcards
            ];

            const savedQuestions = [];
            for (const q of allQuestions) {
                const question = await prisma.question.create({
                    data: {
                        bookmarkId,
                        questionText: q.questionText,
                        type: q.type,
                        correctAnswer: q.correctAnswer,
                        options: q.options || null,
                        explanation: q.explanation || null,
                        difficulty: q.difficulty || 'medium'
                    }
                });
                savedQuestions.push(question);
            }

            logger.info(`Regenerated ${savedQuestions.length} questions for bookmark ${bookmarkId}`);

            return res.json({
                message: 'Questions regenerated',
                questions: savedQuestions,
                total: savedQuestions.length
            });
        } else {
            // Regenerate summaries
            const summary = await aiProvider.generateSummary(bookmark.content);
            const detailedSummary = await aiProvider.generateDetailedSummary(bookmark.content);
            const keyConcepts = await aiProvider.generateKeyConcepts(bookmark.content);

            await prisma.bookmark.update({
                where: { id: bookmarkId },
                data: {
                    summary,
                    detailedSummary,
                    keyConcepts: JSON.stringify(keyConcepts)
                }
            });

            logger.info(`Regenerated content for bookmark ${bookmarkId}`);

            return res.json({
                message: 'Content regenerated',
                summary,
                detailedSummary,
                keyConcepts
            });
        }
    } catch (error) {
        logger.error('AI regeneration error:', error);
        next(error);
    }
});

// Get AI provider status
router.get('/status', async (req, res, next) => {
    try {
        const provider = process.env.AI_PROVIDER || 'local';
        const baseUrl = process.env.AI_BASE_URL || 'http://localhost:11434';

        res.json({
            provider,
            baseUrl: provider === 'local' ? baseUrl : '[CLOUD]',
            status: 'active'
        });
    } catch (error) {
        next(error);
    }
});

export default router;
