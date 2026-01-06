-- Add UPDATE policy for chat_groups
-- This allows members to update group details

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Members can update groups" ON chat_groups;

-- Create new UPDATE policy
CREATE POLICY "Members can update groups" ON chat_groups 
FOR UPDATE 
USING (
  auth.uid() IN (
    SELECT user_id 
    FROM chat_group_members 
    WHERE group_id = chat_groups.id
  )
);

-- Also ensure all groups are viewable (not just public ones)
DROP POLICY IF EXISTS "Public groups are viewable by everyone" ON chat_groups;
CREATE POLICY "Groups are viewable by members" ON chat_groups 
FOR SELECT 
USING (
  is_public = true 
  OR auth.uid() IN (
    SELECT user_id 
    FROM chat_group_members 
    WHERE group_id = chat_groups.id
  )
);
