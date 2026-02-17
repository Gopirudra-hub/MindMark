import { prisma, logger } from '../index.js';

/**
 * Revision Engine - Rule-based scheduling
 * 
 * Rules:
 * - Score ≥ 80 → Review in 5 days
 * - Score 50-79 → Review in 3 days
 * - Score < 50 → Review in 1 day
 */

/**
 * Calculate next review date based on score
 */
export function calculateNextReviewDate(score) {
    const now = new Date();
    let daysToAdd;

    if (score >= 80) {
        daysToAdd = 5;
    } else if (score >= 50) {
        daysToAdd = 3;
    } else {
        daysToAdd = 1;
    }

    const nextReview = new Date(now);
    nextReview.setDate(nextReview.getDate() + daysToAdd);
    nextReview.setHours(9, 0, 0, 0); // Set to 9 AM

    return nextReview;
}

/**
 * Update bookmark review dates after a quiz attempt
 */
export async function updateRevisionSchedule(bookmarkId, score) {
    const now = new Date();
    const nextReviewAt = calculateNextReviewDate(score);

    await prisma.bookmark.update({
        where: { id: bookmarkId },
        data: {
            lastReviewedAt: now,
            nextReviewAt
        }
    });

    logger.info(`Updated revision schedule for bookmark ${bookmarkId}: next review at ${nextReviewAt.toISOString()}`);

    return { lastReviewedAt: now, nextReviewAt };
}

/**
 * Get bookmarks due for review
 */
export async function getDueBookmarks(limit = 10) {
    const now = new Date();

    const dueBookmarks = await prisma.bookmark.findMany({
        where: {
            OR: [
                { nextReviewAt: { lte: now } },
                { nextReviewAt: null, lastReviewedAt: null } // Never reviewed
            ]
        },
        include: {
            category: true,
            questions: {
                take: 5,
                where: { type: 'mcq' }
            },
            quizAttempts: {
                orderBy: { attemptedAt: 'desc' },
                take: 1
            }
        },
        orderBy: [
            { nextReviewAt: 'asc' },
            { createdAt: 'asc' }
        ],
        take: limit
    });

    return dueBookmarks;
}

/**
 * Get bookmarks sorted by weakness (lowest recent scores)
 */
export async function getWeakestBookmarks(limit = 10) {
    // Get bookmarks with their latest quiz scores
    const bookmarksWithScores = await prisma.bookmark.findMany({
        include: {
            category: true,
            quizAttempts: {
                orderBy: { attemptedAt: 'desc' },
                take: 3
            }
        }
    });

    // Calculate average recent score for each bookmark
    const scored = bookmarksWithScores.map(bookmark => {
        const attempts = bookmark.quizAttempts;
        const avgScore = attempts.length > 0
            ? attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length
            : 0;

        return {
            ...bookmark,
            avgRecentScore: avgScore,
            attemptCount: attempts.length
        };
    });

    // Sort by score (ascending) and filter those with at least one attempt
    const weakest = scored
        .filter(b => b.attemptCount > 0)
        .sort((a, b) => a.avgRecentScore - b.avgRecentScore)
        .slice(0, limit);

    return weakest;
}

/**
 * Create daily review set
 */
export async function createDailyReviewSet() {
    const dueBookmarks = await getDueBookmarks(5);
    const weakBookmarks = await getWeakestBookmarks(3);

    // Combine and deduplicate
    const combined = [...dueBookmarks];
    const dueIds = new Set(dueBookmarks.map(b => b.id));

    for (const weak of weakBookmarks) {
        if (!dueIds.has(weak.id)) {
            combined.push(weak);
        }
    }

    // Get questions for a 5-question quick test
    const questions = [];
    for (const bookmark of combined.slice(0, 5)) {
        if (bookmark.questions && bookmark.questions.length > 0) {
            questions.push({
                ...bookmark.questions[0],
                bookmarkTitle: bookmark.title
            });
        }
    }

    return {
        bookmarks: combined.slice(0, 5),
        questions: questions.slice(0, 5),
        totalDue: combined.length
    };
}

export default {
    calculateNextReviewDate,
    updateRevisionSchedule,
    getDueBookmarks,
    getWeakestBookmarks,
    createDailyReviewSet
};
