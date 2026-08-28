import { Router } from 'express';
import { postFinder, getFinder } from '../controllers/finderController.js';

const router = Router();

router.post('/', postFinder);
router.get('/', getFinder);

export default router;
