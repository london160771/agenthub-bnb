import { Router } from 'express';
import {
  postExecutionPreparation,
  postExecution,
  postExecutionRun,
  getExecution,
} from '../controllers/executionController.js';

const router = Router();

router.post('/prepare', postExecutionPreparation);
router.post('/', postExecution);
router.post('/:executionId/run', postExecutionRun);
router.get('/:executionId', getExecution);

export default router;
