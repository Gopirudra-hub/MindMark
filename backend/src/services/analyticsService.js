import { prisma, logger } from '../index.js';

/**
 * Analytics Service - Computes analytics dynamically
 */

/**
 * Get global analytics across all bookmarks
 */
export async function getGlobalAnalytics() {
    // Total bookmarks
    const totalBookmarks = await prisma.bookmark.count();

    // Total categories
    const totalCategories = await prisma.category.count();

    // Get all quiz attempts
    const allAttempts = await prisma.quizAttempt.findMany({
        include: {
            bookmark: {
                include: { category: true }
            }
        }
    });

    // Calculate global average score
    const globalAvgScore = allAttempts.length > 0
        ? allAttempts.reduce((sum, a) => sum + a.score, 0) / allAttempts.length
        : 0;

    // Calculate category scores for finding weakest
    const categoryScores = {};
    for (const attempt of allAttempts) {
        const categoryName = attempt.bookmark?.category?.name || 'Uncategorized';
        if (!categoryScores[categoryName]) {
            categoryScores[categoryName] = { total: 0, count: 0 };
        }
        categoryScores[categoryName].total += attempt.score;
        categoryScores[categoryName].count += 1;
    }

    // Find weakest category
    let weakestCategory = null;
    let lowestAvg = Infinity;
    for (const [name, data] of Object.entries(categoryScores)) {
        const avg = data.total / data.count;
        if (avg < lowestAvg) {
            lowestAvg = avg;
            weakestCategory = { name, avgScore: avg, attempts: data.count };
        }
    }

    // Due reviews count
    const now = new Date();
    const dueReviewsCount = await prisma.bookmark.count({
        where: {
            OR: [
                { nextReviewAt: { lte: now } },
                { nextReviewAt: null, lastReviewedAt: null }
            ]
        }
    });

    // Performance trend (last 7 days vs previous 7 days)
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const thisWeekAttempts = allAttempts.filter(a =>
        new Date(a.attemptedAt) >= oneWeekAgo
    );
    const lastWeekAttempts = allAttempts.filter(a =>
        new Date(a.attemptedAt) >= twoWeeksAgo && new Date(a.attemptedAt) < oneWeekAgo
    );

    const thisWeekAvg = thisWeekAttempts.length > 0
        ? thisWeekAttempts.reduce((sum, a) => sum + a.score, 0) / thisWeekAttempts.length
        : 0;
    const lastWeekAvg = lastWeekAttempts.length > 0
        ? lastWeekAttempts.reduce((sum, a) => sum + a.score, 0) / lastWeekAttempts.length
        : 0;

    const improvementTrend = thisWeekAvg - lastWeekAvg;

    // Review compliance rate (completed reviews / scheduled reviews)
    const scheduledReviews = await prisma.bookmark.count({
        where: {
            nextReviewAt: { not: null }
        }
    });
    const completedReviews = await prisma.bookmark.count({
        where: {
            lastReviewedAt: { not: null }
        }
    });
    const complianceRate = scheduledReviews > 0
        ? (completedReviews / scheduledReviews) * 100
        : 100;

    return {
        totalBookmarks,
        totalCategories,
        totalAttempts: allAttempts.length,
        globalAvgScore: Math.round(globalAvgScore * 100) / 100,
        weakestCategory,
        dueReviewsCount,
        improvementTrend: Math.round(improvementTrend * 100) / 100,
        reviewComplianceRate: Math.round(complianceRate * 100) / 100,
        thisWeekAttempts: thisWeekAttempts.length,
        lastWeekAttempts: lastWeekAttempts.length
    };
}

/**
 * Get category-specific analytics
 */
