import { Router } from 'express';
import insightEngine from '../services/insightEngine.js';

const router = Router();

// Get all insights
router.get('/', async (req, res, next) => {
    try {
        const insights = await insightEngine.generateInsights();
        res.json(insights);
    } catch (error) {
        next(error);
    }
});

// Get category-specific insights
router.get('/category/:id', async (req, res, next) => {
    try {
        const insights = await insightEngine.getCategoryInsights(req.params.id);
        res.json(insights);
    } catch (error) {
        next(error);
    }
});

// Get bookmark-specific insights
router.get('/bookmark/:id', async (req, res, next) => {
    try {
        const insights = await insightEngine.getBookmarkInsights(req.params.id);
        res.json(insights);
    } catch (error) {
        next(error);
    }
});

export default router;
