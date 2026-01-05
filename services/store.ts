

import { createClient } from '@supabase/supabase-js';
import { Comment, UserProfile, ChatMessage, Space, AppNotification, FriendStatus, ChatGroup, ChatGroupMember, SpaceRole, SpaceMemberStatus } from '../types';

// --- PASTE YOUR SUPABASE CONFIG HERE ---
// 1. Go to Supabase Console -> Project Settings -> API
// 2. Copy "Project URL" and "anon" / "public" Key
const MANUAL_SUPABASE_CONFIG = {
  url: "https://qwzwrbfamrdydvtsjwip.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3endyYmZhbXJkeWR2dHNqd2lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzg2NTYsImV4cCI6MjA4MDg1NDY1Nn0.7ND33TthNCsFbuLADfe7_zg5hbcBJ71Wyt1fQk6UPHk"
};

// --- INITIALIZATION ---
let useMock = false;
let supabase: any;

try {
  // Priority: 1. Manual Config, 2. Environment Variables
  // @ts-ignore
  let config = (MANUAL_SUPABASE_CONFIG.url && MANUAL_SUPABASE_CONFIG.key) ? MANUAL_SUPABASE_CONFIG : null;

  if (!config) {
    // @ts-ignore
    const envUrl = typeof __supabase_url !== 'undefined' ? __supabase_url : process.env.SUPABASE_URL;
    // @ts-ignore
    const envKey = typeof __supabase_key !== 'undefined' ? __supabase_key : process.env.SUPABASE_KEY;

    if (envUrl && envKey) {
      config = { url: envUrl, key: envKey };
    }
  }

  if (config) {
    supabase = createClient(config.url, config.key, {
      auth: {
        persistSession: true, // Ensure session persists
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    console.log("Supabase initialized successfully");
  } else {
    throw new Error("No Supabase config found");
  }
} catch (e) {
  console.log("Using Mock Data (Supabase not configured)", e);
  useMock = true;
}

export const getIsMockMode = () => useMock;

// --- HELPER: Date Normalization ---
const normalizeDate = (isoString: string | any) => {
  if (!isoString) return new Date();
  const d = new Date(isoString);
  return {
    toDate: () => d,
    ...d
  };
};

// --- AUTH & PROFILES ---

export const subscribeToAuth = (callback: (user: UserProfile | null) => void) => {
  if (useMock) {
    // Default mock user
    setTimeout(() => {
      const isMockLoggedIn = localStorage.getItem('mock_logged_in') === 'true';
      if (isMockLoggedIn) {
        callback({
          uid: 'mock-user-real',
          displayName: localStorage.getItem('mock_username') || 'Dev_User',
          fullName: localStorage.getItem('mock_fullname') || 'Developer One',
          photoURL: localStorage.getItem('mock_photo') || undefined,
          bio: localStorage.getItem('mock_bio') || undefined,
          isAnonymous: false
        });
      } else {
        callback(null);
      }
    }, 500);
    return () => { };
  }

  const formatUser = (sessionUser: any): UserProfile => ({
    uid: sessionUser.id,
    displayName: sessionUser.user_metadata?.display_name || 'Reader',
    fullName: sessionUser.user_metadata?.full_name,
    photoURL: sessionUser.user_metadata?.avatar_url,
    bio: sessionUser.user_metadata?.bio,
    isAnonymous: sessionUser.is_anonymous || false
  });

  // Sync Supabase Auth Metadata with Public Profiles Table
  const syncProfile = async (user: any) => {
    try {
      // Check if profile exists first
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      const profileData = {
        username: user.user_metadata?.display_name,
        full_name: user.user_metadata?.full_name,
        avatar_url: user.user_metadata?.avatar_url,
        bio: user.user_metadata?.bio,
        email: user.email
      };

      if (existingProfile) {
        // UPDATE existing profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', user.id);

        if (updateError) {
          // If update fails due to RLS (unlikely for own profile) or other reasons
          if (!updateError.message.includes("security policy")) {
            console.warn("Profile sync (update) warning:", updateError.message);
          }
        }
      } else {
        // INSERT new profile
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            ...profileData
          });

        if (insertError) {
          // This often happens if a trigger already created the row, or RLS blocks insert.
          // We suppress RLS errors here because it likely means the system (trigger) handles creation.
          if (!insertError.message.includes("row-level security policy")) {
            console.warn("Profile sync (insert) warning:", insertError.message);
          }
        }
      }
    } catch (e) {
      console.warn("Profile sync error:", e);
    }
  };

  supabase.auth.getSession().then(({ data: { session } }: any) => {
    if (session?.user) {
      const basicUser = formatUser(session.user);
      callback(basicUser);
      // Background update with full profile info
      getPublicUserProfile(session.user.id).then(full => {
        if (full) callback(full);
      });
      syncProfile(session.user);
    } else {
      callback(null);
    }
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
    if (session?.user) {
      const basicUser = formatUser(session.user);
      callback(basicUser);
      getPublicUserProfile(session.user.id).then(full => {
        if (full) callback(full);
      });
      syncProfile(session.user);
    } else {
      callback(null);
    }
  });

  return () => subscription.unsubscribe();
};

export const loginAnonymously = async () => {
  if (useMock) return;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) console.error("Anonymous login failed:", error);
  return data;
};

export const checkUsernameAvailability = async (username: string): Promise<boolean> => {
  if (useMock) return true;

  // Use ilike for case-insensitive check
  const { count, error } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .ilike('username', username);

  if (error) {
    console.error("Error checking username:", error);
    // If error, we default to true to let Auth handle it
    return true;
  }

  return count === 0;
};

export const registerUser = async (email: string, pass: string, name: string) => {
  if (useMock) {
    localStorage.setItem('mock_logged_in', 'true');
    localStorage.setItem('mock_username', name);
    window.location.reload();
    return;
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: {
      data: {
        display_name: name,
        full_name: name,
        bio: "Just another creative soul wandering the digital garden."
      },
    },
  });
  if (error) throw error;
};