export async function getCategoryAnalytics(categoryId) {
    const category = await prisma.category.findUnique({
        where: { id: categoryId },
        include: {
            bookmarks: {
                include: {
                    quizAttempts: {
                        orderBy: { attemptedAt: 'desc' }
                    }
                }
            }
        }
    });

    if (!category) {
        return null;
    }

    const allAttempts = category.bookmarks.flatMap(b => b.quizAttempts);

    // Average score
    const avgScore = allAttempts.length > 0
        ? allAttempts.reduce((sum, a) => sum + a.score, 0) / allAttempts.length
        : 0;

    // Weak bookmarks (avg score < 60)
    const weakBookmarks = category.bookmarks.filter(bookmark => {
        if (bookmark.quizAttempts.length === 0) return false;
        const bookmarkAvg = bookmark.quizAttempts.reduce((sum, a) => sum + a.score, 0) / bookmark.quizAttempts.length;
        return bookmarkAvg < 60;
    });

    // Retention trend (last 30 days)
    const now = new Date();
    const retentionTrend = [];
    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const dayAttempts = allAttempts.filter(a => {
            const attemptDate = new Date(a.attemptedAt);
            return attemptDate >= date && attemptDate < nextDay;
        });

        retentionTrend.push({
            date: date.toISOString().split('T')[0],
            avgScore: dayAttempts.length > 0
                ? dayAttempts.reduce((sum, a) => sum + a.score, 0) / dayAttempts.length
                : null,
            attempts: dayAttempts.length
        });
    }

    return {
        id: category.id,
        name: category.name,
        totalBookmarks: category.bookmarks.length,
        totalAttempts: allAttempts.length,
        avgScore: Math.round(avgScore * 100) / 100,
        weakBookmarks: weakBookmarks.map(b => ({
            id: b.id,
            title: b.title
        })),
        retentionTrend
    };
}

/**
 * Get bookmark-specific analytics
 */
export async function getBookmarkAnalytics(bookmarkId) {
    const bookmark = await prisma.bookmark.findUnique({
        where: { id: bookmarkId },
        include: {
            category: true,
            quizAttempts: {
                orderBy: { attemptedAt: 'asc' },
                include: {
                    userAnswers: {
                        include: { question: true }
                    }
                }
            },
            questions: true
        }
    });

    if (!bookmark) {
        return null;
    }

    const attempts = bookmark.quizAttempts;

    // Average score
    const avgScore = attempts.length > 0
        ? attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length
        : 0;

    // Score progression
    const scoreProgression = attempts.map(a => ({
        date: a.attemptedAt,
        score: a.score,
        timeTaken: a.timeTaken
    }));

    // Days since last review
    const daysSinceLastReview = bookmark.lastReviewedAt
        ? Math.floor((new Date() - new Date(bookmark.lastReviewedAt)) / (1000 * 60 * 60 * 24))
        : null;

    // Question performance
    const questionStats = {};
    for (const attempt of attempts) {
        for (const answer of attempt.userAnswers) {
            if (!questionStats[answer.questionId]) {
                questionStats[answer.questionId] = {
                    questionId: answer.questionId,
                    questionText: answer.question?.questionText,
                    correct: 0,
                    incorrect: 0
                };
            }
            if (answer.isCorrect) {
                questionStats[answer.questionId].correct++;
            } else {
                questionStats[answer.questionId].incorrect++;
            }
        }
    }

    // Find weak questions (< 50% correct rate)
    const weakQuestions = Object.values(questionStats)
        .map(q => ({
            ...q,
            correctRate: q.correct / (q.correct + q.incorrect)
        }))
        .filter(q => q.correctRate < 0.5)
        .sort((a, b) => a.correctRate - b.correctRate);

    return {
        id: bookmark.id,
        title: bookmark.title,
        category: bookmark.category?.name,
        totalAttempts: attempts.length,
        avgScore: Math.round(avgScore * 100) / 100,
        scoreProgression,
        lastReviewedAt: bookmark.lastReviewedAt,
        nextReviewAt: bookmark.nextReviewAt,
        daysSinceLastReview,
        totalQuestions: bookmark.questions.length,
        weakQuestions
    };
}

/**
 * Get performance trend data for charts
 */
export async function getPerformanceTrend(days = 30) {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);

    const attempts = await prisma.quizAttempt.findMany({
        where: {
            attemptedAt: { gte: startDate }
        },
        orderBy: { attemptedAt: 'asc' }
    });

    // Group by day
    const dailyData = {};
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        dailyData[key] = { date: key, scores: [], attempts: 0 };
    }

    for (const attempt of attempts) {
        const key = new Date(attempt.attemptedAt).toISOString().split('T')[0];
        if (dailyData[key]) {
            dailyData[key].scores.push(attempt.score);
            dailyData[key].attempts++;
        }
    }

    return Object.values(dailyData).map(day => ({
        date: day.date,
        avgScore: day.scores.length > 0
            ? Math.round((day.scores.reduce((a, b) => a + b, 0) / day.scores.length) * 100) / 100
            : null,
        attempts: day.attempts
    }));
}

export default {
    getGlobalAnalytics,
    getCategoryAnalytics,
    getBookmarkAnalytics,
    getPerformanceTrend
};
