import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { app } from './api/index.js';

const port = 3000;
console.log(`Starting Hono backend server on port ${port}...`);

// Match Vercel URL layout: /api/health, /api/posts, etc.
const root = new Hono();
root.route('/api', app);

serve({
  fetch: root.fetch,
  port
});
