// Moka Frontend Store - Wired to Hono backend
import { UserProfile, ChatMessage, Comment, Space, AppNotification, FriendStatus, ChatGroup } from '../types';
import axios from 'axios';

declare global {
  interface Window {
    Clerk: any;
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'http://localhost:3000/api',
});

// Attach Clerk JWT to every request automatically
api.interceptors.request.use(async (config) => {
  if (window.Clerk && window.Clerk.session) {
    const token = await window.Clerk.session.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});
// --- Search Result Type ---
export interface SearchResult {
  id: string;
  type: 'user' | 'space' | 'post';
  name: string;
  handle: string;
  photoURL?: string;
}

// --- AUTH ---
export const getIsMockMode = () => false;
export const subscribeToAuth = (callback: (user: UserProfile | null) => void) => { callback(null); return () => {}; };
export const registerUser = async (email: string, pass: string, name: string) => {};
export const loginUser = async (identifier: string, pass: string) => {};
export const logoutUser = async () => {};
export const loginAnonymously = async () => {};
export const checkUsernameAvailability = async (username: string) => true;
export const checkEmailAvailability = async (email: string) => true;

// --- USER PROFILE ---
export const updateUserProfile = async (photoURL: string, bio: string, fullName: string, bannerURL?: string) => {};
export const getPublicUserProfile = async (targetUserId: string, currentUserId?: string): Promise<UserProfile | null> => null;

// --- CONTENT / POSTS ---
export const postThought = async (text: string, user: UserProfile, parentId: string | null = null, title?: string, files?: File[], spaceId?: string, location?: string, tags?: string[], spaceHandle?: string) => {
  let mediaUrl = undefined;
  let mediaType = undefined;

  // Simple upload logic placeholder (assuming one file)
  if (files && files.length > 0) {
    mediaUrl = await uploadMedia(files[0]);
    mediaType = files[0].type.startsWith('video/') ? 'video' : 'image';
  }

  const res = await api.post('/posts', {
    text,
    parentId,
    title,
    mediaUrl,
    mediaType,
    spaceId,
    spaceHandle,
    location,
    tags,
  });
  return res.data;
};

export const togglePinPost = async (postId: string, isPinned: boolean) => {};

// Replace subscribe with simple polling or just a fetch for now to get feed
export const subscribeToFeed = (callback: (posts: Comment[]) => void, userId?: string) => {
  const fetchPosts = async () => {
    try {
      const res = await api.get('/posts');
      callback(res.data);
    } catch (e) {
      console.error('Failed to fetch feed', e);
      callback([]);
    }
  };
  
  fetchPosts();
  const interval = setInterval(fetchPosts, 10000); // Poll every 10s
  return () => clearInterval(interval);
};

export const subscribeToStream = subscribeToFeed;

export const votePost = async (postId: string, userId: string, value: number, currentLikes: number, currentVote: number) => {
  try {
    const res = await api.post(`/posts/${postId}/vote`, { value });
    return res.data;
  } catch (e) {
    console.error('Vote failed', e);
    throw e;
  }
};

export const deletePost = async (id: string, authorId: string) => {};
export const fetchUserPosts = async (userId: string, currentUserId?: string): Promise<Comment[]> => [];

// --- MEDIA UPLOAD ---
export const uploadMedia = async (file: File): Promise<string> => "";

// --- SOCIAL / FRIENDS ---
export const sendFriendRequest = async (currentUserId: string, targetUserId: string) => {};
export const acceptFriendRequest = async (currentUserId: string, senderId: string) => {};
export const declineFriendRequest = async (currentUserId: string, senderId: string) => {};
export const unfriend = async (currentUserId: string, targetUserId: string) => {};
export const fetchUserNetwork = async (userId: string, type: string): Promise<UserProfile[]> => [];

// --- SPACES ---
export const fetchSpaces = async (): Promise<Space[]> => {
  try {
    const res = await api.get('/spaces');
    return res.data;
  } catch (e) {
    console.error('Failed to fetch spaces', e);
    return [];
  }
};

export const joinSpace = async (spaceId: string, userId: string, isPrivate?: boolean) => {
  try {
    await api.post(`/spaces/${spaceId}/join`, { isPrivate });
  } catch (e) {
    console.error('Failed to join space', e);
    throw e;
  }
};

export const addSpaceMember = async (spaceId: string, userId: string, adminId: string) => {};
export const leaveSpace = async (spaceId: string, userId: string) => {};
export const fetchIsMember = async (spaceId: string, userId: string): Promise<{ status: 'pending' | 'accepted' | 'blocked'; role: 'member' | 'admin' | 'owner' } | null> => null;
export const fetchUserSpaces = async (userId: string): Promise<Space[]> => [];

export const createSpace = async (spaceData: any): Promise<Space | null> => {
  try {
    const res = await api.post('/spaces', spaceData);
    return res.data;
  } catch (e) {
    console.error('Failed to create space', e);
    return null;
  }
};
export const fetchSpaceMembers = async (spaceId: string): Promise<any[]> => [];
export const updateSpace = async (spaceId: string, data: any) => {};
export const respondToSpaceRequest = async (spaceId: string, userId: string, action: string) => {};
export const giveAdminRole = async (spaceId: string, userId: string) => {};
export const fetchSpaceMembership = async (spaceId: string, userId: string): Promise<{ status: 'pending' | 'accepted' | 'blocked'; role: 'member' | 'admin' | 'owner' } | null> => null;
export const fetchPendingMembers = async (spaceId: string): Promise<any[]> => [];
export const removeMember = async (spaceId: string, userId: string) => {};

// --- NOTIFICATIONS ---
export const subscribeToNotifications = (userId: string, callback: (notifs: AppNotification[]) => void) => { callback([]); return () => {}; };
export const markNotificationRead = async (notifId: string) => {};
export const markAllNotificationsRead = async (userId: string) => {};
export const fetchNotifications = async (userId: string): Promise<AppNotification[]> => [];

// --- SEARCH ---
export const globalSearch = async (query: string): Promise<SearchResult[]> => [];

// --- CHAT (DM) ---
export const subscribeToMessages = (userId: string, callback: (msgs: ChatMessage[]) => void) => { callback([]); return () => {}; };
export const sendMessage = async (senderId: string, receiverId: string | null, text: string, groupId: string | null) => {};
export const markChatAsRead = async (userId: string, senderId: string) => {};

// --- CHAT GROUPS (CLUBS) ---
export const subscribeToChatGroupMessages = (groupId: string, callback: (msgs: ChatMessage[]) => void) => { callback([]); return () => {}; };
export const createChatGroup = async (name: string, description: string, userId: string, avatarUrl?: string): Promise<string> => "";
export const updateChatGroup = async (groupId: string, name: string, description: string, avatarUrl?: string) => {};
export const joinChatGroup = async (groupId: string, userId: string) => {};
export const leaveChatGroup = async (groupId: string, userId: string) => {};
export const deleteChatGroup = async (groupId: string) => {};
export const searchChatGroups = async (query: string): Promise<ChatGroup[]> => [];
export const subscribeToChatGroups = (userId: string, callback: (groups: ChatGroup[]) => void) => { callback([]); return () => {}; };
export const fetchChatGroupMembers = async (groupId: string): Promise<(UserProfile & { role: string })[]> => [];
export const addChatGroupMember = async (groupId: string, userId: string, addedBy: string) => {};
export const updateChatGroupMemberRole = async (groupId: string, userId: string, role: string) => {};
export const removeChatGroupMember = async (groupId: string, userId: string) => {};
