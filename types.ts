
export type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends';

export interface UserProfile {
  uid: string;
  displayName: string;
  fullName?: string; // New mutable "General Name"
  photoURL?: string;
  bio?: string;
  isAnonymous: boolean;
  // Social Stats
  followersCount?: number; // Still used for Pages
  followingCount?: number; // Still used for following Pages
  friendCount?: number;
  friendStatus?: FriendStatus; // Contextual: Relation with current user
}

export interface AppNotification {
  id: string;
  userId: string; // Target user
  type: 'friend_request' | 'friend_accept' | 'mention' | 'space_invite' | 'vote_up' | 'vote_down' | 'message' | 'reply' | 'follow' | 'group_join';
  fromId: string;
  fromName: string;
  fromPhoto?: string;
  data?: any; // e.g., spaceId or threadId
  isRead: boolean;
  createdAt: any;
}

export interface Comment {
  id: string;
  postId: string;
  parentId: string | null;
  title?: string; // For top-level threads
  text: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string; // Added for UI
  createdAt: any; // Firestore Timestamp or Date
  children: Comment[];
  likes?: number; // Total Score
  userVote?: number; // 0 = none, 1 = up, -1 = down (Current user's vote)
  mediaUrl?: string; // URL to image or video
  mediaType?: 'image' | 'video';
  spaceId?: string; // ID of the space this post belongs to
  spaceHandle?: string; // Handle for display (g/dev)
  location?: string; // For Reels/Blinks
  tags?: string[]; // For Reels/Blinks
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName?: string; // For Group Chats
  senderPhoto?: string; // For Group Chats
  receiverId?: string; // Make optional for group messages
  groupId?: string;    // If set, it's a group message
  text: string;
  createdAt: any;
  isRead: boolean;
}

export interface ChatGroup {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: any;
  avatarUrl?: string;
  memberCount: number;
  isPublic: boolean;
}

export interface ChatGroupMember {
  id: string;
  groupId: string;
  userId: string;
  joinedAt: any;
}

export type SpaceType = 'group' | 'page';
export type SpaceRole = 'member' | 'admin' | 'owner';
export type SpaceMemberStatus = 'pending' | 'accepted' | 'blocked';

export interface Space {
  id: string;
  name: string;
  handle: string; // e.g., @coding or g/dev
  description?: string;
  type: SpaceType;
  ownerId: string;
  avatarURL?: string;
  bannerURL?: string; // Wallpaper
  memberCount: number;
  followerCount: number;
  isPrivate: boolean; // For groups
  createdAt: any;
  userRole?: SpaceRole;
  userStatus?: SpaceMemberStatus;
}