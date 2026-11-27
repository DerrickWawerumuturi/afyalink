import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireProvider } from '../middleware/provider.js';
import providerListingsRouter from './providerListings.js';
import providerRequestsRouter from './providerRequests.js';

const router = Router();

router.use(requireAuth, requireProvider);
router.use(providerListingsRouter);
router.use(providerRequestsRouter);

export default router;
