import { Router } from 'express';
import { postExecution, getExecution } from '../controllers/executionController.js';

const router = Router();

router.post('/', postExecution);
router.get('/:executionId', getExecution);

export default router;
