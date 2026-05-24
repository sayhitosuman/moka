import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // Clerk user ID
  displayName: text('display_name').notNull(),
  fullName: text('full_name'),
  photoUrl: text('photo_url'),
  bannerUrl: text('banner_url'),
  bio: text('bio'),
  isAnonymous: integer('is_anonymous', { mode: 'boolean' }).default(false),
  followersCount: integer('followers_count').default(0),
  followingCount: integer('following_count').default(0),
  friendCount: integer('friend_count').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const friends = sqliteTable('friends', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  friendId: text('friend_id').notNull().references(() => users.id),
  status: text('status').notNull(), // 'pending', 'accepted'
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  parentId: text('parent_id'), // Self-referential for comments
  title: text('title'),
  text: text('text').notNull(),
  authorId: text('author_id').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
  mediaUrl: text('media_url'),
  mediaType: text('media_type'), // 'image' | 'video'
  mediaItems: text('media_items', { mode: 'json' }), // stringified array
  spaceId: text('space_id'),
  spaceHandle: text('space_handle'),
  location: text('location'),
  tags: text('tags', { mode: 'json' }), // stringified array
  likes: integer('likes').default(0),
});

export const postVotes = sqliteTable('post_votes', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => posts.id),
  userId: text('user_id').notNull().references(() => users.id),
  vote: integer('vote').notNull(), // 1 or -1
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const chatGroups = sqliteTable('chat_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdBy: text('created_by').notNull().references(() => users.id),
  avatarUrl: text('avatar_url'),
  memberCount: integer('member_count').default(1),
  isPublic: integer('is_public', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const chatGroupMembers = sqliteTable('chat_group_members', {
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull().references(() => chatGroups.id),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role').notNull(), // 'member' | 'admin' | 'owner'
  joinedAt: integer('joined_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  senderId: text('sender_id').notNull().references(() => users.id),
  receiverId: text('receiver_id').references(() => users.id),
  groupId: text('group_id').references(() => chatGroups.id),
  text: text('text').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const spaces = sqliteTable('spaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  handle: text('handle').notNull().unique(),
  description: text('description'),
  type: text('type').notNull(), // 'group' | 'page'
  ownerId: text('owner_id').notNull().references(() => users.id),
  avatarUrl: text('avatar_url'),
  bannerUrl: text('banner_url'),
  isPrivate: integer('is_private', { mode: 'boolean' }).default(false),
  memberCount: integer('member_count').default(1),
  followerCount: integer('follower_count').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const spaceMembers = sqliteTable('space_members', {
  id: text('id').primaryKey(),
  spaceId: text('space_id').notNull().references(() => spaces.id),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role').notNull(), // 'member' | 'admin' | 'owner'
  status: text('status').notNull(), // 'pending' | 'accepted' | 'blocked'
  joinedAt: integer('joined_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  fromId: text('from_id').notNull().references(() => users.id),
  data: text('data', { mode: 'json' }), // JSON payload
  isRead: integer('is_read', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
