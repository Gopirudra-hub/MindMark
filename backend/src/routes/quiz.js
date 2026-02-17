import { Router } from 'express';
import { z } from 'zod';
import { prisma, logger } from '../index.js';
import { updateRevisionSchedule, createDailyReviewSet } from '../services/revisionEngine.js';

const router = Router();

// Validation schemas
const submitQuizSchema = z.object({
    bookmarkId: z.string().uuid(),
    answers: z.array(z.object({
        questionId: z.string().uuid(),
        selectedAnswer: z.string()
    })),
    timeTaken: z.number().min(0) // in seconds
});

const submitDailyQuizSchema = z.object({
    answers: z.array(z.object({
        questionId: z.string().uuid(),
        selectedAnswer: z.string()
    })),
    timeTaken: z.number().min(0)
});

// Get questions for a bookmark quiz
router.get('/bookmark/:bookmarkId', async (req, res, next) => {
    try {
        const { mode = 'mixed', limit = 10 } = req.query;

        const where = { bookmarkId: req.params.bookmarkId };

        // Filter by mode
        if (mode === 'mcq') {
            where.type = 'mcq';
        } else if (mode === 'short') {
            where.type = 'short';
        } else if (mode === 'flashcard') {
            where.type = 'flashcard';
        }
        // 'mixed' and 'timed' get all types

        const questions = await prisma.question.findMany({
            where,
            take: parseInt(limit)
        });

        // Randomize order
        const shuffled = questions.sort(() => Math.random() - 0.5);

        // For quiz display, hide correct answers
        const quizQuestions = shuffled.map(q => ({
            id: q.id,
            questionText: q.questionText,
            type: q.type,
            options: q.options,
            difficulty: q.difficulty
        }));

        res.json({
            bookmarkId: req.params.bookmarkId,
            mode,
            questions: quizQuestions,
            totalQuestions: quizQuestions.length
        });
    } catch (error) {
        next(error);
    }
});

