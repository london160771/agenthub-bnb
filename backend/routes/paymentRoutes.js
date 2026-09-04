import { Router } from 'express';
import { postPaymentPreparation } from '../controllers/paymentController.js';

const router = Router();

router.post('/prepare', postPaymentPreparation);

export default router;
