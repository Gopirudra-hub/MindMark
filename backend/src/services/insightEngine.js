import { prisma, logger } from '../index.js';

/**
 * Insight Engine - Rule-based insights generation
 * No AI dependency, purely deterministic rules
 */

/**
 * Generate all insights for a user
 */
export async function generateInsights() {
    const insights = [];

    // Get all necessary data
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const allAttempts = await prisma.quizAttempt.findMany({
        include: {
            bookmark: {
                include: { category: true }
            },
            userAnswers: {
                include: { question: true }
            }
        },
        orderBy: { attemptedAt: 'desc' }
    });

    const bookmarks = await prisma.bookmark.findMany({
        include: { category: true }
    });

    // 1. Weekly improvement insight
    const thisWeekAttempts = allAttempts.filter(a => new Date(a.attemptedAt) >= oneWeekAgo);
    const lastWeekAttempts = allAttempts.filter(a =>
        new Date(a.attemptedAt) >= twoWeeksAgo && new Date(a.attemptedAt) < oneWeekAgo
    );

    if (thisWeekAttempts.length > 0 && lastWeekAttempts.length > 0) {
        const thisWeekAvg = thisWeekAttempts.reduce((sum, a) => sum + a.score, 0) / thisWeekAttempts.length;
        const lastWeekAvg = lastWeekAttempts.reduce((sum, a) => sum + a.score, 0) / lastWeekAttempts.length;
        const improvement = thisWeekAvg - lastWeekAvg;

        if (improvement > 0) {
            insights.push({
                type: 'improvement',
                priority: 'positive',
                message: `You improved ${Math.round(improvement)}% this week compared to last week!`,
                metric: improvement
            });
        } else if (improvement < -5) {
            insights.push({
                type: 'decline',
                priority: 'warning',
                message: `Your scores dropped ${Math.round(Math.abs(improvement))}% this week. Consider reviewing more frequently.`,
                metric: improvement
            });
        }
    }

    // 2. Missed reviews insight
    const missedReviews = bookmarks.filter(b => {
        if (!b.nextReviewAt) return false;
        return new Date(b.nextReviewAt) < now && (!b.lastReviewedAt || new Date(b.lastReviewedAt) < new Date(b.nextReviewAt));
    });

    if (missedReviews.length > 0) {
        insights.push({
            type: 'missed_reviews',
            priority: 'warning',
            message: `You missed ${missedReviews.length} scheduled review${missedReviews.length > 1 ? 's' : ''}.`,
            metric: missedReviews.length,
            bookmarks: missedReviews.slice(0, 5).map(b => ({ id: b.id, title: b.title }))
        });
    }

    // 3. Category weakness insight
    const categoryStats = {};
    for (const attempt of allAttempts) {
        const categoryName = attempt.bookmark?.category?.name || 'Uncategorized';
        if (!categoryStats[categoryName]) {
            categoryStats[categoryName] = { scores: [], category: attempt.bookmark?.category };
        }
        categoryStats[categoryName].scores.push(attempt.score);
    }

    for (const [name, data] of Object.entries(categoryStats)) {
        if (data.scores.length >= 3) {
            const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
            if (avgScore < 50) {
                insights.push({
                    type: 'weak_category',
                    priority: 'critical',
                    message: `You struggle with "${name}" topics (avg score: ${Math.round(avgScore)}%). Focus more on this area.`,
                    category: name,
                    metric: avgScore
                });
            }
        }
    }

    // 4. Retention decay insight
    for (const [name, data] of Object.entries(categoryStats)) {
        if (data.scores.length >= 5) {
            // Check if scores decline over time
            const recentScores = data.scores.slice(0, 3);
            const olderScores = data.scores.slice(-3);
            const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
            const olderAvg = olderScores.reduce((a, b) => a + b, 0) / olderScores.length;

            if (olderAvg - recentAvg > 15) {
                // Calculate approximate retention decay
                const daysBetween = Math.ceil(
                    (new Date(allAttempts[0].attemptedAt) - new Date(allAttempts[allAttempts.length - 1].attemptedAt)) /
                    (1000 * 60 * 60 * 24)
                );
                insights.push({
                    type: 'retention_decay',
                    priority: 'warning',
                    message: `You tend to forget "${name}" topics after about ${Math.max(2, Math.round(daysBetween / 2))} days.`,
                    category: name,
                    metric: daysBetween
                });
            }
        }
    }

    // 5. Question type weakness insight
    const questionTypeStats = {
        mcq: { correct: 0, total: 0 },
        short: { correct: 0, total: 0 },
        scenario: { correct: 0, total: 0 },
        flashcard: { correct: 0, total: 0 }
    };

    for (const attempt of allAttempts) {
        for (const answer of attempt.userAnswers) {
            const type = answer.question?.type || 'mcq';
            if (questionTypeStats[type]) {
                questionTypeStats[type].total++;
                if (answer.isCorrect) {
                    questionTypeStats[type].correct++;
                }
            }
        }
    }

    for (const [type, stats] of Object.entries(questionTypeStats)) {
        if (stats.total >= 10) {
            const correctRate = (stats.correct / stats.total) * 100;
            if (correctRate < 50) {
                const typeLabel = {
                    mcq: 'multiple choice',
                    short: 'short answer',
                    scenario: 'scenario-based',
                    flashcard: 'flashcard'
                }[type];

                insights.push({
                    type: 'question_type_weakness',
                    priority: 'info',
                    message: `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} questions score lower (${Math.round(correctRate)}%) than other types.`,
                    questionType: type,
                    metric: correctRate
                });
            }
        }
    }

    // 6. Consistency insight
    const activeDays = new Set();
    for (const attempt of allAttempts.filter(a => new Date(a.attemptedAt) >= oneWeekAgo)) {
        activeDays.add(new Date(attempt.attemptedAt).toISOString().split('T')[0]);
    }

    if (activeDays.size >= 5) {
        insights.push({
            type: 'consistency',
            priority: 'positive',
            message: `Great consistency! You've studied ${activeDays.size} days this week.`,
            metric: activeDays.size
        });
    } else if (activeDays.size <= 2 && allAttempts.length > 0) {
        insights.push({
            type: 'consistency',
            priority: 'warning',
            message: `You've only studied ${activeDays.size} day${activeDays.size === 1 ? '' : 's'} this week. Try to be more consistent.`,
            metric: activeDays.size
        });
    }

    // 7. Streak insight (if applicable)
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    let streak = 0;
    for (let i = 0; i < 30; i++) {
        const checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];

        const hasAttempt = allAttempts.some(a =>
            new Date(a.attemptedAt).toISOString().split('T')[0] === dateStr
        );

        if (hasAttempt) {
            streak++;
        } else if (i > 0) {
            break;
        }
    }

    if (streak >= 3) {
        insights.push({
            type: 'streak',
            priority: 'positive',
            message: `You're on a ${streak}-day study streak! Keep it up!`,
            metric: streak
        });
    }

    // Sort by priority
    const priorityOrder = { critical: 0, warning: 1, info: 2, positive: 3 };
    insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return insights;
}

