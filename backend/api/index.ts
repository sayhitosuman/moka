import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';

const newId = () => crypto.randomUUID();

// Vercel may invoke with /health, /api/health, or odd paths like /api/health.
const api = new Hono();
const secured = new Hono();

const ensureUser = async (userId: string) => {
  const { db, ensureDatabaseSchema } = await import('../src/db/index.js');
  const { users } = await import('../src/db/schema.js');

  await ensureDatabaseSchema();
  await db.insert(users).values({
    id: userId,
    displayName: 'User',
  }).onConflictDoNothing();
};

const getRequestAuth = async (c: any) => {
  const { getAuth } = await import('@hono/clerk-auth');
  return getAuth(c);
};

const toMillis = (value: unknown) => {
  if (!value) return Date.now();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value < 10_000_000_000 ? value * 1000 : value;
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
};

const toStringArray = (value: unknown) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const errorMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;
  return String(err);
};

const fullErrorMessage = (err: unknown) => {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as Error & { cause?: unknown }).cause;
  return cause ? `${err.message}\nCause: ${errorMessage(cause)}` : err.message;
};

// Middleware to parse JSON
api.use('*', async (c, next) => {
  // CORS configuration
  c.header('Access-Control-Allow-Origin', '*'); // Update in production to your domain
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }
  
  await next();
});

// Health Check
api.get('/health', (c) => c.json({ status: 'ok', message: 'Hono Backend is running!' }));

api.get('/diagnostics/env', (c) => c.json({
  clerkPublishableKey: Boolean(process.env.CLERK_PUBLISHABLE_KEY),
  clerkSecretKey: Boolean(process.env.CLERK_SECRET_KEY),
  tursoDatabaseUrl: Boolean(process.env.TURSO_DATABASE_URL),
  tursoAuthToken: Boolean(process.env.TURSO_AUTH_TOKEN),
  cloudinaryCloudName: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
  cloudinaryApiKey: Boolean(process.env.CLOUDINARY_API_KEY),
  cloudinaryApiSecret: Boolean(process.env.CLOUDINARY_API_SECRET),
}));

api.get('/diagnostics/db', async (c) => {
  try {
    const { db, ensureDatabaseSchema } = await import('../src/db/index.js');

    await ensureDatabaseSchema();
    await db.query.users.findMany({ limit: 1 });
    await db.query.posts.findMany({ limit: 1 });

    return c.json({ status: 'ok', message: 'Database query succeeded' });
  } catch (err) {
    console.error('Database diagnostics failed:', err);
    return c.json({ status: 'error', message: fullErrorMessage(err) }, 500);
  }
});

// Webhook from Clerk to create user in Turso (no auth middleware)
api.post('/webhooks/clerk', async (c) => {
  const body = await c.req.json();

  if (body.type === 'user.created') {
    const data = body.data;
    try {
      const { db, ensureDatabaseSchema } = await import('../src/db/index.js');
      const { users } = await import('../src/db/schema.js');

      await ensureDatabaseSchema();
      await db.insert(users).values({
        id: data.id,
        displayName: data.username || data.first_name || 'Anonymous',
        fullName: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
        photoUrl: data.image_url,
      });
      return c.json({ success: true });
    } catch (e) {
      console.error(e);
      return c.json({ error: 'Failed to insert user' }, 500);
    }
  }

  return c.json({ success: true });
});

// Clerk only on secured routes (never runs for /health)
secured.use('*', async (c, next) => {
  try {
    const { clerkMiddleware } = await import('@hono/clerk-auth');
    return clerkMiddleware()(c, next);
  } catch (err) {
    console.error('Clerk middleware failed:', err);
    return c.json({ error: 'Authentication middleware failed', message: errorMessage(err) }, 500);
  }
});

