import { supabase } from './supabase';
import { UserProfile, ChatMessage, Comment, Space, AppNotification, FriendStatus, ChatGroup } from '../types';

// --- HELPERS ---
const mapToUserProfile = (row: any): UserProfile => ({
  uid: row.uid,
  displayName: row.display_name,
  fullName: row.full_name,
  photoURL: row.photo_url,
  bannerURL: row.banner_url,
  bio: row.bio,
  isAnonymous: row.is_anonymous || false,
  followersCount: row.followers_count || 0,
  followingCount: row.following_count || 0,
  friendCount: row.friend_count || 0
});

const mapToComment = (row: any): Comment => ({
  id: row.id,
  postId: 'stream',
  parentId: row.parent_id,
  title: row.title,
  text: row.text,
  authorId: row.author_id,
  authorName: row.author_name,
  authorPhoto: row.author_photo,
  mediaUrl: row.media_url,
  mediaType: row.media_type,
  likes: row.likes || 0,
  createdAt: { toDate: () => new Date(row.created_at) },
  children: [],
  spaceId: row.space_id,
  spaceHandle: row.space_handle
});

const mapToSpace = (d: any): Space => ({
  id: d.id,
  name: d.name,
  handle: d.handle,
  description: d.description,
  type: d.type,
  ownerId: d.owner_id,
  avatarURL: d.avatar_url,
  bannerURL: d.banner_url,
  memberCount: d.member_count,
  followerCount: d.follower_count,
  isPrivate: d.is_private,
  createdAt: { toDate: () => new Date(d.created_at) }
});

// --- AUTH FUNCTIONS ---

export const getIsMockMode = () => false;

export const subscribeToAuth = (callback: (user: UserProfile | null) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth State Event:', event, session?.user?.id);

    if (session?.user) {
      const fetchAndCallback = async (retryCount = 0) => {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('uid', session.user.id)
            .maybeSingle();

          if (profile) {
            console.log('Profile found for UID:', session.user.id);
            const userObj = mapToUserProfile(profile);
            console.log('RETURNING_USER_TO_APP:', userObj);
            callback(userObj);
          } else if (retryCount < 2) {
            console.warn(`Profile not found, retrying... (${retryCount + 1})`);
            setTimeout(() => fetchAndCallback(retryCount + 1), 1000);
          } else {
            console.warn('Profile missing after retries, returning shell user');
            const shellUser = {
              uid: session.user.id,
              displayName: session.user.email?.split('@')[0] || 'User',
              isAnonymous: session.user.is_anonymous || false
            };
            console.log('RETURNING_SHELL_USER_TO_APP:', shellUser);
            callback(shellUser);
          }
        } catch (err) {
          console.error('Critical Profile Fetch Error:', err);
          callback({
            uid: session.user.id,
            displayName: session.user.email?.split('@')[0] || 'User',
            isAnonymous: session.user.is_anonymous || false
          });
        }
      };

      fetchAndCallback();
    } else {
      console.log('No session, clearing user');
      callback(null);
    }
  });

  return () => {
    subscription.unsubscribe();
  };
};

export const registerUser = async (email: string, pass: string, name: string) => {
  console.log('Registering user with Supabase Auth:', email);
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: {
      data: {
        display_name: name,
        full_name: name
      }
    }
  });

  if (error) {
    console.error('Registration Error:', error.message);
    throw error;
  }

  console.log('Registration request successful. Email sent.');
  // NOTE: Profile insertion is now handled by a DATABASE TRIGGER for 100% reliability.
  return data;
};

export const loginUser = async (identifier: string, pass: string) => {
  console.log('Attempting login for:', identifier);

  if (!identifier.includes('@')) {
    throw new Error("Please log in with your email address. Username login is not supported yet.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: identifier,
    password: pass
  });

  if (error) {
    console.error('Supabase Login Error:', error.message);
    throw error;
  }

  if (data.user && !data.user.email_confirmed_at) {
    console.warn('Login successful but email not confirmed yet.');
    // Depending on Supabase settings, this might still allow a session or not.
  }

  console.log('Login successful for UID:', data.user?.id);
};

export const logoutUser = async () => {
  await supabase.auth.signOut();
};

export const loginAnonymously = async () => {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data;
};

