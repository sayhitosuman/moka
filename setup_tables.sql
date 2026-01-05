-- --- SUPABASE DATABASE SCHEMA ---
-- Run these in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. PROFILES (Extending auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    email TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. FRIENDSHIPS
CREATE TABLE IF NOT EXISTS public.friendships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(sender_id, receiver_id)
);

-- 3. FOLLOWS
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(follower_id, following_id)
);

-- 4. STREAM (Posts/Threads)
CREATE TABLE IF NOT EXISTS public.stream (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id TEXT DEFAULT 'stream', -- categorization
    parent_id UUID REFERENCES public.stream(id) ON DELETE CASCADE,
    title TEXT,
    text TEXT NOT NULL,
    author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name TEXT,
    media_url TEXT,
    media_type TEXT, -- 'image' | 'video'
    space_id UUID REFERENCES public.spaces(id) ON DELETE SET NULL, -- Reference to spaces if applicable
    likes INTEGER DEFAULT 0,
    location TEXT,
    tags TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. POST VOTES
CREATE TABLE IF NOT EXISTS public.post_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.stream(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    value INTEGER CHECK (value IN (1, -1)), -- 1 for upvote, -1 for downvote
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(post_id, user_id)
);

-- 6. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'friend_request', 'friend_accept', 'reply', 'vote_up', etc.
    from_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT false,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. MESSAGES (DM & Groups)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    group_id UUID, -- For group chats
    text TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. SPACES (Groups/Pages)
CREATE TABLE IF NOT EXISTS public.spaces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    handle TEXT UNIQUE NOT NULL,
    description TEXT,
    type TEXT CHECK (type IN ('group', 'page')),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    avatar_url TEXT,
    banner_url TEXT, -- Wallpaper/Background
    is_private BOOLEAN DEFAULT false,
    member_count INTEGER DEFAULT 0,
    follower_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. SPACE MEMBERS
CREATE TABLE IF NOT EXISTS public.space_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    space_id UUID REFERENCES public.spaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin', 'owner')),
    status TEXT DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(space_id, user_id)
);

-- --- ENABLE ROW LEVEL SECURITY (RLS) ---
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;

-- --- BASIC RLS POLICIES ---

-- Profiles: Public can see, users can update own
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Friendships: Only involved users can see/update
CREATE POLICY "Users can view their own friendships" ON public.friendships FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send friend requests" ON public.friendships FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update their received friend requests" ON public.friendships FOR UPDATE USING (auth.uid() = receiver_id);
CREATE POLICY "Users can delete own friendships" ON public.friendships FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Stream: Everyone can view, logged in can post
CREATE POLICY "Stream is public" ON public.stream FOR SELECT USING (true);
CREATE POLICY "Authenticated users can post" ON public.stream FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Owners can delete posts" ON public.stream FOR DELETE USING (auth.uid() = author_id);

-- Notifications: Users see own
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Internal system can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Add similar policies for others if needed...
-- Spaces: Everyone can view, users can create, owners/admins can update
CREATE POLICY "Spaces are viewable by everyone" ON public.spaces FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create spaces" ON public.spaces FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Owners and admins can update spaces" ON public.spaces FOR UPDATE USING (
    auth.uid() = owner_id 
    OR 
    EXISTS (
        SELECT 1 FROM public.space_members 
        WHERE space_id = public.spaces.id 
        AND user_id = auth.uid() 
        AND role = 'admin'
    )
);

-- Space Members: Everyone can view, authenticated can join, admins can update
CREATE POLICY "Space membership is viewable by everyone" ON public.space_members FOR SELECT USING (true);
CREATE POLICY "Users can join spaces" ON public.space_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admins can respond to membership requests" ON public.space_members FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.spaces
        WHERE id = space_members.space_id
        AND owner_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.space_members sm
        WHERE sm.space_id = space_members.space_id
        AND sm.user_id = auth.uid()
        AND sm.role = 'admin'
    )
);
CREATE POLICY "Users can leave spaces" ON public.space_members FOR DELETE USING (auth.uid() = user_id);