export const loginUser = async (identifier: string, pass: string) => {
  if (useMock) {
    localStorage.setItem('mock_logged_in', 'true');
    localStorage.setItem('mock_username', identifier.includes('@') ? 'Mock_User' : identifier);
    window.location.reload();
    return;
  }

  let emailToUse = identifier.trim();

  // If input is not an email (no '@'), treat as username and lookup email
  if (!emailToUse.includes('@')) {

    // STRATEGY 1: Direct Query (Most common for standard setups)
    // Attempt to find the email associated with the username in the public profiles table.
    // NOTE: This works if your 'profiles' table has RLS that allows reading 'email'.
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .ilike('username', emailToUse)
      .maybeSingle();

    if (data && data.email) {
      emailToUse = data.email;
    } else {
      // STRATEGY 2: Secure RPC (Best Practice / Fallback)
      // If direct query fails (e.g. RLS hides email), try a Secure RPC function if it exists.
      const { data: rpcEmail, error: rpcError } = await supabase.rpc('get_email_by_username', {
        username_input: emailToUse
      });

      if (!rpcError && rpcEmail) {
        emailToUse = rpcEmail;
      } else {
        // Both strategies failed
        console.warn("Username login failed. Direct query error:", error, "RPC error:", rpcError);
        throw new Error(`Username '${identifier}' not found. Please login with your Email.`);
      }
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailToUse,
    password: pass,
  });
  if (error) throw error;
};

export const logoutUser = async () => {
  if (useMock) {
    localStorage.removeItem('mock_logged_in');
    window.location.reload();
    return;
  }
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const updateUserProfile = async (photoURL: string, bio: string, fullName: string) => {
  if (useMock) {
    localStorage.setItem('mock_photo', photoURL);
    localStorage.setItem('mock_bio', bio);
    localStorage.setItem('mock_fullname', fullName);
    return;
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      avatar_url: photoURL,
      bio: bio,
      full_name: fullName
    }
  });

  if (!error) {
    // Also update public profiles table
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({
        username: user.user_metadata.display_name,
        full_name: fullName,
        avatar_url: photoURL,
        bio: bio,
        email: user.email
      }).eq('id', user.id);
    }
  }

  if (error) throw error;
};

// --- MEDIA SERVICES ---

export const uploadMedia = async (file: File): Promise<string | null> => {
  if (useMock) return URL.createObjectURL(file);

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${fileName}`;

  // NOTE: Ensure a public bucket named 'stream-media' exists in Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('stream-media')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Error uploading media:', uploadError);
    // Throw error so post creation stops
    throw new Error(`Upload Failed: ${uploadError.message}. (Hint: Ensure 'stream-media' bucket exists and is public)`);
  }

  const { data } = supabase.storage.from('stream-media').getPublicUrl(filePath);
  return data.publicUrl;
};

// --- SOCIAL GRAPH (FOLLOWERS) ---

export const fetchProfileByUsername = async (username: string): Promise<UserProfile | null> => {
  if (useMock) {
    // Provide a mock admin profile if requested
    if (username === 'SUMAN(ADMIN)') {
      return {
        uid: 'mock-admin-id',
        displayName: 'SUMAN(ADMIN)',
        fullName: 'SUMAN',
        photoURL: 'https://i.ibb.co/84mRF7fL/f5325d09-aed9-45f6-a66c-18608742a664.jpg',
        bio: 'Artist . Developer . Dreamer',
        isAnonymous: false,
        followersCount: 1337
      };
    }
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, bio')
    .ilike('username', username) // Use ilike for case-insensitive
    .single();

  if (error || !data) return null;

  // Get follower counts for the preview
  const { count: followersCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', data.id);

  return {
    uid: data.id,
    displayName: data.username,
    fullName: data.full_name,
    photoURL: data.avatar_url,
    bio: data.bio,
    isAnonymous: false,
    followersCount: followersCount || 0
  };
};

export const fetchUserLatestPost = async (userId: string): Promise<Comment | null> => {
  if (useMock) return null;

  const { data, error } = await supabase
    .from('stream')
    .select('*')
    .eq('author_id', userId)
    .eq('post_id', 'stream') // Top level posts only
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  // Fetch author profile for photo
  const { data: profile } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', data.author_id)
    .single();

  return {
    id: data.id,
    postId: data.post_id,
    parentId: data.parent_id,
    title: data.title,
    text: data.text,
    authorId: data.author_id,
    authorName: data.author_name,
    authorPhoto: profile?.avatar_url,
    createdAt: normalizeDate(data.created_at),
    likes: data.likes || 0,
    mediaUrl: data.media_url,
    mediaType: data.media_type,
    location: data.location,
    tags: data.tags,
    children: []
  };
};

export const getPublicUserProfile = async (targetUserId: string, currentUserId?: string): Promise<UserProfile | null> => {
  if (useMock) return {
    uid: targetUserId,
    displayName: 'MockUser',
    fullName: 'Mock User',
    isAnonymous: false
  };

  // 1. Fetch Profile Info
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, bio') // Select specific fields to avoid leaking email
    .eq('id', targetUserId)
    .single();

  if (error || !profile) return null;

  // 2. Fetch Stats
  const { count: friendCount } = await supabase
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .or(`sender_id.eq.${targetUserId},receiver_id.eq.${targetUserId}`)
    .eq('status', 'accepted');

  const { count: followersCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', targetUserId);

  const { count: followingCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', targetUserId);

  // 3. Check Friendship Status with current user
  let friendStatus: FriendStatus = 'none';
  if (currentUserId && currentUserId !== targetUserId) {
    // Safer query than complex strings: fetch rows where both users are involved
    const { data: fRows, error: fError } = await supabase
      .from('friendships')
      .select('*')
      .in('sender_id', [currentUserId, targetUserId])
      .in('receiver_id', [currentUserId, targetUserId]);

    if (fError) console.error("Friendship check error:", fError);

    const f1 = (fRows as any[])?.find((r: any) =>
      (r.sender_id === currentUserId && r.receiver_id === targetUserId) ||
      (r.sender_id === targetUserId && r.receiver_id === currentUserId)
    );

    if (f1) {
      if (f1.status === 'accepted') {
        friendStatus = 'friends';
      } else if (f1.sender_id === currentUserId) {
        friendStatus = 'pending_sent';
      } else {
        friendStatus = 'pending_received';
      }
    }
  }

  return {
    uid: profile.id,
    displayName: profile.username || 'User',
    fullName: profile.full_name || 'User',
    photoURL: profile.avatar_url,
    bio: profile.bio,
    isAnonymous: false,
    followersCount: followersCount || 0,
    followingCount: followingCount || 0,
    friendCount: friendCount || 0,
    friendStatus
  };
};

export const sendFriendRequest = async (currentUserId: string, targetUserId: string) => {
  if (useMock) return;
  try {
    // 1. Create Friendship Entry (Pending)
    const { error: friendshipError } = await supabase.from('friendships').insert({
      sender_id: currentUserId,
      receiver_id: targetUserId,
      status: 'pending'
    });

    if (friendshipError) {
      console.error("Friend request insert error:", friendshipError);
      throw new Error(`Failed to send friend request: ${friendshipError.message}`);
    }

    // 2. Create Notification
    await createNotification(targetUserId, 'friend_request', currentUserId);
  } catch (e) {
    console.error("sendFriendRequest failed:", e);
    throw e;
  }
};

export const acceptFriendRequest = async (currentUserId: string, senderId: string) => {
  if (useMock) return;
  try {
    // 1. Update Friendship Status
    const { error } = await supabase.from('friendships').update({ status: 'accepted' })
      .match({ sender_id: senderId, receiver_id: currentUserId });

    if (error) {
      console.error("Accept friend request error:", error);
      throw new Error(`Failed to accept friend request: ${error.message}`);
    }

    // 2. Create Notification for Sender
    await createNotification(senderId, 'friend_accept', currentUserId);
  } catch (e) {
    console.error("acceptFriendRequest failed:", e);
    throw e;
  }
};

export const declineFriendRequest = async (currentUserId: string, senderId: string) => {
  if (useMock) return;
  await supabase.from('friendships').delete()
    .match({ sender_id: senderId, receiver_id: currentUserId, status: 'pending' });
};

export const unfriend = async (currentUserId: string, targetUserId: string) => {
  if (useMock) return;
  try {
    const { error } = await supabase.from('friendships').delete()
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`);

    if (error) {
      console.error("Unfriend error:", error);
      throw new Error(`Failed to unfriend: ${error.message}`);
    }
  } catch (e) {
    console.error("unfriend failed:", e);
    throw e;
  }
};

