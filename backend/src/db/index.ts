import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });

let schemaReady: Promise<void> | null = null;

export const ensureDatabaseSchema = async () => {
  schemaReady ??= (async () => {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY NOT NULL,
        display_name text NOT NULL,
        full_name text,
        photo_url text,
        banner_url text,
        bio text,
        is_anonymous integer DEFAULT false,
        followers_count integer DEFAULT 0,
        following_count integer DEFAULT 0,
        friend_count integer DEFAULT 0,
        created_at integer DEFAULT (strftime('%s', 'now'))
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS posts (
        id text PRIMARY KEY NOT NULL,
        parent_id text,
        title text,
        text text NOT NULL,
        author_id text NOT NULL,
        created_at integer DEFAULT (strftime('%s', 'now')),
        media_url text,
        media_type text,
        media_items text,
        space_id text,
        space_handle text,
        location text,
        tags text,
        likes integer DEFAULT 0,
        FOREIGN KEY (author_id) REFERENCES users(id)
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS post_votes (
        id text PRIMARY KEY NOT NULL,
        post_id text NOT NULL,
        user_id text NOT NULL,
        vote integer NOT NULL,
        created_at integer DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (post_id) REFERENCES posts(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS spaces (
        id text PRIMARY KEY NOT NULL,
        name text NOT NULL,
        handle text NOT NULL UNIQUE,
        description text,
        type text NOT NULL,
        owner_id text NOT NULL,
        avatar_url text,
        banner_url text,
        is_private integer DEFAULT false,
        member_count integer DEFAULT 1,
        follower_count integer DEFAULT 0,
        created_at integer DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (owner_id) REFERENCES users(id)
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS space_members (
        id text PRIMARY KEY NOT NULL,
        space_id text NOT NULL,
        user_id text NOT NULL,
        role text NOT NULL,
        status text NOT NULL,
        joined_at integer DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (space_id) REFERENCES spaces(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
  })();

  return schemaReady;
};