export const checkUsernameAvailability = async (username: string) => {
  if (!username || username.length < 3) return true;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('display_name', username)
      .maybeSingle(); // maybeSingle doesn't throw error on 0 rows

    if (error && error.code !== 'PGRST116') {
      console.error('Check username error:', error);
      return true;
    }

    return !data;
  } catch (err) {
    console.error('Check username exception:', err);
    return true;
  }
};

export const checkEmailAvailability = async (email: string) => {
  if (!email) return true;
  // This is tricky as we can't search auth.users directly easily from client
  // But we can check if it exists in our 'profiles' table if we store it there (we don't currently)
  // Or just rely on the error from signUp.
  return true;
};

export const updateUserProfile = async (photoURL: string, bio: string, fullName: string, bannerURL?: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required to update profile.");

  console.log('Updating profile for user:', user.id, { photoURL, bio, fullName });
  const { error, data } = await supabase.from('profiles').update({
    photo_url: photoURL,
    bio: bio,
    full_name: fullName,
    banner_url: bannerURL
  }).eq('uid', user.id).select();

  if (error) {
    console.error('DATABASE_PROFILE_ERROR:', error);
    throw new Error(error.message);
  }
  console.log('Update Result:', data);
};

export const getPublicUserProfile = async (targetUserId: string, currentUserId?: string): Promise<UserProfile | null> => {
  console.log('Fetching public profile for:', targetUserId);
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('uid', targetUserId)
      .single();

    if (error) {
      console.warn('Error/Not Found fetching profile:', error.message);
      return null;
    }

    return data ? mapToUserProfile(data) : null;
  } catch (err) {
    console.error('Exception fetching profile:', err);
    return null;
  }
};

// --- CONTENT FUNCTIONS ---

export const postThought = async (text: string, user: UserProfile, parentId: string | null = null, title?: string, file?: File, spaceId?: string, location?: string, tags?: string[]) => {
  console.log('Starting postThought for user:', user.uid);

  // Refresh user data before posting
  const { data: latestProfile } = await supabase
    .from('profiles')
    .select('display_name, photo_url')
    .eq('uid', user.uid)
    .maybeSingle();

  const authorName = latestProfile?.display_name || user.displayName;
  const authorPhoto = latestProfile?.photo_url || user.photoURL;

  let mediaUrl = '';
  let mediaType: 'image' | 'video' | undefined = undefined;

  try {
    if (file) {
      console.log('Uploading media...', file.name);
      mediaUrl = await uploadMedia(file);
      mediaType = file.type.startsWith('video') ? 'video' : 'image';
      console.log('Media uploaded:', mediaUrl);
    }

    const postData = {
      parent_id: parentId,
      title,
      text,
      author_id: user.uid,
      author_name: authorName,
      author_photo: authorPhoto,
      media_url: mediaUrl,
      media_type: mediaType,
      space_id: spaceId,
      location,
      tags
    };

    console.log('Inserting post into DB:', postData);
    const { data, error } = await supabase.from('posts').insert(postData).select();

    if (error) {
      console.error('Post insertion error:', error.message, error.details);
      throw error;
    }

    console.log('Post successful:', data);
  } catch (err: any) {
    console.error('Exception in postThought:', err);
    throw err;
  }
};

export const subscribeToFeed = (callback: (posts: Comment[]) => void) => {
  const fetchPostsTree = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      const allPosts = data.map(mapToComment);
      const postMap = new Map<string, Comment>();
      allPosts.forEach(p => postMap.set(p.id, p));

      const tree: Comment[] = [];
      allPosts.forEach(p => {
        if (p.parentId) {
          const parent = postMap.get(p.parentId);
          if (parent) {
            // Push to parent but maintain newest-first order
            parent.children = [p, ...(parent.children || [])];
          } else {
            // If parent not found (e.g. deleted), treat as top-level or ignore
            tree.push(p);
          }
        } else {
          tree.push(p);
        }
      });

      // Sort tree by newest first
      tree.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
        const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
        return dateB - dateA;
      });

      callback(tree);
    }
  };

  fetchPostsTree();

  const subscription = supabase
    .channel('public-posts-feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
      fetchPostsTree();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
};

export const subscribeToStream = subscribeToFeed;

