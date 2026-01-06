
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, ArrowBigUp, ArrowBigDown, Share2, User, Search, X, Settings, LogOut, Edit2, Trash2, Camera, Users, UserPlus, UserMinus, UserCheck, ChevronLeft, ChevronRight, ArrowRight, Send, ShieldCheck, Activity, MessageCircle, Menu, Filter, Image as ImageIcon, Paperclip, Loader, Copy, Download, Plus, Minimize2, Layout, PlaySquare, Compass, Heart, Bell, Check, Info } from 'lucide-react';
import { UserProfile, Comment, Space, AppNotification } from '../types';
import {
  subscribeToStream, postThought, votePost, updateUserProfile, deletePost, getPublicUserProfile, sendFriendRequest, acceptFriendRequest, declineFriendRequest, unfriend, fetchUserNetwork, fetchSpaces, createSpace, subscribeToNotifications, markNotificationRead, fetchNotifications, globalSearch, SearchResult, fetchIsMember, joinSpace, leaveSpace, fetchUserSpaces, fetchSpaceMembers, updateSpace, respondToSpaceRequest, giveAdminRole, fetchSpaceMembership, fetchPendingMembers, subscribeToFeed, uploadMedia, removeMember, fetchUserPosts, togglePinPost
} from '../services/store';
import { Window, Button, Input, Modal, THEME, ToastContainer } from '../components/UI';
import { toBlob } from 'html-to-image';

