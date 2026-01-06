
import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle, Minimize2, X, Send, User, ChevronLeft, Minus,
  Square, Check, CheckCheck, Users, Plus, Search,
  Hash, ShieldCheck, Info, Camera, LogOut, Settings
} from 'lucide-react';
import { UserProfile, ChatMessage, ChatGroup, Comment } from '../types';
import {
  sendMessage, getPublicUserProfile, markChatAsRead,
  createChatGroup, updateChatGroup, joinChatGroup, searchChatGroups, subscribeToChatGroups,
  fetchChatGroupMembers, uploadMedia, subscribeToChatGroupMessages, fetchUserNetwork, globalSearch, addChatGroupMember, SearchResult, leaveChatGroup, deleteChatGroup,
  updateChatGroupMemberRole, removeChatGroupMember
} from '../services/store';
import { Window, Button, THEME, Input } from './UI';

// Helper for rendering dates similarly to Guestbook.tsx
const renderDate = (createdAt: any) => {
  if (!createdAt) return '...';
  const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  if (isNaN(date.getTime())) return '...';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

interface ChatWidgetProps {
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  targetUser?: UserProfile | null; // If set, opens directly to this chat
  messages: ChatMessage[]; // Lifted state
  onMarkRead: (senderId: string) => void; // Trigger mark read
  onOpenProfile?: (userId: string) => void; // Open user profile
}

export const ChatWidget = ({ currentUser, isOpen, onClose, targetUser, messages, onMarkRead, onOpenProfile }: ChatWidgetProps) => {
  const [activeChatUser, setActiveChatUser] = useState<UserProfile | null>(null);
  const [activeGroup, setActiveGroup] = useState<ChatGroup | null>(null);
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [inboxProfiles, setInboxProfiles] = useState<Record<string, UserProfile>>({});
  const [myGroups, setMyGroups] = useState<ChatGroup[]>([]);
  const [chatTab, setChatTab] = useState<'personal' | 'groups'>('personal');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isEditingClub, setIsEditingClub] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatGroup[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [groupAvatar, setGroupAvatar] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<(UserProfile & { role: string })[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [clubDetailView, setClubDetailView] = useState<'chat' | 'members' | 'settings' | 'invite'>('chat');
  const [groupMessages, setGroupMessages] = useState<ChatMessage[]>([]);

  // Invite State
  const [friendsForInvite, setFriendsForInvite] = useState<UserProfile[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<SearchResult[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Subscribe to active group messages
  useEffect(() => {
    if (activeGroup) {
      const unsub = subscribeToChatGroupMessages(activeGroup.id, setGroupMessages);
      return () => unsub();
    } else {
      setGroupMessages([]);
    }
  }, [activeGroup]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load target user if prop provided
  useEffect(() => {
    if (targetUser) {
      setActiveChatUser(targetUser);
      setActiveGroup(null);
      setChatTab('personal');
      setIsMinimized(false);
    }
  }, [targetUser]);

  // Subscribe to my groups
  useEffect(() => {
    if (currentUser.uid) {
      const unsub = subscribeToChatGroups(currentUser.uid, setMyGroups);
      return () => unsub();
    }
  }, [currentUser.uid]);

  // Fetch profiles for inbox whenever messages change
  useEffect(() => {
    const userIds = new Set<string>();
    messages.forEach(m => {
      if (!m.groupId) {
        userIds.add(m.senderId === currentUser.uid ? (m.receiverId || '') : m.senderId);
      }
    });

    userIds.forEach(uid => {
      if (!inboxProfiles[uid] && uid && uid !== 'undefined') {
        getPublicUserProfile(uid).then(p => {
          if (p) setInboxProfiles(prev => ({ ...prev, [uid]: p }));
        });
      }
    });
  }, [messages, currentUser.uid]);

  // Scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeChatUser, activeGroup]);

  // Mark as read
  useEffect(() => {
    if (activeChatUser) {
      onMarkRead(activeChatUser.uid);
    }
  }, [activeChatUser, messages]);

  const currentUserRole = groupMembers.find(m => m.uid === currentUser.uid)?.role || (activeGroup?.createdBy === currentUser.uid ? 'owner' : 'member');
  const isClubAdmin = currentUserRole === 'admin' || currentUserRole === 'owner' || activeGroup?.createdBy === currentUser.uid;

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText(''); // Clear instantly

    if (activeGroup) {
      // Optimistic Update for Group
      const tempId = 'temp-' + Date.now();
      const optimisticMsg: ChatMessage = {
        id: tempId,
        senderId: currentUser.uid,
        receiverId: undefined,
        groupId: activeGroup.id,
        text: text,
        senderName: currentUser.displayName,
        senderPhoto: currentUser.photoURL,
        isRead: false,
        createdAt: { toDate: () => new Date() }
      };
      setGroupMessages(prev => [...prev, optimisticMsg]);

      try {
        await sendMessage(currentUser.uid, null, text, activeGroup.id);
      } catch (err) {
        console.error("Failed to send message", err);
        setGroupMessages(prev => prev.filter(m => m.id !== tempId)); // Revert
        alert("Message failed to send");
      }
    } else if (activeChatUser) {
      // Personal chat (prop-based, harder to optimistic update without setMessages prop, but fast enough usually)
      await sendMessage(currentUser.uid, activeChatUser.uid, text, null);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    try {
      if (isEditingClub && activeGroup) {
        // Update existing club
        await updateChatGroup(activeGroup.id, groupName, groupDesc, groupAvatar || undefined);
        setIsEditingClub(false);
        setActiveGroup({ ...activeGroup, name: groupName, description: groupDesc, avatarUrl: groupAvatar || undefined });
        alert('Club updated successfully!');
      } else {
        // Create new club
        const gid = await createChatGroup(groupName, groupDesc, currentUser.uid, groupAvatar || undefined);
        console.log('Club created with ID:', gid);
        alert('Club created successfully!');
      }
      setIsCreatingGroup(false);
      setGroupName('');
      setGroupDesc('');
      setGroupAvatar(null);
    } catch (e) {
      console.error('Club creation/update error:', e);
      alert('Failed to save club: ' + (e instanceof Error ? e.message : 'Unknown error'));
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const url = await uploadMedia(file);
      setGroupAvatar(url);
    } catch (err) {
      console.error(err);
      alert('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const loadMembers = async () => {
    if (activeGroup) {
      console.log('Loading members for group:', activeGroup.id);
      try {
        const members = await fetchChatGroupMembers(activeGroup.id);
        console.log('Loaded members:', members);
        setGroupMembers(members);
      } catch (err) {
        console.error('Failed to load members:', err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        alert('Failed to load members: ' + errorMsg + '\n\nCheck console for details.');
      }
    }
  };

  // Load members when activeGroup changes
  useEffect(() => {
    if (activeGroup) {
      loadMembers();
    }
  }, [activeGroup?.id]);

  const handleSearchGroups = async () => {
    let q = searchQuery.trim();
    if (q.startsWith('c:')) q = q.slice(2);
    if (!q) return;
    const results = await searchChatGroups(q);
    setSearchResults(results);
  };

  const handleJoin = async (group: ChatGroup) => {
    await joinChatGroup(group.id, currentUser.uid);
    setActiveGroup(group);
    setSearchQuery('');
    setSearchResults([]);
  };

  if (!isOpen) return null;

  // Filter messages for active conversation
  const activeMessages = activeGroup
    ? groupMessages
    : activeChatUser
      ? messages.filter(m =>
        (!m.groupId) && (
          (m.senderId === currentUser.uid && m.receiverId === activeChatUser.uid) ||
          (m.senderId === activeChatUser.uid && m.receiverId === currentUser.uid)
        )
      )
      : [];

  // Get list of recent personal chats
  const recentChatIds = Array.from(new Set(
    messages.filter(m => !m.groupId).map(m => m.senderId === currentUser.uid ? (m.receiverId || '') : m.senderId)
  )).filter(id => id);

  const globalUnreadCount = messages.filter(m => m.receiverId === currentUser.uid && !m.isRead).length;

  if (isMinimized) {
    return (
      <div className="fixed bottom-0 right-4 z-50 w-72 bg-white border border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsMinimized(false)}>
        <div className="flex items-center gap-2 font-bold text-xs uppercase relative">
          <MessageCircle size={14} />
          {activeChatUser ? `DM: ${activeChatUser.displayName}` : activeGroup ? `c:${activeGroup.name}` : 'Direct_Net'}
          {globalUnreadCount > 0 && (
            <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center border border-white">
              {globalUnreadCount}
            </span>
          )}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="hover:bg-black hover:text-white p-1">
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[95vw] md:w-[600px] h-[80vh] md:h-[600px] flex flex-col animate-slide-up shadow-[12px_12px_0px_0px_rgba(0,0,0,0.4)]">
      <Window
        title={activeChatUser ? `Comm_Link: ${activeChatUser.displayName}` : activeGroup ? `Club: c:${activeGroup.name}` : 'Direct_Net // Social Hub'}
        color={THEME.blue}
        className="h-full flex flex-col"
        noPadding
        onClose={onClose}
      >
        <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
          {/* Header Controls Overlay */}
          <div className="absolute top-[-31px] right-8 flex gap-1">
            <button onClick={() => setIsMinimized(true)} className="p-1 hover:bg-black hover:text-white transition-colors h-6 w-6 flex items-center justify-center border-l border-black">
              <Minus size={12} />
            </button>
          </div>

          {(activeChatUser || activeGroup) ? (
            // --- CHAT VIEW (Personal or Group) ---
            <>
              <div className="p-3 border-b border-black bg-white flex items-center gap-3 shrink-0">
                <Button onClick={() => { setActiveChatUser(null); setActiveGroup(null); setShowMembers(false); }} className="px-3 py-1.5 h-8 flex items-center"><ChevronLeft size={16} /></Button>
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                  <div className="w-10 h-10 bg-black rounded-full overflow-hidden text-white flex items-center justify-center text-xs shadow-md border border-black/10">
                    {activeGroup ? (
                      activeGroup.avatarUrl ? <img src={activeGroup.avatarUrl} className="w-full h-full object-cover" /> : <Users size={20} />
                    ) : (
                      activeChatUser?.photoURL ? <img src={activeChatUser.photoURL} className="w-full h-full object-cover" /> : activeChatUser?.displayName[0]
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => {
                        if (activeGroup) {
                          setClubDetailView('members');
                        } else if (activeChatUser && onOpenProfile) {
                          onOpenProfile(activeChatUser.uid);
                        }
                      }}
                      className="font-black text-sm truncate uppercase tracking-tight flex items-center gap-2 hover:underline cursor-pointer text-left w-full"
                    >
                      {activeGroup ? `c:${activeGroup.name}` : (activeChatUser?.fullName || activeChatUser?.displayName)}
                      {!activeGroup && <div className="w-2 h-2 bg-green-500 rounded-full" title="Online" />}
                    </button>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2">
                      {activeGroup ? (
                        <>
                          <span className="truncate">Tap name for info • {activeGroup.memberCount || 1} Members</span>
                        </>
                      ) : 'Secure Encryption Active'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative flex">
                {/* Club Detail View */}
                {activeGroup && clubDetailView !== 'chat' ? (
                  <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
                    {/* Tab Navigation */}
                    <div className="sticky top-0 bg-white border-b border-black z-10 flex">
                      <button
                        onClick={() => setClubDetailView('chat')}
                        className="flex-1 py-3 text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-colors"
                      >
                        💬 Chat
                      </button>
                      <button
                        onClick={() => { setClubDetailView('members'); loadMembers(); }}
                        className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors border-l border-black ${clubDetailView === 'members' ? 'bg-black text-white' : 'hover:bg-gray-50'}`}
                      >
                        👥 Members
                      </button>
                      {isClubAdmin && (
                        <>
                          <button
                            onClick={() => { setClubDetailView('invite'); fetchUserNetwork(currentUser.uid, 'friends').then(setFriendsForInvite); }}
                            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors border-l border-black ${clubDetailView === 'invite' ? 'bg-black text-white' : 'hover:bg-gray-50'}`}
                          >
                            ➕ Add
                          </button>
                          <button
                            onClick={() => setClubDetailView('settings')}
                            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors border-l border-black ${clubDetailView === 'settings' ? 'bg-black text-white' : 'hover:bg-gray-50'}`}
                          >
                            ⚙️ Settings
                          </button>
                        </>
                      )}
                    </div>

                    {/* Invite Tab */}
                    {clubDetailView === 'invite' && (
                      <div className="p-6 space-y-8 animate-fade-in">
                        {/* Search Users */}
                        <div className="space-y-4">
                          <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                            <Search size={12} /> Search for Users
                          </h3>
                          <div className="relative">
                            <Input
                              placeholder="Search by username..."
                              value={userSearchQuery}
                              onChange={async (e) => {
                                const val = e.target.value;
                                setUserSearchQuery(val);
                                if (val.trim().length > 1) {
                                  setIsSearchingUsers(true);
                                  const results = await globalSearch(val);
                                  setUserSearchResults(results.filter(r => r.type === 'user'));
                                  setIsSearchingUsers(false);
                                } else {
                                  setUserSearchResults([]);
                                }
                              }}
                              className="pl-11 h-12 rounded-xl"
                            />
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                          </div>

                          {userSearchResults.length > 0 && (
                            <div className="space-y-2 border-2 border-dashed border-gray-100 p-4 rounded-2xl">
                              {userSearchResults.map(res => (
                                <div key={res.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-xl transition-colors">
                                  <div className="w-10 h-10 bg-black rounded-full overflow-hidden text-white flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-sm">
                                    {res.photoURL ? <img src={res.photoURL} alt="" className="w-full h-full object-cover" /> : res.name[0]}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-black text-xs truncate">u:{res.handle}</div>
                                  </div>
                                  <button
                                    disabled={groupMembers.some(gm => gm.uid === res.id)}
                                    onClick={async () => {
                                      try {
                                        await addChatGroupMember(activeGroup.id, res.id, currentUser.uid);
                                        // Update local list
                                        loadMembers();
                                        setUserSearchQuery('');
                                        setUserSearchResults([]);
                                        alert(`Added u:${res.handle} to club!`);
                                      } catch (err: any) {
                                        alert(err.message || 'Failed to add user.');
                                      }
                                    }}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all
                                      ${groupMembers.some(gm => gm.uid === res.id)
                                        ? 'bg-gray-100 text-gray-400 cursor-default'
                                        : 'bg-black text-white hover:shadow-lg active:scale-95 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]'}
                                    `}
                                  >
                                    {groupMembers.some(gm => gm.uid === res.id) ? 'ALREADY IN' : 'ADD'}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Friends List */}
                        <div className="space-y-4">
                          <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-2">
                            <Users size={12} /> Invite Friends
                          </h3>
                          <div className="space-y-2">
                            {friendsForInvite.length > 0 ? (
                              friendsForInvite
                                .filter(f => !groupMembers.some(gm => gm.uid === f.uid))
                                .map(friend => (
                                  <div key={friend.uid} className="flex items-center gap-3 p-4 bg-gray-50 border border-black/5 rounded-2xl hover:bg-gray-100 transition-all group">
                                    <div className="w-12 h-12 bg-black rounded-full overflow-hidden shadow-md flex items-center justify-center text-white text-sm font-black transition-transform group-hover:scale-105">
                                      {friend.photoURL ? <img src={friend.photoURL} className="w-full h-full object-cover" /> : friend.displayName[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-black truncate uppercase tracking-tight">{friend.displayName}</div>
                                      <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Available to Invite</div>
                                    </div>
                                    <button
                                      onClick={async () => {
                                        try {
                                          await addChatGroupMember(activeGroup.id, friend.uid, currentUser.uid);
                                          loadMembers();
                                          alert(`Added ${friend.displayName} to club!`);
                                        } catch (err: any) {
                                          alert(err.message || 'Failed to add friend.');
                                        }
                                      }}
                                      className="px-5 py-2.5 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:shadow-xl active:scale-95 transition-all shadow-[6px_6px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                                    >
                                      ADD
                                    </button>
                                  </div>
                                ))
                            ) : (
                              <p className="text-xs text-gray-400 italic text-center py-4">No available friends to invite.</p>
                            )}

                            {friendsForInvite.length > 0 && friendsForInvite.filter(f => !groupMembers.some(gm => gm.uid === f.uid)).length === 0 && (
                              <p className="text-xs text-gray-400 italic text-center py-4">Your entire network is already in this club!</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Members Tab */}
                    {clubDetailView === 'members' && (
                      <div className="p-6 space-y-6">
                        <div className="text-center pb-6 border-b border-black/5">
                          <div className="w-24 h-24 bg-black rounded-2xl mx-auto mb-4 shadow-xl overflow-hidden flex items-center justify-center text-white">
                            {activeGroup.avatarUrl ? <img src={activeGroup.avatarUrl} className="w-full h-full object-cover" /> : <Users size={40} />}
                          </div>
                          <h2 className="font-black text-2xl uppercase mb-2">c:{activeGroup.name}</h2>
                          <p className="text-sm text-gray-500 font-medium max-w-md mx-auto">{activeGroup.description || 'No description yet.'}</p>
                          <div className="flex gap-3 mt-4 justify-center">
                            <div className="px-4 py-2 bg-gray-50 rounded-lg border border-black/5">
                              <div className="text-xs text-gray-400 font-bold uppercase">Members</div>
                              <div className="text-lg font-black">{activeGroup.memberCount || groupMembers.length}</div>
                            </div>
                            <div className="px-4 py-2 bg-gray-50 rounded-lg border border-black/5">
                              <div className="text-xs text-gray-400 font-bold uppercase">Type</div>
                              <div className="text-lg font-black">{activeGroup.isPublic ? 'Public' : 'Private'}</div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-xs font-black uppercase text-gray-400 tracking-widest">Member List ({groupMembers.length})</h3>
                          {groupMembers.length === 0 ? (
                            <div className="py-8 text-center text-gray-400">
                              <p className="text-sm font-bold">Loading members...</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {groupMembers.map(member => (
                                <div
                                  key={member.uid}
                                  className="w-full flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-black/5 text-left"
                                >
                                  <div className="w-12 h-12 bg-black rounded-full overflow-hidden shadow-md flex items-center justify-center text-white text-sm font-black shrink-0">
                                    {member.photoURL ? <img src={member.photoURL} className="w-full h-full object-cover" /> : member.displayName[0]}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-black truncate uppercase tracking-tight">{member.displayName}</div>
                                    <div className="text-[10px] text-gray-500 font-bold flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded text-[9px] text-white uppercase font-black ${member.role === 'owner' ? 'bg-purple-500' : member.role === 'admin' ? 'bg-blue-500' : 'bg-gray-400'}`}>
                                        {member.role === 'owner' ? 'Founder' : member.role === 'admin' ? 'Admin' : 'Member'}
                                      </span>
                                    </div>
                                  </div>

                                  {isClubAdmin && member.uid !== currentUser.uid && member.role !== 'owner' && (
                                    <div className="flex gap-2">
                                      {currentUserRole === 'owner' && (
                                        <button
                                          onClick={async () => {
                                            const newRole = member.role === 'admin' ? 'member' : 'admin';
                                            try {
                                              await updateChatGroupMemberRole(activeGroup.id, member.uid, newRole);
                                              loadMembers();
                                            } catch (err) {
                                              console.error(err);
                                            }
                                          }}
                                          title={member.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                                          className="p-2 hover:bg-black hover:text-white rounded-lg transition-colors border border-black/10"
                                        >
                                          {member.role === 'admin' ? <ShieldCheck size={14} className="text-blue-500" /> : <ShieldCheck size={14} />}
                                        </button>
                                      )}
                                      <button
                                        onClick={async () => {
                                          if (confirm(`Remove ${member.displayName} from this club?`)) {
                                            try {
                                              await removeChatGroupMember(activeGroup.id, member.uid);
                                              loadMembers();
                                            } catch (err) {
                                              console.error(err);
                                            }
                                          }
                                        }}
                                        title="Kick Member"
                                        className="p-2 hover:bg-red-500 hover:text-white rounded-lg transition-colors border border-black/10"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Settings Tab */}
                    {clubDetailView === 'settings' && (
                      <div className="p-6 space-y-6">
                        <div className="text-center pb-6 border-b border-black/5">
                          <h2 className="font-black text-xl uppercase mb-2">Club Settings</h2>
                          <p className="text-sm text-gray-500">Manage your club preferences</p>
                        </div>

                        <div className="space-y-6 max-w-md mx-auto">
                          <div className="flex flex-col items-center gap-4">
                            <div className="relative group">
                              <div className="w-24 h-24 bg-gray-100 border-2 border-dashed border-black rounded-2xl flex items-center justify-center overflow-hidden transition-all group-hover:bg-gray-50">
                                {isUploading ? (
                                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black" />
                                ) : activeGroup.avatarUrl ? (
                                  <img src={activeGroup.avatarUrl} className="w-full h-full object-cover" />
                                ) : (
                                  <Camera size={24} className="text-gray-400" />
                                )}
                              </div>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  try {
                                    setIsUploading(true);
                                    const url = await uploadMedia(file);
                                    await updateChatGroup(activeGroup.id, activeGroup.name, activeGroup.description || '', url);
                                    setActiveGroup({ ...activeGroup, avatarUrl: url });
                                    alert('Club icon updated!');
                                  } catch (err) {
                                    console.error(err);
                                    alert('Failed to upload image');
                                  } finally {
                                    setIsUploading(false);
                                  }
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                disabled={isUploading}
                              />
                              <div className="absolute -bottom-2 -right-2 bg-black text-white p-1.5 rounded-lg shadow-lg">
                                <Camera size={14} />
                              </div>
                            </div>
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Click to change club icon</p>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-black/40 tracking-widest">Club Name</label>
                              <Input
                                value={activeGroup.name}
                                onChange={async (e) => {
                                  const newName = e.target.value;
                                  await updateChatGroup(activeGroup.id, newName, activeGroup.description || '', activeGroup.avatarUrl);
                                  setActiveGroup({ ...activeGroup, name: newName });
                                }}
                                className="text-base font-bold h-12"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-black/40 tracking-widest">Description</label>
                              <textarea
                                className="w-full h-32 bg-gray-50 border border-black p-4 text-sm focus:outline-none focus:ring-4 focus:ring-black/5 transition-all outline-none font-medium custom-scrollbar rounded-xl shadow-inner"
                                value={activeGroup.description || ''}
                                onChange={async (e) => {
                                  const newDesc = e.target.value;
                                  await updateChatGroup(activeGroup.id, activeGroup.name, newDesc, activeGroup.avatarUrl);
                                  setActiveGroup({ ...activeGroup, description: newDesc });
                                }}
                              />
                            </div>
                          </div>

                          <div className="pt-4 border-t border-black/5 space-y-3">
                            <button
                              onClick={async () => {
                                const link = `${window.location.origin}?club=${activeGroup.id}`;
                                await navigator.clipboard.writeText(link);
                                alert('Club invite link copied to clipboard!');
                              }}
                              className="w-full py-3 bg-blue-600 text-white font-black text-sm uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            >
                              <Plus size={18} /> Share Invite Link
                            </button>

                            <button
                              onClick={async () => {
                                if (confirm('Are you sure you want to leave this club?')) {
                                  try {
                                    await leaveChatGroup(activeGroup.id, currentUser.uid);
                                    // Optimistic UI update
                                    setMyGroups(prev => prev.filter(g => g.id !== activeGroup.id));
                                    setActiveGroup(null);
                                    setClubDetailView('chat');
                                    alert('You have left the club.');
                                  } catch (err) {
                                    console.error(err);
                                    alert('Failed to leave club');
                                  }
                                }
                              }}
                              className="w-full py-3 bg-gray-100 text-black font-black text-sm uppercase tracking-widest rounded-xl hover:bg-gray-200 transition-colors border-2 border-black/5"
                            >
                              Leave Club
                            </button>

                            {activeGroup.createdBy === currentUser.uid && (
                              <button
                                onClick={async () => {
                                  if (confirm('CRITICAL: Are you sure you want to DELETE this club? This action cannot be undone.')) {
                                    try {
                                      await deleteChatGroup(activeGroup.id);
                                      // Optimistic UI update
                                      setMyGroups(prev => prev.filter(g => g.id !== activeGroup.id));
                                      setActiveGroup(null);
                                      setClubDetailView('chat');
                                      alert('Club has been deleted.');
                                    } catch (err) {
                                      console.error(err);
                                      alert('Failed to delete club');
                                    }
                                  }
                                }}
                                className="w-full py-3 bg-red-500 text-white font-black text-sm uppercase tracking-widest rounded-xl hover:bg-red-600 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]"
                              >
                                DELETE CLUB
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`flex-1 overflow-y-auto p-5 space-y-4 bg-[#fcfcfc] custom-scrollbar transition-all ${showMembers ? 'mr-0' : ''}`}>
                    {activeMessages.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-3 opacity-50">
                        <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center">
                          <MessageCircle size={32} strokeWidth={1} />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] italic">Encrypted channel open...</p>
                      </div>
                    )}
                    {activeMessages.map((m, idx) => {
                      const isMe = m.senderId === currentUser.uid;
                      const prevMsg = idx > 0 ? activeMessages[idx - 1] : null;
                      // In group chats, always show header for members at start of block
                      const showHeader = activeGroup
                        ? (!prevMsg || prevMsg.senderId !== m.senderId)
                        : (!isMe && (!prevMsg || prevMsg.senderId !== m.senderId));

                      return (
                        <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${showHeader ? 'mt-6' : 'mt-1'}`}>
                          {showHeader && (
                            <div className="flex items-center gap-1.5 mb-1.5 ml-1">
                              <div className="w-5 h-5 bg-black rounded-full overflow-hidden flex items-center justify-center text-[10px] text-white shadow-sm ring-1 ring-black/5">
                                {m.senderPhoto ? <img src={m.senderPhoto} className="w-full h-full object-cover" /> : m.senderName?.[0]}
                              </div>
                              <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">@{m.senderName}</span>
                            </div>
                          )}
                          <div className={`group relative max-w-[80%] px-4 py-2.5 border border-black text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${isMe ? 'bg-black text-white rounded-2xl rounded-tr-none' : 'bg-white text-black rounded-2xl rounded-tl-none'}`}>
                            {m.text}
                            {!activeGroup && isMe && (
                              <div className="absolute -bottom-5 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {m.isRead ? <CheckCheck size={12} className="text-blue-500" /> : <Check size={12} />}
                                <span className="text-[9px] font-bold uppercase">{m.isRead ? 'Seen' : 'Sent'}</span>
                              </div>
                            )}
                            <div className={`absolute top-0 ${isMe ? '-left-12' : '-right-12'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                              <span className="text-[9px] text-gray-400 font-bold">{renderDate(m.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}

                {/* Member Sidebar Overlay */}
                {activeGroup && showMembers && clubDetailView === 'chat' && (
                  <div className="w-64 border-l border-black bg-white animate-slide-in-right flex flex-col z-10 overflow-hidden">
                    <div className="p-4 border-b border-black bg-gray-50 flex items-center justify-between">
                      <h4 className="font-black text-xs uppercase tracking-widest">Members</h4>
                      <button onClick={() => setShowMembers(false)} className="hover:bg-black hover:text-white p-1 rounded transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar flex-1">
                      <div className="space-y-4">
                        <div className="text-center pb-4 border-b border-black/5">
                          <div className="w-20 h-20 bg-black rounded-2xl mx-auto mb-3 shadow-lg overflow-hidden flex items-center justify-center text-white">
                            {activeGroup.avatarUrl ? <img src={activeGroup.avatarUrl} className="w-full h-full object-cover" /> : <Users size={32} />}
                          </div>
                          <h5 className="font-black text-sm uppercase">c:{activeGroup.name}</h5>
                          <p className="text-[10px] text-gray-500 font-bold mt-1 line-clamp-3">{activeGroup.description}</p>
                          <div className="flex gap-2 mt-4 justify-center">
                            <button onClick={() => { setIsEditingClub(true); setIsCreatingGroup(true); setGroupName(activeGroup.name); setGroupDesc(activeGroup.description || ''); setGroupAvatar(activeGroup.avatarUrl || null); setActiveGroup(null); setShowMembers(false); }} className="px-3 py-1 bg-black text-white text-[9px] font-black uppercase hover:bg-gray-800 transition-colors border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none">EDIT CLUB</button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {groupMembers.map(member => (
                            <div key={member.uid} className="flex items-center gap-3 p-1">
                              <div className="w-8 h-8 bg-gray-100 rounded-full overflow-hidden shadow-sm flex items-center justify-center text-xs">
                                {member.photoURL ? <img src={member.photoURL} className="w-full h-full object-cover" /> : member.displayName[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-black truncate uppercase tracking-tight">{member.displayName}</div>
                                <div className="text-[9px] text-gray-400 font-bold uppercase">{member.uid === activeGroup.createdBy ? 'Founder' : 'Member'}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-black bg-white flex gap-3">
                <Input
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder={activeGroup ? `Message c:${activeGroup.name}...` : `Message u:${activeChatUser?.displayName}...`}
                  className="flex-1 text-sm font-medium"
                  autoFocus
                />
                <Button onClick={handleSend} variant="primary" className="px-5 transition-transform active:scale-95"><Send size={16} /></Button>
              </div>
            </>
          ) : isCreatingGroup ? (
            // --- CREATE GROUP VIEW ---
            <div className="flex-1 p-6 flex flex-col gap-6 animate-fade-in bg-white overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-3">
                <Button onClick={() => { setIsCreatingGroup(false); setIsEditingClub(false); }} className="px-2 py-1 h-8"><ChevronLeft size={16} /></Button>
                <h3 className="font-black text-lg tracking-tighter uppercase">{isEditingClub ? 'Edit_Club' : 'Create_New_Club'}</h3>
              </div>

              <div className="space-y-6 max-w-md mx-auto w-full">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative group">
                    <div className="w-24 h-24 bg-gray-100 border-2 border-dashed border-black rounded-2xl flex items-center justify-center overflow-hidden transition-all group-hover:bg-gray-50">
                      {isUploading ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black" />
                      ) : groupAvatar ? (
                        <img src={groupAvatar} className="w-full h-full object-cover" />
                      ) : (
                        <Camera size={24} className="text-gray-400" />
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={isUploading}
                    />
                    <div className="absolute -bottom-2 -right-2 bg-black text-white p-1.5 rounded-lg shadow-lg">
                      <Plus size={14} />
                    </div>
                  </div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Upload club icon</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-black/40 tracking-widest">Club Name</label>
                    <Input
                      placeholder="e.g. Design Enthusiasts"
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      className="text-base font-bold h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-black/40 tracking-widest">Club Description</label>
                    <textarea
                      className="w-full h-32 bg-gray-50 border border-black p-4 text-sm focus:outline-none focus:ring-4 focus:ring-black/5 transition-all outline-none font-medium custom-scrollbar rounded-xl shadow-inner italic"
                      placeholder="What's this club about?"
                      value={groupDesc}
                      onChange={e => setGroupDesc(e.target.value)}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleCreateGroup}
                    variant="primary"
                    className="w-full py-5 font-black text-sm tracking-widest shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                    disabled={!groupName.trim() || isUploading}
                  >
                    {isEditingClub ? 'UPDATE_CLUB_MANIFEST' : 'INITIALIZE_CLUB'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // --- INBOX VIEW ---
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex border-b border-black shrink-0 bg-gray-50 p-1">
                <button
                  onClick={() => setChatTab('personal')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all rounded-lg ${chatTab === 'personal' ? 'bg-black text-white shadow-lg' : 'text-gray-400 hover:text-black hover:bg-white'}`}
                >
                  <User size={14} strokeWidth={3} /> Personal
                </button>
                <button
                  onClick={() => setChatTab('groups')}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all rounded-lg ${chatTab === 'groups' ? 'bg-black text-white shadow-lg' : 'text-gray-400 hover:text-black hover:bg-white'}`}
                >
                  <Users size={14} strokeWidth={3} /> Clubs
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {chatTab === 'personal' ? (
                  <div className="p-2 space-y-1">
                    {recentChatIds.length === 0 ? (
                      <div className="h-64 flex flex-col items-center justify-center text-gray-300 gap-3 opacity-50">
                        <MessageCircle size={48} strokeWidth={1} />
                        <span className="text-[10px] font-black uppercase tracking-widest italic">No active direct signals.</span>
                      </div>
                    ) : (
                      recentChatIds.map(uid => {
                        const profile = inboxProfiles[uid];
                        if (!profile) return null;
                        const userMessages = messages.filter(m => !m.groupId && (m.senderId === uid || m.receiverId === uid));
                        const lastMsg = userMessages[userMessages.length - 1];
                        const unreadCount = messages.filter(m => !m.groupId && m.senderId === uid && m.receiverId === currentUser.uid && !m.isRead).length;

                        return (
                          <div
                            key={uid}
                            onClick={() => setActiveChatUser(profile)}
                            className="flex items-center gap-4 p-4 border border-transparent hover:border-black hover:bg-yellow-50 cursor-pointer group transition-all relative rounded-xl"
                          >
                            <div className="w-12 h-12 bg-black rounded-full overflow-hidden text-white flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                              {profile.photoURL ? <img src={profile.photoURL} className="w-full h-full object-cover" /> : profile.displayName[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-baseline mb-0.5">
                                <div className="font-black text-sm uppercase tracking-tight truncate">{profile.fullName || profile.displayName}</div>
                                {lastMsg && <div className="text-[9px] text-gray-400 font-black uppercase tracking-tighter shrink-0 ml-2">{renderDate(lastMsg.createdAt)}</div>}
                              </div>
                              <div className="text-xs text-gray-500 truncate group-hover:text-black flex items-center gap-1 font-medium">
                                {lastMsg ? (
                                  lastMsg.senderId === currentUser.uid ? (
                                    <>
                                      <span className="text-gray-400 uppercase text-[9px] font-black">You:</span>
                                      {lastMsg.isRead ? <CheckCheck size={10} className="text-blue-500" /> : <Check size={10} />}
                                      {lastMsg.text}
                                    </>
                                  ) : (
                                    <span className={!lastMsg.isRead ? "font-black text-black" : ""}>{lastMsg.text}</span>
                                  )
                                ) : 'Secure connection established.'}
                              </div>
                            </div>
                            {unreadCount > 0 && (
                              <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-black border-2 border-white shadow-sm animate-bounce">
                                {unreadCount}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  // --- GROUPS LIST ---
                  <div className="p-4 flex flex-col h-full bg-white">
                    <div className="flex gap-2 mb-6">
                      <div className="flex-1 relative">
                        <Input
                          placeholder="Search for clubs..."
                          className="pl-11 text-xs py-4 border-2 border-black/10 focus:border-black rounded-xl"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSearchGroups()}
                        />
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      </div>
                      <Button onClick={() => { setIsCreatingGroup(true); setGroupName(''); setGroupDesc(''); setGroupAvatar(null); }} variant="primary" className="px-5 flex items-center gap-2 text-xs font-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none">
                        <Plus size={18} /> NEW
                      </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                      {searchResults.length > 0 && (
                        <div className="bg-blue-50/50 border-2 border-dashed border-blue-200 p-3 rounded-2xl animate-fade-in">
                          <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-2 mb-3">GLOBAL DISCOVERY</p>
                          <div className="space-y-2">
                            {searchResults.map(g => (
                              <div key={g.id} className="flex items-center justify-between p-3 bg-white border border-black/10 rounded-xl hover:border-black transition-all group">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center overflow-hidden">
                                    {g.avatarUrl ? <img src={g.avatarUrl} className="w-full h-full object-cover" /> : <Hash size={18} />}
                                  </div>
                                  <div>
                                    <div className="text-xs font-black uppercase">c:{g.name}</div>
                                    <div className="text-[9px] text-gray-400 font-bold uppercase">{g.memberCount || 1} Members</div>
                                  </div>
                                </div>
                                <Button onClick={() => handleJoin(g)} className="text-[10px] font-black px-4 py-1.5 h-auto">JOIN</Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-black/5 pb-2">
                          <p className="text-[10px] font-black text-black/30 uppercase tracking-[0.2em]">MY CHANNELS</p>
                          <span className="text-[10px] font-black text-black/30 uppercase">{myGroups.length}</span>
                        </div>
                        {myGroups.length === 0 ? (
                          <div className="py-20 flex flex-col items-center text-center text-gray-300 gap-4">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center border-2 border-dashed border-gray-200">
                              <Users size={32} strokeWidth={1} />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest max-w-[180px] leading-relaxed">Join a club to begin community transmissions.</p>
                          </div>
                        ) : (
                          myGroups.map(g => {
                            const groupMessages = messages.filter(m => m.groupId === g.id);
                            const lastMsg = groupMessages[groupMessages.length - 1];

                            return (
                              <div
                                key={g.id}
                                onClick={() => setActiveGroup(g)}
                                className="flex items-center gap-4 p-4 border border-black/5 hover:border-black hover:bg-indigo-50/30 cursor-pointer group transition-all rounded-2xl relative overflow-hidden"
                              >
                                <div className="w-14 h-14 bg-gray-100 rounded-2xl overflow-hidden flex items-center justify-center text-gray-400 group-hover:shadow-lg transition-all transform group-hover:-rotate-2 border border-black/5">
                                  {g.avatarUrl ? <img src={g.avatarUrl} className="w-full h-full object-cover" /> : <Hash size={28} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-baseline mb-1">
                                    <div className="font-black text-sm uppercase tracking-tight truncate group-hover:text-black">c:{g.name}</div>
                                    {lastMsg && <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest shrink-0 ml-2">{renderDate(lastMsg.createdAt)}</div>}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate group-hover:text-black flex items-center gap-1.5 font-medium">
                                    {lastMsg ? (
                                      <>
                                        <span className="text-black/30 font-black text-[9px] uppercase shrink-0">@{lastMsg.senderName}:</span>
                                        <span className="truncate">{lastMsg.text}</span>
                                      </>
                                    ) : <span className="italic opacity-60">"Mission briefing awaits..."</span>}
                                  </div>
                                </div>
                                <div className="w-6 h-6 flex items-center justify-center text-black/20 group-hover:text-black transition-all">
                                  <ChevronLeft size={20} className="rotate-180" />
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Window>
    </div>
  );
};
