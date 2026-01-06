-- FIX RLS POLICIES FOR SPACES AND MEMBERS
-- Run this in your Supabase SQL Editor

-- 1. Space Members Policies
ALTER TABLE space_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Memberships are viewable by everyone" ON space_members;
CREATE POLICY "Memberships are viewable by everyone" ON space_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join spaces" ON space_members;
DROP POLICY IF EXISTS "Users can join/add members" ON space_members;
CREATE POLICY "Users can join/add members" ON space_members FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update memberships" ON space_members;
CREATE POLICY "Admins can update memberships" ON space_members 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM space_members sm 
    WHERE sm.space_id = space_members.space_id 
    AND sm.user_id = auth.uid() 
    AND sm.role IN ('admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Admins can delete memberships" ON space_members;
CREATE POLICY "Admins can delete memberships" ON space_members 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM space_members sm 
    WHERE sm.space_id = space_members.space_id 
    AND sm.user_id = auth.uid() 
    AND sm.role IN ('admin', 'owner')
  )
);

-- 2. Spaces Update Policy
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can update spaces" ON spaces;
CREATE POLICY "Admins can update spaces" ON spaces 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM space_members sm 
    WHERE sm.space_id = spaces.id 
    AND sm.user_id = auth.uid() 
    AND sm.role IN ('admin', 'owner')
  )
);

-- 3. Profiles Update Policy (ensure it's restrictive)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = uid);

-- 4. Chat Group Members Policies
ALTER TABLE chat_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group memberships are viewable by everyone" ON chat_group_members;
CREATE POLICY "Group memberships are viewable by everyone" ON chat_group_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join groups" ON chat_group_members;
DROP POLICY IF EXISTS "Users can join/add members to groups" ON chat_group_members;
CREATE POLICY "Users can join/add members to groups" ON chat_group_members 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id -- Self join
  OR 
  EXISTS (
    SELECT 1 FROM chat_groups 
    WHERE id = chat_group_members.group_id 
    AND created_by = auth.uid() -- Owner adds others
  )
);

DROP POLICY IF EXISTS "Owners can remove group members" ON chat_group_members;
CREATE POLICY "Owners can remove group members" ON chat_group_members 
FOR DELETE 
USING (
  auth.uid() = user_id -- Self leave
  OR 
  EXISTS (
    SELECT 1 FROM chat_groups 
    WHERE id = chat_group_members.group_id 
    AND created_by = auth.uid() -- Owner kicks
  )
);
