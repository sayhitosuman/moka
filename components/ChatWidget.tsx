
import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle, Minimize2, X, Send, User, ChevronLeft, Minus,
  Square, Check, CheckCheck, Users, Plus, Search,
  Hash, ShieldCheck, Info
} from 'lucide-react';
import { UserProfile, ChatMessage, ChatGroup } from '../types';
import {
  sendMessage, getPublicUserProfile, markChatAsRead,
  createChatGroup, joinChatGroup, searchChatGroups, subscribeToChatGroups
} from '../services/store';
import { Window, Button, THEME, Input } from './UI';

interface ChatWidgetProps {
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  targetUser?: UserProfile | null; // If set, opens directly to this chat
  messages: ChatMessage[]; // Lifted state
  onMarkRead: (senderId: string) => void; // Trigger mark read
}

export const ChatWidget = ({ currentUser, isOpen, onClose, targetUser, messages, onMarkRead }: ChatWidgetProps) => {
  const [activeChatUser, setActiveChatUser] = useState<UserProfile | null>(null);
  const [activeGroup, setActiveGroup] = useState<ChatGroup | null>(null);
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [inboxProfiles, setInboxProfiles] = useState<Record<string, UserProfile>>({});
  const [myGroups, setMyGroups] = useState<ChatGroup[]>([]);
  const [chatTab, setChatTab] = useState<'personal' | 'groups'>('personal');
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatGroup[]>([]);

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

  const handleSend = async () => {
    if (!inputText.trim()) return;

    if (activeChatUser) {
      await sendMessage(currentUser.uid, activeChatUser.uid, inputText, false);
    } else if (activeGroup) {
      await sendMessage(currentUser.uid, activeGroup.id, inputText, true);
    }

    setInputText('');
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    try {
      const gid = await createChatGroup(groupName, groupDesc, currentUser.uid);
      setIsCreatingGroup(false);
      setGroupName('');
      setGroupDesc('');
      // Group subscription will update myGroups and we can maybe auto-open
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearchGroups = async () => {
    if (!searchQuery.trim()) return;
    const results = await searchChatGroups(searchQuery);
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
    ? messages.filter(m => m.groupId === activeGroup.id)
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
          {activeChatUser ? `DM: ${activeChatUser.displayName}` : activeGroup ? `Grp: ${activeGroup.name}` : 'Direct_Net'}
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
        title={activeChatUser ? `Comm_Link: ${activeChatUser.displayName}` : activeGroup ? `Group_Link: ${activeGroup.name}` : 'Direct_Net // Social Hub'}
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
              <div className="p-3 border-b border-black bg-gray-50/80 flex items-center gap-3 shrink-0 backdrop-blur-sm">
                <Button onClick={() => { setActiveChatUser(null); setActiveGroup(null); }} className="px-3 py-1.5 h-8 flex items-center"><ChevronLeft size={16} /></Button>
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 bg-black rounded-full overflow-hidden text-white flex items-center justify-center text-xs shadow-inner">
                    {activeGroup ? (
                      activeGroup.avatarUrl ? <img src={activeGroup.avatarUrl} className="w-full h-full object-cover" /> : <Users size={16} />
                    ) : (
                      activeChatUser?.photoURL ? <img src={activeChatUser.photoURL} className="w-full h-full object-cover" /> : activeChatUser?.displayName[0]
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-sm truncate uppercase tracking-tight">
                      {activeGroup ? `g/${activeGroup.name}` : (activeChatUser?.fullName || activeChatUser?.displayName)}
                    </div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                      {activeGroup ? `${activeGroup.isPublic ? 'Public' : 'Private'} Group` : 'Direct Signal'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#fcfcfc] custom-scrollbar">
                {activeMessages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-3 opacity-50">
                    <Hash size={48} strokeWidth={1} />
                    <p className="text-xs font-black uppercase tracking-[0.2em] italic">Start the transmission...</p>
                  </div>
                )}
                {activeMessages.map((m, idx) => {
                  const isMe = m.senderId === currentUser.uid;
                  const prevMsg = idx > 0 ? activeMessages[idx - 1] : null;
                  const showHeader = !isMe && (!prevMsg || prevMsg.senderId !== m.senderId);

                  return (
                    <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${showHeader ? 'mt-4' : 'mt-1'}`}>
                      {showHeader && (
                        <div className="flex items-center gap-1.5 mb-1 ml-1">
                          <div className="w-5 h-5 bg-black rounded-full overflow-hidden flex items-center justify-center text-[10px] text-white">
                            {m.senderPhoto ? <img src={m.senderPhoto} className="w-full h-full object-cover" /> : m.senderName?.[0]}
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">m/{m.senderName}</span>
                        </div>
                      )}
                      <div className={`group relative max-w-[85%] px-4 py-2 border border-black text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${isMe ? 'bg-black text-white rounded-2xl rounded-tr-none' : 'bg-white text-black rounded-2xl rounded-tl-none'}`}>
                        {m.text}
                        {!activeGroup && isMe && (
                          <div className="absolute -bottom-5 right-0 flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                            {m.isRead ? <CheckCheck size={12} className="text-blue-500" /> : <Check size={12} />}
                            <span className="text-[9px] font-bold uppercase">{m.isRead ? 'Seen' : 'Sent'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-3 border-t border-black bg-white flex gap-3">
                <Input
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder={activeGroup ? `Message g/${activeGroup.name}...` : `Message #${activeChatUser?.displayName}...`}
                  className="flex-1 text-sm font-medium"
                  autoFocus
                />
                <Button onClick={handleSend} variant="primary" className="px-5 transition-transform active:scale-95"><Send size={16} /></Button>
              </div>
            </>
          ) : isCreatingGroup ? (
            // --- CREATE GROUP VIEW ---
            <div className="flex-1 p-6 flex flex-col gap-6 animate-fade-in bg-gray-50">
              <div className="flex items-center gap-3">
                <Button onClick={() => setIsCreatingGroup(false)} className="px-2 py-1"><ChevronLeft size={16} /></Button>
                <h3 className="font-black text-lg tracking-tighter uppercase">Construct_New_Group</h3>
              </div>

              <div className="space-y-4 max-w-md mx-auto w-full">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Group Designation</label>
                  <Input
                    placeholder="e.g. Design Underground"
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    className="text-base font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Transmission Log / Description</label>
                  <textarea
                    className="w-full h-32 bg-white border border-black p-4 text-sm focus:outline-none focus:ring-4 focus:ring-black/5 transition-all outline-none font-medium custom-scrollbar"
                    placeholder="What's the purpose of this cluster?"
                    value={groupDesc}
                    onChange={e => setGroupDesc(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleCreateGroup}
                  variant="primary"
                  className="w-full py-4 font-black text-sm tracking-widest"
                  disabled={!groupName.trim()}
                >
                  INITIALIZE CLUSTER
                </Button>
              </div>
            </div>
          ) : (
            // --- INBOX VIEW ---
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex border-b border-black shrink-0">
                <button
                  onClick={() => setChatTab('personal')}
                  className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${chatTab === 'personal' ? 'bg-black text-white' : 'bg-white text-gray-400 hover:text-black hover:bg-gray-50'}`}
                >
                  <User size={14} /> Personal
                </button>
                <button
                  onClick={() => setChatTab('groups')}
                  className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${chatTab === 'groups' ? 'bg-black text-white' : 'bg-white text-gray-400 hover:text-black hover:bg-gray-50'}`}
                >
                  <Users size={14} /> Groups
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
                                {lastMsg && <div className="text-[9px] text-gray-400 font-black uppercase tracking-tighter shrink-0 ml-2">{new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
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
                  <div className="p-4 space-y-6">
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Input
                          placeholder="Search public clusters..."
                          className="pl-10 text-xs py-3"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSearchGroups()}
                        />
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      </div>
                      <Button onClick={() => setIsCreatingGroup(true)} variant="primary" className="px-4 flex items-center gap-2 text-xs font-black">
                        <Plus size={16} /> NEW
                      </Button>
                    </div>

                    {searchResults.length > 0 && (
                      <div className="bg-blue-50/50 border border-blue-100 p-2 rounded-xl animate-fade-in">
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest px-2 mb-2">Search Results</p>
                        <div className="space-y-1">
                          {searchResults.map(g => (
                            <div key={g.id} className="flex items-center justify-between p-3 bg-white border border-black/5 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><Hash size={14} /></div>
                                <div>
                                  <div className="text-xs font-black uppercase">g/{g.name}</div>
                                  <div className="text-[9px] text-gray-400 font-bold">{g.memberCount || 1} Members</div>
                                </div>
                              </div>
                              <Button onClick={() => handleJoin(g)} className="text-[9px] font-black px-3 py-1">JOIN</Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Your Clusters</p>
                      {myGroups.length === 0 ? (
                        <div className="py-12 flex flex-col items-center text-center text-gray-300 gap-3 opacity-50">
                          <Users size={48} strokeWidth={1} />
                          <p className="text-xs font-black uppercase tracking-widest max-w-[200px]">You haven't joined any group clusters yet.</p>
                        </div>
                      ) : (
                        myGroups.map(g => {
                          const groupMessages = messages.filter(m => m.groupId === g.id);
                          const lastMsg = groupMessages[groupMessages.length - 1];

                          return (
                            <div
                              key={g.id}
                              onClick={() => setActiveGroup(g)}
                              className="flex items-center gap-4 p-4 border border-black/5 hover:border-black hover:bg-blue-50 cursor-pointer group transition-all rounded-xl"
                            >
                              <div className="w-12 h-12 bg-gray-100 rounded-2xl overflow-hidden flex items-center justify-center text-gray-400 group-hover:bg-black group-hover:text-white transition-all transform group-hover:rotate-3 shadow-sm">
                                {g.avatarUrl ? <img src={g.avatarUrl} className="w-full h-full object-cover" /> : <Hash size={24} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                  <div className="font-black text-sm uppercase tracking-tight truncate">g/{g.name}</div>
                                  {lastMsg && <div className="text-[9px] text-gray-400 font-black uppercase tracking-tighter">{new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                                </div>
                                <div className="text-xs text-gray-500 truncate group-hover:text-black flex items-center gap-1 font-medium">
                                  {lastMsg ? (
                                    <>
                                      <span className="text-gray-400 font-black text-[9px] uppercase shrink-0">m/{lastMsg.senderName}:</span>
                                      {lastMsg.text}
                                    </>
                                  ) : (g.description || 'Welcome to the cluster.')}
                                </div>
                              </div>
                              <div className="w-8 h-8 flex items-center justify-center text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronLeft size={20} className="rotate-180" />
                              </div>
                            </div>
                          );
                        })
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
  );
};
