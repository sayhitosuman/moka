-- Fix for "Failed to load members" error
-- Run this in Supabase SQL Editor

-- First, check what policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'chat_group_members';

-- Drop and recreate the SELECT policy to ensure it works
DROP POLICY IF EXISTS "Group memberships are viewable by everyone" ON chat_group_members;

CREATE POLICY "Group memberships are viewable by everyone" 
ON chat_group_members 
FOR SELECT 
USING (true);

-- Also ensure INSERT policy exists for joining groups
DROP POLICY IF EXISTS "Users can join groups" ON chat_group_members;

CREATE POLICY "Users can join groups" 
ON chat_group_members 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Verify the policies were created
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'chat_group_members';
