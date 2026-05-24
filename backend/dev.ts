import 'dotenv/config';
import { serve } from '@hono/node-server';
import { app } from './api/index.js';

const port = 3000;
console.log(`Starting Hono backend server on port ${port}...`);

serve({
  fetch: app.fetch,
  port
});
