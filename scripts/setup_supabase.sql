-- SUPABASE SCHEMA FOR STREAM
-- Run this in the Supabase SQL Editor

-- 1. Profiles Table
CREATE TABLE profiles (
    uid UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    display_name TEXT UNIQUE,
    full_name TEXT,
    photo_url TEXT,
    banner_url TEXT,
    bio TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE,
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    friend_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Spaces Table
CREATE TABLE spaces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    handle TEXT UNIQUE NOT NULL,
    description TEXT,
    type TEXT CHECK (type IN ('group', 'page')),
    owner_id UUID REFERENCES auth.users ON DELETE CASCADE,
    avatar_url TEXT,
    banner_url TEXT,
    member_count INTEGER DEFAULT 0,
    follower_count INTEGER DEFAULT 0,
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Posts/Comments Table
CREATE TABLE posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    title TEXT,
    text TEXT NOT NULL,
    author_id UUID REFERENCES auth.users ON DELETE CASCADE,
    author_name TEXT,
    author_photo TEXT,
    media_url TEXT,
    media_type TEXT CHECK (media_type IN ('image', 'video')),
    likes INTEGER DEFAULT 0,
    space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
    space_handle TEXT,
    location TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Votes Table
CREATE TABLE votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    value INTEGER CHECK (value IN (-1, 1)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- 5. Notifications
CREATE TABLE notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    type TEXT NOT NULL,
    from_id UUID REFERENCES auth.users ON DELETE CASCADE,
    from_name TEXT,
    from_photo TEXT,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Messages
CREATE TABLE messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES auth.users ON DELETE CASCADE,
    receiver_id UUID REFERENCES auth.users ON DELETE CASCADE,
    group_id UUID, -- For future group chat
    text TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Network/Friends
CREATE TABLE friends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    friend_id UUID REFERENCES auth.users ON DELETE CASCADE,
    status TEXT CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, friend_id)
);

-- 8. Space Members
CREATE TABLE space_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    role TEXT CHECK (role IN ('member', 'admin', 'owner')),
    status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(space_id, user_id)
);

-- 9. Followers (for Pages)
CREATE TABLE followers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    target_id UUID REFERENCES auth.users ON DELETE CASCADE, -- Can be a user or a space page
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, target_id)
);

-- 10. Chat Groups
CREATE TABLE chat_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users ON DELETE CASCADE,
    avatar_url TEXT,
    member_count INTEGER DEFAULT 1,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Chat Group Members
CREATE TABLE chat_group_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES chat_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_id, user_id)
);

-- RLS POLICIES (Simplified for now - Enable RLS and add policies as needed)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = uid);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts are viewable by everyone" ON posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Authors can update/delete own posts" ON posts FOR ALL USING (true);

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Votes are viewable by everyone" ON votes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can vote" ON votes FOR ALL USING (true);

ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own friends" ON friends FOR SELECT USING (true);
CREATE POLICY "Users can insert friend requests" ON friends FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own friend status" ON friends FOR UPDATE USING (true);

ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Spaces are viewable by everyone" ON spaces FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create spaces" ON spaces FOR INSERT WITH CHECK (true);

ALTER TABLE space_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Memberships are viewable by everyone" ON space_members FOR SELECT USING (true);
CREATE POLICY "Users can join spaces" ON space_members FOR INSERT WITH CHECK (true);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (true);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (true);

ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public groups are viewable by everyone" ON chat_groups FOR SELECT USING (is_public = true);
CREATE POLICY "Users can create groups" ON chat_groups FOR INSERT WITH CHECK (auth.role() = 'authenticated');

ALTER TABLE chat_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group memberships are viewable by everyone" ON chat_group_members FOR SELECT USING (true);
CREATE POLICY "Users can join groups" ON chat_group_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Storage bucket for media
-- You'll need to create a bucket named 'media' in the Supabase Dashboard

-- 12. AUTOMATIC PROFILE TRIGGER
-- This ensures every user gets a profile even if the frontend fails to insert it.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (uid, display_name, full_name, is_anonymous)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'display_name', 'User_' || substr(new.id::text, 1, 5)),
    COALESCE(new.raw_user_meta_data->>'full_name', 'New Member'),
    false
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