/**
 * Generate insights for a specific category
 */
export async function getCategoryInsights(categoryId) {
    const category = await prisma.category.findUnique({
        where: { id: categoryId },
        include: {
            bookmarks: {
                include: {
                    quizAttempts: {
                        include: {
                            userAnswers: {
                                include: { question: true }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!category) return [];

    const insights = [];
    const allAttempts = category.bookmarks.flatMap(b => b.quizAttempts);

    if (allAttempts.length === 0) {
        insights.push({
            type: 'no_data',
            priority: 'info',
            message: `No quiz attempts yet for "${category.name}". Start reviewing to get insights!`
        });
        return insights;
    }

    // Average score
    const avgScore = allAttempts.reduce((sum, a) => sum + a.score, 0) / allAttempts.length;

    if (avgScore >= 80) {
        insights.push({
            type: 'strong_category',
            priority: 'positive',
            message: `You're doing great in "${category.name}" with an average score of ${Math.round(avgScore)}%!`
        });
    } else if (avgScore < 50) {
        insights.push({
            type: 'weak_category',
            priority: 'critical',
            message: `"${category.name}" needs more attention. Average score is only ${Math.round(avgScore)}%.`
        });
    }

    // Improvement trend
    if (allAttempts.length >= 5) {
        const recentAvg = allAttempts.slice(0, 3).reduce((s, a) => s + a.score, 0) / 3;
        const olderAvg = allAttempts.slice(-3).reduce((s, a) => s + a.score, 0) / 3;

        if (recentAvg > olderAvg + 10) {
            insights.push({
                type: 'improving',
                priority: 'positive',
                message: `Your "${category.name}" scores are improving! Recent average is ${Math.round(recentAvg - olderAvg)}% higher.`
            });
        }
    }

    return insights;
}

/**
 * Generate insights for a specific bookmark
 */
export async function getBookmarkInsights(bookmarkId) {
    const bookmark = await prisma.bookmark.findUnique({
        where: { id: bookmarkId },
        include: {
            quizAttempts: {
                orderBy: { attemptedAt: 'desc' },
                include: {
                    userAnswers: {
                        include: { question: true }
                    }
                }
            },
            questions: true
        }
    });

    if (!bookmark) return [];

    const insights = [];
    const attempts = bookmark.quizAttempts;

    if (attempts.length === 0) {
        insights.push({
            type: 'no_attempts',
            priority: 'info',
            message: 'No quiz attempts yet. Take a quiz to start tracking your progress!'
        });
        return insights;
    }

    // Score trend
    const avgScore = attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length;
    const latestScore = attempts[0].score;

    if (latestScore >= avgScore + 10) {
        insights.push({
            type: 'improving',
            priority: 'positive',
            message: `Great progress! Your latest score (${latestScore}%) is above your average (${Math.round(avgScore)}%).`
        });
    } else if (latestScore < avgScore - 10) {
        insights.push({
            type: 'declining',
            priority: 'warning',
            message: `Your latest score (${latestScore}%) dropped below your average (${Math.round(avgScore)}%). Review recommended.`
        });
    }

    // Time between reviews
    if (bookmark.lastReviewedAt) {
        const daysSinceReview = Math.floor(
            (new Date() - new Date(bookmark.lastReviewedAt)) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceReview > 7) {
            insights.push({
                type: 'overdue',
                priority: 'warning',
                message: `It's been ${daysSinceReview} days since your last review. Time to refresh your memory!`
            });
        }
    }

    // Weak questions
    const questionStats = {};
    for (const attempt of attempts) {
        for (const answer of attempt.userAnswers) {
            if (!questionStats[answer.questionId]) {
                questionStats[answer.questionId] = { correct: 0, total: 0, questionText: answer.question?.questionText };
            }
            questionStats[answer.questionId].total++;
            if (answer.isCorrect) questionStats[answer.questionId].correct++;
        }
    }

    const weakQuestions = Object.values(questionStats)
        .filter(q => q.total >= 2 && (q.correct / q.total) < 0.5);

    if (weakQuestions.length > 0) {
        insights.push({
            type: 'weak_questions',
            priority: 'info',
            message: `You consistently miss ${weakQuestions.length} question(s). Focus on: "${weakQuestions[0].questionText?.substring(0, 50)}..."`
        });
    }

    return insights;
}

export default {
    generateInsights,
    getCategoryInsights,
    getBookmarkInsights
};