// Submit quiz answers
router.post('/submit', async (req, res, next) => {
    try {
        const data = submitQuizSchema.parse(req.body);

        // Verify bookmark exists
        const bookmark = await prisma.bookmark.findUnique({
            where: { id: data.bookmarkId }
        });

        if (!bookmark) {
            return res.status(404).json({ error: 'Bookmark not found' });
        }

        // Validate answers and calculate score
        const results = [];
        let correctCount = 0;

        for (const answer of data.answers) {
            const question = await prisma.question.findUnique({
                where: { id: answer.questionId }
            });

            if (!question) {
                continue;
            }

            const isCorrect = checkAnswer(question, answer.selectedAnswer);
            if (isCorrect) correctCount++;

            results.push({
                questionId: question.id,
                questionText: question.questionText,
                selectedAnswer: answer.selectedAnswer,
                correctAnswer: question.correctAnswer,
                isCorrect,
                explanation: question.explanation
            });
        }

        const totalQuestions = results.length;
        const score = totalQuestions > 0
            ? (correctCount / totalQuestions) * 100
            : 0;

        // Create quiz attempt
        const attempt = await prisma.quizAttempt.create({
            data: {
                bookmarkId: data.bookmarkId,
                score,
                totalQuestions,
                timeTaken: data.timeTaken
            }
        });

        // Create user answers
        for (const result of results) {
            await prisma.userAnswer.create({
                data: {
                    attemptId: attempt.id,
                    questionId: result.questionId,
                    selectedAnswer: result.selectedAnswer,
                    isCorrect: result.isCorrect
                }
            });
        }

        // Update revision schedule
        const revisionUpdate = await updateRevisionSchedule(data.bookmarkId, score);

        // Find weak questions (answered incorrectly)
        const weakQuestions = results.filter(r => !r.isCorrect);

        logger.info(`Quiz submitted for bookmark ${data.bookmarkId}: ${score}%`);

        res.json({
            attemptId: attempt.id,
            score: Math.round(score * 100) / 100,
            correct: correctCount,
            total: totalQuestions,
            timeTaken: data.timeTaken,
            results,
            weakQuestions,
            nextReviewAt: revisionUpdate.nextReviewAt
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        next(error);
    }
});

// Get quiz attempts for a bookmark
router.get('/attempts/:bookmarkId', async (req, res, next) => {
    try {
        const attempts = await prisma.quizAttempt.findMany({
            where: { bookmarkId: req.params.bookmarkId },
            orderBy: { attemptedAt: 'desc' },
            include: {
                userAnswers: {
                    include: { question: true }
                }
            }
        });

        res.json(attempts);
    } catch (error) {
        next(error);
    }
});

// Get single attempt details
router.get('/attempt/:id', async (req, res, next) => {
    try {
        const attempt = await prisma.quizAttempt.findUnique({
            where: { id: req.params.id },
            include: {
                bookmark: true,
                userAnswers: {
                    include: { question: true }
                }
            }
        });

        if (!attempt) {
            return res.status(404).json({ error: 'Attempt not found' });
        }

        res.json(attempt);
    } catch (error) {
        next(error);
    }
});

// Get daily review quiz
router.get('/daily-review', async (req, res, next) => {
    try {
        const reviewSet = await createDailyReviewSet();

        // Format questions for quiz
        const quizQuestions = reviewSet.questions.map(q => ({
            id: q.id,
            questionText: q.questionText,
            type: q.type,
            options: q.options,
            difficulty: q.difficulty,
            bookmarkTitle: q.bookmarkTitle
        }));

        res.json({
            questions: quizQuestions,
            totalDue: reviewSet.totalDue,
            bookmarks: reviewSet.bookmarks.map(b => ({
                id: b.id,
                title: b.title,
                category: b.category?.name
            }))
        });
    } catch (error) {
        next(error);
    }
});

// Submit daily review quiz
router.post('/daily-review/submit', async (req, res, next) => {
    try {
        const data = submitDailyQuizSchema.parse(req.body);

        const results = [];
        let correctCount = 0;
        const bookmarkScores = {};

        for (const answer of data.answers) {
            const question = await prisma.question.findUnique({
                where: { id: answer.questionId },
                include: { bookmark: true }
            });

            if (!question) continue;

            const isCorrect = checkAnswer(question, answer.selectedAnswer);
            if (isCorrect) correctCount++;

            // Track per-bookmark scores
            if (!bookmarkScores[question.bookmarkId]) {
                bookmarkScores[question.bookmarkId] = { correct: 0, total: 0 };
            }
            bookmarkScores[question.bookmarkId].total++;
            if (isCorrect) bookmarkScores[question.bookmarkId].correct++;

            results.push({
                questionId: question.id,
                questionText: question.questionText,
                selectedAnswer: answer.selectedAnswer,
                correctAnswer: question.correctAnswer,
                isCorrect,
                explanation: question.explanation,
                bookmarkTitle: question.bookmark?.title
            });
        }

        const totalQuestions = results.length;
        const overallScore = totalQuestions > 0
            ? (correctCount / totalQuestions) * 100
            : 0;

        // Update revision schedules for each bookmark
        for (const [bookmarkId, scores] of Object.entries(bookmarkScores)) {
            const bookmarkScore = (scores.correct / scores.total) * 100;
            await updateRevisionSchedule(bookmarkId, bookmarkScore);
        }

        logger.info(`Daily review completed: ${overallScore}%`);

        res.json({
            score: Math.round(overallScore * 100) / 100,
            correct: correctCount,
            total: totalQuestions,
            timeTaken: data.timeTaken,
            results,
            bookmarksReviewed: Object.keys(bookmarkScores).length
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        next(error);
    }
});

// Helper function to check answer correctness
function checkAnswer(question, selectedAnswer) {
    const correct = question.correctAnswer.toLowerCase().trim();
    const selected = selectedAnswer.toLowerCase().trim();

    if (question.type === 'mcq') {
        return correct === selected;
    } else if (question.type === 'short' || question.type === 'scenario') {
        // For short answers, check if key words are present
        const correctWords = correct.split(/\s+/).filter(w => w.length > 3);
        const selectedWords = selected.split(/\s+/);
        const matchCount = correctWords.filter(w =>
            selectedWords.some(sw => sw.includes(w) || w.includes(sw))
        ).length;
        return matchCount / correctWords.length >= 0.5;
    } else if (question.type === 'flashcard') {
        // For flashcards, more lenient matching
        return correct.includes(selected) || selected.includes(correct) || correct === selected;
    }

    return false;
}

export default router;
