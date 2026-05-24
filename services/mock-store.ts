
import { Comment, UserProfile, ChatMessage, Space, AppNotification, FriendStatus, ChatGroup, SpaceRole, SpaceMemberStatus } from '../types';

// --- MOCK DATA ---

export const MOCK_USER: UserProfile = {
  uid: 'sumanadmin',
  displayName: 'Suman Mandal',
  fullName: 'Suman Mandal',
  photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=suman',
  bannerURL: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
  bio: 'Building the future of digital expression. ✨',
  isAnonymous: false,
  followersCount: 1240,
  followingCount: 420,
  friendCount: 156,
  friendStatus: 'none'
};

const MOCK_PROFILES: UserProfile[] = [
  MOCK_USER,
  {
    uid: 'user-3',
    displayName: 'thinker',
    fullName: 'Deep Thinker',
    photoURL: 'https://i.ibb.co/6y405cM/abstract-3.png',
    bio: 'Lost in the moka of consciousness...',
    isAnonymous: false,
    friendStatus: 'friends'
  },
  {
    uid: 'user3',
    displayName: 'Echo',
    fullName: 'Echo Vanguard',
    photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=echo',
    bio: 'Resonating through the digital void.',
    isAnonymous: false,
    friendStatus: 'pending_received'
  }
];

const MOCK_SPACES: Space[] = [
  {
    id: 'space1',
    name: 'Dev Community',
    handle: 'g:dev',
    description: 'A place for developers to share their journey.',
    type: 'group',
    ownerId: 'sumanadmin',
    avatarURL: 'https://api.dicebear.com/7.x/identicon/svg?seed=dev',
    memberCount: 1500,
    followerCount: 3000,
    isPrivate: false,
    createdAt: new Date()
  },
  {
    id: 'space-1',
    name: 'Moka Official',
    handle: 'p:moka',
    description: 'Official announcements and updates.',
    type: 'page',
    ownerId: 'sumanadmin',
    avatarURL: 'https://api.dicebear.com/7.x/identicon/svg?seed=official',
    memberCount: 0,
    followerCount: 12000,
    isPrivate: false,
    createdAt: new Date()
  }
];

const MOCK_POSTS: Comment[] = [
  {
    id: 'post1',
    postId: 'stream',
    parentId: null,
    title: 'The Future is Agentic',
    text: 'Just thinking about how AI agents are going to transform the way we interact with information. The digital garden is growing! 🌿',
    authorId: 'sumanadmin',
    authorName: 'Suman Mandal',
    authorPhoto: MOCK_USER.photoURL,
    createdAt: { toDate: () => new Date(Date.now() - 1000 * 60 * 30) },
    likes: 42,
    userVote: 1,
    children: [],
    spaceHandle: 'g:dev'
  },
  {
    id: 'post2',
    postId: 'stream',
    parentId: null,
    text: 'Love the new UI updates! Everything feels so smooth now. Great work team! 🚀',
    authorId: 'user2',
    authorName: 'Aura',
    authorPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=aura',
    createdAt: { toDate: () => new Date(Date.now() - 1000 * 60 * 120) },
    likes: 12,
    userVote: 0,
    children: [],
    mediaUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&q=80',
    mediaType: 'image'
  }
];

const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif1',
    userId: 'sumanadmin',
    type: 'friend_request',
    fromId: 'user3',
    fromName: 'Echo',
    fromPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=echo',
    isRead: false,
    createdAt: { toDate: () => new Date() }
  }
];

const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: 'msg1',
    senderId: 'user2',
    senderName: 'Aura',
    senderPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=aura',
    text: 'Hey Suman! Did you see the latest designs?',
    createdAt: { toDate: () => new Date(Date.now() - 1000 * 60 * 5) },
    isRead: false
  }
];

// --- HELPERS ---

const normalizeDate = (d: any) => {
  const date = d instanceof Date ? d : new Date();
  return { toDate: () => date };
};

// --- EXPORTS ---

export const getIsMockMode = () => true;

export const subscribeToAuth = (callback: (user: UserProfile | null) => void) => {
  setTimeout(() => callback(MOCK_USER), 500);
  return () => { };
};

export const registerUser = async (email: string, pass: string, name: string) => {
  console.log('Mock register:', email, name);
  return;
};

export const loginUser = async (identifier: string, pass: string) => {
  console.log('Mock login:', identifier);
  return;
};

export const logoutUser = async () => {
  console.log('Mock logout');
  return;
};

export const loginAnonymously = async () => {
  return { user: { uid: 'anon' } };
};

export const checkUsernameAvailability = async (username: string) => true;

export const updateUserProfile = async (photoURL: string, bio: string, fullName: string, bannerURL?: string) => {
  console.log('Mock update profile:', { photoURL, bio, fullName, bannerURL });
};

export const uploadMedia = async (file: File) => {
  return URL.createObjectURL(file);
};

export const getPublicUserProfile = async (targetUserId: string, currentUserId?: string): Promise<UserProfile | null> => {
  const p = MOCK_PROFILES.find(u => u.uid === targetUserId);
  return p || MOCK_USER;
};

