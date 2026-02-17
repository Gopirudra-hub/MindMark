import axios from 'axios';

// Use relative path for vite proxy, or explicit URL for production
const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
    baseURL: `${API_URL}/api`,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Bookmarks
export const getBookmarks = (params) => api.get('/bookmarks', { params });
export const getBookmark = (id) => api.get(`/bookmarks/${id}`);
export const createBookmark = (data) => api.post('/bookmarks', data);
export const updateBookmark = (id, data) => api.put(`/bookmarks/${id}`, data);
export const deleteBookmark = (id) => api.delete(`/bookmarks/${id}`);
export const addTagToBookmark = (id, tagName) => api.post(`/bookmarks/${id}/tags`, { tagName });
export const removeTagFromBookmark = (id, tagId) => api.delete(`/bookmarks/${id}/tags/${tagId}`);

// Categories
export const getCategories = () => api.get('/categories');
export const getCategory = (id) => api.get(`/categories/${id}`);
export const createCategory = (data) => api.post('/categories', data);
export const updateCategory = (id, data) => api.put(`/categories/${id}`, data);
export const deleteCategory = (id) => api.delete(`/categories/${id}`);
export const mergeCategories = (sourceId, targetId) => api.post('/categories/merge', { sourceId, targetId });
export const getCategoryPerformance = (id) => api.get(`/categories/${id}/performance`);

// Tags
export const getTags = () => api.get('/tags');
export const createTag = (name) => api.post('/tags', { name });
export const deleteTag = (id) => api.delete(`/tags/${id}`);

// Quiz
export const getQuizQuestions = (bookmarkId, params) => api.get(`/quiz/bookmark/${bookmarkId}`, { params });
export const submitQuiz = (data) => api.post('/quiz/submit', data);
export const getQuizAttempts = (bookmarkId) => api.get(`/quiz/attempts/${bookmarkId}`);
export const getQuizAttempt = (id) => api.get(`/quiz/attempt/${id}`);
export const getDailyReview = () => api.get('/quiz/daily-review');
export const submitDailyReview = (data) => api.post('/quiz/daily-review/submit', data);

// Analytics
export const getGlobalAnalytics = () => api.get('/analytics');
export const getPerformanceTrend = (days) => api.get('/analytics/trend', { params: { days } });
export const getCategoryAnalytics = (id) => api.get(`/analytics/category/${id}`);
export const getBookmarkAnalytics = (id) => api.get(`/analytics/bookmark/${id}`);
export const getAllCategoriesAnalytics = () => api.get('/analytics/categories');
export const getWeakestBookmarks = (limit) => api.get('/analytics/weakest', { params: { limit } });
export const getReviewStats = () => api.get('/analytics/reviews');

// Insights
export const getInsights = () => api.get('/insights');
export const getCategoryInsights = (id) => api.get(`/insights/category/${id}`);
export const getBookmarkInsights = (id) => api.get(`/insights/bookmark/${id}`);

// AI Generation
export const generateSummary = (bookmarkId, type = 'summary') =>
    api.post('/ai/generate-summary', { bookmarkId, type });
export const generateQuestions = (bookmarkId, types, count) =>
    api.post('/ai/generate-questions', { bookmarkId, types, count });
export const regenerateContent = (bookmarkId, type) =>
    api.post('/ai/regenerate', { bookmarkId, type });
export const getAIStatus = () => api.get('/ai/status');

export default api;
