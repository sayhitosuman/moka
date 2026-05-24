import React, { useState, useEffect } from 'react';
import { MailCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { UserProfile, ChatMessage } from './types';
import {
  subscribeToAuth, loginAnonymously, logoutUser,
  registerUser, loginUser, getIsMockMode, getPublicUserProfile, subscribeToMessages, markChatAsRead, checkUsernameAvailability, checkEmailAvailability
} from './services/store';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Button, Modal, Input } from './components/UI';
import { MokaBoard } from './views/Guestbook';
import { ChatWidget } from './components/ChatWidget';

const App = () => {
  const { user: clerkUser, isLoaded } = useUser();
  const clerk = useClerk();
  const [user, setUser] = useState<UserProfile | null>(null);

  // Navigation State to pass to Stream
  const [initialThreadId, setInitialThreadId] = useState<string | null>(null);
  const [creatorProfileId, setCreatorProfileId] = useState<string | null>(null);

  // Modals
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatTargetUser, setChatTargetUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<'none' | 'checking' | 'available' | 'taken'>('none');
  const [emailAvailability, setEmailAvailability] = useState<'none' | 'checking' | 'available' | 'taken'>('none');
  const [passwordRequirements, setPasswordRequirements] = useState({
    hasUpper: false,
    hasLower: false,
    hasNumber: false,
    isMinLength: false
  });

  // Status Check
  const isMock = getIsMockMode();

  // Clerk to App User Mapping
  useEffect(() => {
    if (isLoaded && clerkUser) {
      setUser({
        uid: clerkUser.id,
        displayName: clerkUser.username || clerkUser.firstName || 'Anonymous',
        fullName: clerkUser.fullName || undefined,
        photoURL: clerkUser.imageUrl,
        isAnonymous: false,
      });
      setIsLoginOpen(false);
    } else if (isLoaded) {
      setUser(null);
    }
  }, [isLoaded, clerkUser]);

  // Subscribe to messages globally if logged in
  useEffect(() => {
    if (user) {
      const unsub = subscribeToMessages(user.uid, setMessages);
      return () => unsub();
    } else {
      setMessages([]);
    }
  }, [user]);

  // Event Listener for Chat requests from Guestbook
  useEffect(() => {
    const handleChatRequest = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.userId) {
        setIsChatOpen(true);
        // Fetch full profile for chat widget
        const profile = await getPublicUserProfile(detail.userId);
        if (profile) setChatTargetUser(profile);
      }
    };
    window.addEventListener('open-chat-with-user', handleChatRequest);
    return () => window.removeEventListener('open-chat-with-user', handleChatRequest);
  }, []);

  const handleLogout = async () => {
    await clerk.signOut();
  };

  const handleMarkRead = async (senderId: string) => {
    if (user) {
      // Optimistic Update
      setMessages(prev => prev.map(m =>
        (!m.groupId && m.senderId === senderId && m.receiverId === user.uid)
          ? { ...m, isRead: true }
          : m
      ));
      await markChatAsRead(user.uid, senderId);
    }
  };

  const unreadCount = user ? messages.filter(m => m.receiverId === user.uid && !m.isRead).length : 0;

  return (
    <div className="h-[100dvh] w-full bg-[#f4f4f5] flex flex-col overflow-hidden font-sans text-stone-900">

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 h-full overflow-hidden flex flex-col relative">
        <div className="absolute top-2.5 left-1 z-50 hidden md:block">
          <img src="https://i.ibb.co/mVJPnXxD/5c65fc3a-4f54-409c-827e-884d8e01c5ff.png" alt="logo" className="h-10 w-10" />
        </div>
        <MokaBoard
          user={user}
          onOpenLogin={() => clerk.openSignIn()}
          onLogout={handleLogout}
          initialProfileId={creatorProfileId}
          onClearInitialProfileId={() => setCreatorProfileId(null)}
          onToggleChat={() => setIsChatOpen(true)}
          unreadCount={unreadCount}
          initialThreadId={initialThreadId} // Pass down ID from URL
          onClearInitialThreadId={() => setInitialThreadId(null)}
        />

        {/* CHAT WIDGET */}
        {user && (
          <ChatWidget
            currentUser={user}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            targetUser={chatTargetUser}
            messages={messages}
            onMarkRead={handleMarkRead}
            onOpenProfile={(userId) => {
              // Dispatch event to open profile
              window.dispatchEvent(new CustomEvent('open-user-profile', { detail: { userId } }));
            }}
          />
        )}
      </main>

      {/* Global Login/Register Modal is now handled natively by Clerk via clerk.openSignIn() */}

    </div>
  );
};

export default App;