export const postThought = async (text: string, user: UserProfile, parentId: string | null = null, title?: string, file?: File, spaceId?: string, location?: string, tags?: string[]) => {
  console.log('Mock post thought:', text);
};

export const subscribeToFeed = (callback: (comments: Comment[]) => void, currentUserId?: string) => {
  callback(MOCK_POSTS);
  return () => { };
};

export const subscribeToStream = subscribeToFeed;

export const votePost = async (postId: string, userId: string, value: number, currentLikes: number, previousVote: number) => {
  console.log('Mock vote:', postId, value);
};

export const deletePost = async (id: string, authorId: string) => {
  console.log('Mock delete post:', id);
};

export const fetchUserPosts = async (userId: string, currentUserId?: string): Promise<Comment[]> => {
  return MOCK_POSTS.filter(p => p.authorId === userId);
};

export const subscribeToMessages = (currentUserId: string, callback: (msgs: ChatMessage[]) => void) => {
  callback(MOCK_MESSAGES);
  return () => { };
};

export const sendMessage = async (senderId: string, targetId: string, text: string, isGroup: boolean = false) => {
  console.log('Mock send message:', text);
};

export const markChatAsRead = async (currentUserId: string, senderId: string) => { };

export const fetchSpaces = async (): Promise<Space[]> => MOCK_SPACES;

export const joinSpace = async (spaceId: string, userId: string, isPrivate: boolean = false) => { };

export const leaveSpace = async (spaceId: string, userId: string) => { };

export const fetchIsMember = async (spaceId: string, userId: string) => true;

export const fetchUserSpaces = async (userId: string): Promise<Space[]> => MOCK_SPACES;

export const subscribeToNotifications = (userId: string, callback: (notifications: AppNotification[]) => void) => {
  callback(MOCK_NOTIFICATIONS);
  return () => { };
};

export const fetchNotifications = (userId: string, callback: (notifications: AppNotification[]) => void) => {
  callback(MOCK_NOTIFICATIONS);
};

export const markNotificationRead = async (id: string) => { };

export const sendFriendRequest = async (currentUserId: string, targetUserId: string) => { };

export const acceptFriendRequest = async (currentUserId: string, senderId: string) => { };

export const declineFriendRequest = async (currentUserId: string, senderId: string) => { };

export const unfriend = async (currentUserId: string, targetUserId: string) => { };

export const fetchUserNetwork = async (userId: string, type: string): Promise<UserProfile[]> => {
  return MOCK_PROFILES.slice(1);
};

export const globalSearch = async (query: string): Promise<any[]> => {
  return [
    { type: 'user', id: 'user2', name: 'Aura Digital', handle: 'aura', photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=aura' },
    { type: 'group', id: 'space1', name: 'Dev Community', handle: 'g:dev', photoURL: 'https://api.dicebear.com/7.x/identicon/svg?seed=dev' }
  ];
};

export const createSpace = async (data: any) => {
  return { ...MOCK_SPACES[0], id: Math.random().toString() };
};

export const updateSpace = async (id: string, updates: any) => { };

export const respondToSpaceRequest = async (sid: string, uid: string, acc: boolean) => { };

export const fetchSpaceMembers = async (sid: string) => {
  return MOCK_PROFILES.map(p => ({ uid: p.uid, name: p.displayName, photoURL: p.photoURL, role: 'member', status: 'accepted' }));
};

export const fetchPendingMembers = async (sid: string) => [];

export const fetchSpaceMembership = async (sid: string, uid: string) => ({ role: 'member', status: 'accepted' });

export const giveAdminRole = async (sid: string, uid: string) => { };

export const removeMember = async (sid: string, uid: string) => { };

export const fetchProfileByUsername = async (username: string) => MOCK_USER;

export const fetchUserLatestPost = async (userId: string) => MOCK_POSTS[0];

export const followPage = async (currentUserId: string, pageId: string) => { };

export const createNotification = async (targetUserId: string, type: string, fromId: string, data: any = null) => {
  console.log('Mock create notification:', type, 'for', targetUserId);
};

export const createChatGroup = async (name: string, desc: string, userId: string) => {
  console.log('Mock create group:', name);
  return 'mock-group-id';
};

export const joinChatGroup = async (groupId: string, userId: string) => {
  console.log('Mock join group:', groupId);
};

export const searchChatGroups = async (query: string): Promise<ChatGroup[]> => {
  return [
    { id: 'group1', name: 'Design Underground', description: 'Design talk.', createdBy: 'sumanadmin', createdAt: new Date(), memberCount: 42, isPublic: true }
  ];
};

export const subscribeToChatGroups = (userId: string, callback: (groups: ChatGroup[]) => void) => {
  callback([
    { id: 'group1', name: 'Design Underground', description: 'Design talk.', createdBy: 'sumanadmin', createdAt: new Date(), memberCount: 42, isPublic: true }
  ]);
  return () => { };
};

export const auth = { currentUser: MOCK_USER } as any;
export const db = {} as any;
export const storage = {} as any;
export const supabase = {} as any;
