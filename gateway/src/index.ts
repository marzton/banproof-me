import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { tollBoothMiddleware } from './middleware/tollBooth.js';

const app = new Hono();

// Testing public route vs private route
app.get('/public/milestones', (c) => {
  return c.json({ message: 'Public milestones data', status: 'unrestricted' });
});

// Protect all /api/ endpoints with the Toll Booth
app.use('/api/*', tollBoothMiddleware);

app.post('/api/verify', async (c) => {
  const body = await c.req.json();
  return c.json({ message: 'Payload verified and logged', data: body });
});

app.get('/api/data/goldshore', (c) => {
  return c.json({ 
    message: 'Gold Shore logic execution success',
    data: { drsScore: 85, recommendation: 'Approve' } 
  });
});

app.get('/api/status', (c) => {
  // This route is protected by the tollBoothMiddleware.
  // We can access the poaScore that was set in the middleware.
  const poaScore = c.get('poaScore');
  return c.json({
    message: 'Gateway status: Operational',
    poaScore: poaScore ?? 'N/A',
  });
});

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Toll Booth Gateway running at http://localhost:${info.port}`);
});