export const followPage = async (currentUserId: string, pageId: string) => {
  if (useMock) return;
  await supabase.from('follows').insert({
    follower_id: currentUserId,
    following_id: pageId
  });

  createNotification(pageId, 'follow', currentUserId);
};

export const fetchUserNetwork = async (userId: string, type: 'followers' | 'following' | 'friends'): Promise<UserProfile[]> => {
  if (useMock) return [];

  if (type === 'friends') {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        sender_id,
        receiver_id,
        sender:profiles!sender_id (id, username, full_name, avatar_url, bio),
        receiver:profiles!receiver_id (id, username, full_name, avatar_url, bio)
      `)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .eq('status', 'accepted');

    if (error) return [];

    return data.map((item: any) => {
      const isSender = item.sender_id === userId;
      const profile = isSender ? item.receiver : item.sender;
      return {
        uid: profile.id,
        displayName: profile.username,
        fullName: profile.full_name,
        photoURL: profile.avatar_url,
        bio: profile.bio,
        isAnonymous: false
      };
    });
  }

  const filterColumn = type === 'followers' ? 'following_id' : 'follower_id';
  const joinColumn = type === 'followers' ? 'follower_id' : 'following_id';

  const { data, error } = await supabase
    .from('follows')
    .select(`
      ${joinColumn},
      profile:profiles!${joinColumn} (
        id, username, full_name, avatar_url, bio
      )
    `)
    .eq(filterColumn, userId);

  if (error) {
    console.error("Network fetch error", error);
    return [];
  }

  return data.map((item: any) => ({
    uid: item.profile.id,
    displayName: item.profile.username,
    fullName: item.profile.full_name,
    photoURL: item.profile.avatar_url,
    bio: item.profile.bio,
    isAnonymous: false
  }));
};

export const fetchNotifications = async (userId: string, callback: (notifications: AppNotification[]) => void) => {
  if (useMock) return;
  const { data } = await supabase
    .from('notifications')
    .select(`
        *,
        from_profile:profiles!from_id (username, avatar_url)
      `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (data) {
    callback(data.map((n: any) => ({
      id: n.id,
      userId: n.user_id,
      type: n.type,
      fromId: n.from_id,
      fromName: n.from_profile?.username || 'User',
      fromPhoto: n.from_profile?.avatar_url,
      isRead: n.is_read,
      createdAt: normalizeDate(n.created_at)
    })));
  }
};

export const subscribeToNotifications = (userId: string, callback: (notifications: AppNotification[]) => void) => {
  if (useMock) {
    // Generate a trial notification for demo
    setTimeout(() => {
      callback([{
        id: 'mock-notif-1',
        userId,
        type: 'friend_request',
        fromId: 'system',
        fromName: 'Creative Admin',
        isRead: false,
        createdAt: new Date().toISOString()
      }]);
    }, 2000);
    return () => { };
  }

  fetchNotifications(userId, callback);

  const sub = supabase
    .channel(`notifications-realtime-${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, () => fetchNotifications(userId, callback))
    .subscribe();

  return () => {
    supabase.removeChannel(sub);
  };
};

export const markNotificationRead = async (id: string) => {
  if (useMock) return;
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
};

export const createNotification = async (targetUserId: string, type: string, fromId: string, data: any = null) => {
  if (useMock || targetUserId === fromId) return;
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: targetUserId,
      type,
      from_id: fromId,
      is_read: false,
      data: data
    });
    if (error) console.error("Notification insert error:", error);
  } catch (e) {
    console.error("Notification creation failed:", e);
  }
};

