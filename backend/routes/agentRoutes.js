import { Router } from 'express';
import { getAgents, getAgent, getAgentFacets } from '../controllers/agentController.js';

const router = Router();

// Static routes before the parameterised one so "facets" isn't read as an id.
router.get('/', getAgents);
router.get('/facets', getAgentFacets);
router.get('/:agentId', getAgent);

export default router;
