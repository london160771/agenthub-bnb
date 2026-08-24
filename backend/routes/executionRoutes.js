import { Router } from 'express';
import {
  postExecution,
  postExecutionRun,
  getExecution,
} from '../controllers/executionController.js';

const router = Router();

router.post('/', postExecution);
router.post('/:executionId/run', postExecutionRun);
router.get('/:executionId', getExecution);

export default router;