// --- CHAT SERVICES ---
export const subscribeToMessages = (currentUserId: string, callback: (msgs: ChatMessage[]) => void) => {
  if (useMock) {
    const interval = setInterval(() => {
      const stored = JSON.parse(localStorage.getItem('mock_messages') || '[]');
      const relevant = stored.filter((m: any) => m.senderId === currentUserId || m.receiverId === currentUserId || (m.groupId && JSON.parse(localStorage.getItem('mock_memberships') || '[]').includes(m.groupId)));
      callback(relevant.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    }, 1000);
    return () => clearInterval(interval);
  }

  const fetch = async () => {
    // 1. Get user's group memberships first
    const { data: memberships } = await supabase
      .from('chat_group_members')
      .select('group_id')
      .eq('user_id', currentUserId);

    const groupIds = memberships?.map((m: any) => m.group_id) || [];

    // 2. Query personal letters OR group messages for your groups
    let query = supabase.from('messages').select(`
      *,
      sender:profiles!sender_id (username, avatar_url)
    `);

    let filterStr = `sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`;
    if (groupIds.length > 0) {
      filterStr += `,group_id.in.(${groupIds.join(',')})`;
    }

    const { data } = await query.or(filterStr).order('created_at', { ascending: true });

    if (data) {
      callback(data.map((m: any) => ({
        id: m.id,
        senderId: m.sender_id,
        senderName: m.sender?.username,
        senderPhoto: m.sender?.avatar_url,
        receiverId: m.receiver_id,
        groupId: m.group_id,
        text: m.text,
        createdAt: normalizeDate(m.created_at),
        isRead: m.is_read || false
      })));
    }
  };

  fetch();

  const channel = supabase.channel('chat-updates')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetch())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_group_members', filter: `user_id=eq.${currentUserId}` }, () => fetch())
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export const sendMessage = async (senderId: string, targetId: string, text: string, isGroup: boolean = false) => {
  if (useMock) {
    const stored = JSON.parse(localStorage.getItem('mock_messages') || '[]');
    const newMsg = {
      id: 'msg_' + Date.now(),
      senderId,
      [isGroup ? 'groupId' : 'receiverId']: targetId,
      text,
      createdAt: new Date().toISOString(),
      isRead: false
    };
    stored.push(newMsg);
    localStorage.setItem('mock_messages', JSON.stringify(stored));
    return;
  }

  const payload: any = {
    sender_id: senderId,
    text,
    is_read: false
  };

  if (isGroup) {
    payload.group_id = targetId;
  } else {
    payload.receiver_id = targetId;
  }

  await supabase.from('messages').insert(payload);

  if (!isGroup) {
    createNotification(targetId, 'message', senderId, { text: text.substring(0, 50) });
  }
}

export const markChatAsRead = async (currentUserId: string, senderId: string) => {
  if (useMock) {
    const stored = JSON.parse(localStorage.getItem('mock_messages') || '[]');
    const updated = stored.map((m: any) => {
      if (m.receiverId === currentUserId && m.senderId === senderId && !m.isRead) {
        return { ...m, isRead: true };
      }
      return m;
    });
    localStorage.setItem('mock_messages', JSON.stringify(updated));
    return;
  }

  await supabase.from('messages')
    .update({ is_read: true })
    .eq('receiver_id', currentUserId)
    .eq('sender_id', senderId)
    .eq('is_read', false);
}

// --- GROUP CHAT SERVICES ---
export const createChatGroup = async (name: string, description: string, creatorId: string) => {
  if (useMock) {
    const id = 'grp_' + Date.now();
    const groups = JSON.parse(localStorage.getItem('mock_groups') || '[]');
    const newGroup = { id, name, description, createdBy: creatorId, createdAt: new Date().toISOString(), memberCount: 1, isPublic: true };
    groups.push(newGroup);
    localStorage.setItem('mock_groups', JSON.stringify(groups));

    const memberships = JSON.parse(localStorage.getItem('mock_memberships') || '[]');
    memberships.push({ groupId: id, userId: creatorId });
    localStorage.setItem('mock_memberships', JSON.stringify(memberships));
    return id;
  }

  const { data, error } = await supabase.from('chat_groups').insert({
    name,
    description,
    created_by: creatorId,
    is_public: true
  }).select().single();

  if (error) throw error;

  // Auto-join creator
  await joinChatGroup(data.id, creatorId);
  return data.id;
};

export const joinChatGroup = async (groupId: string, userId: string) => {
  if (useMock) return;
  await supabase.from('chat_group_members').insert({
    group_id: groupId,
    user_id: userId
  });

  // Notify creator
  const { data: group } = await supabase.from('chat_groups').select('creator_id, name').eq('id', groupId).single();
  if (group && group.creator_id !== userId) {
    createNotification(group.creator_id, 'group_join', userId, { groupId, name: group.name });
  }
};

export const searchChatGroups = async (query: string) => {
  if (useMock) {
    const groups = JSON.parse(localStorage.getItem('mock_groups') || '[]');
    return groups.filter((g: any) => g.name.toLowerCase().includes(query.toLowerCase()));
  }
  const { data } = await supabase.from('chat_groups')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(10);

  return (data || []).map((g: any) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    avatarUrl: g.avatar_url,
    memberCount: 0 // Fetch count separately if needed
  }));
};

