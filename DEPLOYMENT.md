# Deployment

This app is split into two deploys:

- Frontend: Vite/React on Firebase Hosting
- Backend: Hono API on Vercel

## 1. Backend on Vercel

Create these environment variables in the Vercel project:

```env
CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Use `backend` as the Vercel project root directory.

Build command:

```sh
npm run build
```

Deploy command:

```sh
vercel --prod
```

After deploy, test:

```text
https://your-backend.vercel.app/api/health
```

## 2. Database Schema

From the `backend` directory, after setting Turso environment variables:

```sh
npm run db:push
```

## 3. Frontend on Firebase Hosting

Create frontend environment variables locally and in your hosting build setup:

```env
VITE_CLERK_PUBLISHABLE_KEY=
VITE_API_URL=https://your-backend.vercel.app
```

Build and deploy:

```sh
npm run build
firebase deploy --only hosting
```

Firebase uses `firebase.json`, which publishes the `dist` folder.

## 4. Clerk URLs

In Clerk, allow the final Firebase frontend URL and point the Clerk webhook to:

```text
https://your-backend.vercel.app/api/webhooks/clerk
```