// --- Users ---
secured.get('/users/me', async (c) => {
  const auth = await getRequestAuth(c);
  if (!auth?.userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const { db, ensureDatabaseSchema } = await import('../src/db/index.js');
    const { users } = await import('../src/db/schema.js');

    await ensureDatabaseSchema();
    const user = await db.query.users.findFirst({
      where: eq(users.id, auth.userId),
    });

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    return c.json(user);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

// --- Storage (Cloudinary) ---
secured.post('/storage/signature', async (c) => {
  const auth = await getRequestAuth(c);
  if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

  const timestamp = Math.round((new Date()).getTime() / 1000);
  
  try {
    const { v2: cloudinary } = await import('cloudinary');

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const signature = cloudinary.utils.api_sign_request({
      timestamp: timestamp,
      folder: 'streamweb', // Puts all uploads in a folder
    }, process.env.CLOUDINARY_API_SECRET!);

    return c.json({ 
      timestamp, 
      signature, 
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY 
    });
  } catch (err) {
    console.error('Error generating signature:', err);
    return c.json({ error: 'Failed to generate signature' }, 500);
  }
});

// --- POSTS ---
secured.get('/posts', async (c) => {
  try {
    const { db, ensureDatabaseSchema } = await import('../src/db/index.js');
    const { posts } = await import('../src/db/schema.js');

    await ensureDatabaseSchema();
    const allPosts = await db.query.posts.findMany({
      orderBy: [desc(posts.createdAt)],
      limit: 50,
      with: {
        author: true
      }
    });
    
    // Map to frontend Comment structure
    const mapped = allPosts.map(p => ({
      id: p.id,
      postId: p.parentId || 'stream',
      parentId: p.parentId,
      text: p.text,
      authorId: p.authorId,
      authorName: (p as any).author?.displayName || 'Unknown',
      authorPhoto: (p as any).author?.photoUrl,
      createdAt: toMillis(p.createdAt),
      children: [],
      likes: p.likes || 0,
      mediaUrl: p.mediaUrl,
      mediaType: p.mediaType,
      mediaItems: p.mediaItems || undefined,
      title: p.title,
      spaceId: p.spaceId,
      spaceHandle: p.spaceHandle,
      location: p.location,
      tags: toStringArray(p.tags),
    }));

    return c.json(mapped);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to fetch posts', message: errorMessage(err) }, 500);
  }
});

secured.post('/posts', async (c) => {
  const auth = await getRequestAuth(c);
  if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const { db, ensureDatabaseSchema } = await import('../src/db/index.js');
    const { posts } = await import('../src/db/schema.js');
    const body = await c.req.json();
    const newPostId = newId();
    await ensureDatabaseSchema();
    await ensureUser(auth.userId);
    await db.insert(posts).values({
      id: newPostId,
      text: body.text,
      authorId: auth.userId,
      title: body.title,
      mediaUrl: body.mediaUrl,
      mediaType: body.mediaType,
      spaceId: body.spaceId,
      spaceHandle: body.spaceHandle,
      location: body.location,
      tags: body.tags ? JSON.stringify(body.tags) : null,
      parentId: body.parentId,
    });
    return c.json({ success: true, id: newPostId });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to create post', message: errorMessage(err) }, 500);
  }
});

secured.post('/posts/:id/vote', async (c) => {
  const auth = await getRequestAuth(c);
  if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const { db, ensureDatabaseSchema } = await import('../src/db/index.js');
    const { posts, postVotes } = await import('../src/db/schema.js');
    const postId = c.req.param('id');
    const body = await c.req.json(); // { value: 1 or -1 }
    await ensureDatabaseSchema();
    
    // Check existing vote
    const existing = await db.query.postVotes.findFirst({
      where: (votes, { eq, and }) => and(eq(votes.postId, postId), eq(votes.userId, auth.userId))
    });

    if (existing) {
      if (existing.vote === body.value) {
        // Remove vote
        await db.delete(postVotes).where(eq(postVotes.id, existing.id));
      } else {
        // Change vote
        // Note: SQLite update needs raw sql for atomic updates or separate transactions.
      }
    } else {
      // Add vote
      await db.insert(postVotes).values({
        id: newId(),
        postId,
        userId: auth.userId,
        vote: body.value,
      });
    }

    // Recalculate likes (simplified)
    const allVotes = await db.query.postVotes.findMany({ where: eq(postVotes.postId, postId) });
    const total = allVotes.reduce((sum, v) => sum + v.vote, 0);
    
    // In drizzle sqlite, we just do a raw update or use the query builder
    await db.update(posts).set({ likes: total }).where(eq(posts.id, postId));

    return c.json({ success: true, likes: total });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to vote' }, 500);
  }
});

// --- SPACES ---
secured.get('/spaces', async (c) => {
  try {
    const { db, ensureDatabaseSchema } = await import('../src/db/index.js');

    await ensureDatabaseSchema();
    const allSpaces = await db.query.spaces.findMany();
    return c.json(allSpaces);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to fetch spaces' }, 500);
  }
});

secured.post('/spaces', async (c) => {
  const auth = await getRequestAuth(c);
  if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const { db, ensureDatabaseSchema } = await import('../src/db/index.js');
    const { spaces, spaceMembers } = await import('../src/db/schema.js');
    const body = await c.req.json();
    const newSpaceId = newId();
    await ensureDatabaseSchema();
    await ensureUser(auth.userId);
    
    await db.insert(spaces).values({
      id: newSpaceId,
      name: body.name,
      handle: body.handle,
      description: body.description,
      type: body.type || 'group',
      ownerId: auth.userId,
      isPrivate: body.isPrivate || false,
    });

    // Add owner as member
    await db.insert(spaceMembers).values({
      id: newId(),
      spaceId: newSpaceId,
      userId: auth.userId,
      role: 'owner',
      status: 'accepted',
    });

    return c.json({ success: true, id: newSpaceId });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to create space' }, 500);
  }
});

secured.post('/spaces/:id/join', async (c) => {
  const auth = await getRequestAuth(c);
  if (!auth?.userId) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const { db, ensureDatabaseSchema } = await import('../src/db/index.js');
    const { spaceMembers } = await import('../src/db/schema.js');
    const spaceId = c.req.param('id');
    const body = await c.req.json(); // { isPrivate: boolean }
    await ensureDatabaseSchema();
    await ensureUser(auth.userId);
    
    await db.insert(spaceMembers).values({
      id: newId(),
      spaceId,
      userId: auth.userId,
      role: 'member',
      status: body.isPrivate ? 'pending' : 'accepted',
    });

    return c.json({ success: true });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Failed to join space' }, 500);
  }
});

api.route('/', secured);

const app = new Hono();
app.route('/api', api);
app.route('/', api);

export { app, api, secured };
// Vercel Hono: export the app directly (not handle()) so responses are sent correctly
export default app;