export const votePost = async (postId: string, userId: string, value: number) => {
  const { error } = await supabase.from('votes').upsert({
    post_id: postId,
    user_id: userId,
    value
  });

  if (error) throw error;
};

export const deletePost = async (id: string, authorId: string) => {
  await supabase.from('posts').delete().eq('id', id).eq('author_id', authorId);
};

export const uploadMedia = async (file: File): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required for upload.");

  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `${user.id}/${fileName}`; // Folder named after user'.id

  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(filePath, file);

  if (uploadError) {
    console.error('UPLOAD_ERROR:', uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage.from('media').getPublicUrl(filePath);
  return data.publicUrl;
};

// --- SOCIAL / NETWORK ---

export const sendFriendRequest = async (currentUserId: string, targetUserId: string) => {
  await supabase.from('friends').insert({
    user_id: currentUserId,
    friend_id: targetUserId,
    status: 'pending'
  });
};

export const acceptFriendRequest = async (currentUserId: string, senderId: string) => {
  await supabase.from('friends').update({ status: 'accepted' })
    .eq('user_id', senderId)
    .eq('friend_id', currentUserId);

  await supabase.from('friends').upsert({
    user_id: currentUserId,
    friend_id: senderId,
    status: 'accepted'
  });
};

export const declineFriendRequest = async (currentUserId: string, senderId: string) => {
  await supabase.from('friends').delete()
    .eq('user_id', senderId)
    .eq('friend_id', currentUserId);
};

export const unfriend = async (currentUserId: string, targetUserId: string) => {
  await supabase.from('friends').delete()
    .or(`user_id.eq.${currentUserId},friend_id.eq.${targetUserId}`);
};

export const fetchUserNetwork = async (userId: string, type: string): Promise<UserProfile[]> => {
  const { data } = await supabase
    .from('friends')
    .select('profiles!friend_id(*)')
    .eq('user_id', userId)
    .eq('status', 'accepted');

  return data ? data.map((d: any) => mapToUserProfile(d.profiles)) : [];
};

// --- SPACES ---

export const fetchSpaces = async (): Promise<Space[]> => {
  const { data } = await supabase.from('spaces').select('*');
  return data ? data.map(mapToSpace) : [];
};

export const joinSpace = async (spaceId: string, userId: string) => {
  await supabase.from('space_members').upsert({
    space_id: spaceId,
    user_id: userId,
    role: 'member',
    status: 'accepted'
  });
};

export const leaveSpace = async (spaceId: string, userId: string) => {
  await supabase.from('space_members').delete()
    .eq('space_id', spaceId)
    .eq('user_id', userId);
};

export const fetchIsMember = async (spaceId: string, userId: string) => {
  const { data } = await supabase
    .from('space_members')
    .select('*')
    .eq('space_id', spaceId)
    .eq('user_id', userId)
    .single();
  return !!data;
};

export const fetchUserSpaces = async (userId: string): Promise<Space[]> => {
  const { data } = await supabase
    .from('space_members')
    .select('spaces(*)')
    .eq('user_id', userId);
  return data ? data.map((d: any) => mapToSpace(d.spaces)) : [];
};

export const createSpace = async (spaceData: any) => {
  const { data, error } = await supabase.from('spaces').insert(spaceData).select().single();
  if (error) throw error;
  return data;
};

// --- NOTIFICATIONS ---

export const subscribeToNotifications = (userId: string, callback: (notifs: AppNotification[]) => void) => {
  const fetchNotifs = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (data) {
      callback(data.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        type: d.type,
        fromId: d.from_id,
        fromName: d.from_name,
        fromPhoto: d.from_photo,
        data: d.data,
        isRead: d.is_read,
        createdAt: { toDate: () => new Date(d.created_at) }
      })));
    }
  };

  fetchNotifs();

  const subscription = supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => {
      fetchNotifs();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
};

export const markNotificationRead = async (id: string) => {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
};

// --- CHAT ---

