-- Fix: Add missing foreign key relationship
-- This is why members aren't loading!

-- Add foreign key constraint from chat_group_members to profiles
ALTER TABLE chat_group_members
ADD CONSTRAINT chat_group_members_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES profiles(uid) 
ON DELETE CASCADE;

-- Verify the constraint was added
SELECT
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'chat_group_members' 
  AND tc.constraint_type = 'FOREIGN KEY';