export const subscribeToChatGroups = (userId: string, callback: (groups: ChatGroup[]) => void) => {
  if (useMock) {
    const interval = setInterval(() => {
      const memberships = JSON.parse(localStorage.getItem('mock_memberships') || '[]').filter((m: any) => m.userId === userId);
      const groupIds = memberships.map((m: any) => m.groupId);
      const allGroups = JSON.parse(localStorage.getItem('mock_groups') || '[]');
      callback(allGroups.filter((g: any) => groupIds.includes(g.id)));
    }, 1000);
    return () => clearInterval(interval);
  }

  const fetch = async () => {
    const { data } = await supabase
      .from('chat_group_members')
      .select(`
        group_id,
        group:chat_groups (*)
      `)
      .eq('user_id', userId);

    if (data) {
      callback(data.map((m: any) => ({
        id: m.group.id,
        name: m.group.name,
        description: m.group.description,
        createdBy: m.group.created_by,
        createdAt: normalizeDate(m.group.created_at),
        avatarUrl: m.group.avatar_url,
        memberCount: 0,
        isPublic: m.group.is_public
      })));
    }
  };

  fetch();
  const sub = supabase.channel(`group-memberships:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_group_members', filter: `user_id=eq.${userId}` }, fetch)
    .subscribe();

  return () => supabase.removeChannel(sub);
};


// --- STREAM/COMMENTS SERVICE ---

export const subscribeToStream = (callback: (comments: Comment[]) => void, currentUserId?: string) => {
  const processComments = (rawComments: any[], votes: any[], profileMap: Record<string, string> = {}) => {
    const map: Record<string, Comment> = {};
    const roots: Comment[] = [];

    const list = rawComments.map(c => {
      // Find vote if exists
      const vote = votes.find(v => v.post_id === c.id);
      return {
        id: c.id,
        postId: c.post_id,
        parentId: c.parent_id,
        title: c.title,
        text: c.text,
        authorId: c.author_id,
        authorName: c.author_name,
        authorPhoto: profileMap[c.author_id],
        createdAt: normalizeDate(c.created_at),
        likes: c.likes || 0,
        userVote: vote ? vote.value : 0, // 1 or -1
        mediaUrl: c.media_url,
        mediaType: c.media_type,
        spaceId: c.space_id,
        spaceHandle: c.space?.handle,
        location: c.location,
        tags: c.tags,
        children: []
      };
    });

    list.forEach(c => map[c.id] = c);
    list.forEach(c => {
      if (c.parentId && map[c.parentId]) {
        map[c.parentId].children.push(c);
      } else {
        roots.push(c);
      }
    });
    return roots.sort((a, b) => {
      // @ts-ignore
      const tA = a.createdAt.toDate().getTime();
      // @ts-ignore
      const tB = b.createdAt.toDate().getTime();
      return tB - tA;
    });
  };

  if (useMock) {
    callback([]);
    return () => { };
  }

  const fetchData = async () => {
    // 1. Fetch Posts
    const { data: posts, error } = await supabase
      .from('stream')
      .select('*, space:spaces(handle)')
      .eq('post_id', 'stream');

    if (error || !posts) return;

    // 1.5 Fetch Profiles for these authors
    const authorIds = Array.from(new Set(posts.map((p: any) => p.author_id)));
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, avatar_url')
      .in('id', authorIds);

    const profileMap = (profiles || []).reduce((acc: any, p: any) => {
      acc[p.id] = p.avatar_url;
      return acc;
    }, {});

    // 2. Fetch User Votes if logged in
    let votes: any[] = [];
    if (currentUserId) {
      const { data: v } = await supabase
        .from('post_votes')
        .select('*')
        .eq('user_id', currentUserId);
      if (v) votes = v;
    }

    callback(processComments(posts, votes, profileMap));
  };

  fetchData();

  // Listen for changes
  const channel = supabase
    .channel('public:stream')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stream' }, () => fetchData())
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const subscribeToLatestStream = (callback: (comment: Comment | null) => void) => {
  if (useMock) return () => { };

  const fetchLatest = async () => {
    const { data, error } = await supabase
      .from('stream')
      .select('*')
      .eq('post_id', 'stream')
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      const d = data[0];

      // Fetch author profile for photo
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', d.author_id)
        .single();

      callback({
        id: d.id,
        postId: d.post_id,
        parentId: d.parent_id,
        title: d.title,
        text: d.text,
        authorId: d.author_id,
        authorName: d.author_name,
        authorPhoto: profile?.avatar_url,
        createdAt: normalizeDate(d.created_at),
        likes: d.likes,
        mediaUrl: d.media_url,
        mediaType: d.media_type,
        location: d.location,
        tags: d.tags,
        children: []
      });
    } else {
      callback(null);
    }
  };

  fetchLatest();
  return () => { };
};

export const postThought = async (
  text: string,
  user: UserProfile,
  parentId: string | null = null,
  title?: string,
  file?: File,
  spaceId?: string,
  location?: string,
  tags?: string[]
) => {
  if (useMock) return;

  // 1. Upload file if exists
  let mediaUrl = null;
  let mediaType = null;

  if (file) {
    try {
      mediaUrl = await uploadMedia(file);
      if (mediaUrl) {
        mediaType = file.type.startsWith('video') ? 'video' : 'image';
      }
    } catch (e: any) {
      console.error("Media upload failure:", e);
      throw e; // Rethrow to stop the post process
    }
  }

  // 2. Insert Post
  const { error } = await supabase.from('stream').insert({
    post_id: 'stream',
    parent_id: parentId,
    title,
    text,
    author_id: user.uid,
    author_name: user.displayName,
    media_url: mediaUrl,
    media_type: mediaType,
    space_id: spaceId,
    location,
    tags
  }).select().single();

  if (error) {
    console.error("Error posting:", error);

    // Code 23503: Foreign Key Violation.
    if (error.code === '23503') {
      throw new Error("Account Error: Your user profile is missing (database was reset). Please LOG OUT and REGISTER again to fix this.");
    }

    throw new Error(`Database Error: ${error.message}`);
  }

  // Notify parent author if this is a reply
  if (parentId && !error) {
    const { data: parentPost } = await supabase.from('stream').select('author_id').eq('id', parentId).single();
    if (parentPost && parentPost.author_id !== user.uid) {
      createNotification(parentPost.author_id, 'reply', user.uid, { postId: parentId, text: text.substring(0, 50) });
    }
  }
};

export const deletePost = async (id: string, authorId: string) => {
  if (useMock) return;

  // 1. Attempt to delete the post directly
  const { error } = await supabase
    .from('stream')
    .delete()
    .eq('id', id)
    .eq('author_id', authorId);

  if (error) {
    // Check for Foreign Key Violation (Postgres Code 23503)
    // This usually means there are child comments linked to this post (parent_id constraint)
    // And ON DELETE CASCADE is likely not enabled in the DB schema.
    if (error.code === '23503') {
      console.warn("Foreign Key Violation on delete. Attempting to delete children first.");

      // 2. Manual Cascade: Delete children first
      // Note: This only works if the user has permission to delete the children,
      // OR if RLS policies allow deleting threads by thread owner.
      // We assume simple 1-level deep or recursive permissions are managed by DB/RLS.
      const { error: childError } = await supabase
        .from('stream')
        .delete()
        .eq('parent_id', id);

      if (childError) {
        console.error("Failed to delete children:", childError);
        // Throw the original error if we can't clean up children, as that's the root cause
        throw error;
      }

      // 3. Retry deleting the parent post
      const { error: retryError } = await supabase
        .from('stream')
        .delete()
        .eq('id', id)
        .eq('author_id', authorId);

      if (retryError) throw retryError;

      return; // Success after manual cascade
    }

    // Some other error
    throw error;
  }
};

export const votePost = async (postId: string, userId: string, value: number, currentLikes: number, previousVote: number) => {
  if (useMock) return;

  const diff = value - previousVote;
  const newScore = currentLikes + diff;

  if (value === 0) {
    await supabase.from('post_votes').delete().match({ user_id: userId, post_id: postId });
  } else {
    // Upsert vote
    const { error } = await supabase.from('post_votes').upsert({ user_id: userId, post_id: postId, value });
    if (error && error.code === '23503') {
      console.error("Vote failed: Profile missing.");
      // Fail silently for simple actions, or we could alert
      return;
    }
  }
  await supabase.from('stream').update({ likes: newScore }).eq('id', postId);

  // Notify author
  if (value !== 0) {
    const { data: postData } = await supabase.from('stream').select('author_id, text').eq('id', postId).single();
    if (postData && postData.author_id !== userId) {
      createNotification(postData.author_id, value > 0 ? 'vote_up' : 'vote_down', userId, { postId, text: postData.text.substring(0, 50) });
    }
  }
};

// --- SPACES SERVICES ---

export const fetchSpaces = async (): Promise<Space[]> => {
  if (useMock) {
    const stored = JSON.parse(localStorage.getItem('mock_spaces') || '[]');
    if (stored.length === 0) {
      // Seed some mock spaces
      const initialSpaces: Space[] = [
        { id: '1', name: 'Tech Universe', handle: 'g/tech', type: 'group', ownerId: 'system', memberCount: 1240, followerCount: 0, isPrivate: false, createdAt: new Date() },
        { id: '2', name: 'Daily Philosophy', handle: '@philosophy', type: 'page', ownerId: 'system', memberCount: 0, followerCount: 5200, isPrivate: false, createdAt: new Date() },
        { id: '3', name: 'Creative Coders', handle: 'g/code', type: 'group', ownerId: 'system', memberCount: 850, followerCount: 0, isPrivate: false, createdAt: new Date() },
      ];
      localStorage.setItem('mock_spaces', JSON.stringify(initialSpaces));
      return initialSpaces;
    }
    return stored;
  }

  const { data, error } = await supabase.from('spaces').select('*').order('created_at', { ascending: false });
  if (error) return [];
  return data.map((s: any) => ({
    id: s.id,
    name: s.name,
    handle: s.handle,
    description: s.description,
    type: s.type,
    ownerId: s.owner_id,
    avatarURL: s.avatar_url,
    bannerURL: s.banner_url,
    memberCount: s.member_count || 0,
    followerCount: s.follower_count || 0,
    isPrivate: s.is_private || false,
    createdAt: normalizeDate(s.created_at)
  }));
};

export const createSpace = async (spaceData: Omit<Space, 'id' | 'createdAt' | 'memberCount' | 'followerCount'>): Promise<Space | null> => {
  if (useMock) {
    const stored = JSON.parse(localStorage.getItem('mock_spaces') || '[]');
    const newSpace: Space = {
      ...spaceData,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      memberCount: spaceData.type === 'group' ? 1 : 0,
      followerCount: spaceData.type === 'page' ? 1 : 0,
    };
    stored.push(newSpace);
    localStorage.setItem('mock_spaces', JSON.stringify(stored));
    return newSpace;
  }

  const { data, error } = await supabase.from('spaces').insert({
    name: spaceData.name,
    handle: spaceData.handle,
    description: spaceData.description,
    type: spaceData.type,
    owner_id: spaceData.ownerId,
    avatar_url: spaceData.avatarURL,
    banner_url: spaceData.bannerURL,
    is_private: spaceData.isPrivate,
    member_count: spaceData.type === 'group' ? 1 : 0,
    follower_count: spaceData.type === 'page' ? 1 : 0
  }).select().single();

  if (error) throw error;

  // Auto-join creator as owner/admin
  await supabase.from('space_members').insert({
    space_id: data.id,
    user_id: spaceData.ownerId,
    role: 'owner',
    status: 'accepted'
  });

  return {
    id: data.id,
    name: data.name,
    handle: data.handle,
    description: data.description,
    type: data.type,
    ownerId: data.owner_id,
    avatarURL: data.avatar_url,
    bannerURL: data.banner_url,
    memberCount: 1,
    followerCount: 0,
    isPrivate: data.is_private,
    createdAt: normalizeDate(data.created_at)
  };
};

export const updateSpace = async (spaceId: string, updates: Partial<Space>) => {
  if (useMock) return;
  const dbUpdates: any = {};
  if (updates.name) dbUpdates.name = updates.name;
  if (updates.description) dbUpdates.description = updates.description;
  if (updates.avatarURL) dbUpdates.avatar_url = updates.avatarURL;
  if (updates.bannerURL) dbUpdates.banner_url = updates.bannerURL;
  if (updates.isPrivate !== undefined) dbUpdates.is_private = updates.isPrivate;

  const { error } = await supabase.from('spaces').update(dbUpdates).eq('id', spaceId);
  if (error) throw error;
};

export const joinSpace = async (spaceId: string, userId: string, isPrivate: boolean = false) => {
  if (useMock) return;
  const status = isPrivate ? 'pending' : 'accepted';
  const { error } = await supabase.from('space_members').upsert({
    space_id: spaceId,
    user_id: userId,
    status: status,
    role: 'member'
  });

  if (!error && isPrivate) {
    // Notify all admins and the owner
    const { data: staff } = await supabase.from('space_members').select('user_id').eq('space_id', spaceId).in('role', ['owner', 'admin']);
    const { data: space } = await supabase.from('spaces').select('name').eq('id', spaceId).single();
    if (staff && space) {
      staff.forEach((member: any) => {
        createNotification(member.user_id, 'space_invite', userId, { spaceId, name: space.name, subtype: 'request' });
      });
    }
  } else if (!error && !isPrivate) {
    // Increment count
    const { data: space } = await supabase.from('spaces').select('type, member_count, follower_count').eq('id', spaceId).single();
    if (space) {
      const field = space.type === 'group' ? 'member_count' : 'follower_count';
      await supabase.from('spaces').update({ [field]: (space[field] || 0) + 1 }).eq('id', spaceId);
    }
  }
};

export const respondToSpaceRequest = async (spaceId: string, targetUserId: string, accept: boolean) => {
  if (useMock) return;
  if (accept) {
    const { error } = await supabase.from('space_members').update({ status: 'accepted' }).match({ space_id: spaceId, user_id: targetUserId });
    if (!error) {
      const { data: space } = await supabase.from('spaces').select('type, member_count, follower_count').eq('id', spaceId).single();
      if (space) {
        const field = space.type === 'group' ? 'member_count' : 'follower_count';
        await supabase.from('spaces').update({ [field]: (space[field] || 0) + 1 }).eq('id', spaceId);
      }
    }
  } else {
    await supabase.from('space_members').delete().match({ space_id: spaceId, user_id: targetUserId });
  }
};

export const giveAdminRole = async (spaceId: string, targetUserId: string) => {
  if (useMock) return;
  await supabase.from('space_members').update({ role: 'admin' }).match({ space_id: spaceId, user_id: targetUserId });
};

export const removeMember = async (spaceId: string, userId: string) => {
  if (useMock) return;
  const { error } = await supabase.from('space_members').delete().match({ space_id: spaceId, user_id: userId });
  if (!error) {
    const { data: space } = await supabase.from('spaces').select('type, member_count, follower_count').eq('id', spaceId).single();
    if (space) {
      const field = space.type === 'group' ? 'member_count' : 'follower_count';
      await supabase.from('spaces').update({ [field]: Math.max(0, (space[field] || 1) - 1) }).eq('id', spaceId);
    }
  }
};

export const leaveSpace = async (spaceId: string, userId: string) => {
  if (useMock) return;
  const { error } = await supabase.from('space_members').delete().match({ space_id: spaceId, user_id: userId });
  if (!error) {
    // Decrement count
    const { data: space } = await supabase.from('spaces').select('type, member_count, follower_count').eq('id', spaceId).single();
    if (space) {
      const field = space.type === 'group' ? 'member_count' : 'follower_count';
      await supabase.from('spaces').update({ [field]: Math.max(0, (space[field] || 0) - 1) }).eq('id', spaceId);
    }
  }
};

export const fetchIsMember = async (spaceId: string, userId: string): Promise<boolean> => {
  if (useMock) return true;
  const { count } = await supabase.from('space_members').select('*', { count: 'exact', head: true }).match({ space_id: spaceId, user_id: userId });
  return (count || 0) > 0;
};

export const fetchSpaceMembers = async (spaceId: string) => {
  if (useMock) return [];
  const { data, error } = await supabase
    .from('space_members')
    .select(`
      user_id,
      role,
      status,
      profiles:user_id ( id, full_name, username, avatar_url )
    `)
    .eq('space_id', spaceId)
    .eq('status', 'accepted') // Only show active members
    .limit(50);

  if (error) return [];
  return (data || []).map((d: any) => {
    const p = d.profiles;
    return {
      uid: d.user_id,
      name: p ? (p.full_name || p.username || `Node_${d.user_id.substring(0, 4)}`) : 'Anonymous Node',
      photoURL: p?.avatar_url,
      role: d.role as SpaceRole,
      status: d.status as SpaceMemberStatus
    };
  });
};

export const fetchSpaceMembership = async (spaceId: string, userId: string) => {
  if (useMock || !userId) return null;
  const { data, error } = await supabase
    .from('space_members')
    .select('role, status')
    .match({ space_id: spaceId, user_id: userId })
    .maybeSingle();

  if (error || !data) return null;
  return {
    role: data.role as SpaceRole,
    status: data.status as SpaceMemberStatus
  };
};

export const fetchPendingMembers = async (spaceId: string) => {
  if (useMock) return [];
  const { data, error } = await supabase
    .from('space_members')
    .select(`
      user_id,
      profiles:user_id ( id, full_name, username, avatar_url )
    `)
    .eq('space_id', spaceId)
    .eq('status', 'pending');

  if (error) return [];
  return data.map((d: any) => ({
    uid: d.user_id,
    name: d.profiles.full_name || d.profiles.username,
    photoURL: d.profiles.avatar_url
  }));
};

export const fetchUserSpaces = async (userId: string): Promise<Space[]> => {
  if (useMock) return [];
  const { data } = await supabase
    .from('space_members')
    .select('space:spaces(*)')
    .eq('user_id', userId);

  return (data || []).map((d: any) => ({
    id: d.space.id,
    name: d.space.name,
    handle: d.space.handle,
    description: d.space.description,
    type: d.space.type,
    ownerId: d.space.owner_id,
    avatarURL: d.space.avatar_url,
    memberCount: d.space.member_count || 0,
    followerCount: d.space.follower_count || 0,
    isPrivate: d.space.is_private || false,
    createdAt: normalizeDate(d.space.created_at)
  }));
};

// Deprecated simple like, redirect to vote
export const likeThought = async (id: string, currentLikes: number) => {
  console.warn("Use votePost instead");
};

// --- GLOBAL SEARCH ---
export interface SearchResult {
  type: 'user' | 'group' | 'page';
  id: string;
  name: string;
  handle?: string;
  photoURL?: string;
  description?: string;
}

export const globalSearch = async (query: string): Promise<SearchResult[]> => {
  if (useMock) return [];
  if (!query || query.trim().length < 2) return [];

  const searchTerm = query.trim();
  const results: SearchResult[] = [];

  try {
    console.log('Searching for:', searchTerm);

    // Search Users (profiles) - try multiple approaches
    try {
      const { data: users, error: userError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, bio')
        .or(`username.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`)
        .limit(10);

      if (userError) {
        console.error('User search error:', userError);
      } else if (users) {
        console.log('Found users:', users.length);
        results.push(...users.map((u: any) => ({
          type: 'user' as const,
          id: u.id,
          name: u.full_name || u.username,
          handle: u.username,
          photoURL: u.avatar_url,
          description: u.bio
        })));
      }
    } catch (e) {
      console.error('User search exception:', e);
    }

    // Search Spaces (groups and pages)
    try {
      const { data: spaces, error: spaceError } = await supabase
        .from('spaces')
        .select('id, name, handle, type, avatar_url, description')
        .or(`name.ilike.%${searchTerm}%,handle.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .limit(10);

      if (spaceError) {
        console.error('Space search error:', spaceError);
      } else if (spaces) {
        console.log('Found spaces:', spaces.length);
        results.push(...spaces.map((s: any) => ({
          type: s.type as 'group' | 'page',
          id: s.id,
          name: s.name,
          handle: s.handle,
          photoURL: s.avatar_url,
          description: s.description
        })));
      }
    } catch (e) {
      console.error('Space search exception:', e);
    }

    console.log('Total results:', results.length);
    return results;
  } catch (e) {
    console.error('Global search error:', e);
    return [];
  }
};

