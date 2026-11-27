import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireProvider } from '../middleware/provider.js';
import providerListingsRouter from './providerListings.js';
import providerRequestsRouter from './providerRequests.js';
import providerAppointmentsRouter from './providerAppointments.js';

const router = Router();

router.use(requireAuth, requireProvider);

router.get('/profile', (request, response) => {
  response.json({ data: request.provider });
});

router.use(providerListingsRouter);
router.use(providerRequestsRouter);
router.use(providerAppointmentsRouter);

export default router;
