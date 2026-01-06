-- ADD ROLE TO CHAT GROUP MEMBERS
-- Run this in your Supabase SQL Editor

-- 1. Add role column if it doesn't exist
ALTER TABLE chat_group_members 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin', 'owner'));

-- 2. Update existing owners (creators of groups)
UPDATE chat_group_members
SET role = 'owner'
FROM chat_groups
WHERE chat_group_members.group_id = chat_groups.id
AND chat_group_members.user_id = chat_groups.created_by;

-- 3. Update RLS for chat_groups
ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Owners can delete groups" ON chat_groups;
CREATE POLICY "Owners can delete groups" ON chat_groups 
FOR DELETE 
USING (
  created_by = auth.uid()
);

-- 4. Update RLS for chat_group_members
ALTER TABLE chat_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can join/add members to groups" ON chat_group_members;
CREATE POLICY "Users can join/add members to groups" ON chat_group_members 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id -- Self join (if allowed)
  OR 
  EXISTS (
    SELECT 1 FROM chat_group_members cgm 
    WHERE cgm.group_id = chat_group_members.group_id 
    AND cgm.user_id = auth.uid() 
    AND cgm.role IN ('admin', 'owner') -- Admin/Owner adds others
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
  auth.uid() = user_id -- Self leave
  OR 
  EXISTS (
    SELECT 1 FROM chat_group_members cgm 
    WHERE cgm.group_id = chat_group_members.group_id 
    AND cgm.user_id = auth.uid() 
    AND cgm.role IN ('admin', 'owner') -- Admin can remove others
  )
);
