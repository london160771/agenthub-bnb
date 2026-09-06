import { Router } from 'express';
import { postPaymentConfirmation, postPaymentPreparation } from '../controllers/paymentController.js';

const router = Router();

router.post('/prepare', postPaymentPreparation);
router.post('/:executionId/confirm', postPaymentConfirmation);

export default router;