export const subscribeToMessages = (userId: string, callback: (msgs: ChatMessage[]) => void) => {
  const fetchMsgs = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: true });

    if (data) {
      callback(data.map((d: any) => ({
        id: d.id,
        senderId: d.sender_id,
        receiverId: d.receiver_id,
        text: d.text,
        isRead: d.is_read,
        createdAt: { toDate: () => new Date(d.created_at) }
      })));
    }
  };

  fetchMsgs();

  const subscription = supabase
    .channel(`messages:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
      fetchMsgs();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
};

export const sendMessage = async (senderId: string, receiverId: string | null, text: string, groupId: string | null = null) => {
  await supabase.from('messages').insert({
    sender_id: senderId,
    receiver_id: receiverId,
    group_id: groupId,
    text
  });
};

// --- ADDITIONAL FUNCTIONS ---

export const fetchUserPosts = async (userId: string): Promise<Comment[]> => {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .eq('author_id', userId)
    .order('created_at', { ascending: false });
  return data ? data.map(mapToComment) : [];
};

export const fetchProfileByUsername = async (username: string): Promise<UserProfile | null> => {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('display_name', username)
    .single();
  return data ? mapToUserProfile(data) : null;
};

export const globalSearch = async (query: string): Promise<any[]> => {
  const { data: users } = await supabase.from('profiles').select('*').ilike('display_name', `%${query}%`);
  const { data: spaces } = await supabase.from('spaces').select('*').ilike('name', `%${query}%`);

  return [
    ...(users || []).map(u => ({ type: 'user', id: u.uid, name: u.full_name, handle: u.display_name, photoURL: u.photo_url })),
    ...(spaces || []).map(s => ({ type: 'space', id: s.id, name: s.name, handle: s.handle, photoURL: s.avatar_url }))
  ];
};

// --- STUBS ---
export const markChatAsRead = async (...args: any[]) => { };
export const updateSpace = async (id: string, updates: any) => { };
export const fetchSpaceMembers = async (sid: string) => { return [] };
export const respondToSpaceRequest = async (sid: string, uid: string, acc: boolean) => { };
export const giveAdminRole = async (sid: string, uid: string) => { };
export const fetchSpaceMembership = async (sid: string, uid: string) => { return null };
export const fetchPendingMembers = async (sid: string) => { return [] };
export const removeMember = async (sid: string, uid: string) => { };
export const fetchUserLatestPost = async (userId: string) => { return null; };
export const followPage = async (currentUserId: string, pageId: string) => { };
export const createNotification = async (targetUserId: string, type: string, fromId: string, data: any = null) => { };
export const createChatGroup = async (name: string, desc: string, userId: string) => {
  const { data, error } = await supabase
    .from('chat_groups')
    .insert({
      name,
      description: desc,
      created_by: userId,
      member_count: 1
    })
    .select()
    .single();

  if (error) throw error;

  // Add creator as member
  await joinChatGroup(data.id, userId);

  return data.id;
};

export const joinChatGroup = async (groupId: string, userId: string) => {
  await supabase.from('chat_group_members').upsert({
    group_id: groupId,
    user_id: userId
  });
};

export const searchChatGroups = async (query: string): Promise<ChatGroup[]> => {
  const { data } = await supabase
    .from('chat_groups')
    .select('*')
    .ilike('name', `%${query}%`);

  return data ? data.map((d: any) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    createdBy: d.created_by,
    createdAt: { toDate: () => new Date(d.created_at) },
    avatarUrl: d.avatar_url,
    memberCount: d.member_count,
    isPublic: d.is_public
  })) : [];
};

export const subscribeToChatGroups = (userId: string, callback: (groups: ChatGroup[]) => void) => {
  const fetchMyGroups = async () => {
    const { data } = await supabase
      .from('chat_group_members')
      .select('chat_groups(*)')
      .eq('user_id', userId);

    if (data) {
      callback(data.map((d: any) => ({
        id: d.chat_groups.id,
        name: d.chat_groups.name,
        description: d.chat_groups.description,
        createdBy: d.chat_groups.created_by,
        createdAt: { toDate: () => new Date(d.chat_groups.created_at) },
        avatarUrl: d.chat_groups.avatar_url,
        memberCount: d.chat_groups.member_count,
        isPublic: d.chat_groups.is_public
      })));
    }
  };

  fetchMyGroups();

  const sub = supabase
    .channel(`user_groups:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_group_members', filter: `user_id=eq.${userId}` }, () => {
      fetchMyGroups();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(sub);
  };
};

export const auth = { currentUser: null } as any;
export const db = {} as any;
export const storage = {} as any;
