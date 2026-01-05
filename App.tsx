import React, { useState, useEffect } from 'react';
import { User, MailCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { UserProfile, ChatMessage } from './types';
import {
  subscribeToAuth, loginAnonymously, logoutUser,
  registerUser, loginUser, getIsMockMode, getPublicUserProfile, subscribeToMessages, markChatAsRead, checkUsernameAvailability
} from './services/store';
import { Button, Modal, Input } from './components/UI';
import { MindStream } from './views/Guestbook';
import { ChatWidget } from './components/ChatWidget';

const App = () => {
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
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [usernameAvailabilityError, setUsernameAvailabilityError] = useState('');

  // Status Check
  const isMock = getIsMockMode();

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Auth Subscription
    const unsub = subscribeToAuth(setUser);
    loginAnonymously();

    // 2. Deep Link Check (Thread Sharing)
    const params = new URLSearchParams(window.location.search);
    const threadId = params.get('thread');
    if (threadId) {
      setInitialThreadId(threadId);
      // Clean URL without refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    return () => unsub();
  }, []);

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

  const resetAuthForm = () => {
    setAuthEmail('');
    setAuthPassword('');
    setAuthUsername('');
    setAuthError('');
    setUsernameAvailabilityError('');
    setRegistrationSuccess(false);
  };

  const handleAuth = async () => {
    setAuthError('');
    setUsernameAvailabilityError('');
    try {
      if (authMode === 'login') {
        if (!authEmail || !authPassword) {
          setAuthError('Please fill in all fields.');
          return;
        }
        // authEmail here acts as general identifier (email or username)
        await loginUser(authEmail, authPassword);
        setIsLoginOpen(false);
        resetAuthForm();
      } else {
        if (!authEmail || !authPassword || !authUsername) {
          setAuthError('All fields are required.');
          return;
        }

        // --- EMAIL DOMAIN CHECK START ---
        const domain = authEmail.split('@')[1]?.toLowerCase();
        // Strict whitelist of major real providers
        const allowedDomains = [
          'gmail.com', 'googlemail.com',
          'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
          'yahoo.com', 'ymail.com',
          'protonmail.com', 'proton.me',
          'icloud.com', 'me.com', 'mac.com',
          'tutamail.com', 'tutanota.com',
          'yandex.ru', 'mail.ru',
          'qq.com', '163.com'
        ];

        // Also allow regional variations for the big ones if they start with the provider name
        const isMajorProvider = allowedDomains.includes(domain) ||
          (domain && (
            (domain.startsWith('yahoo.') && domain !== 'yahoo.com') ||
            (domain.startsWith('outlook.') && domain !== 'outlook.com') ||
            (domain.startsWith('hotmail.') && domain !== 'hotmail.com')
          ));

        if (!domain || !isMajorProvider) {
          setAuthError('Registration restricted to major email providers (Gmail, Outlook, Yahoo, Proton, iCloud, etc.) to prevent spam.');
          return;
        }
        // --- EMAIL DOMAIN CHECK END ---

        // Check availability
        const isAvailable = await checkUsernameAvailability(authUsername);
        if (!isAvailable) {
          setUsernameAvailabilityError('Username already exists. Please choose another.');
          return;
        }

        await registerUser(authEmail, authPassword, authUsername);
        // Do not close modal, show success state instead
        setRegistrationSuccess(true);
      }
    } catch (e: any) {
      console.error(e);
      setAuthError(e.message || 'Authentication failed. Please check details.');
    }
  };

  const handleLogout = async () => {
    await logoutUser();
  };

  const handleMarkRead = async (senderId: string) => {
    if (user) {
      await markChatAsRead(user.uid, senderId);
    }
  };

  const unreadCount = user ? messages.filter(m => m.receiverId === user.uid && !m.isRead).length : 0;

  return (
    <div className="h-[100dvh] w-full bg-[#f4f4f5] flex flex-col overflow-hidden font-sans text-stone-900">

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 h-full overflow-hidden flex flex-col relative">
        <MindStream
          user={user}
          onOpenLogin={() => setIsLoginOpen(true)}
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
          />
        )}
      </main>

      {/* Global Login/Register Modal */}
      <Modal isOpen={isLoginOpen} onClose={() => { setIsLoginOpen(false); resetAuthForm(); }} title="Member_Access">
        <div className="p-2">
          {registrationSuccess ? (
            <div className="flex flex-col items-center text-center space-y-4 py-8 animate-fade-in">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2 border border-green-200">
                <MailCheck size={32} />
              </div>
              <h3 className="font-serif font-bold text-xl">Confirm Your Email</h3>
              <p className="text-sm text-gray-600 max-w-xs">
                We've sent a confirmation link to <span className="font-bold">{authEmail}</span>.
              </p>
              <div className="bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 rounded-md max-w-xs text-left">
                <strong>Important:</strong> You must click the link in your email to activate your account before you can log in.
              </div>
              <Button onClick={() => { setRegistrationSuccess(false); setAuthMode('login'); }} variant="primary" className="mt-4 w-full">
                RETURN TO LOGIN
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-md">
                  <User size={24} />
                </div>
                <p className="text-sm text-gray-600">Join the community to post, like, and connect.</p>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-black mb-4">
                <button
                  onClick={() => { setAuthMode('login'); setAuthError(''); setUsernameAvailabilityError(''); }}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider ${authMode === 'login' ? 'bg-black text-white' : 'hover:bg-gray-100 text-gray-500'}`}
                >
                  Login
                </button>
                <button
                  onClick={() => { setAuthMode('register'); setAuthError(''); setUsernameAvailabilityError(''); }}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider ${authMode === 'register' ? 'bg-black text-white' : 'hover:bg-gray-100 text-gray-500'}`}
                >
                  Register
                </button>
              </div>

              {/* Form */}
              <div className="space-y-3">
                {authMode === 'register' && (
                  <div>
                    <label className="text-[10px] font-bold uppercase block mb-1">Username (Visible Publicly)</label>
                    <Input
                      placeholder="e.g. creative_mind"
                      value={authUsername}
                      onChange={(e) => {
                        // Only allow alphanumeric and underscore, limit length
                        const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 15);
                        setAuthUsername(val);
                        setUsernameAvailabilityError('');
                      }}
                    />
                    {usernameAvailabilityError && <div className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={10} /> {usernameAvailabilityError}</div>}
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold uppercase block mb-1">
                    {authMode === 'login' ? 'Email or Username' : 'Email Address'}
                  </label>
                  <Input
                    type={authMode === 'login' ? 'text' : 'email'}
                    placeholder={authMode === 'login' ? 'username or name@example.com' : 'name@example.com'}
                    value={authEmail}
                    onChange={e => setAuthEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase block mb-1">Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={e => setAuthPassword(e.target.value)}
                      className="pr-8"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-2 text-gray-400 hover:text-black"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {authError && (
                  <div className="bg-red-50 border border-red-200 p-2 text-xs text-red-600 flex items-start gap-2">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                <Button onClick={handleAuth} variant="primary" className="w-full mt-4 py-2">
                  {authMode === 'login' ? 'ENTER STREAM' : 'CREATE ACCOUNT'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

    </div>
  );
};

export default App;
