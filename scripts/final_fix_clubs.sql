-- FINAL COMPREHENSIVE FIX FOR CLUBS
-- Run this in your Supabase SQL Editor to fix ALL errors

-- 1. Fix Relationship Error (PGRST200)
-- This links chat members to profiles so names can load
ALTER TABLE chat_group_members
DROP CONSTRAINT IF EXISTS chat_group_members_user_id_fkey;

ALTER TABLE chat_group_members
ADD CONSTRAINT chat_group_members_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES profiles(uid) 
ON DELETE CASCADE;

-- 2. Add Role Support
ALTER TABLE chat_group_members 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin', 'owner'));

-- 3. Assign Founder Status to creators
UPDATE chat_group_members
SET role = 'owner'
FROM chat_groups
WHERE chat_group_members.group_id = chat_groups.id
AND chat_group_members.user_id = chat_groups.created_by;

-- 4. Secure the Club settings
DROP POLICY IF EXISTS "Admins can update groups" ON chat_groups;
CREATE POLICY "Admins can update groups" ON chat_groups 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM chat_group_members cgm 
    WHERE cgm.group_id = chat_groups.id 
    AND cgm.user_id = auth.uid() 
    AND cgm.role IN ('admin', 'owner')
  )
);

-- 5. Secure Member management
DROP POLICY IF EXISTS "Users can join/add members to groups" ON chat_group_members;
CREATE POLICY "Users can join/add members to groups" ON chat_group_members 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM chat_group_members cgm 
    WHERE cgm.group_id = chat_group_members.group_id 
    AND cgm.user_id = auth.uid() 
    AND cgm.role IN ('admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Admins can update member roles" ON chat_group_members;
CREATE POLICY "Admins can update member roles" ON chat_group_members 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM chat_group_members cgm 
    WHERE cgm.group_id = chat_group_members.group_id 
    AND cgm.user_id = auth.uid() 
    AND cgm.role IN ('admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Admins can remove members" ON chat_group_members;
CREATE POLICY "Admins can remove members" ON chat_group_members 
FOR DELETE 
USING (
  auth.uid() = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM chat_group_members cgm 
    WHERE cgm.group_id = chat_group_members.group_id 
    AND cgm.user_id = auth.uid() 
    AND cgm.role IN ('admin', 'owner')
  )
);
