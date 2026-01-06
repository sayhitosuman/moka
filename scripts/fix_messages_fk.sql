-- FIX: Add foreign key from messages to profiles
-- This allows Supabase to properly join sender details in group chats
-- Run this in your Supabase SQL Editor

ALTER TABLE messages
DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

ALTER TABLE messages
ADD CONSTRAINT messages_sender_id_fkey 
FOREIGN KEY (sender_id) 
REFERENCES profiles(uid) 
ON DELETE CASCADE;

-- Also fix chat_group_members if not already done
ALTER TABLE chat_group_members
DROP CONSTRAINT IF EXISTS chat_group_members_user_id_fkey;

ALTER TABLE chat_group_members
ADD CONSTRAINT chat_group_members_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES profiles(uid) 
ON DELETE CASCADE;