// --- FEED ALGORITHM ---
/*
  The Goal: A feed that feels alive.
  Formula: Score = (Votes * VoteWeight) + (RecencyScore * RecencyWeight) + (Randomness * RandomWeight)
  - Recency: Newer posts get higher base score.
  - Votes: Upvotes boost visibility.
  - Random: Slight 10-20% random shuffle to keep the feed fresh on every refresh.
*/
export const subscribeToFeed = (callback: (comments: Comment[]) => void, currentUserId?: string) => {
  if (useMock) return subscribeToStream(callback, currentUserId);

  const fetchAndRank = async () => {
    // 1. Fetch all root posts with space info (Fallback if join fails)
    let { data: posts, error } = await supabase
      .from('stream')
      .select('*, space:spaces(handle)')
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn("Feed join failed, falling back to simple select:", error);
      const { data: postsSimple, error: errorSimple } = await supabase
        .from('stream')
        .select('*')
        .is('parent_id', null)
        .order('created_at', { ascending: false })
        .limit(100);
      posts = postsSimple;
      error = errorSimple;
    }

    if (error || !posts) {
      callback([]);
      return;
    }

    // 2. Fetch Profiles
    const authorIds = Array.from(new Set(posts.map((p: any) => p.author_id)));
    const { data: profiles } = await supabase.from('profiles').select('id, avatar_url').in('id', authorIds);
    const profileMap = (profiles || []).reduce((acc: any, p: any) => { acc[p.id] = p.avatar_url; return acc; }, {});

    // 3. Fetch User Votes
    let votes: any[] = [];
    if (currentUserId) {
      const { data: v } = await supabase.from('post_votes').select('*').eq('user_id', currentUserId);
      if (v) votes = v;
    }

    // 4. Transform and Rank
    const list = posts.map((c: any) => {
      const vote = votes.find((v: any) => v.post_id === c.id);
      const postDate = new Date(c.created_at).getTime();
      const now = Date.now();

      // Recency Score: 1.0 (newest) to 0.0 (oldest in the set)
      const hourInMs = 3600000;
      const ageInHours = (now - postDate) / hourInMs;
      const recencyScore = Math.max(0, 1 / (1 + ageInHours / 24)); // Decay over 24 hours

      // Vote Score: Normalized likes
      const voteScore = (c.likes || 0) > 0 ? Math.log10(c.likes + 1) : 0;

      // Randomness: 0 to 1
      const randomScore = Math.random();

      // Weighted Total
      // recency (50%) + votes (30%) + random (20%)
      const totalScore = (recencyScore * 5) + (voteScore * 3) + (randomScore * 2);

      return {
        id: c.id,
        postId: c.post_id,
        parentId: c.parent_id,
        title: c.title,
        text: c.text,
        authorId: c.author_id,
        authorName: c.author_name,
        authorPhoto: profileMap[c.author_id],
        createdAt: normalizeDate(c.created_at),
        likes: c.likes || 0,
        userVote: vote ? vote.value : 0,
        mediaUrl: c.media_url,
        mediaType: c.media_type,
        spaceId: c.space_id,
        spaceHandle: c.space?.handle,
        location: c.location,
        tags: c.tags,
        children: [],
        _rank: totalScore // Internal use
      };
    });

    // Final Sort
    const ranked = list.sort((a: any, b: any) => b._rank - a._rank);
    callback(ranked);
  };

  fetchAndRank();
  const channel = supabase.channel('feed-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stream' }, () => fetchAndRank())
    .subscribe();

  return () => supabase.removeChannel(channel);
};

