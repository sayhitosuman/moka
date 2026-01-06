# 🐛 Debug Members Not Loading

## Quick Test

1. **Open browser console** (Press F12)
2. **Open a club** and click the club name
3. **Look for these logs**:

### Expected Console Output:
```
Loading members for group: [some-uuid]
fetchChatGroupMembers called with groupId: [same-uuid]
Raw chat_group_members data: [array of data]
Mapping member: {profiles: {...}}
Mapped members: [{uid: ..., displayName: ...}]
Loaded members: [array]
```

### If You See:
- ❌ **"Raw chat_group_members data: []"** or **"null"**
  - Problem: No members in database
  - **Solution**: The creator needs to be added to chat_group_members table

- ❌ **"Error fetching chat group members"**
  - Problem: Database permission issue
  - **Solution**: Check RLS policies

- ❌ **"Loaded members: []"**
  - Problem: Data exists but mapping failed
  - **Solution**: Check profile data structure

## Most Likely Issue: Creator Not Auto-Added

When you create a club, the creator should automatically be added as a member. Let me check if this is happening...

### Check Database Manually:

Run this in Supabase SQL Editor:
```sql
-- See all chat groups
SELECT * FROM chat_groups;

-- See all chat group members
SELECT * FROM chat_group_members;

-- See if YOUR user is in any groups
SELECT 
  cg.name as club_name,
  cgm.user_id,
  p.display_name
FROM chat_group_members cgm
JOIN chat_groups cg ON cg.id = cgm.group_id
JOIN profiles p ON p.uid = cgm.user_id;
```

### If No Members Show Up:

The `joinChatGroup` function should be called after creating a club, but it might not be working. Let me fix this...

## 🔧 What I'm Checking

1. Is `joinChatGroup` being called after `createChatGroup`?
2. Are there any errors in the console?
3. Is the RLS policy allowing inserts to `chat_group_members`?

**Please share the console output after opening a club!**
