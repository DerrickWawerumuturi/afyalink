import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireProvider } from '../middleware/provider.js';
import providerListingsRouter from './providerListings.js';

const router = Router();

router.use(requireAuth, requireProvider);
router.use(providerListingsRouter);

export default router;