const formatDate = (timestamp: any) => {
  if (!timestamp) return '...';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatHandle = (handle: string | undefined, type: 'group' | 'page' | 'user' | 'club') => {
  if (!handle) return '';
  // Remove any legacy prefixes or the target prefix to prevent doubling
  const clean = handle.replace(/^([gu]:|p:|c:|g\/|@)/i, '');
  const prefix = type === 'group' ? 'g:' : type === 'page' ? 'p:' : type === 'user' ? 'u:' : 'c:';
  return prefix + clean;
};

// --- INLINE INPUT COMPONENT ---
const InlineInput = ({
  onSubmit,
  onCancel,
  placeholder = "Write a reply...",
  buttonLabel = "Reply",
  autoFocus = false,
  className = ""
}: {
  onSubmit: (text: string, files?: File[]) => void;
  onCancel?: () => void;
  placeholder?: string;
  buttonLabel?: string;
  autoFocus?: boolean;
  className?: string;
}) => {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ url: string, type: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!text.trim() && files.length === 0) return;
    onSubmit(text, files.length > 0 ? files : undefined);
    setText('');
    setFiles([]);
    previews.forEach(p => URL.revokeObjectURL(p.url));
    setPreviews([]);
    if (onCancel) onCancel();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      const newFiles = [...files, ...selectedFiles];
      setFiles(newFiles);

      const newPreviews = selectedFiles.map(f => ({
        url: URL.createObjectURL(f),
        type: f.type
      }));
      setPreviews([...previews, ...newPreviews]);
    }
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index].url);
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={`mt-2 animate-fade-in ${className}`}>
      <textarea
        className="w-full bg-white border border-black p-2 text-sm focus:outline-none min-h-[80px] shadow-sm placeholder-gray-400"
        placeholder={placeholder}
        value={text}
        onChange={e => setText(e.target.value)}
        autoFocus={autoFocus}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.ctrlKey) handleSubmit();
        }}
      />
      {previews.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {previews.map((p, idx) => (
            <div key={idx} className="relative shrink-0">
              {p.type.startsWith('video') ? (
                <video src={p.url} className="h-20 w-32 object-cover border border-black" muted />
              ) : (
                <img src={p.url} className="h-20 w-32 border border-black object-cover" />
              )}
              <button onClick={() => removeFile(idx)} className="absolute -top-2 -right-2 bg-black text-white rounded-full p-0.5 shadow-md">
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-between items-center mt-2">
        <div className="flex gap-2">
          <input type="file" ref={fileRef} className="hidden" accept="image/*,video/*" multiple onChange={handleFile} />
          <button onClick={() => fileRef.current?.click()} className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors">
            <ImageIcon size={16} />
          </button>
        </div>
        <div className="flex gap-2">
          {onCancel && <Button onClick={onCancel} className="text-xs px-2 py-1 border-transparent hover:bg-gray-100 shadow-none">Cancel</Button>}
          <Button onClick={handleSubmit} variant="primary" className="text-xs px-3 py-1 flex items-center gap-1">
            <Send size={12} /> {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};

// --- POST COMPONENT ---
interface ThreadItemProps {
  thread: Comment;
  onClick: () => void;
  onVote: (id: string, val: number) => void;
  onUserClick: (uid: string) => void;
  onChat: (uid: string) => void;
  currentUserId?: string;
  onDelete?: (id: string) => void;
  onShare: (thread: Comment) => void;
  onSpaceClick?: (spaceId: string) => void;
  onPin?: (id: string, currentlyPinned: boolean) => void;
  isSpaceAdmin?: boolean;
}

const MediaCarousel: React.FC<{ items: { url: string; type: 'image' | 'video' }[] }> = ({ items }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!items || items.length === 0) return null;

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const currentItem = items[currentIndex];

  return (
    <div className="mt-4 mb-3 rounded-2xl overflow-hidden border border-gray-100 bg-black shadow-inner group/media relative max-w-2xl mx-auto aspect-square md:aspect-video flex items-center justify-center">
      {currentItem.type === 'video' ? (
        <video
          src={currentItem.url}
          controls
          className="w-full h-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={currentItem.url}
          alt="attachment"
          className="w-full h-full object-contain transition-transform duration-700 hover:scale-[1.02]"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {items.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-md text-white p-1.5 rounded-full transition-all opacity-0 group-hover/media:opacity-100"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-md text-white p-1.5 rounded-full transition-all opacity-0 group-hover/media:opacity-100"
          >
            <ChevronRight size={20} />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {items.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIndex ? 'bg-white scale-125' : 'bg-white/40'}`}
              />
            ))}
          </div>

          <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-full px-2">
            {currentIndex + 1} / {items.length}
          </div>
        </>
      )}
    </div>
  );
};

const ThreadItem: React.FC<ThreadItemProps> = ({
  thread,
  onClick,
  onVote,
  onUserClick,
  onChat,
  currentUserId,
  onDelete,
  onShare,
  onSpaceClick,
  onPin,
  isSpaceAdmin
}) => {

  const handleVote = (e: React.MouseEvent, val: number) => {
    e.stopPropagation();
    // If clicking the same vote, toggle it off (0). Otherwise set to new val.
    const newVote = thread.userVote === val ? 0 : val;
    onVote(thread.id, newVote);
  };

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUserClick(thread.authorId);
  }

  const handleChatClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChat(thread.authorId);
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete(thread.id);
  }

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShare(thread);
  }

  const handleSpaceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (thread.spaceId && onSpaceClick) onSpaceClick(thread.spaceId);
  }

  const isMe = currentUserId === thread.authorId;

  return (
    <div
      onClick={onClick}
      className={`group border-b border-gray-100 p-4 md:p-5 transition-all duration-300 cursor-pointer flex gap-4 last:border-0 hover:bg-[#fafafa] relative bg-white`}
    >
      {/* Interaction Column: Votes */}
      <div className="flex flex-col items-center gap-1.5 min-w-[36px] pt-1 shrink-0">
        <button
          onClick={(e) => handleVote(e, 1)}
          className={`p-1.5 rounded-lg transition-all duration-200 active:scale-90 ${thread.userVote === 1 ? 'text-orange-600 bg-orange-50' : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'}`}
        >
          <ArrowBigUp size={22} strokeWidth={2.5} fill={thread.userVote === 1 ? "currentColor" : "none"} />
        </button>

        <span className={`text-xs font-black tracking-tight ${thread.userVote !== 0 ? (thread.userVote === 1 ? 'text-orange-600' : 'text-blue-600') : 'text-gray-400'}`}>
          {thread.likes || 0}
        </span>

        <button
          onClick={(e) => handleVote(e, -1)}
          className={`p-1.5 rounded-lg transition-all duration-200 active:scale-90 ${thread.userVote === -1 ? 'text-blue-600 bg-blue-50' : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'}`}
        >
          <ArrowBigDown size={22} strokeWidth={2.5} fill={thread.userVote === -1 ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Content Column */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              onClick={handleUserClick}
              className="w-6 h-6 rounded-full bg-black flex items-center justify-center text-[10px] text-white font-bold shrink-0 overflow-hidden shadow-sm hover:ring-2 hover:ring-black/5 transition-all"
            >
              {thread.authorPhoto ? <img src={thread.authorPhoto} className="w-full h-full object-cover" /> : thread.authorName[0]}
            </div>
            <button
              onClick={handleUserClick}
              className={`text-[11px] font-black tracking-wide hover:underline transition-colors flex items-center gap-1 text-white bg-black px-1.5 py-0.5 rounded-md shadow-sm`}
            >
              {thread.spaceId ? 'm:' : 'u:'}{thread.authorName}
            </button>
            {thread.spaceHandle && (
              <>
                <span className="text-[10px] text-gray-300 mt-0.5">•</span>
                <button
                  onClick={handleSpaceClick}
                  className="text-[12px] font-black text-blue-600 mt-0.5 lowercase tracking-tight bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors border border-blue-100 shadow-sm"
                >
                  {formatHandle(thread.spaceHandle, thread.tags?.includes('PAGE') ? 'page' : 'group')}
                </button>
              </>
            )}
            <span className="text-[10px] text-gray-400 mt-0.5">•</span>
            <span className="text-[10px] text-gray-400 mt-0.5 font-medium">{formatDate(thread.createdAt)}</span>
          </div>

          <div className="flex items-center gap-1">
            {isMe && onDelete && (
              <button
                onClick={handleDeleteClick}
                className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-all active:scale-90"
                title="Delete Post"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {thread.title && <h3 className="font-extrabold text-lg text-gray-900 mb-1.5 leading-snug tracking-tight">{thread.title}</h3>}
        <p className={`text-[15px] text-gray-700 leading-relaxed font-medium whitespace-pre-wrap ${thread.title ? 'line-clamp-4' : ''}`}>
          {thread.text}
        </p>

        {/* Media Preview (Enriched Carousel) */}
        {thread.mediaItems && thread.mediaItems.length > 0 ? (
          <MediaCarousel items={thread.mediaItems} />
        ) : thread.mediaUrl ? (
          <div className="mt-4 mb-3 rounded-2xl overflow-hidden border border-gray-100 bg-black/5 shadow-inner group/media relative max-w-2xl">
            {thread.mediaType === 'video' ? (
              <video
                src={thread.mediaUrl}
                controls
                className="w-full max-h-[500px] object-contain mx-auto"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={thread.mediaUrl}
                alt="attachment"
                className="w-full max-h-[500px] object-contain mx-auto transition-transform duration-700 group-hover/media:scale-[1.02]"
              />
            )}
          </div>
        ) : null}

        {/* Action Bar */}
        <div className="flex items-center gap-5 mt-4">
          <button className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-black transition-colors py-1 px-1 rounded-md">
            <MessageSquare size={14} strokeWidth={2.5} />
            {thread.children.length} {thread.children.length === 1 ? 'Comment' : 'Comments'}
          </button>

          <button
            onClick={handleShareClick}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-black transition-colors py-1 px-1 rounded-md"
          >
            <Share2 size={14} strokeWidth={2.5} /> Share
          </button>

          {!isMe && (
            <button
              onClick={handleChatClick}
              className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-blue-600 transition-colors py-1 px-1 rounded-md ml-auto"
            >
              <MessageCircle size={14} strokeWidth={2.5} /> Message
            </button>
          )}

          {isSpaceAdmin && onPin && (
            <button
              onClick={(e) => { e.stopPropagation(); onPin(thread.id, thread.tags?.includes('PIN') || false); }}
              className={`flex items-center gap-1.5 text-xs font-bold transition-colors py-1 px-1.5 rounded-md border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none ${thread.tags?.includes('PIN') ? 'bg-yellow-400 text-black' : 'bg-white text-gray-400 hover:text-black'}`}
              title={thread.tags?.includes('PIN') ? 'Unpin' : 'Pin'}
            >
              <Plus size={14} strokeWidth={2.5} className={thread.tags?.includes('PIN') ? 'rotate-45' : ''} />
              {thread.tags?.includes('PIN') ? 'PINNED' : 'PIN'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- COMMENT NODE ---
interface CommentNodeProps {
  c: Comment;
  onReply: (text: string, parentId: string, files?: File[]) => void;
  onUserClick: (id: string) => void;
  canPost: boolean;
  highlightedId?: string | null;
}

const CommentNode: React.FC<CommentNodeProps> = ({ c, onReply, onUserClick, canPost, highlightedId }) => {
  const [isReplying, setIsReplying] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  const isHighlighted = highlightedId === c.id;

  useEffect(() => {
    if (isHighlighted && nodeRef.current) {
      nodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Clean up highlight after animation if we wanted, but keeping it is fine for context
    }
  }, [isHighlighted]);

  if (isCollapsed) {
    return (
      <div className="mt-3 ml-2 pl-4 py-1 border-l-2 border-gray-100 transition-all hover:border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCollapsed(false)}
            className="w-6 h-6 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-black hover:bg-gray-100 transition-all"
          >
            <Plus size={12} strokeWidth={3} />
          </button>
          <button onClick={() => onUserClick(c.authorId)} className={`text-[11px] font-bold opacity-60 flex items-center gap-1 text-gray-900`}>
            {c.spaceId ? 'm:' : 'u:'}{c.authorName}
          </button>
          {c.tags?.includes('PIN') && <span className="text-[8px] font-black bg-yellow-400 px-1 border border-black uppercase tracking-widest">Pinned</span>}
          <span className="text-[10px] text-gray-300 font-medium">Collapsed thread ({c.children.length + 1} items)</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={nodeRef}
      className={`mt-5 ml-2 md:ml-4 pl-4 border-l-2 relative group/cmt transition-colors duration-500 rounded-r-xl ${isHighlighted ? 'border-yellow-400 bg-yellow-50/50 py-2' : 'border-gray-100 hover:border-black/10'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            onClick={() => onUserClick(c.authorId)}
            className="w-5 h-5 rounded-full bg-black flex items-center justify-center text-[8px] text-white font-bold shrink-0 shadow-sm transition-transform hover:scale-110"
          >
            {c.authorPhoto ? <img src={c.authorPhoto} className="w-full h-full object-cover rounded-full" /> : c.authorName[0]}
          </div>
          <button onClick={() => onUserClick(c.authorId)} className={`text-[11px] font-black tracking-tight hover:underline flex items-center gap-1 text-gray-900`}>
            {c.spaceId ? 'm:' : 'u:'}{c.authorName}
          </button>
          <span className="text-[10px] text-gray-400">•</span>
          <span className="text-[10px] text-gray-400 font-medium">{formatDate(c.createdAt)}</span>
        </div>

        <button
          onClick={() => setIsCollapsed(true)}
          className="opacity-0 group-hover/cmt:opacity-100 p-1 text-gray-300 hover:text-black transition-all"
          title="Collapse"
        >
          <Minimize2 size={12} strokeWidth={3} />
        </button>
      </div>

      <p className="text-[14px] text-gray-700 leading-relaxed font-medium mb-3 whitespace-pre-wrap">{c.text}</p>
      {/* Media Preview for Comments */}
      {c.mediaUrl && (
        <div className="mb-3 max-w-sm rounded-[5px] overflow-hidden border border-black">
          {c.mediaType === 'video' ? <video src={c.mediaUrl} controls className="w-full" /> : <img src={c.mediaUrl} className="w-full" />}
        </div>
      )}

      <div className="flex gap-4 items-center">
        {canPost && (
          <button
            onClick={() => setIsReplying(!isReplying)}
            className={`text-[10px] font-black tracking-wider transition-all px-2 py-1 rounded-md hover:bg-gray-100 ${isReplying ? 'text-black bg-gray-100' : 'text-gray-400'}`}
          >
            {isReplying ? 'CANCEL' : 'REPLY'}
          </button>
        )}
      </div>

      {isReplying && (
        <div className="mt-3 animate-slide-up">
          <InlineInput
            onSubmit={(text, files) => { onReply(text, c.id, files); setIsReplying(false); }}
            onCancel={() => setIsReplying(false)}
            autoFocus
            placeholder={`Replying to ${c.authorName}...`}
          />
        </div>
      )}

      <div className="space-y-1">
        {c.children.map(child => (
          <CommentNode
            key={child.id}
            c={child}
            onReply={onReply}
            onUserClick={onUserClick}
            canPost={canPost}
            highlightedId={highlightedId}
          />
        ))}
      </div>
    </div>
  );
};

// --- PROFILE MODAL (Generic for Self and Others) ---
export const UserProfileModal = ({
  currentUser,
  targetUserId,
  thoughts,
  isOpen,
  onClose,
  onLogout,
  onNavigate,
  onChat,
  onDeletePost,
  onOpenThread,
  onToast
}: {
  currentUser: UserProfile | null,
  targetUserId: string | null,
  thoughts: Comment[],
  isOpen: boolean,
  onClose: () => void,
  onLogout?: () => void,
  onNavigate: (uid: string) => void,
  onChat: (uid: string) => void,
  onDeletePost: (id: string) => void,
  onOpenThread: (id: string) => void,
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');

  const [userPosts, setUserPosts] = useState<Comment[]>([]);
  const [userSpaces, setUserSpaces] = useState<Space[]>([]);

  const [isEditing, setIsEditing] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [editBanner, setEditBanner] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [networkList, setNetworkList] = useState<UserProfile[]>([]);
  const [networkType, setNetworkType] = useState<'followers' | 'following' | 'friends' | null>(null);

  // Space Filters
  const [spaceTypeFilter, setSpaceTypeFilter] = useState<'all' | 'group' | 'page'>('all');
  const [spaceRoleFilter, setSpaceRoleFilter] = useState<'all' | 'own' | 'joined'>('all');

  const isOwnProfile = currentUser && targetUserId === currentUser.uid;

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        if (!targetUserId) return;
        if (!profile || profile.uid !== targetUserId) setLoading(true);
        setNetworkType(null);

        const [data, posts, spaces] = await Promise.all([
          getPublicUserProfile(targetUserId, currentUser?.uid).catch(() => null),
          fetchUserPosts(targetUserId, currentUser?.uid).catch(() => []),
          fetchUserSpaces(targetUserId).catch(() => [])
        ]);

        if (data) {
          setProfile(data);
          setUserPosts(posts);
          setUserSpaces(spaces);
        } else if (isOwnProfile && currentUser) {
          // Fallback to currentUser info if document doesn't exist (e.g. anonymous or fresh signup)
          setProfile(currentUser);
          setUserPosts([]);
          setUserSpaces([]);
        } else {
          setProfile(null);
        }

        if (isOwnProfile && currentUser) {
          const base = data || currentUser;
          setEditBio(base.bio || "");
          setEditPhoto(base.photoURL || "");
          setEditBanner(base.bannerURL || "");
          setEditFullName(base.fullName || base.displayName || "");
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) fetchProfileData();
  }, [isOpen, targetUserId, currentUser?.uid]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      let finalPhoto = editPhoto;
      let finalBanner = editBanner;

      if (photoFile) {
        const url = await uploadMedia(photoFile);
        if (url) finalPhoto = url;
      }
      if (bannerFile) {
        const url = await uploadMedia(bannerFile);
        if (url) finalBanner = url;
      }

      await updateUserProfile(finalPhoto, editBio, editFullName, finalBanner);
      setIsEditing(false);
      setProfile(prev => prev ? ({ ...prev, photoURL: finalPhoto, bannerURL: finalBanner, bio: editBio, fullName: editFullName }) : null);
      setPhotoFile(null);
      setBannerFile(null);
    } catch (e) {
      console.error(e);
      if (onToast) onToast("Failed to update profile", 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFriendAction = async () => {
    if (!currentUser || !profile) return;
    try {
      if (profile.friendStatus === 'friends') {
        if (!window.confirm(`Remove #${profile.displayName} from your friends?`)) return;
        await unfriend(currentUser.uid, profile.uid);
        setProfile({ ...profile, friendStatus: 'none', friendCount: (profile.friendCount || 0) - 1 });
      } else if (profile.friendStatus === 'pending_sent') {
        await unfriend(currentUser.uid, profile.uid);
        setProfile({ ...profile, friendStatus: 'none' });
      } else if (profile.friendStatus === 'pending_received') {
        await acceptFriendRequest(currentUser.uid, profile.uid);
        setProfile({ ...profile, friendStatus: 'friends', friendCount: (profile.friendCount || 0) + 1 });
      } else {
        await sendFriendRequest(currentUser.uid, profile.uid);
        setProfile({ ...profile, friendStatus: 'pending_sent' });
      }
    } catch (e: any) { console.error(e); }
  };

  const handleDeleteUserPost = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete post?")) {
      await onDeletePost(id);
      setUserPosts(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleViewNetwork = async (type: 'followers' | 'following' | 'friends') => {
    if (!profile) return;
    setNetworkType(type);
    setNetworkList([]);
    const list = await fetchUserNetwork(profile.uid, type);
    setNetworkList(list);
  };

  if (!isOpen) return null;

  // Filter Logic
  const blinks = userPosts.filter(p => p.mediaType === 'video');
  // Threads = Top level, non-video posts
  const threads = userPosts.filter(p => !p.parentId && p.mediaType !== 'video');
  // Comments = Replies (any type)
  const comments = userPosts.filter(p => !!p.parentId);

  const filteredSpaces = userSpaces.filter(s => {
    // Type Filter
    if (spaceTypeFilter !== 'all' && s.type !== spaceTypeFilter) return false;
    // Role Filter
    if (spaceRoleFilter === 'own' && s.ownerId !== profile?.uid) return false;
    if (spaceRoleFilter === 'joined' && s.ownerId === profile?.uid) return false;
    return true;
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={loading ? "DATA_LINK..." : `PROFILE: u:${profile?.displayName || 'USER'}`} maxWidth="max-w-4xl">
      {loading ? (
        <div className="flex flex-col h-[80vh] bg-white border-t border-black overflow-hidden relative animate-pulse">
          {/* Banner Skeleton */}
          <div className="h-32 md:h-40 bg-gray-200 border-b-2 border-black w-full" />

          {/* Info Skeleton */}
          <div className="p-6 pt-0 bg-[#f4f4f5] border-b-2 border-black">
            <div className="flex flex-col md:flex-row items-start gap-8 -mt-12">
              {/* Avatar Skeleton */}
              <div className="w-32 h-32 bg-gray-300 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] shrink-0" />

              {/* Text Skeletons */}
              <div className="flex-1 mt-14 space-y-4 w-full">
                <div className="h-8 w-48 bg-gray-300 border-2 border-black/10" />
                <div className="flex gap-2">
                  <div className="h-6 w-24 bg-gray-200 border border-black/5" />
                  <div className="h-6 w-24 bg-gray-200 border border-black/5" />
                </div>
              </div>
            </div>
          </div>

          {/* Content Skeleton */}
          <div className="p-6 space-y-4">
            <div className="h-4 w-full max-w-md bg-gray-100 rounded" />
            <div className="h-4 w-3/4 max-w-sm bg-gray-100 rounded" />
            <div className="grid grid-cols-3 gap-2 mt-8">
              <div className="aspect-square bg-gray-100 border border-black/5" />
              <div className="aspect-square bg-gray-100 border border-black/5" />
              <div className="aspect-square bg-gray-100 border border-black/5" />
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="bg-black text-white px-3 py-1 text-[10px] font-black tracking-widest uppercase shadow-lg">LOADING PROFILE DATA...</span>
          </div>
        </div>
      ) : !profile ? (
        <div className="h-[400px] flex flex-col items-center justify-center gap-4 bg-white">
          <span className="text-xs font-black uppercase tracking-widest text-gray-400">NODE_NOT_FOUND_OR_SYNC_ERROR</span>
        </div>
      ) : (
        <div className="flex flex-col h-[80vh] bg-white border-t border-black overflow-hidden relative">
          {networkType ? (
            <div className="flex flex-col h-full bg-white">
              <div className="p-4 border-b-2 border-black flex items-center gap-4 bg-[#a6cade]">
                <button onClick={() => setNetworkType(null)} className="p-1 px-2 border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none font-black text-xs">BACK</button>
                <span className="font-black text-xs uppercase tracking-widest">NETWORK: {networkType}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {networkList.length > 0 ? networkList.map(u => (
                  <div key={u.uid} onClick={() => onNavigate(u.uid)} className="flex items-center gap-4 p-4 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 cursor-pointer group">
                    <div className="w-12 h-12 bg-black border-2 border-black overflow-hidden text-white flex items-center justify-center font-black">
                      {u.photoURL ? <img src={u.photoURL} alt="avi" className="w-full h-full object-cover" /> : u.displayName[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-black text-sm uppercase tracking-tight">{u.fullName || u.displayName}</div>
                      <div className="text-[10px] font-black text-gray-400">u:{u.displayName}</div>
                    </div>
                    <button className="p-2 border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black text-[10px]">VIEW</button>
                  </div>
                )) : (
                  <div className="h-40 flex items-center justify-center text-black font-black uppercase text-xs border-2 border-dashed border-black">
                    EMPTY_NETWORK_STATUS
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* BANNER SECTION */}
              <div className="relative h-32 md:h-40 shrink-0 border-b-2 border-black bg-[#d1b8d6] overflow-hidden group">
                {(isEditing ? editBanner : profile.bannerURL) ? (
                  <img src={isEditing ? editBanner : profile.bannerURL} alt="banner" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-20">
                    <div className="grid grid-cols-4 gap-4">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <div key={i} className="w-1 h-1 bg-black rounded-full"></div>)}
                    </div>
                  </div>
                )}
                {isEditing && (
                  <button onClick={() => bannerInputRef.current?.click()} className="absolute inset-0 bg-black/50 text-white font-black text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2 uppercase tracking-widest">
                    <ImageIcon size={16} /> SET_WALLPAPER
                  </button>
                )}
                <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setBannerFile(file);
                    const r = new FileReader();
                    r.onload = (ev) => setEditBanner(ev.target?.result as string);
                    r.readAsDataURL(file);
                  }
                }} />
              </div>

              {/* HEADER: Blocky Neubrutalist */}
              <div className="relative p-6 pt-0 border-b-2 border-black bg-[#f4f4f5]">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-8 -mt-12">
                  {/* HEX PHOTO */}
                  <div className="relative shrink-0">
                    <div className="w-32 h-32 bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden relative group">
                      {(isEditing ? editPhoto : profile.photoURL) ? (
                        <img src={isEditing ? editPhoto : profile.photoURL} alt="avi" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl font-black bg-black text-white">{profile.displayName[0]}</div>
                      )}
                      {isEditing && (
                        <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/70 text-white font-black text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">UPDATE_MEDIA</button>
                      )}
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPhotoFile(file);
                        const r = new FileReader();
                        r.onload = (ev) => setEditPhoto(ev.target?.result as string);
                        r.readAsDataURL(file);
                      }
                    }} />
                    {!isOwnProfile && profile.friendStatus === 'friends' && (
                      <div className="absolute -bottom-2 -right-2 bg-[#b8d6c6] border-2 border-black px-2 py-0.5 text-[8px] font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">TRUSTED_CONTACT</div>
                    )}
                  </div>

                  {/* PROFILE INFO */}
                  <div className="flex-1 text-center md:text-left">
                    <div className="mb-4">
                      <h2 className="text-3xl font-black uppercase tracking-tighter text-black bg-white px-4 py-0 mb-4 inline-block border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">{profile.fullName || profile.displayName}</h2>
                      <div className="flex flex-wrap justify-center md:justify-start gap-2">
                        <span className="px-2 py-0.5 border-2 border-black bg-white text-[9px] font-black tracking-widest uppercase">NODE: #{profile.displayName}</span>
                        {isOwnProfile && <span className="px-2 py-0.5 border-2 border-black bg-black text-white text-[9px] font-black tracking-widest uppercase italic">ROOT_USER</span>}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-center md:justify-start gap-6">
                      <button onClick={() => handleViewNetwork('friends')} className="bg-white border-2 border-black px-3 py-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none hover:bg-gray-50 flex items-center gap-2">
                        <Users size={14} strokeWidth={3} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{profile.friendCount || 0} FRIENDS</span>
                      </button>
                      <div className="bg-white border-2 border-black px-3 py-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
                        <Activity size={14} strokeWidth={3} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{userPosts.length} CONTRIBUTIONS</span>
                      </div>
                    </div>
                  </div>

                  {/* ACTIONS */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {isOwnProfile ? (
                      !isEditing ? (
                        <button onClick={() => setIsEditing(true)} className="px-6 py-3 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none font-black text-xs uppercase tracking-widest flex items-center gap-2"><Edit2 size={14} strokeWidth={3} /> EDIT_UI</button>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => setIsEditing(false)} className="px-4 py-3 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none font-black text-xs uppercase tracking-widest">CANCEL</button>
                          <button onClick={handleSaveProfile} disabled={isSaving} className="px-4 py-3 bg-[#b8d6c6] border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none font-black text-xs uppercase tracking-widest disabled:opacity-50">
                            {isSaving ? 'UPLOADING...' : 'SAVE_NODE'}
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col gap-2">
                        <button onClick={() => onChat(profile.uid)} className="px-6 py-3 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none font-black text-xs uppercase tracking-widest flex items-center gap-2"><MessageCircle size={14} strokeWidth={3} /> SEND MESSAGE</button>
                        <button onClick={handleFriendAction} className={`px-6 py-3 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none font-black text-xs uppercase tracking-widest flex items-center gap-2 ${profile.friendStatus === 'friends' ? 'bg-[#d1b8d6]' : 'bg-[#a6cade]'}`}>
                          {profile.friendStatus === 'friends' ? <><UserCheck size={14} strokeWidth={3} /> FRIEND</> : profile.friendStatus === 'pending_sent' ? <><Loader size={12} className="animate-spin" /> PENDING...</> : <><UserPlus size={14} strokeWidth={3} /> ADD FRIEND</>}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* BIO / EDITING AREA */}
              {(isEditing || profile.bio) && (
                <div className="p-6 bg-white border-b-2 border-black">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest mb-1 block opacity-50">DISPLAY_TITLE</label>
                        <input value={editFullName} onChange={e => setEditFullName(e.target.value)} className="w-full bg-[#f4f4f5] border-2 border-black p-3 font-mono text-sm focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest mb-1 block opacity-50">NODE_DESCRIPTION</label>
                        <textarea value={editBio} onChange={e => setEditBio(e.target.value)} className="w-full bg-[#f4f4f5] border-2 border-black p-3 font-mono text-sm focus:outline-none min-h-[80px]" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-4 items-start">
                      <div className="p-2 border-2 border-black bg-black text-white shrink-0"><Info size={16} /></div>
                      <p className="text-sm font-black italic tracking-tight leading-snug">"{profile.bio}"</p>
                    </div>
                  )}
                </div>
              )}

              {/* TABS: Neubrutalist Bottom Borders */}
              <div className="flex bg-white border-b-2 border-black overflow-x-auto no-scrollbar">
                {[
                  { id: 'posts', label: 'THREADS', count: threads.length, icon: MessageSquare },
                  { id: 'comments', label: 'COMMENTS', count: comments.length, icon: MessageCircle },
                  { id: 'blinks', label: 'BLINKS', count: blinks.length, icon: PlaySquare },
                  { id: 'spaces', label: 'SPACES', count: userSpaces.length, icon: Layout },
                  ...(isOwnProfile ? [{ id: 'settings', label: 'SECURITY', icon: ShieldCheck }] : [])
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-4 px-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 border-r last:border-r-0 border-black ${activeTab === tab.id ? 'bg-black text-white' : 'hover:bg-[#f4f4f5]'}`}
                  >
                    <tab.icon size={12} strokeWidth={3} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* TAB CONTENT: Scrollable */}
              <div className="flex-1 overflow-y-auto p-6 bg-[#f4f4f5]">
                {activeTab === 'posts' && (
                  <div className="space-y-4">
                    {threads.length > 0 ? threads.map(p => (
                      <div key={p.id} onClick={() => onOpenThread(p.id)} className="p-4 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-[#fffcf0] transition-colors cursor-pointer group relative">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[9px] font-black uppercase tracking-widest opacity-40">{formatDate(p.createdAt)}</span>
                          {isOwnProfile && <button onClick={(e) => handleDeleteUserPost(p.id, e)} className="p-1 border border-black bg-white hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>}
                        </div>
                        <div className="flex gap-4">
                          {p.mediaUrl && <div className="w-16 h-16 border-2 border-black shrink-0 overflow-hidden bg-gray-100"><img src={p.mediaUrl} className="w-full h-full object-cover" alt="m" /></div>}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-black text-sm uppercase mb-1 truncate">{p.title || "UNTITLED_THREAD"}</h4>
                            <p className="text-xs font-bold text-gray-600 line-clamp-2 leading-tight">{p.text}</p>
                            <div className="flex gap-2 mt-2 items-center">
                              <span className="text-[8px] font-black bg-gray-100 px-1 border border-black uppercase text-gray-500">LIKES: {p.likes}</span>
                              {p.spaceHandle ? (
                                <span className={`text-[8px] font-black px-1 border border-black uppercase ${p.tags?.includes('PAGE') ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                                  IN {p.tags?.includes('PAGE') ? 'PAGE' : 'GROUP'} {formatHandle(p.spaceHandle, p.tags?.includes('PAGE') ? 'page' : 'group')}
                                </span>
                              ) : (
                                <span className="text-[8px] font-black px-1 border border-black uppercase bg-gray-50 text-gray-400">PUBLIC STREAM</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="h-40 flex items-center justify-center border-2 border-black border-dashed font-black text-[10px] uppercase">NO_THREADS_PUBLISHED</div>
                    )}
                  </div>
                )}

                {activeTab === 'comments' && (
                  <div className="space-y-4">
                    {comments.length > 0 ? comments.map(c => (
                      <div key={c.id} onClick={() => onOpenThread(c.id)} className="p-4 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-[#f0f9ff] transition-colors cursor-pointer group relative">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-40">REPLIED {formatDate(c.createdAt)}</span>
                            {c.spaceHandle ? (
                              <span className={`text-[8px] font-black px-1 border border-black uppercase ${c.tags?.includes('PAGE') ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                                IN {c.tags?.includes('PAGE') ? 'PAGE' : 'GROUP'}
                              </span>
                            ) : (
                              <span className="text-[7px] font-black border border-gray-200 px-1 text-gray-400 uppercase">STREAM</span>
                            )}
                          </div>
                          {isOwnProfile && <button onClick={(e) => handleDeleteUserPost(c.id, e)} className="p-1 border border-black bg-white hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>}
                        </div>
                        <div className="flex items-start gap-3">
                          <MessageCircle size={16} className="mt-1 text-gray-300" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-700 line-clamp-3 leading-relaxed">"{c.text}"</p>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="h-40 flex items-center justify-center border-2 border-black border-dashed font-black text-[10px] uppercase">NO_COMMENTS_MADE</div>
                    )}
                  </div>
                )}

                {activeTab === 'blinks' && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {blinks.length > 0 ? blinks.map(b => (
                      <div key={b.id} onClick={() => onOpenThread(b.id)} className="aspect-[9/16] border-2 border-black bg-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative group cursor-pointer overflow-hidden active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
                        <video src={b.mediaUrl} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60"></div>
                        <div className="absolute bottom-2 left-2 right-2">
                          <p className="text-[10px] font-black text-white line-clamp-2 uppercase leading-none mb-1">{b.text}</p>
                          <span className="text-[8px] font-black text-white/50 bg-black/50 px-1 py-0.5 border border-white/20">VOTES: {b.likes}</span>
                        </div>
                      </div>
                    )) : (
                      <div className="col-span-full h-40 flex items-center justify-center border-2 border-black border-dashed font-black text-[10px] uppercase">NULL_VIDEO_NODES</div>
                    )}
                  </div>
                )}

                {activeTab === 'spaces' && (
                  <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col gap-2 mb-4 bg-white border border-black p-2 rounded-lg">
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 mr-2">TYPE:</span>
                        <button onClick={() => setSpaceTypeFilter('all')} className={`px-2 py-0.5 text-[8px] font-black border border-black uppercase ${spaceTypeFilter === 'all' ? 'bg-black text-white' : 'bg-white text-gray-500'}`}>ALL</button>
                        <button onClick={() => setSpaceTypeFilter('group')} className={`px-2 py-0.5 text-[8px] font-black border border-black uppercase ${spaceTypeFilter === 'group' ? 'bg-black text-white' : 'bg-white text-gray-500'}`}>GROUPS</button>
                        <button onClick={() => setSpaceTypeFilter('page')} className={`px-2 py-0.5 text-[8px] font-black border border-black uppercase ${spaceTypeFilter === 'page' ? 'bg-black text-white' : 'bg-white text-gray-500'}`}>PAGES</button>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                        <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 mr-2">ROLE:</span>
                        <button onClick={() => setSpaceRoleFilter('all')} className={`px-2 py-0.5 text-[8px] font-black border border-black uppercase ${spaceRoleFilter === 'all' ? 'bg-black text-white' : 'bg-white text-gray-500'}`}>ALL</button>
                        <button onClick={() => setSpaceRoleFilter('own')} className={`px-2 py-0.5 text-[8px] font-black border border-black uppercase ${spaceRoleFilter === 'own' ? 'bg-black text-white' : 'bg-white text-gray-500'}`}>OWNED</button>
                        <button onClick={() => setSpaceRoleFilter('joined')} className={`px-2 py-0.5 text-[8px] font-black border border-black uppercase ${spaceRoleFilter === 'joined' ? 'bg-black text-white' : 'bg-white text-gray-500'}`}>SUBSCRIBED</button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {filteredSpaces.length > 0 ? filteredSpaces.map(s => (
                        <div key={s.id} onClick={() => { onClose(); onNavigate(s.id); }} className="p-4 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-4 hover:bg-[#fffcf0] cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
                          <div className={`w-12 h-12 border-2 border-black shrink-0 overflow-hidden flex items-center justify-center ${s.type === 'group' ? 'bg-green-100' : 'bg-blue-100'}`}>
                            {s.avatarURL ? <img src={s.avatarURL} alt="s" className="w-full h-full object-cover" /> : (
                              s.type === 'group' ? <Users size={20} className="text-black" /> : <Layout size={20} className="text-black" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[8px] font-black px-1 border border-black uppercase ${s.type === 'group' ? 'bg-green-300' : 'bg-blue-300'}`}>{s.type}</span>
                              {s.ownerId === profile?.uid && <span className="text-[8px] font-black px-1 border border-black bg-yellow-400 uppercase">OWNER</span>}
                            </div>
                            <h4 className="font-black text-sm uppercase truncate">{s.name}</h4>
                            <p className="text-[10px] font-black text-gray-400 tracking-wider truncate">{s.handle}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-[9px] font-black uppercase text-gray-400">{s.memberCount || 0} MEMBERS</div>
                          </div>
                        </div>
                      )) : (
                        <div className="py-12 flex flex-col items-center justify-center border-2 border-black border-dashed font-black text-[10px] uppercase text-gray-400 bg-gray-50">
                          <Layout size={24} className="mb-2 opacity-20" />
                          NO_SPACES_MATCH_FILTER
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div className="max-w-md mx-auto py-8">
                    <div className="p-8 border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-8">
                      <div className="text-center font-black space-y-2 uppercase">
                        <ShieldCheck size={40} className="mx-auto" strokeWidth={3} />
                        <h3 className="text-xl tracking-tighter">SECURITY_PROTOCOL</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="p-4 border-2 border-black bg-[#f4f4f5]">
                          <label className="text-[10px] font-black uppercase block opacity-40 mb-1">GARDEN_ID</label>
                          <div className="flex items-center justify-between font-mono font-black text-sm">
                            <span>#{profile.displayName}</span>
                            <span className="text-[10px] border border-black px-2 bg-white">LOCKED</span>
                          </div>
                        </div>
                        <div className="p-4 border-2 border-black bg-[#f4f4f5]">
                          <label className="text-[10px] font-black uppercase block opacity-40 mb-1">SESSION_AUTH</label>
                          <div className="font-mono font-black text-[10px] tracking-widest">{currentUser?.isAnonymous ? "LEVEL: GUEST" : "LEVEL: AUTHENTICATED"}</div>
                        </div>
                      </div>
                      <button onClick={onLogout} className="w-full py-4 bg-black text-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none font-black text-xs tracking-[0.2em] uppercase">TERMINATE_SESSION</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
};


export const MindStream = ({
  user,
  onOpenLogin,
  onLogout,
  initialProfileId,
  onClearInitialProfileId,
  onToggleChat,
  unreadCount = 0,
  initialThreadId,
  onClearInitialThreadId
}: {
  user: UserProfile | null,
  onOpenLogin: () => void,
  onLogout?: () => void,
  initialProfileId?: string | null,
  onClearInitialProfileId?: () => void,
  onToggleChat?: () => void,
  unreadCount?: number,
  initialThreadId?: string | null,
  onClearInitialThreadId?: () => void
}) => {
  const [thoughts, setThoughts] = useState<Comment[]>([]);
  const canPost = !!user;
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ url: string; type: string }[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // View State: 'stream' | 'spaces' | 'blinks'
  const [activeView, setActiveView] = useState<'stream' | 'spaces' | 'blinks'>('stream');
  const [activeSpace, setActiveSpace] = useState<Space | null>(null);

  // Use ID to track active thread so updates to 'thoughts' propagate immediately to the view
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThreadId || null);
  const activeThread = thoughts.find(t => t.id === activeThreadId) || null;
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);

  // Helper to find root thread of ANY comment/post ID
  const findThreadAndOpen = (targetId: string) => {
    // 1. Check if it's a top level thread
    const top = thoughts.find(t => t.id === targetId);
    if (top) {
      setActiveThreadId(targetId);
      setHighlightedCommentId(null);
      return;
    }

    // 2. Recursive search
    const containsNode = (node: Comment, target: string): boolean => {
      if (node.id === target) return true;
      if (node.children) {
        return node.children.some(child => containsNode(child, target));
      }
      return false;
    };

    for (const root of thoughts) {
      if (containsNode(root, targetId)) {
        setActiveThreadId(root.id);
        setHighlightedCommentId(targetId);
        return;
      }
    }
    showToast("Thread not found or unavailable.", 'error');
  };

  // Share Card State
  const [shareCardThread, setShareCardThread] = useState<Comment | null>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateReelOpen, setIsCreateReelOpen] = useState(false);
  const [reelStep, setReelStep] = useState(1);
  const [reelLocation, setReelLocation] = useState('');
  const [reelTags, setReelTags] = useState('');
  const [openedBlinkId, setOpenedBlinkId] = useState<string | null>(null);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<'suggested' | 'mine' | 'following' | 'directory'>('suggested');
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryFilter, setDirectoryFilter] = useState<'all' | 'group' | 'page'>('all');
  const [directoryTag, setDirectoryTag] = useState<string | null>(null);
  const [isMemberOfActiveSpace, setIsMemberOfActiveSpace] = useState(false);
  const [userSpaceRole, setUserSpaceRole] = useState<'member' | 'admin' | 'owner' | null>(null);
  const [userSpaceStatus, setUserSpaceStatus] = useState<'pending' | 'accepted' | 'blocked' | null>(null);

  // Space Management State
  const [isEditSpaceOpen, setIsEditSpaceOpen] = useState(false);
  const [isMemberManageOpen, setIsMemberManageOpen] = useState(false);
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [isUpdatingSpace, setIsUpdatingSpace] = useState(false);
  const [recentSpaceIds, setRecentSpaceIds] = useState<string[]>([]);

  // Update recent spaces
  useEffect(() => {
    if (activeSpace) {
      setRecentSpaceIds(prev => {
        const filtered = prev.filter(id => id !== activeSpace.id);
        return [activeSpace.id, ...filtered].slice(0, 3);
      });
    }
  }, [activeSpace]);

  // Dashboard Expansion States
  const [showAllSuggestedGroups, setShowAllSuggestedGroups] = useState(false);
  const [showAllSuggestedPages, setShowAllSuggestedPages] = useState(false);
  const [showAllMySpaces, setShowAllMySpaces] = useState(false);
  const [showAllFollowing, setShowAllFollowing] = useState(false);

  const isSpaceAdmin = (userSpaceRole === 'admin' || userSpaceRole === 'owner') || (activeSpace && user && activeSpace.ownerId === user.uid);
  const isSpaceOwner = userSpaceRole === 'owner' || (activeSpace && user && activeSpace.ownerId === user.uid);

  // Fetch Member Status and Pending Requests
  useEffect(() => {
    if (activeSpace && user) {
      fetchSpaceMembership(activeSpace.id, user.uid).then(status => {
        if (status) {
          setUserSpaceRole(status.role);
          setUserSpaceStatus(status.status);
          setIsMemberOfActiveSpace(status.status === 'accepted');
        } else if (activeSpace.ownerId === user.uid) {
          // Robust Owner Check: If I'm the owner but membership record is missing/delayed
          setUserSpaceRole('owner');
          setUserSpaceStatus('accepted');
          setIsMemberOfActiveSpace(true);
        } else {
          setUserSpaceRole(null);
          setUserSpaceStatus(null);
          setIsMemberOfActiveSpace(false);
        }
      });
      fetchSpaceMembers(activeSpace.id).then(setSpaceMembers);
    } else if (activeSpace) {
      fetchSpaceMembers(activeSpace.id).then(setSpaceMembers);
      setUserSpaceRole(null);
      setUserSpaceStatus(null);
      setIsMemberOfActiveSpace(false);
    }
  }, [activeSpace, user]);

  useEffect(() => {
    if (activeSpace && isSpaceAdmin) {
      fetchPendingMembers(activeSpace.id).then(setPendingMembers);
    }
  }, [activeSpace, isSpaceAdmin]);

  useEffect(() => {
    if (activeSpace) {
      fetchSpaceMembers(activeSpace.id).then(setSpaceMembers);
    }
  }, [activeSpace]);
  const [spaceMembers, setSpaceMembers] = useState<{ uid: string, name: string, photoURL?: string, role?: string }[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [userSpaces, setUserSpaces] = useState<Space[]>([]);
  const [isCreateSpaceOpen, setIsCreateSpaceOpen] = useState(false);

  useEffect(() => {
    fetchSpaces().then(setSpaces);
  }, []);

  useEffect(() => {
    if (user?.uid) {
      fetchUserSpaces(user.uid).then(setUserSpaces);
    } else {
      setUserSpaces([]);
    }
  }, [user?.uid]);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      const unsub = subscribeToNotifications(user.uid, setNotifications);
      return () => {
        unsub();
      };
    }
  }, [user?.uid]);

  const unreadNotifsCount = notifications.filter(n => !n.isRead).length;

  const [newSpaceType, setNewSpaceType] = useState<'group' | 'page'>('group');
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceHandle, setNewSpaceHandle] = useState('');
  const [newSpaceDesc, setNewSpaceDesc] = useState('');
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);

  // Profile Modal State
  const [profileTargetId, setProfileTargetId] = useState<string | null>(initialProfileId || null);

  // Mobile Sidebar Toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Update profile target if prop changes (for external triggers like creator widget)
  useEffect(() => {
    if (initialProfileId) {
      setProfileTargetId(initialProfileId);
      // Clear the prop in parent so it doesn't reopen unwantedly on remount
      if (onClearInitialProfileId) {
        // Small timeout to ensure state is set before clearing
        setTimeout(onClearInitialProfileId, 100);
      }
    }
  }, [initialProfileId]);

  // Listen for open-user-profile event (e.g. from ChatWidget)
  useEffect(() => {
    const handleOpenProfile = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.userId) {
        console.log('Received open-user-profile event:', detail.userId);
        setProfileTargetId(detail.userId);
      }
    };
    window.addEventListener('open-user-profile', handleOpenProfile);
    return () => window.removeEventListener('open-user-profile', handleOpenProfile);
  }, []);

  // Update active thread if prop changes (Deep Linking)
  useEffect(() => {
    if (initialThreadId) {
      setActiveThreadId(initialThreadId);
      if (onClearInitialThreadId) {
        setTimeout(onClearInitialThreadId, 100);
      }
    }
  }, [initialThreadId]); // Restored closing bracket and dependency array

  // Consolidating redundant membership effects
  // Removed old fetchIsMember call here to avoid double-fetching and conflicts

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Toast Notifications
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000); // Auto remove after 5 seconds
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFilter, setSearchFilter] = useState<'all' | 'user' | 'group' | 'page'>('all');

  // Debounced global search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      const results = await globalSearch(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filtered search results based on active filter
  const filteredSearchResults = searchFilter === 'all'
    ? searchResults
    : searchResults.filter(r => r.type === searchFilter);

  // New Post Form (Top Level)
  useEffect(() => {
    const unsub = subscribeToFeed(setThoughts, user?.uid);
    return () => unsub();
  }, [user]);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const validFiles = files.filter(f => {
        if (f.size > 50 * 1024 * 1024) {
          showToast(`File ${f.name} too large. Max size 50MB.`, 'error');
          return false;
        }
        return true;
      });

      setSelectedFiles(prev => [...prev, ...validFiles]);
      const newPreviews = validFiles.map(f => ({
        url: URL.createObjectURL(f),
        type: f.type
      }));
      setFilePreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const clearFile = () => {
    filePreviews.forEach(p => URL.revokeObjectURL(p.url));
    setSelectedFiles([]);
    setFilePreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeSelectedFile = (index: number) => {
    URL.revokeObjectURL(filePreviews[index].url);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Handle creating a NEW thread
  const handlePost = async () => {
    if (!user || (!text && selectedFiles.length === 0)) return;
    setIsPosting(true);
    try {
      // If we are in a space, associate the post with it
      await postThought(text, user, null, title, selectedFiles, activeSpace?.id, undefined, undefined, activeSpace?.handle);
      setText('');
      setTitle('');
      clearFile();
      setIsCreateOpen(false);
    } catch (e: any) {
      showToast(`Failed to post: ${e.message}`, 'error');
    } finally {
      setIsPosting(false);
    }
  };

  const handlePostReel = async () => {
    if (!user || selectedFiles.length === 0) return;
    setIsPosting(true);
    try {
      const tags = reelTags.split(/[,\s]+/).map(t => t.startsWith('#') ? t : `#${t}`).filter(t => t.length > 1);
      await postThought(text, user, null, title, selectedFiles, activeSpace?.id, reelLocation, tags, activeSpace?.handle);
      setText('');
      setTitle('');
      setReelLocation('');
      setReelTags('');
      clearFile();
      setIsCreateReelOpen(false);
      setReelStep(1);
    } catch (e: any) {
      showToast(`Failed to post reel: ${e.message}`, 'error');
    } finally {
      setIsPosting(false);
    }
  };

  const handleReelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        alert("Please select a video file for the reel.");
        return;
      }
      // Check duration
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        if (video.duration > 61) {
          showToast("Note: This video is longer than 60 seconds. Only the first 60 seconds will be featured in the collective feed.", 'info');
        }
        setSelectedFiles([file]);
        setFilePreviews([{ url: URL.createObjectURL(file), type: file.type }]);
        setReelStep(2); // Auto proceed to next step
      };
      video.src = URL.createObjectURL(file);
    }
  };

  const handleSpaceClick = (spaceId: string) => {
    const space = spaces.find(s => s.id === spaceId);
    if (space) {
      setActiveSpace(space);
      setActiveView('spaces');
      setActiveThreadId(null);
      setProfileTargetId(null);
    }
  };

  const handleCreateSpace = async () => {
    if (!user) return;
    setIsCreatingSpace(true);
    try {
      const freshSpace = await createSpace({
        name: newSpaceName,
        handle: (newSpaceType === 'group' ? 'g:' : 'p:') + newSpaceHandle,
        description: newSpaceDesc,
        type: newSpaceType,
        owner_id: user.uid
      });
      if (freshSpace) {
        setSpaces(prev => [freshSpace, ...prev]);
        setUserSpaces(prev => [freshSpace, ...prev]); // Add to my clusters
        setActiveSpace(freshSpace);
        setActiveView('spaces');
        setIsCreateSpaceOpen(false);
        // Reset fields
        setNewSpaceName('');
        setNewSpaceHandle('');
        setNewSpaceDesc('');
        // Immediately set owner role locally
        setUserSpaceRole('owner');
        setUserSpaceStatus('accepted');
        setIsMemberOfActiveSpace(true);
        setSpaceMembers([{ uid: user.uid, name: user.displayName, photoURL: user.photoURL, role: 'owner' }]);
      }
    } catch (e: any) {
      showToast(e.message || "Failed to create space. Please try again.", 'error');
    } finally {
      setIsCreatingSpace(false);
    }
  };

  const handleTogglePin = async (id: string, currentlyPinned: boolean) => {
    try {
      await togglePinPost(id, !currentlyPinned);
      showToast(currentlyPinned ? "Unpinned from space." : "Pinned to space.", 'success');
      // Refresh local state
      setThoughts(prev => prev.map(t => t.id === id ? { ...t, tags: currentlyPinned ? (t.tags || []).filter(v => v !== 'PIN') : [...(t.tags || []), 'PIN'] } : t));
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const handleRemoveMember = async (sid: string, uid: string) => {
    if (!window.confirm("Remove this member from the space?")) return;
    try {
      await removeMember(sid, uid);
      setSpaceMembers(prev => prev.filter(m => m.uid !== uid));
      showToast("Member removed.", 'info');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Handle deletion (Optimistic)
  const handleDeleteThought = async (id: string) => {
    if (!user) return;

    // Optimistic Update: Immediately remove from local state
    setThoughts(prev => prev.filter(t => t.id !== id));

    // API Call
    try {
      await deletePost(id, user.uid);
    } catch (e: any) {
      console.error("Failed to delete post on server", e);
      // Alert the user about the failure
      showToast(`Failed to delete post: ${e.message}`, 'error');
      // Note: For a robust app we would revert the optimistic update here by re-fetching.
      // Since we have real-time subscription, the next update might fix it or we can force reload,
      // but often if it fails on server, it won't be deleted, so it will come back on next sync.
    }
  };

  // Handle Share (Deep Linking)
  const handleShare = async (thread: Comment) => {
    // 1. Set thread to render the hidden card
    setShareCardThread(thread);

    // 2. Wait for render, then capture
    setTimeout(async () => {
      if (shareCardRef.current) {
        try {
          const blob = await toBlob(shareCardRef.current, { cacheBust: true, backgroundColor: '#fcfbf9' });
          const url = `${window.location.origin}${window.location.pathname}?thread=${thread.id}`;

          if (blob) {
            const file = new File([blob], 'stream-thought.png', { type: 'image/png' });
            const shareData = {
              title: 'Stream Thought',
              text: `"${thread.title || thread.text.substring(0, 30)}..." - by ${thread.authorName}\n${url}`,
              files: [file],
              url: url
            };

            // Check if can share files
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share(shareData);
            } else {
              // Fallback for desktop/unsupported
              await navigator.clipboard.writeText(url);
              showToast("Link copied! (Image sharing not supported on this device)", 'success');
            }
          }
        } catch (err) {
          console.error("Share gen error:", err);
          const url = `${window.location.origin}${window.location.pathname}?thread=${thread.id}`;
          await navigator.clipboard.writeText(url);
          showToast("Link copied!", 'success');
        } finally {
          setShareCardThread(null);
        }
      }
    }, 100);
  };

  // Handle inline comments/replies
  const handleInlinePost = async (text: string, parentId: string | null, files?: File[]) => {
    if (!user) {
      onOpenLogin();
      return;
    }

    // Optimistic Update
    const tempId = `temp-${Date.now()}`;
    const blobUrl = files && files.length > 0 ? URL.createObjectURL(files[0]) : null;
    const mediaType = files && files.length > 0 ? (files[0].type.startsWith('video') ? 'video' : 'image') : null;

    const newThought: Comment = {
      id: tempId,
      postId: 'stream',
      parentId: parentId || null,
      title: null,
      text,
      authorId: user.uid,
      authorName: user.displayName,
      authorPhoto: user.photoURL,
      mediaUrl: blobUrl,
      mediaType: mediaType,
      mediaItems: [],
      likes: 0,
      createdAt: { toDate: () => new Date() },
      children: [],
      spaceId: activeSpace?.id || null,
      spaceHandle: activeSpace?.handle || null
    };

    const addNodeToTree = (nodes: Comment[], newNode: Comment): Comment[] => {
      // If root reply (should be rare in this function context as parentId is usually set)
      if (!newNode.parentId) return [newNode, ...nodes];

      return nodes.map(node => {
        if (node.id === newNode.parentId) {
          return { ...node, children: [newNode, ...(node.children || [])] };
        } else if (node.children && node.children.length > 0) {
          return { ...node, children: addNodeToTree(node.children, newNode) };
        }
        return node;
      });
    };

    setThoughts(prev => addNodeToTree(prev, newThought));

    try {
      await postThought(text, user, parentId, undefined, files, activeSpace?.id, undefined, undefined, activeSpace?.handle);
    } catch (e: any) {
      showToast(`Failed to reply: ${e.message}`, 'error');
      // If failed, we should theoretically remove the optimistic node, but avoiding complex revert for now.
    }
  };

  const handleVote = async (postId: string, val: number) => {
    if (!user) {
      onOpenLogin();
      return;
    }
    const updateThreadVote = (nodes: Comment[]): Comment[] => {
      return nodes.map(node => {
        if (node.id === postId) {
          const oldVote = node.userVote || 0;
          const diff = val - oldVote;
          return {
            ...node,
            userVote: val,
            likes: (node.likes || 0) + diff
          };
        } else if (node.children && node.children.length > 0) {
          return { ...node, children: updateThreadVote(node.children) };
        }
        return node;
      });
    };

    const findSpecificNode = (nodes: Comment[]): Comment | undefined => {
      for (const n of nodes) {
        if (n.id === postId) return n;
        if (n.children && n.children.length > 0) {
          const found = findSpecificNode(n.children);
          if (found) return found;
        }
      }
      return undefined;
    };

    const targetNode = findSpecificNode(thoughts);

    if (targetNode) {
      // RULE: In groups, only members can vote.
      if (targetNode.spaceId) {
        const space = spaces.find(s => s.id === targetNode.spaceId);
        if (space && space.type === 'group') {
          const membership = await fetchIsMember(space.id, user.uid);
          if (!membership || membership.status !== 'accepted') {
            showToast("Only members of this group can vote on posts.", 'error');
            return;
          }
        }
      }

      // Optimistic Update
      setThoughts(prev => updateThreadVote(prev));

      try {
        await votePost(postId, user.uid, val, targetNode.likes || 0, targetNode.userVote || 0);
      } catch (e: any) {
        console.error("Voting error:", e);
        showToast("Failed to record vote. " + (e.message || ""), 'error');
        // Refresh feed to sync state back
        subscribeToFeed(setThoughts, user.uid);
      }
    }
  };

  // Chat Trigger
  const handleChatTrigger = (targetUid: string) => {
    if (!canPost) {
      onOpenLogin();
      return;
    }
    // Close modals that might be open
    setProfileTargetId(null);
    setActiveThreadId(null);

    // Dispatch event for App.tsx to catch and open ChatWidget
    const event = new CustomEvent('open-chat-with-user', { detail: { userId: targetUid } });
    window.dispatchEvent(event);
  };

  const filteredThoughts = thoughts.filter(t => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();

    if (q.startsWith('u:')) {
      const targetUser = q.slice(2);
      return t.authorName.toLowerCase().includes(targetUser) && !t.spaceId;
    }
    if (q.startsWith('m:')) {
      const targetUser = q.slice(2);
      return t.authorName.toLowerCase().includes(targetUser) && !!t.spaceId;
    }
    if (q.startsWith('p:')) {
      const targetPage = q.slice(2);
      return (t.spaceHandle && formatHandle(t.spaceHandle, 'page').toLowerCase().includes(targetPage)) || (t.title && t.title.toLowerCase().includes(targetPage)) || t.text.toLowerCase().includes(targetPage);
    }
    if (q.startsWith('g:')) {
      const targetGroup = q.slice(2);
      return (t.spaceHandle && formatHandle(t.spaceHandle, 'group').toLowerCase().includes(targetGroup)) || (t.title && t.title.toLowerCase().includes(targetGroup)) || t.text.toLowerCase().includes(targetGroup);
    }

    return (
      (t.title && t.title.toLowerCase().includes(q)) ||
      t.text.toLowerCase().includes(q) ||
      t.authorName.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="flex flex-col md:flex-row h-full relative flex-1 bg-[#fcfcfc]">
        {/* --- SIDEBAR --- */}
        <div className={`
                absolute md:relative inset-0 z-40 md:z-auto bg-[#f8f9fa] md:border-r border-gray-100 flex flex-col shrink-0 transition-all duration-500 ease-in-out md:translate-x-0 w-full md:w-72
                ${isSidebarOpen ? 'translate-x-0 shadow-2xl overflow-hidden' : '-translate-x-full'}
              `}>
          {/* Mobile Sidebar Close */}
          <div className="md:hidden flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white">
            <div
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => { setActiveView('stream'); setActiveSpace(null); setIsSidebarOpen(false); }}
            >
              <h2 className="font-serif font-black text-xl tracking-tight text-gray-900 leading-none">Stream</h2>
              {canPost && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsNotifOpen(true); }}
                  className="relative p-2 text-gray-400 hover:text-black transition-colors"
                >
                  <Bell size={18} strokeWidth={2.5} />
                  {unreadNotifsCount > 0 && (
                    <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white shadow-sm" />
                  )}
                </button>
              )}
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-all text-gray-500 hover:text-black"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>

          <div className="px-5 py-5 border-b border-gray-100 hidden md:flex items-center justify-between bg-white/50">
            <div
              className="flex flex-col items-start cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => { setActiveView('stream'); setActiveSpace(null); }}
            >
              <h2 className="font-serif text-xl font-black tracking-tight text-gray-900 leading-none ml-5">Stream</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 opacity-70">The living collective mind</p>
            </div>
            {canPost && (
              <button
                onClick={() => setIsNotifOpen(true)}
                className="relative p-2 text-gray-400 hover:text-black transition-colors rounded-xl hover:bg-gray-50"
              >
                <Bell size={20} strokeWidth={2.5} />
                {unreadNotifsCount > 0 && (
                  <div className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-black border-2 border-white shadow-sm animate-pulse">
                    {unreadNotifsCount}
                  </div>
                )}
              </button>
            )}
          </div>

          <div className="p-5 flex flex-col gap-5 overflow-y-auto h-full">
            {/* Identity Section */}
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Your Identity</label>
              {canPost ? (
                <button
                  onClick={() => { setProfileTargetId(user.uid); setIsSidebarOpen(false); }}
                  className="w-full group flex items-center gap-3 p-3 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-black/5 transition-all duration-300 text-left relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-50/0 to-gray-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  <div className="relative w-8 h-8 bg-black rounded-full overflow-hidden text-white flex items-center justify-center shrink-0 shadow-inner">
                    {user?.photoURL ? <img src={user.photoURL} alt="avi" className="w-full h-full object-cover" /> : <User size={16} />}
                  </div>
                  <div className="relative min-w-0 flex-1">
                    <div className="text-[11px] font-black text-gray-900 truncate tracking-tight">{user.fullName || user.displayName}</div>
                    <div className="text-[9px] text-gray-400 font-medium truncate">u:{user.displayName}</div>
                  </div>
                  <Settings size={14} className="relative text-gray-300 group-hover:text-black transition-colors" />
                </button>
              ) : (
                <button
                  onClick={onOpenLogin}
                  className="w-full py-2.5 px-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:ring-2 hover:ring-black/5 transition-all text-left flex items-center justify-center gap-2 font-bold text-xs tracking-wide"
                >
                  <User size={14} strokeWidth={2.5} />
                  LOGIN / JOIN
                </button>
              )}
            </div>

            {/* Actions Section */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Interactions</label>

              <button
                onClick={() => { canPost ? setIsCreateOpen(true) : onOpenLogin(); setIsSidebarOpen(false); }}
                className="w-full py-2.5 rounded-2xl bg-black text-white shadow-lg hover:shadow-xl hover:translate-y-[-1px] active:translate-y-[0] transition-all duration-300 flex items-center justify-center gap-2 font-black text-sm tracking-tight"
              >
                <Edit2 size={16} strokeWidth={2.5} />
                POST THOUGHT
              </button>

              {/* Blinks Button */}
              <button
                onClick={() => { setActiveView('blinks'); setActiveSpace(null); setIsSidebarOpen(false); }}
                className={`w-full py-2.5 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 font-black text-sm tracking-tight border ${activeView === 'blinks'
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-100/50'
                  }`}
              >
                <PlaySquare size={16} strokeWidth={2.5} />
                BLINKS
              </button>

              {onToggleChat && (
                <div className="relative">
                  <button
                    onClick={() => { canPost ? onToggleChat() : onOpenLogin(); setIsSidebarOpen(false); }}
                    className={`w-full py-2.5 rounded-2xl flex items-center justify-center gap-2 font-black text-sm tracking-tight transition-all duration-300 ${canPost ? 'bg-yellow-200 text-black hover:bg-yellow-300 shadow-sm' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 opacity-80'}`}
                  >
                    <MessageCircle size={18} strokeWidth={2.5} />
                    {canPost ? 'MESSAGES' : 'MESSAGES'}
                  </button>
                  {canPost && unreadCount > 0 && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm animate-bounce">
                      {unreadCount}
                    </div>
                  )}
                </div>
              )}
              {/* Notifications Button Removed as per User Request and moved to header icon */}
            </div>

            {/* Spaces Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[10px] font-black uppercase text-gray-400 block tracking-widest">Spaces</label>
                <button
                  onClick={() => { canPost ? setIsCreateSpaceOpen(true) : onOpenLogin(); setIsSidebarOpen(false); }}
                  className="px-2.5 py-1 rounded-lg bg-black text-white text-[9px] font-black uppercase tracking-tighter hover:bg-gray-800 transition-all shadow-sm active:scale-95 flex items-center gap-1"
                >
                  <Plus size={10} strokeWidth={4} /> CREATE
                </button>
              </div>
              <div className="space-y-2">
                {recentSpaceIds.length > 0 ? recentSpaceIds.map(id => {
                  const space = spaces.find(s => s.id === id);
                  if (!space) return null;
                  return (
                    <button
                      key={space.id}
                      onClick={() => {
                        setActiveView('spaces');
                        setActiveSpace(space);
                        setIsSidebarOpen(false);
                      }}
                      className="w-full group flex items-center gap-3 p-2 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-black/5 transition-all duration-300 text-left relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-50/0 to-gray-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                      <div className="relative w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 shrink-0 group-hover:bg-black group-hover:text-white group-hover:border-black transition-all duration-300 overflow-hidden">
                        {space.avatarURL ? (
                          <img src={space.avatarURL} alt={space.name} className="w-full h-full object-cover" />
                        ) : (
                          space.type === 'group' ? <Users size={12} /> : <Layout size={12} />
                        )}
                      </div>

                      <div className="relative min-w-0 flex-1">
                        <div className="text-[10px] font-black text-black truncate tracking-tight mb-0">{space.name}</div>
                        <div className="text-[8px] text-gray-400 uppercase font-black tracking-wider truncate">{formatHandle(space.handle, space.type)}</div>
                      </div>

                      <ChevronLeft size={10} className="relative text-gray-300 rotate-180 group-hover:text-black transition-colors" />
                    </button>
                  );
                }) : spaces.slice(0, 3).map(space => (
                  <button
                    key={space.id}
                    onClick={() => {
                      setActiveView('spaces');
                      setActiveSpace(space);
                      setIsSidebarOpen(false);
                    }}
                    className="w-full group flex items-center gap-3 p-2 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-black/5 transition-all duration-300 text-left relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-50/0 to-gray-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                    <div className="relative w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 shrink-0 group-hover:bg-black group-hover:text-white group-hover:border-black transition-all duration-300 overflow-hidden">
                      {space.avatarURL ? (
                        <img src={space.avatarURL} alt={space.name} className="w-full h-full object-cover" />
                      ) : (
                        space.type === 'group' ? <Users size={12} /> : <Layout size={12} />
                      )}
                    </div>

                    <div className="relative min-w-0 flex-1">
                      <div className="text-[10px] font-black text-black truncate tracking-tight mb-0">{space.name}</div>
                      <div className="text-[8px] text-gray-400 uppercase font-black tracking-wider truncate">{formatHandle(space.handle, space.type)}</div>
                    </div>

                    <ChevronLeft size={10} className="relative text-gray-300 rotate-180 group-hover:text-black transition-colors" />
                  </button>
                ))}

                <button
                  onClick={() => { setActiveView('spaces'); setActiveSpace(null); setIsSidebarOpen(false); }}
                  className="w-full py-2 bg-white border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-[9px] font-black text-black hover:bg-green-50 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 rounded-lg"
                >
                  <Compass size={12} strokeWidth={2.5} /> EXPLORE_DIRECTORY
                </button>
              </div>
            </div>

            {/* Top Interests Section */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Top Interests</label>
              <div className="flex flex-wrap gap-2">
                <span
                  onClick={() => { setSearchQuery('Exploration'); setActiveView('stream'); setIsSidebarOpen(false); }}
                  className="px-3 py-1.5 bg-white border border-gray-100 rounded-xl text-[10px] font-bold text-gray-600 hover:border-black cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Compass size={12} className="text-blue-500" /> Exploration
                </span>
                <span
                  onClick={() => { setSearchQuery('Digital Art'); setActiveView('stream'); setIsSidebarOpen(false); }}
                  className="px-3 py-1.5 bg-white border border-gray-100 rounded-xl text-[10px] font-bold text-gray-600 hover:border-black cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Heart size={12} className="text-red-500" /> Digital Art
                </span>
                <span
                  onClick={() => { setSearchQuery('Startups'); setActiveView('stream'); setIsSidebarOpen(false); }}
                  className="px-3 py-1.5 bg-white border border-gray-100 rounded-xl text-[10px] font-bold text-gray-600 hover:border-black cursor-pointer transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Activity size={12} className="text-green-500" /> Startups
                </span>
              </div>
            </div>

            {/* Empty space for mt-auto to push content up */}
            <div className="mt-auto" />
          </div>
        </div>

        {/* --- MAIN FEED --- */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
          {/* Desktop Overlay: Floating Premium Search Pill (Top Right) */}
          <div className={`hidden md:block absolute top-6 right-8 z-30 transition-all duration-500 ease-out ${isSearchExpanded ? 'w-72' : 'w-12'} pointer-events-none`}>
            <div className="relative group pointer-events-auto">
              <div
                onClick={() => !isSearchExpanded && setIsSearchExpanded(true)}
                className={`absolute inset-0 bg-white/70 backdrop-blur-xl rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/10 transition-all duration-500 ease-out ${isSearchExpanded ? 'bg-white/90 border-black/20' : 'cursor-pointer hover:bg-white hover:scale-110'}`}
              />
              <div className="relative flex items-center h-12 overflow-hidden">
                <Search
                  className={`absolute left-4 text-gray-400 transition-all duration-300 ${isSearchExpanded ? 'text-black' : 'cursor-pointer'}`}
                  size={16}
                  strokeWidth={2.5}
                  onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                />
                <input
                  placeholder="Search thoughts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchExpanded(true)}
                  className={`w-full bg-transparent border-none rounded-full py-3 pl-11 pr-10 text-sm font-medium focus:ring-0 placeholder-gray-400 focus:outline-none transition-opacity duration-300 ${isSearchExpanded ? 'opacity-100' : 'opacity-0'}`}
                />
                {isSearchExpanded && (
                  <button
                    onClick={(e) => { e.stopPropagation(); if (searchQuery) setSearchQuery(''); else setIsSearchExpanded(false); }}
                    className="absolute right-4 p-1 hover:bg-black/5 rounded-full text-gray-400 hover:text-black transition-all"
                  >
                    {searchQuery ? <X size={14} strokeWidth={3} /> : <ChevronLeft size={14} strokeWidth={3} />}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Sleek Header Toolbar */}
          <div className={`md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0 h-16 relative z-30 transition-all duration-300 ${searchQuery || isMobileSearchOpen ? 'bg-white' : 'bg-white/95 backdrop-blur-md'}`}>
            {isMobileSearchOpen ? (
              <div className="flex-1 flex items-center gap-3 animate-fade-in w-full">
                <div className="relative flex-1 group">
                  <div className="absolute inset-0 bg-gray-100 rounded-full transition-all group-focus-within:bg-gray-200/50" />
                  <div className="relative flex items-center">
                    <Search size={16} className="absolute left-3.5 text-gray-400 pointer-events-none" />
                    <input
                      autoFocus
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-transparent border-none py-2.5 pl-10 pr-4 text-sm font-medium focus:ring-0 focus:outline-none placeholder-gray-500"
                    />
                  </div>
                </div>
                <button
                  onClick={() => { setSearchQuery(''); setIsMobileSearchOpen(false); }}
                  className="text-xs font-bold tracking-widest text-gray-400 active:text-black transition-colors px-2"
                >
                  CANCEL
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  {activeView !== 'stream' ? (
                    <button
                      onClick={() => {
                        if (activeSpace) setActiveSpace(null);
                        else setActiveView('stream');
                      }}
                      className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-black border border-gray-100 shadow-sm active:scale-90 transition-all"
                    >
                      <ChevronLeft size={18} />
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsSidebarOpen(true)}
                      className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-black border border-gray-100 shadow-sm active:scale-90 transition-all"
                    >
                      <Menu size={18} />
                      {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white" />
                      )}
                    </button>
                  )}
                  <h1 className="font-serif font-black text-2xl tracking-tight text-gray-900 capitalize truncate max-w-[150px]">
                    {activeSpace ? activeSpace.name : activeView}
                  </h1>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsMobileSearchOpen(true)}
                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-black active:scale-95 transition-all"
                  >
                    <Search size={22} strokeWidth={1.5} />
                  </button>

                  <button
                    onClick={() => canPost ? setIsCreateOpen(true) : onOpenLogin()}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-black text-white shadow-lg active:scale-90 transition-all"
                  >
                    <Edit2 size={18} />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Global Search Results Dropdown */}
          {searchQuery && searchQuery.trim().length >= 2 && (
            <div className="border-b border-gray-200 bg-white">
              <div className="px-4 py-3">
                <div className="text-[10px] font-black uppercase text-gray-400 mb-3 tracking-widest flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search size={12} />
                    {isSearching ? 'Searching...' : `Results for "${searchQuery}"`}
                  </div>
                  {!isSearching && searchResults.length > 0 && (
                    <span className="text-gray-300">({searchResults.length})</span>
                  )}
                </div>

                {/* Filter Tabs */}
                {!isSearching && searchResults.length > 0 && (
                  <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                    {[
                      { key: 'all', label: 'All', count: searchResults.length },
                      { key: 'user', label: 'Users', count: searchResults.filter(r => r.type === 'user').length },
                      { key: 'group', label: 'Groups', count: searchResults.filter(r => r.type === 'group').length },
                      { key: 'page', label: 'Pages', count: searchResults.filter(r => r.type === 'page').length }
                    ].map(filter => (
                      <button
                        key={filter.key}
                        onClick={() => setSearchFilter(filter.key as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${searchFilter === filter.key
                          ? 'bg-black text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                      >
                        {filter.label}
                        {filter.count > 0 && (
                          <span className={`ml-1.5 ${searchFilter === filter.key ? 'text-white/70' : 'text-gray-400'}`}>
                            ({filter.count})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {isSearching ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader size={20} className="animate-spin text-gray-400" />
                  </div>
                ) : filteredSearchResults.length > 0 ? (
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {filteredSearchResults.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => {
                          if (result.type === 'user') {
                            setProfileTargetId(result.id);
                          } else {
                            const found = spaces.find(s => s.id === result.id);
                            if (found) {
                              setActiveSpace(found);
                              setActiveView('spaces');
                            }
                          }
                          setSearchQuery('');
                          setIsMobileSearchOpen(false);
                          setIsSearchExpanded(false);
                        }}
                        className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 transition-all text-left group border border-transparent hover:border-gray-100"
                      >
                        <div className="w-9 h-9 rounded-full bg-black overflow-hidden flex items-center justify-center text-white font-bold shrink-0 shadow-sm">
                          {result.photoURL ? (
                            <img src={result.photoURL} alt={result.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs">{result.name[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[13px] truncate group-hover:text-black transition-colors leading-tight">
                            {result.name}
                          </div>
                          <div className="text-[10px] text-gray-400 truncate mt-0.5">
                            {formatHandle(result.handle, result.type as any)}
                          </div>
                        </div>
                        <div className="shrink-0">
                          <div className="px-2 py-0.5 rounded-md bg-gray-50 text-[8px] font-black uppercase tracking-wider text-gray-400 border border-gray-100">
                            {result.type}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <Search size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No results found</p>
                    <p className="text-xs mt-1">Try searching for users, groups, or pages</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Added min-h-0 to ensure flex container allows scrolling inside this div */}
          <div className="flex-1 overflow-y-auto relative min-h-0">
            {/* STREAM VIEW */}
            {activeView === 'stream' && (
              <div className="divide-y divide-gray-200">
                {filteredThoughts.length > 0 ? (
                  filteredThoughts.map(t => (
                    <ThreadItem
                      key={t.id}
                      thread={t}
                      onClick={() => setActiveThreadId(t.id)}
                      onVote={handleVote}
                      onUserClick={(uid) => setProfileTargetId(uid)}
                      onChat={handleChatTrigger}
                      currentUserId={user?.uid}
                      onDelete={(id) => {
                        if (window.confirm("Are you sure you want to delete this post?")) {
                          handleDeleteThought(id);
                        }
                      }}
                      onShare={handleShare}
                      onSpaceClick={handleSpaceClick}
                    />
                  ))
                ) : (
                  <div className="p-12 text-center flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                    <Activity size={32} className="opacity-20" />
                    <span className="font-mono text-sm">{searchQuery ? 'No matching thoughts.' : 'Stream is quiet. Be the first to post.'}</span>
                  </div>
                )}
                {/* Bottom spacer for mobile nav */}
                <div className="h-12 md:hidden"></div>
              </div>
            )}

            {/* SPACES VIEW (Dashboard or Specific Space) */}
            {activeView === 'spaces' && (
              <div className="flex-1 h-full bg-[#f4f4f5] p-2 md:p-4 overflow-hidden flex flex-col">
                <Window
                  title={activeSpace ? `Space_Link: ${activeSpace.handle}` : 'SPACES // Explorer'}
                  color={THEME.green}
                  className="h-full flex flex-col"
                  noPadding
                >
                  <div className="flex-1 flex flex-col overflow-hidden bg-white">
                    {activeSpace ? (
                      /* --- SPACE DETAIL VIEW --- */
                      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                        {/* Improved Header with Banner/Wallpaper */}
                        <div className="relative shrink-0 group/banner">
                          {/* Banner Image / Gradient */}
                          <div className="h-32 md:h-48 w-full bg-slate-900 relative overflow-hidden flex items-center justify-center">
                            {activeSpace.bannerURL ? (
                              <img src={activeSpace.bannerURL} className="w-full h-full object-cover" alt="banner" />
                            ) : (
                              <div className="opacity-10 flex border-black border-4">
                                <Activity className="w-full h-full p-8 text-white" />
                              </div>
                            )}
                            {/* Dark Overlay for Text Readability */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                            {isSpaceAdmin && (
                              <button
                                onClick={() => setIsEditSpaceOpen(true)}
                                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 backdrop-blur-md text-white p-2.5 rounded-full border border-white/20 transition-all z-20"
                                title="Edit Header"
                              >
                                <Camera size={18} />
                              </button>
                            )}
                          </div>

                          {/* Profile Overlay */}
                          <div className="px-6 pb-6 pt-0 -mt-10 relative flex flex-col md:flex-row md:items-end gap-6 z-10">
                            <div className="w-24 h-24 bg-black text-white border-4 border-white shadow-xl flex items-center justify-center text-4xl shrink-0 overflow-hidden">
                              {activeSpace.avatarURL ? (
                                <img src={activeSpace.avatarURL} className="w-full h-full object-cover" alt="avatar" />
                              ) : (activeSpace.type === 'group' ? <Users size={40} /> : <Layout size={40} />)}
                            </div>

                            <div className="flex-1 pb-2">
                              <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-xl md:text-2xl font-black tracking-tighter uppercase leading-none text-black bg-white px-3 py-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{activeSpace.name}</h2>
                                {activeSpace.isPrivate && <ShieldCheck size={20} className="text-yellow-400 drop-shadow-md" />}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="bg-white text-black px-2.5 py-1 text-[10px] font-black border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest">
                                  {formatHandle(activeSpace.handle, activeSpace.type)}
                                </span>
                                <span className="bg-yellow-400 text-black px-2.5 py-1 text-[10px] font-black border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest">
                                  {activeSpace.type.toUpperCase()}
                                </span>
                                <button
                                  onClick={() => setIsMemberManageOpen(true)}
                                  className="bg-green-400 text-black px-2.5 py-1 text-[10px] font-black border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] uppercase tracking-widest hover:bg-green-300 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                                >
                                  {activeSpace.type === 'group' ? `${activeSpace.memberCount || spaceMembers.length || 1} members` : `${activeSpace.followerCount || spaceMembers.length || 1} followers`}
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-3 pb-2">
                              {isSpaceAdmin && (
                                <>
                                  <Button
                                    onClick={() => setIsEditSpaceOpen(true)}
                                    className="px-4 py-2 font-black text-[10px] tracking-widest bg-white border-black hover:bg-gray-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2"
                                  >
                                    <Edit2 size={12} /> EDIT_SPACE
                                  </Button>
                                  <Button
                                    onClick={() => setIsMemberManageOpen(true)}
                                    className="px-4 py-2 font-black text-[10px] tracking-widest bg-yellow-400 border-black hover:bg-yellow-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                  >
                                    MANAGE_CLUSTER
                                  </Button>
                                </>
                              )}
                              <Button
                                onClick={() => setActiveSpace(null)}
                                className="px-4 py-2 font-black text-[10px] tracking-widest bg-white border-black hover:bg-gray-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                              >
                                BACK
                              </Button>
                              <Button
                                variant={isMemberOfActiveSpace ? "default" : "primary"}
                                className={`px-4 py-2 font-black text-[10px] tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${isMemberOfActiveSpace ? 'opacity-90' : ''}`}
                                disabled={userSpaceStatus === 'pending'}
                                onClick={async () => {
                                  if (!user) { onOpenLogin(); return; }
                                  try {
                                    if (isMemberOfActiveSpace) {
                                      if (window.confirm(`Leave this space?`)) {
                                        await leaveSpace(activeSpace.id, user.uid);
                                        setIsMemberOfActiveSpace(false);
                                        setUserSpaceStatus(null);
                                        setUserSpaceRole(null);
                                        showToast("Left space.", 'success');
                                      }
                                    } else {
                                      await joinSpace(activeSpace.id, user.uid, activeSpace.isPrivate);
                                      if (activeSpace.isPrivate) {
                                        setUserSpaceStatus('pending');
                                        showToast("Request sent to admins!", 'info');
                                      } else {
                                        setIsMemberOfActiveSpace(true);
                                        setUserSpaceStatus('accepted');
                                        setUserSpaceRole('member');
                                        showToast("Joined space successfully!", 'success');
                                        // Refresh member list
                                        fetchSpaceMembers(activeSpace.id).then(setSpaceMembers);
                                      }
                                    }
                                  } catch (err: any) {
                                    console.error(err);
                                    showToast(err.message || "Operation failed.", 'error');
                                  }
                                }}
                              >
                                {userSpaceStatus === 'pending'
                                  ? 'REQUEST_PENDING...'
                                  : (activeSpace.type === 'group'
                                    ? (isMemberOfActiveSpace ? 'EXIT GROUP' : 'JOIN GROUP')
                                    : (isMemberOfActiveSpace ? 'UNFOLLOW' : 'FOLLOW'))}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 max-w-7xl mx-auto w-full">
                          {/* Sub-feed Column */}
                          <div className="lg:col-span-2 space-y-4">
                            <div className="bg-gray-50 border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                              <button
                                onClick={() => { if (!user) onOpenLogin(); else setIsCreateOpen(true); }}
                                className="w-full text-left px-4 py-3 bg-white border border-black text-gray-400 text-xs font-black tracking-widest hover:bg-yellow-50 transition-all"
                              >
                                TX_BUFFER: Write to {activeSpace?.name}...
                              </button>
                            </div>
                            <div className="divide-y divide-black bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                              {thoughts.filter(t => t.spaceId === activeSpace?.id).length > 0 ? (
                                thoughts.filter(t => t.spaceId === activeSpace?.id).map(t => (
                                  <ThreadItem
                                    key={t.id}
                                    thread={t}
                                    onClick={() => setActiveThreadId(t.id)}
                                    onVote={handleVote}
                                    onUserClick={(uid) => setProfileTargetId(uid)}
                                    onChat={handleChatTrigger}
                                    currentUserId={user?.uid}
                                    onShare={handleShare}
                                    onSpaceClick={handleSpaceClick}
                                  />
                                ))
                              ) : (
                                <div className="p-16 text-center text-gray-400">
                                  <MessageSquare size={48} className="mx-auto mb-4 opacity-10" />
                                  <p className="font-bold italic text-sm">Empty Space</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Info Column */}
                          <div className="space-y-6">
                            <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2"><Info size={12} /> Registry // About</h3>
                              <p className="text-xs text-black leading-relaxed font-bold font-mono">{activeSpace?.description || 'Secure communication channel for the space. Share, explore and connect.'}</p>
                            </div>
                            <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2 font-black italic"><Plus size={12} strokeWidth={4} /> Pins // Threads</h3>
                              <div className="space-y-3">
                                {thoughts.filter(t => t.spaceId === activeSpace?.id && t.tags?.includes('PIN')).length > 0 ? (
                                  thoughts.filter(t => t.spaceId === activeSpace?.id && t.tags?.includes('PIN')).map(t => (
                                    <button
                                      key={t.id}
                                      onClick={() => setActiveThreadId(t.id)}
                                      className="block w-full text-left p-3 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-50 transition-all bg-white group"
                                    >
                                      <div className="text-[10px] font-black uppercase tracking-tight text-black group-hover:underline truncate">{t.title || t.text.slice(0, 30) + '...'}</div>
                                      <div className="text-[8px] font-bold text-gray-400 mt-1 uppercase tracking-widest flex items-center gap-1"><Activity size={8} /> Active in node</div>
                                    </button>
                                  ))
                                ) : (
                                  <div className="text-[9px] font-bold text-gray-300 uppercase italic py-2">No pinned threads yet.</div>
                                )}
                              </div>
                            </div>

                            <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2"><Users size={12} /> Members</h3>
                              <div className="space-y-2">
                                {spaceMembers.length > 0 ? spaceMembers.map(member => (
                                  <div
                                    key={member.uid}
                                    className="flex items-center gap-3 w-full p-2 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white transition-all group"
                                  >
                                    <button onClick={() => setProfileTargetId(member.uid)} className="w-8 h-8 bg-black overflow-hidden flex items-center justify-center shrink-0 border-2 border-white ring-1 ring-black shadow-sm">
                                      {member.photoURL ? <img src={member.photoURL} className="w-full h-full object-cover" alt="" /> : <User size={14} className="text-white" />}
                                    </button>
                                    <div className="flex-1 text-left min-w-0">
                                      <div className="text-[10px] font-black truncate uppercase tracking-tight text-black">u:{member.name}</div>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <div className="text-[7px] font-black bg-green-100 text-green-700 px-1 border border-green-200 uppercase tracking-widest">Active</div>
                                        {member.role === 'owner' && <div className="text-[7px] font-black bg-yellow-400 text-black px-1 border border-black uppercase tracking-widest">Owner</div>}
                                        {member.role === 'admin' && <div className="text-[7px] font-black bg-black text-white px-1 border border-black uppercase tracking-widest">Admin</div>}
                                      </div>
                                    </div>
                                    {isSpaceAdmin && member.uid !== user?.uid && member.role !== 'owner' && (
                                      <button
                                        onClick={() => handleRemoveMember(activeSpace!.id, member.uid)}
                                        className="p-1 hover:text-red-500 transition-colors"
                                        title="Remove Member"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                )) : (
                                  <div className="text-center py-8 text-gray-400 text-[10px] font-black uppercase tracking-widest border-2 border-dashed border-gray-100 bg-gray-50/50">
                                    Empty_Cluster
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* --- SPACES DASHBOARD --- */
                      <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                        <div className="max-w-6xl mx-auto space-y-10">
                          {/* Top Action / Title */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-200">
                            <div>
                              <h2 className="text-xl font-black tracking-tighter mb-0.5 uppercase">SPACES</h2>
                              <p className="text-gray-400 font-bold text-[10px] uppercase tracking-[0.2em] opacity-60">Explore and join community spaces</p>
                            </div>
                            <Button
                              variant="primary"
                              className="px-3 py-1.5 font-black text-[9px] tracking-widest transition-transform active:scale-95 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                              onClick={() => canPost ? setIsCreateSpaceOpen(true) : onOpenLogin()}
                            >
                              <Plus size={10} strokeWidth={5} className="mr-1.5" /> CREATE SPACE
                            </Button>
                          </div>

                          {/* Filter Tab System */}
                          <div className="flex border border-black bg-white overflow-hidden shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-lg">
                            {[
                              { id: 'suggested', label: 'Recommended' },
                              { id: 'mine', label: 'MY SPACES' },
                              { id: 'following', label: 'Subscribed' }
                            ].map((tab) => (
                              <button
                                key={tab.id}
                                onClick={() => setDashboardTab(tab.id as any)}
                                className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] transition-all ${dashboardTab === tab.id ? 'bg-black text-white hover:bg-black' : 'bg-white text-gray-400 hover:text-black hover:bg-gray-50 border-r last:border-0 border-black'}`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>

                          {dashboardTab === 'suggested' && (
                            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">

                              {/* NEW: Recently Visited Section */}
                              {recentSpaceIds.length > 0 && (
                                <div className="space-y-6">
                                  <div className="flex items-center justify-between px-1 border-l-2 border-yellow-400 pl-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">Recently_Surfed // History</label>
                                  </div>
                                  <div className="flex flex-wrap gap-3">
                                    {recentSpaceIds.map(id => {
                                      const space = spaces.find(s => s.id === id);
                                      if (!space) return null;
                                      return (
                                        <div
                                          key={space.id}
                                          onClick={() => setActiveSpace(space)}
                                          className="bg-white border-2 border-black p-2 flex flex-col items-center justify-center text-center w-24 h-24 shrink-0 gap-1.5 hover:bg-yellow-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer group rounded-xl"
                                        >
                                          <div className="w-8 h-8 bg-black text-white flex items-center justify-center shrink-0 border border-black shadow-[1px_1px_0px_0px_rgba(255,255,255,0.2)] rounded-lg overflow-hidden">
                                            {space.avatarURL ? (
                                              <img src={space.avatarURL} alt={space.name} className="w-full h-full object-cover" />
                                            ) : (
                                              space.type === 'group' ? <Users size={14} /> : <Layout size={14} />
                                            )}
                                          </div>
                                          <div className="w-full min-w-0">
                                            <div className="font-black text-[9px] text-black leading-tight truncate px-0.5 uppercase tracking-tighter">{space.name}</div>
                                            <div className="text-[6px] text-gray-400 font-bold uppercase tracking-widest truncate">{space.handle}</div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                {/* Section: Suggested Groups */}
                                <div className="space-y-6">
                                  <div className="flex items-center justify-between px-1 border-l-2 border-green-400 pl-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">Hub_Suggestions [Groups]</label>
                                    <button
                                      onClick={() => setDashboardTab('directory')}
                                      className="group/btn flex items-center gap-1.5 text-[9px] font-black text-black hover:text-green-600 transition-colors uppercase tracking-widest pl-2"
                                    >
                                      VIEW_ALL <ArrowRight size={10} className="group-hover/btn:translate-x-0.5 transition-transform" />
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-2.5">
                                    {spaces.filter(s => s.type === 'group').slice(0, 6).map(group => (
                                      <div
                                        key={group.id}
                                        onClick={() => setActiveSpace(group)}
                                        className="bg-white border-2 border-black p-2 flex flex-col items-center justify-center text-center w-24 h-24 shrink-0 gap-1.5 hover:bg-green-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer group rounded-xl"
                                      >
                                        <div className="w-8 h-8 bg-black text-white flex items-center justify-center shrink-0 border border-black shadow-[1px_1px_0px_0px_rgba(255,255,255,0.2)] rounded-lg overflow-hidden">
                                          {group.avatarURL ? (
                                            <img src={group.avatarURL} alt={group.name} className="w-full h-full object-cover" />
                                          ) : (
                                            <Users size={14} />
                                          )}
                                        </div>
                                        <div className="w-full min-w-0">
                                          <div className="font-black text-[9px] text-black leading-tight truncate px-0.5 uppercase tracking-tighter">{group.name}</div>
                                          <div className="text-[6px] text-gray-400 font-bold uppercase tracking-widest truncate">{group.handle}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Section: Suggested Pages */}
                                <div className="space-y-6">
                                  <div className="flex items-center justify-between px-1 border-l-2 border-blue-400 pl-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500">CreatorHub_Featured [Pages]</label>
                                    <button
                                      onClick={() => setDashboardTab('directory')}
                                      className="group/btn flex items-center gap-1.5 text-[9px] font-black text-black hover:text-blue-600 transition-colors uppercase tracking-widest pl-2"
                                    >
                                      VIEW_ALL <ArrowRight size={10} className="group-hover/btn:translate-x-0.5 transition-transform" />
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-2.5">
                                    {spaces.filter(s => s.type === 'page').slice(0, 6).map(page => (
                                      <div
                                        key={page.id}
                                        onClick={() => setActiveSpace(page)}
                                        className="bg-white border-2 border-black p-2 flex flex-col items-center justify-center text-center w-24 h-24 shrink-0 gap-1.5 hover:bg-blue-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer group rounded-xl"
                                      >
                                        <div className="w-8 h-8 bg-black text-white flex items-center justify-center shrink-0 border border-black shadow-[1px_1px_0px_0px_rgba(255,255,255,0.2)] rounded-lg overflow-hidden">
                                          {page.avatarURL ? (
                                            <img src={page.avatarURL} alt={page.name} className="w-full h-full object-cover" />
                                          ) : (
                                            <Layout size={14} />
                                          )}
                                        </div>
                                        <div className="w-full min-w-0">
                                          <div className="font-black text-[9px] text-black leading-tight truncate px-0.5 uppercase tracking-tighter">{page.name}</div>
                                          <div className="text-[6px] text-gray-400 font-bold uppercase tracking-widest truncate">{page.handle}</div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Section: Sub-feed (Spaces Stream) - ONLY IN SUGGESTED */}
                              <div className="space-y-6 pt-6">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                                  <div>
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 block mb-1">Collective Feed</label>
                                    <p className="text-[11px] font-bold text-gray-500 uppercase">TOP POSTS FROM SPACES YOU ARE IN</p>
                                  </div>
                                </div>

                                <div className="divide-y divide-gray-100 bg-white border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] overflow-hidden rounded-xl">
                                  {thoughts.filter(t => t.spaceId).length > 0 ? (
                                    thoughts.filter(t => t.spaceId).slice(0, 10).map(t => (
                                      <ThreadItem
                                        key={t.id}
                                        thread={t}
                                        onClick={() => setActiveThreadId(t.id)}
                                        onVote={handleVote}
                                        onUserClick={(uid) => setProfileTargetId(uid)}
                                        onChat={handleChatTrigger}
                                        currentUserId={user?.uid}
                                        onShare={handleShare}
                                        onSpaceClick={handleSpaceClick}
                                      />
                                    ))
                                  ) : (
                                    <div className="p-20 text-center text-gray-400">
                                      <Activity size={48} className="mx-auto mb-6 opacity-10 animate-pulse" />
                                      <div className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tighter">Silent_Gardens</div>
                                      <div className="text-[10px] font-bold text-gray-500 max-w-sm mx-auto leading-relaxed uppercase tracking-widest">Connect to nodes to receive data packets here.</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {dashboardTab === 'mine' && (
                            <div className="space-y-6">
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                {userSpaces.filter(s => s.ownerId === user?.uid).length > 0 ? (
                                  userSpaces.filter(s => s.ownerId === user?.uid).map(space => (
                                    <div
                                      key={space.id}
                                      onClick={() => setActiveSpace(space)}
                                      className="bg-white border border-black p-4 hover:bg-yellow-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer group flex flex-col items-center justify-center text-center aspect-square rounded-2xl"
                                    >
                                      <div className="w-10 h-10 border border-black flex items-center justify-center mb-3 group-hover:bg-black group-hover:text-white transition-colors rounded-xl overflow-hidden bg-purple-50">
                                        {space.avatarURL ? (
                                          <img src={space.avatarURL} alt={space.name} className="w-full h-full object-cover" />
                                        ) : (
                                          space.type === 'group' ? <Users size={18} className="text-purple-600" /> : <Layout size={18} className="text-blue-600" />
                                        )}
                                      </div>
                                      <h3 className="font-black text-[11px] mb-0.5 uppercase tracking-tighter truncate w-full text-black leading-tight px-1">{space.name}</h3>
                                      <p className="text-[7px] font-black text-gray-400 uppercase tracking-[0.2em]">{formatHandle(space.handle, space.type)}</p>
                                    </div>
                                  ))
                                ) : (
                                  <div className="col-span-full py-16 bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center rounded-2xl">
                                    <ShieldCheck size={32} strokeWidth={1.5} className="text-gray-300 mb-3" />
                                    <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest italic">No locally created instances found.</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {dashboardTab === 'following' && (
                            <div className="space-y-6">
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                {userSpaces.filter(s => s.ownerId !== user?.uid).length > 0 ? (
                                  userSpaces.filter(s => s.ownerId !== user?.uid).map(space => (
                                    <div
                                      key={space.id}
                                      onClick={() => setActiveSpace(space)}
                                      className="bg-white border border-black p-4 hover:bg-blue-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer group flex flex-col items-center justify-center text-center aspect-square rounded-2xl"
                                    >
                                      <div className="w-10 h-10 border border-black flex items-center justify-center mb-3 group-hover:bg-black group-hover:text-white transition-colors rounded-xl overflow-hidden bg-blue-50">
                                        {space.avatarURL ? (
                                          <img src={space.avatarURL} alt={space.name} className="w-full h-full object-cover" />
                                        ) : (
                                          space.type === 'group' ? <Users size={18} className="text-purple-600" /> : <Layout size={18} className="text-blue-600" />
                                        )}
                                      </div>
                                      <h3 className="font-black text-[11px] mb-0.5 uppercase tracking-tighter truncate w-full text-black leading-tight px-1">{space.name}</h3>
                                      <p className="text-[7px] font-black text-gray-400 uppercase tracking-[0.2em]">{formatHandle(space.handle, space.type)}</p>
                                    </div>
                                  ))
                                ) : (
                                  <div className="col-span-full py-16 bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center rounded-2xl">
                                    <ShieldCheck size={32} strokeWidth={1.5} className="text-gray-300 mb-3" />
                                    <p className="text-gray-400 font-black text-[10px] uppercase tracking-widest italic">No active subscriptions detected.</p>
                                    <button onClick={() => setDashboardTab('suggested')} className="mt-4 text-black font-black text-[9px] uppercase tracking-widest hover:underline">ACCESS DIRECTORY</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {dashboardTab === 'directory' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                              {/* Directory Header */}
                              <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                                <button
                                  onClick={() => setDashboardTab('suggested')}
                                  className="w-8 h-8 flex items-center justify-center border border-black rounded-lg hover:bg-black hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[1px] hover:translate-x-[1px] hover:translate-y-[1px]"
                                >
                                  <ChevronLeft size={16} />
                                </button>
                                <div>
                                  <h3 className="text-lg font-black uppercase tracking-tighter leading-none mb-1">GLOBAL_DIRECTORY</h3>
                                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-none">Browse all identified clusters on the network</p>
                                </div>
                              </div>

                              {/* Search & Main Filters */}
                              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between ">
                                <div className="flex-1 w-full relative">
                                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                  <input
                                    type="text"
                                    placeholder="SEARCH_CLUSTERS..."
                                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-black text-[10px] font-black uppercase tracking-widest rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-black/5 transition-all"
                                    value={directorySearch}
                                    onChange={(e) => setDirectorySearch(e.target.value)}
                                  />
                                </div>
                                <div className="flex items-center gap-2 p-1 bg-gray-100 border border-black rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar">
                                  {(['all', 'group', 'page'] as const).map((f) => (
                                    <button
                                      key={f}
                                      onClick={() => setDirectoryFilter(f)}
                                      className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${directoryFilter === f ? 'bg-black text-white' : 'text-gray-400 hover:text-black hover:bg-white'}`}
                                    >
                                      {f}S
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Topic / Tag Cloud */}
                              <div className="space-y-3">
                                <label className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 border-b border-gray-100 block pb-1 w-fit">FILTER_BY_TOPIC</label>
                                <div className="flex flex-wrap gap-2">
                                  {['General', 'Tech', 'Design', 'Media', 'Music', 'Gaming', 'Research', 'AI', 'Web3', 'Culture', 'Philosophy'].map(tag => (
                                    <button
                                      key={tag}
                                      onClick={() => setDirectoryTag(directoryTag === tag ? null : tag)}
                                      className={`px-3 py-1.5 border border-black rounded-full text-[8px] font-black uppercase tracking-widest transition-all ${directoryTag === tag ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white text-gray-400 hover:text-black hover:border-black active:translate-y-[1px]'}`}
                                    >
                                      #{tag}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Directory Results */}
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 pb-20">
                                {spaces
                                  .filter(s => {
                                    const matchesSearch = s.name.toLowerCase().includes(directorySearch.toLowerCase()) || s.handle.toLowerCase().includes(directorySearch.toLowerCase());
                                    const matchesFilter = directoryFilter === 'all' || s.type === directoryFilter;
                                    return matchesSearch && matchesFilter;
                                  })
                                  .map(space => (
                                    <div
                                      key={space.id}
                                      onClick={() => setActiveSpace(space)}
                                      className="bg-white border border-black p-4 flex flex-col items-center justify-center text-center aspect-square gap-2 hover:bg-gray-50 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer group rounded-2xl"
                                    >
                                      <div className={`w-10 h-10 border border-black flex items-center justify-center mb-1 group-hover:bg-black group-hover:text-white transition-colors rounded-xl overflow-hidden ${space.type === 'group' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                        {space.avatarURL ? (
                                          <img src={space.avatarURL} alt={space.name} className="w-full h-full object-cover" />
                                        ) : (
                                          space.type === 'group' ? <Users size={20} /> : <Layout size={20} />
                                        )}
                                      </div>
                                      <h3 className="font-black text-[10px] mb-0.5 uppercase tracking-tighter truncate w-full text-black leading-tight px-1">{space.name}</h3>
                                      <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest">{formatHandle(space.handle, space.type)}</p>
                                    </div>
                                  ))
                                }
                                {spaces.filter(s => {
                                  const matchesSearch = s.name.toLowerCase().includes(directorySearch.toLowerCase()) || s.handle.toLowerCase().includes(directorySearch.toLowerCase());
                                  const matchesFilter = directoryFilter === 'all' || s.type === directoryFilter;
                                  return matchesSearch && matchesFilter;
                                }).length === 0 && (
                                    <div className="col-span-full py-20 text-center">
                                      <div className="text-gray-300 font-black text-xs uppercase tracking-[0.3em]">No clusters found for this query.</div>
                                    </div>
                                  )}
                              </div>
                            </div>
                          )}



                        </div>
                      </div>
                    )}
                  </div>
                </Window>
              </div>
            )}

            {/* BLINKS VIEW */}
            {activeView === 'blinks' && (
              <div className="flex-1 h-full bg-[#f4f4f5] p-2 md:p-4 overflow-hidden flex flex-col">
                <Window
                  title="Flash_Stream // Blinks"
                  color={THEME.accent}
                  className="h-full flex flex-col"
                  noPadding
                >
                  <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-white custom-scrollbar">
                    <div className="max-w-5xl mx-auto">
                      <div className="mb-12 text-center">
                        <div className="inline-flex items-center justify-center w-24 h-24 bg-black border-2 border-black shadow-[8px_8px_0px_0px_rgba(209,184,214,1)] mb-8">
                          <PlaySquare size={44} className="text-white" strokeWidth={2.5} />
                        </div>
                        <h2 className="text-5xl font-black mb-3 tracking-tighter uppercase">Flash_Blinks</h2>
                        <p className="text-gray-400 text-xs font-black uppercase tracking-[0.3em] max-w-md mx-auto italic mb-8">Short stories // Shared memories // Infinite possibilities</p>
                        <Button
                          variant="primary"
                          className="px-8 py-3 font-black text-xs tracking-[0.2em]"
                          onClick={() => { if (!user) onOpenLogin(); else { setIsCreateReelOpen(true); setReelStep(1); } }}
                        >
                          <Plus size={16} className="mr-2" /> POST_NEW_REEL
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                        {thoughts.filter(t => t.mediaType === 'video').length > 0 ? (
                          thoughts.filter(t => t.mediaType === 'video').map((blink) => (
                            <div
                              key={blink.id}
                              onClick={() => setOpenedBlinkId(blink.id)}
                              className="group relative aspect-[9/16] bg-black border-2 border-black overflow-hidden cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-300"
                            >
                              <video src={blink.mediaUrl} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center group-hover:hidden">
                                <PlaySquare size={32} className="text-white mb-4 drop-shadow-md" />
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/80 text-white translate-y-full group-hover:translate-y-0 transition-transform">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 bg-white shrink-0 border border-black overflow-hidden">
                                    {blink.authorPhoto ? <img src={blink.authorPhoto} alt="" className="w-full h-full object-cover" /> : <User size={12} className="text-black ml-1 mt-1" />}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[9px] font-black uppercase truncate">#{blink.authorName}</p>
                                    <p className="text-[8px] font-medium opacity-70 uppercase tracking-tighter line-clamp-1">{blink.title || blink.text}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          [1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className="group relative aspect-[9/16] bg-gray-50 border-2 border-black overflow-hidden cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-300 flex flex-col items-center justify-center opacity-30"
                            >
                              <PlaySquare size={32} className="text-black mb-2" />
                              <p className="text-[8px] font-black uppercase tracking-widest">Waiting_for_Signal...</p>
                            </div>
                          ))
                        )}
                      </div>

                    </div>
                  </div>
                </Window>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal (For New Threads Only) */}
      <Modal isOpen={isCreateOpen} onClose={() => { if (!isPosting) setIsCreateOpen(false); }} title="Create Post">
        <div className="space-y-4 p-6 shrink-0">
          <Input placeholder="Title (Optional)" value={title} onChange={e => setTitle(e.target.value)} disabled={isPosting} />
          <textarea
            className="w-full h-32 bg-[#f4f4f5] border border-black p-2 text-sm focus:outline-none disabled:opacity-50"
            placeholder="What's on your mind?"
            value={text}
            onChange={e => setText(e.target.value)}
            autoFocus
            disabled={isPosting}
          />

          {/* File Upload Section */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*,video/mp4,video/webm"
              onChange={handleFileSelect}
              disabled={isPosting}
            />
            <Button onClick={() => {
              fileInputRef.current?.click();
            }} className="flex items-center gap-2" disabled={isPosting}>
              <ImageIcon size={14} /> Add Media
            </Button>
            {selectedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                {selectedFiles.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                    <Paperclip size={12} />
                    <span className="max-w-[100px] truncate">{f.name}</span>
                    <button onClick={() => removeSelectedFile(idx)} disabled={isPosting} className="hover:text-red-500"><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          {filePreviews.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar border border-gray-100 p-2 bg-gray-50 rounded-xl">
              {filePreviews.map((p, idx) => (
                <div key={idx} className="relative shrink-0 w-32 h-32 rounded-lg overflow-hidden border-2 border-black bg-black">
                  {p.type.startsWith('video') ? (
                    <video src={p.url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={p.url} alt="Preview" className="w-full h-full object-cover" />
                  )}
                  <button onClick={() => removeSelectedFile(idx)} className="absolute top-1 right-1 bg-black text-white rounded-full p-1 shadow-md">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 items-center">
            {isPosting && <span className="text-xs text-gray-500 animate-pulse flex items-center gap-1"><Loader size={12} className="animate-spin" /> Uploading...</span>}
            <Button onClick={() => { if (!isPosting) setIsCreateOpen(false); }} disabled={isPosting}>CANCEL</Button>
            <Button onClick={handlePost} variant="primary" disabled={isPosting || (!text && selectedFiles.length === 0)}>
              {isPosting ? 'POSTING...' : 'POST'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Thread Detail Modal */}
      <Modal isOpen={!!activeThread} onClose={() => setActiveThreadId(null)} title={activeThread?.title || 'Thread'}>
        {activeThread && (
          <div className="p-6 shrink-0">
            {/* Main Thread Content */}
            <div className={`border border-gray-200 p-4 mb-4 bg-yellow-50`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-black rounded-full overflow-hidden text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {activeThread.authorPhoto ? (
                    <img src={activeThread.authorPhoto} alt="avi" className="w-full h-full object-cover" />
                  ) : (
                    activeThread.authorName[0]
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setProfileTargetId(activeThread.authorId)} className="font-bold text-sm hover:underline">
                      {activeThread.spaceId ? 'm:' : 'u:'}{activeThread.authorName}
                    </button>
                    {activeThread.spaceHandle && (
                      <button
                        onClick={() => handleSpaceClick(activeThread.spaceId!)}
                        className="text-[11px] font-black text-blue-600 lowercase bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100 border border-blue-100 shadow-sm"
                      >
                        {formatHandle(activeThread.spaceHandle, activeThread.tags?.includes('PAGE') ? 'page' : 'group')}
                      </button>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-500">{formatDate(activeThread.createdAt)}</div>
                </div>
              </div>
              <h3 className="font-bold text-xl mb-2">{activeThread.title}</h3>
              <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{activeThread.text}</p>

              {/* Full Media View */}
              {(activeThread.mediaItems && activeThread.mediaItems.length > 0) ? (
                <MediaCarousel items={activeThread.mediaItems} />
              ) : activeThread.mediaUrl && (
                <div className="mt-4 mb-2 w-full border border-gray-200 bg-black flex justify-center">
                  {activeThread.mediaType === 'video' ? (
                    <video
                      src={activeThread.mediaUrl}
                      controls
                      className="w-full max-h-[600px] object-contain"
                    />
                  ) : (
                    <img
                      src={activeThread.mediaUrl}
                      alt="attachment"
                      className="w-full max-h-[600px] object-contain"
                    />
                  )}
                </div>
              )}

              <div className="flex gap-4 mt-4 pt-4 border-t border-gray-300">
                <div className="flex items-center gap-2">
                  <button onClick={() => handleVote(activeThread.id, 1)} className={`p-1 ${activeThread.userVote === 1 ? 'text-orange-500' : 'text-gray-400'}`}><ArrowBigUp size={20} /></button>
                  <span className="font-bold">{activeThread.likes}</span>
                  <button onClick={() => handleVote(activeThread.id, -1)} className={`p-1 ${activeThread.userVote === -1 ? 'text-blue-500' : 'text-gray-400'}`}><ArrowBigDown size={20} /></button>
                </div>

                {/* Share Button (Functional) */}
                <button
                  onClick={() => handleShare(activeThread)}
                  className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-black hover:bg-gray-200 px-2 rounded transition-colors"
                >
                  <Share2 size={14} /> Share
                </button>

                {/* DM Button inside detail view */}
                {user?.uid !== activeThread.authorId && (
                  <button
                    onClick={() => handleChatTrigger(activeThread.authorId)}
                    className="flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-blue-600 hover:bg-gray-200 px-2 rounded ml-auto transition-colors"
                  >
                    <MessageCircle size={14} /> Message Author
                  </button>
                )}

                {/* Delete Option for Author */}
                {user?.uid === activeThread.authorId && (
                  <button
                    onClick={() => {
                      if (window.confirm("Delete this thread?")) {
                        handleDeleteThought(activeThread.id);
                        setActiveThreadId(null);
                      }
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-red-400 hover:text-red-600 hover:bg-red-50 px-2 rounded ml-2 transition-colors"
                  >
                    <Trash2 size={14} /> Delete Thread
                  </button>
                )}
              </div>
            </div>

            {/* Main Comment Input Area */}
            {canPost ? (
              <div className="mb-8">
                <InlineInput
                  onSubmit={(text) => handleInlinePost(text, activeThread.id)}
                  placeholder="Write a comment..."
                  buttonLabel="Post Comment"
                />
              </div>
            ) : (
              <div className="mb-8 text-center bg-gray-50 p-4 border border-dashed border-gray-300">
                <button onClick={() => { setActiveThreadId(null); onOpenLogin(); }} className="font-bold underline hover:text-blue-600">
                  Join or Login
                </button> to participate in the conversation.
              </div>
            )}

            {/* Comments List */}
            <div className="pl-2">
              <div className="text-xs font-bold uppercase text-gray-400 mb-4 pb-2 border-b border-gray-200">
                Comments ({activeThread.children.length})
              </div>
              {activeThread.children.map(c => (
                <CommentNode
                  key={c.id}
                  c={c}
                  onReply={handleInlinePost}
                  onUserClick={(uid) => setProfileTargetId(uid)}
                  canPost={canPost}
                  highlightedId={highlightedCommentId}
                />
              ))}
            </div>
          </div>
        )}
      </Modal >

      {/* Create Space Modal */}
      <Modal isOpen={isCreateSpaceOpen} onClose={() => setIsCreateSpaceOpen(false)} title="Create New Space" >
        <div className="space-y-4 p-6 shrink-0">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setNewSpaceType('group')}
              className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all tracking-widest ${newSpaceType === 'group' ? 'bg-white shadow-sm text-black' : 'text-gray-500'}`}
            >
              GROUP
            </button>
            <button
              onClick={() => setNewSpaceType('page')}
              className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all tracking-widest ${newSpaceType === 'page' ? 'bg-white shadow-sm text-black' : 'text-gray-500'}`}
            >
              PAGE
            </button>
          </div>

          <div className="space-y-2 text-center pb-2 border-b border-gray-50">
            <p className="text-[11px] text-gray-500 font-medium">
              {newSpaceType === 'group'
                ? "Groups are for collective discussion. Anyone can join and share."
                : "Pages are for individual content creators. Others can follow your updates."}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Space Name</label>
            <Input
              placeholder={newSpaceType === 'group' ? "e.g., Creative Coders" : "e.g., Daily Philosophy"}
              value={newSpaceName}
              onChange={e => setNewSpaceName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Handle</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">
                {newSpaceType === 'group' ? 'g:' : 'p:'}
              </span>
              <Input
                className="pl-8"
                placeholder="unique-handle"
                value={newSpaceHandle}
                onChange={e => setNewSpaceHandle(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Description</label>
            <textarea
              className="w-full h-24 bg-gray-50 border border-gray-100 rounded-2xl p-3 text-sm focus:outline-none focus:ring-4 focus:ring-black/5 transition-all outline-none"
              placeholder="Tell everyone what this space is about..."
              value={newSpaceDesc}
              onChange={e => setNewSpaceDesc(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setIsCreateSpaceOpen(false)}>CANCEL</Button>
            <Button
              onClick={handleCreateSpace}
              variant="primary"
              className="px-6"
              disabled={!newSpaceName || !newSpaceHandle || isCreatingSpace}
            >
              {isCreatingSpace ? 'CREATING...' : 'CREATE SPACE'}
            </Button>
          </div>
        </div>
      </Modal >
      <Modal
        isOpen={isNotifOpen}
        onClose={() => {
          setIsNotifOpen(false);
          // Mark all as read when closing
          notifications.filter(n => !n.isRead).forEach(n => markNotificationRead(n.id));
        }}
        title="Notifications"
      >
        <div className="space-y-3 p-6 min-h-[300px] shrink-0">
          {notifications.length > 0 ? (
            notifications.map(notif => (
              <div
                key={notif.id}
                className={`p-4 rounded-2xl border transition-all flex items-center gap-3 ${notif.isRead ? 'bg-gray-50/50 border-gray-100 opacity-80' : 'bg-white border-black/5 shadow-sm'}`}
              >
                <div className="w-10 h-10 rounded-full bg-black overflow-hidden flex items-center justify-center shrink-0">
                  {notif.fromPhoto ? <img src={notif.fromPhoto} className="w-full h-full object-cover" /> : <User size={20} className="text-white" />}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-tight">
                    <span className="font-black">u:{notif.fromName}</span>
                    {notif.type === 'friend_request' ? ' sent you a friend request.' :
                      notif.type === 'friend_accept' ? ' accepted your friend request!' :
                        notif.type === 'vote_up' ? ' upvoted your thought.' :
                          notif.type === 'vote_down' ? ' downvoted your thought.' :
                            notif.type === 'message' ? ' sent you a direct signal.' :
                              notif.type === 'reply' ? ' replied to your thought.' :
                                notif.type === 'follow' ? ' started following you.' :
                                  notif.type === 'group_join' ? ` joined your group "${notif.data?.name || 'Cluster'}".` :
                                    ' interacted with you.'}
                  </p>
                  {notif.data?.text && (
                    <p className="text-[10px] text-gray-400 italic mt-1 line-clamp-1 border-l-2 border-gray-200 pl-2">
                      "{notif.data.text}"
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-widest flex items-center gap-1">
                    {notif.type === 'vote_up' && <ArrowBigUp size={10} className="text-orange-500" />}
                    {notif.type === 'vote_down' && <ArrowBigDown size={10} className="text-blue-500" />}
                    {notif.type === 'message' && <MessageSquare size={10} className="text-yellow-500" />}
                    {notif.type === 'reply' && <MessageCircle size={10} className="text-green-500" />}
                    {(notif.type === 'follow' || notif.type === 'friend_request' || notif.type === 'friend_accept') && <Users size={10} className="text-blue-400" />}
                    {formatDate(notif.createdAt)}
                  </p>
                </div>

                {notif.type === 'friend_request' && !notif.isRead && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={async () => {
                        if (user?.uid) {
                          await acceptFriendRequest(user.uid, notif.fromId);
                          markNotificationRead(notif.id);
                        }
                      }}
                      className="p-1 px-3 bg-black text-white rounded-lg text-[10px] font-black hover:bg-gray-800 transition-all"
                    >
                      ACCEPT
                    </button>
                    <button
                      onClick={async () => {
                        if (user?.uid) {
                          await declineFriendRequest(user.uid, notif.fromId);
                          markNotificationRead(notif.id);
                        }
                      }}
                      className="p-1 px-3 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-black hover:bg-gray-200 transition-all"
                    >
                      IGNORE
                    </button>
                  </div>
                )}

                {(notif.type === 'vote_up' || notif.type === 'vote_down' || notif.type === 'reply') && notif.data?.postId && (
                  <button
                    onClick={() => { setActiveThreadId(notif.data.postId); setIsNotifOpen(false); }}
                    className="p-1 px-2 border border-black text-[9px] font-black uppercase hover:bg-black hover:text-white transition-all rounded-md"
                  >
                    VIEW
                  </button>
                )}

                {notif.type === 'group_join' && onToggleChat && (
                  <button
                    onClick={() => { onToggleChat(); setIsNotifOpen(false); }}
                    className="p-1 px-2 border border-black text-[9px] font-black uppercase hover:bg-black hover:text-white transition-all rounded-md"
                  >
                    VIEW GROUP
                  </button>
                )}

                {(notif.type === 'follow' || notif.type === 'friend_accept') && (
                  <button
                    onClick={() => { setProfileTargetId(notif.fromId); setIsNotifOpen(false); }}
                    className="p-1 px-2 border border-black text-[9px] font-black uppercase hover:bg-black hover:text-white transition-all rounded-md"
                  >
                    PROFILE
                  </button>
                )}

                {notif.type === 'message' && !notif.isRead && onToggleChat && (
                  <button
                    onClick={() => { onToggleChat(); setIsNotifOpen(false); }}
                    className="p-1 px-2 bg-yellow-200 border border-black text-[9px] font-black uppercase hover:bg-yellow-300 transition-all rounded-md"
                  >
                    CHAT
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-3">
              <Bell size={40} strokeWidth={1} />
              <p className="text-xs font-bold uppercase tracking-widest">No notifications yet</p>
            </div>
          )}
        </div>
      </Modal>

      {/* User Profile Modal (Generic) */}
      <UserProfileModal
        currentUser={user}
        targetUserId={profileTargetId}
        thoughts={thoughts}
        isOpen={!!profileTargetId}
        onClose={() => {
          setProfileTargetId(null);
        }}
        onLogout={() => { setProfileTargetId(null); onLogout && onLogout(); }}
        onNavigate={(uid) => setProfileTargetId(uid)}
        onChat={handleChatTrigger}
        onDeletePost={handleDeleteThought}
        onOpenThread={(id) => {
          setProfileTargetId(null);
          // NEW: Use the smart deeper finder
          findThreadAndOpen(id);
        }}
        onToast={showToast}
      />

      {/* Create Reel Modal (Step-by-Step) */}
      <Modal isOpen={isCreateReelOpen} onClose={() => { if (!isPosting) setIsCreateReelOpen(false); }} title={reelStep === 1 ? "Broadcast_Uplink // Step 1" : "Signal_Metadata // Step 2"}>
        <div className="space-y-6 p-6 shrink-0">
          {reelStep === 1 ? (
            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-black bg-gray-50 text-center space-y-4">
              <PlaySquare size={48} className="text-gray-400" />
              <div>
                <h4 className="font-black text-sm uppercase tracking-widest">Select_Source_Media</h4>
                <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">MP4 or WebM format // Max 60s</p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="video/*"
                onChange={handleReelFileSelect}
                disabled={isPosting}
              />
              <Button onClick={() => fileInputRef.current?.click()} variant="primary" className="px-6">CHOOSE_VIDEO</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Preview */}
              <div className="relative aspect-[9/16] max-h-48 mx-auto bg-black border-2 border-black overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <video src={filePreviews[0]?.url || ''} className="w-full h-full object-cover opacity-80" muted autoPlay loop />
                <button onClick={() => setReelStep(1)} className="absolute top-2 right-2 p-1 bg-black text-white border border-white hover:bg-gray-800"><Edit2 size={12} /></button>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Captions // Description</label>
                <textarea
                  className="w-full h-24 bg-white border-2 border-black p-3 text-xs font-bold focus:outline-none focus:bg-yellow-50"
                  placeholder="Tell the collective about this memory..."
                  value={text}
                  onChange={e => setText(e.target.value)}
                  disabled={isPosting}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1"><Compass size={10} /> Location</label>
                  <Input
                    placeholder="Where was this captured?"
                    value={reelLocation}
                    onChange={e => setReelLocation(e.target.value)}
                    disabled={isPosting}
                    className="font-bold text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1"><Plus size={10} /> Hashtags</label>
                  <Input
                    placeholder="art, nature, vibe..."
                    value={reelTags}
                    onChange={e => setReelTags(e.target.value)}
                    disabled={isPosting}
                    className="font-bold text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t-2 border-black">
                <button onClick={() => { if (!isPosting) setIsCreateReelOpen(false); }} className="text-[10px] font-black uppercase hover:underline">Discard_Session</button>
                <div className="flex gap-2">
                  <Button onClick={() => setReelStep(1)} disabled={isPosting}>Back</Button>
                  <Button onClick={handlePostReel} variant="primary" disabled={isPosting}>
                    {isPosting ? 'UPLOADING...' : 'BROADCAST_REEL'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Hidden Share Card for Generation */}
      {
        shareCardThread && (
          <div
            ref={shareCardRef}
            className="fixed top-0 left-[-9999px] w-[400px] bg-[#fcfbf9] p-6 border-4 border-black font-serif text-black"
            style={{ zIndex: -1 }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 border-b-2 border-black pb-2">
              <div className="w-12 h-12 bg-black rounded-full overflow-hidden border-2 border-white shrink-0">
                {shareCardThread.authorPhoto ? (
                  <img src={shareCardThread.authorPhoto} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-xl font-bold">{shareCardThread.authorName[0]}</div>
                )}
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Thought Stream</div>
                <div className="text-xl font-bold">u:{shareCardThread.authorName}</div>
              </div>
            </div>

            {/* Content */}
            <div className="mb-4">
              {shareCardThread.title && <h1 className="text-2xl font-bold mb-2 leading-tight">{shareCardThread.title}</h1>}
              <p className="text-lg leading-relaxed whitespace-pre-wrap font-medium font-sans text-gray-800">
                {shareCardThread.text.length > 300 ? shareCardThread.text.substring(0, 300) + '...' : shareCardThread.text}
              </p>
            </div>

            {/* Image if exists */}
            {shareCardThread.mediaUrl && !shareCardThread.mediaType?.startsWith('video') && (
              <div className="mb-4 border-2 border-black overflow-hidden relative aspect-video bg-gray-100">
                <img src={shareCardThread.mediaUrl} className="w-full h-full object-cover grayscale contrast-125" />
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-between items-end mt-8 border-t-2 border-black pt-2">
              <div className="text-sm font-mono text-gray-600">
                {new Date(shareCardThread.createdAt.toDate ? shareCardThread.createdAt.toDate() : shareCardThread.createdAt).toLocaleDateString()}
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-gray-500">Read more at</div>
                <div className="font-bold flex items-center gap-1"><Share2 size={12} /> sumanmandal.com</div>
              </div>
            </div>
          </div>
        )
      }
      {/* Blink Full Screen Reels Viewer */}
      {openedBlinkId && (
        <div className="fixed inset-0 z-[200] bg-black md:bg-black/95 flex items-center justify-center overflow-hidden">
          {/* Top Controls */}
          <div className="absolute top-6 left-6 right-6 z-[210] flex justify-between items-center">
            <button
              onClick={() => { setIsCreateReelOpen(true); setReelStep(1); }}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all border border-white/20 flex items-center gap-2 font-black text-[10px] tracking-widest uppercase"
            >
              <Plus size={16} /> Post_Reel
            </button>
            <button
              onClick={() => setOpenedBlinkId(null)}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all border border-white/20"
            >
              <X size={24} />
            </button>
          </div>

          <div className="w-full h-full overflow-y-auto snap-y snap-mandatory custom-scrollbar scroll-smooth flex flex-col items-center">
            {(() => {
              const videoBlinks = thoughts.filter(t => t.mediaType === 'video');
              const initialIndex = videoBlinks.findIndex(b => b.id === openedBlinkId);
              // Simple ordering to start with the clicked one (not true snap scroll to specific index without ref, but good for now)
              // For a better experience, we should use a ref and scrollIntoView or just reorder the array temporarily
              const orderedBlinks = [...videoBlinks.slice(initialIndex), ...videoBlinks.slice(0, initialIndex)];

              return orderedBlinks.map((blink) => (
                <div key={blink.id} className="snap-start w-full h-[100dvh] flex items-center justify-center relative shrink-0">
                  <video
                    src={blink.mediaUrl}
                    controls
                    autoPlay
                    loop
                    className="h-full w-full object-contain md:max-w-md bg-black shadow-2xl"
                  />

                  {/* Overlay Info (Reels Style) */}
                  <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white md:max-w-md md:mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-white border-2 border-white overflow-hidden shrink-0 shadow-lg">
                        {blink.authorPhoto ? <img src={blink.authorPhoto} alt="" className="w-full h-full object-cover" /> : <User size={20} className="text-black ml-2 mt-2" />}
                      </div>
                      <div className="flex-1">
                        <button
                          onClick={() => { setProfileTargetId(blink.authorId); setOpenedBlinkId(null); }}
                          className="font-black text-sm uppercase tracking-tighter hover:underline"
                        >
                          u:{blink.authorName}
                        </button>
                        <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest">{formatDate(blink.createdAt)}</p>
                      </div>
                      <Button
                        variant="primary"
                        className="bg-yellow-400 border-black text-black text-[9px] font-black px-4"
                        onClick={() => handleVote(blink.id, 1)}
                      >
                        <ArrowBigUp size={14} className="mr-1" /> {blink.likes}
                      </Button>
                    </div>
                    {blink.title && <h4 className="font-black text-lg mb-2 uppercase tracking-tight">{blink.title}</h4>}
                    <p className="text-xs text-white/90 leading-relaxed font-bold font-mono line-clamp-3 mb-3">{blink.text}</p>

                    <div className="flex flex-wrap gap-2 items-center">
                      {blink.location && (
                        <div className="flex items-center gap-1 text-[9px] font-black uppercase text-yellow-400 bg-black/40 px-2 py-1 rounded border border-yellow-400/30">
                          <Compass size={10} /> {blink.location}
                        </div>
                      )}
                      {blink.tags && blink.tags.map((tag, idx) => (
                        <span key={idx} className="text-[9px] font-black uppercase text-white/60 hover:text-white transition-colors">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Sidebar Actions */}
                  <div className="absolute right-4 bottom-32 flex flex-col gap-6 items-center">
                    <div className="flex flex-col items-center">
                      <button onClick={() => handleVote(blink.id, 1)} className="p-3 bg-white/10 backdrop-blur-md rounded-full border border-white/20 hover:bg-white/20 shadow-lg transition-all">
                        <ArrowBigUp size={24} className={blink.userVote === 1 ? 'text-yellow-400' : 'text-white'} />
                      </button>
                      <span className="text-[10px] font-black mt-1 text-white">{blink.likes}</span>
                    </div>
                    <button onClick={() => handleShare(blink)} className="p-3 bg-white/10 backdrop-blur-md rounded-full border border-white/20 hover:bg-white/20 shadow-lg transition-all text-white">
                      <Share2 size={24} />
                    </button>
                    <button onClick={() => setOpenedBlinkId(null)} className="p-3 bg-red-500/20 backdrop-blur-md rounded-full border border-red-500/40 hover:bg-red-500/40 shadow-lg transition-all text-red-400">
                      <X size={24} />
                    </button>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
      {/* Edit Space Modal */}
      <Modal isOpen={isEditSpaceOpen} onClose={() => setIsEditSpaceOpen(false)} title="Edit Space">
        {activeSpace && (
          <div className="space-y-4 p-6 shrink-0">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Space Name</label>
              <Input
                value={activeSpace.name}
                onChange={e => setActiveSpace({ ...activeSpace, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Description</label>
              <textarea
                className="w-full h-24 bg-gray-50 border border-gray-100 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                value={activeSpace.description || ''}
                onChange={e => setActiveSpace({ ...activeSpace, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex justify-between">
                  Avatar
                  <button onClick={() => avatarInputRef.current?.click()} className="text-black hover:underline tracking-tight">Upload_File</button>
                </label>
                <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file && activeSpace) {
                    try {
                      setIsUpdatingSpace(true);
                      const url = await uploadMedia(file);
                      if (url) setActiveSpace({ ...activeSpace, avatarURL: url });
                    } catch (e) {
                      showToast("Upload failed", 'error');
                    } finally {
                      setIsUpdatingSpace(false);
                    }
                  }
                }} />
                <Input
                  value={activeSpace.avatarURL || ''}
                  onChange={e => setActiveSpace({ ...activeSpace, avatarURL: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex justify-between">
                  Banner
                  <button onClick={() => bannerInputRef.current?.click()} className="text-black hover:underline tracking-tight">Upload_File</button>
                </label>
                <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file && activeSpace) {
                    try {
                      setIsUpdatingSpace(true);
                      const url = await uploadMedia(file);
                      if (url) setActiveSpace({ ...activeSpace, bannerURL: url });
                    } catch (e) {
                      showToast("Upload failed", 'error');
                    } finally {
                      setIsUpdatingSpace(false);
                    }
                  }
                }} />
                <Input
                  value={activeSpace.bannerURL || ''}
                  onChange={e => setActiveSpace({ ...activeSpace, bannerURL: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={activeSpace.isPrivate}
                onChange={e => setActiveSpace({ ...activeSpace, isPrivate: e.target.checked })}
                id="isPrivate"
              />
              <label htmlFor="isPrivate" className="text-xs font-bold text-gray-600">Private Space (Requires Approval)</label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button onClick={() => setIsEditSpaceOpen(false)} disabled={isUpdatingSpace}>CANCEL</Button>
              <Button
                variant="primary"
                disabled={isUpdatingSpace}
                onClick={async () => {
                  try {
                    setIsUpdatingSpace(true);
                    await updateSpace(activeSpace.id, activeSpace);
                    // Update the spaces list with the new data
                    setSpaces(prev => prev.map(s => s.id === activeSpace.id ? activeSpace : s));
                    setIsEditSpaceOpen(false);
                    showToast("Space updated successfully!", 'success');
                  } catch (e) {
                    console.error(e);
                    showToast("Failed to update space. Ensure you have admin permissions.", 'error');
                  } finally {
                    setIsUpdatingSpace(false);
                  }
                }}
              >
                {isUpdatingSpace ? 'SAVING...' : 'SAVE_CHANGES'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Member Management Modal */}
      <Modal isOpen={isMemberManageOpen} onClose={() => setIsMemberManageOpen(false)} title="Manage Space Cluster">
        <div className="space-y-6 p-6 shrink-0">
          {isSpaceAdmin && (
            <div className="space-y-4 pt-2 border-b-2 border-dashed border-gray-100 pb-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <Loader size={12} className={pendingMembers.length > 0 ? 'animate-spin' : ''} />
                Pending Requests ({pendingMembers.length})
              </h3>
              {pendingMembers.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {pendingMembers.map(m => (
                    <div key={m.uid} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                      <div className="w-8 h-8 bg-black rounded-full overflow-hidden text-white flex items-center justify-center font-bold text-[10px]">
                        {m.photoURL ? <img src={m.photoURL} alt="" /> : m.name?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs truncate text-gray-900">u:{m.name}</div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={async () => {
                            await respondToSpaceRequest(activeSpace!.id, m.uid, true);
                            setPendingMembers(prev => prev.filter(p => p.uid !== m.uid));
                          }}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={async () => {
                            await respondToSpaceRequest(activeSpace!.id, m.uid, false);
                            setPendingMembers(prev => prev.filter(p => p.uid !== m.uid));
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No pending requests.</p>
              )}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <Users size={12} /> Current Nodes ({spaceMembers.length})
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {[...spaceMembers].sort((a, b) => {
                const hierarchy = { 'owner': 0, 'admin': 1, 'member': 2 };
                return (hierarchy[a.role as keyof typeof hierarchy] ?? 2) - (hierarchy[b.role as keyof typeof hierarchy] ?? 2);
              }).map(member => (
                <div key={member.uid} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50">
                  <div className="w-8 h-8 bg-black rounded-full overflow-hidden text-white flex items-center justify-center font-bold text-[10px]">
                    {member.photoURL ? <img src={member.photoURL} alt="" /> : member.name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-xs truncate text-gray-900">u:{member.name}</div>
                      <span className={`text-[7px] font-black px-1 border border-black uppercase tracking-tight
                        ${member.role === 'owner' ? 'bg-yellow-400 text-black' :
                          member.role === 'admin' ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}
                      `}>
                        {member.role || 'MEMBER'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* View Profile Action */}
                    <button
                      onClick={() => setProfileTargetId(member.uid)}
                      className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-all"
                      title="View Profile"
                    >
                      <User size={14} />
                    </button>

                    {/* Admin Actions (Requires Admin status) */}
                    {isSpaceAdmin && member.uid !== user?.uid && (
                      <>
                        {/* Make Admin Toggle */}
                        {isSpaceOwner && member.role !== 'admin' && member.role !== 'owner' && (
                          <button
                            onClick={async () => {
                              if (window.confirm(`Promote u:${member.name} to Admin?`)) {
                                await giveAdminRole(activeSpace!.id, member.uid);
                                setSpaceMembers(prev => prev.map(m => m.uid === member.uid ? { ...m, role: 'admin' } : m));
                              }
                            }}
                            className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Promote to Admin"
                          >
                            <ShieldCheck size={14} />
                          </button>
                        )}

                        {/* Kick Action (Don't let admins kick owners) */}
                        {(isSpaceOwner || (isSpaceAdmin && member.role === 'member')) && (
                          <button
                            onClick={async () => {
                              if (window.confirm(`Kick u:${member.name} from the cluster?`)) {
                                await removeMember(activeSpace!.id, member.uid);
                                setSpaceMembers(prev => prev.filter(p => p.uid !== member.uid));
                              }
                            }}
                            className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Kick Node"
                          >
                            <UserMinus size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

    </>
  );
};

