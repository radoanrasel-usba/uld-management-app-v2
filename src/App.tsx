import React, { useState, useEffect } from 'react';
import { ULD, UserProfile } from './types';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import UldForms from './components/UldForms';
import AdminPanel from './components/AdminPanel';
import { ShieldAlert, Terminal, Lock, RefreshCw, X, Plane, List, Shield, Users, History, Database, UserCheck, Menu, Plus } from 'lucide-react';

function TypewriterText({ text }: { text: string }) {
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    const currentSpeed = isDeleting ? 40 : 90;

    const timer = setTimeout(() => {
      if (!isDeleting && charIndex < text.length) {
        setDisplayedText(text.slice(0, charIndex + 1));
        setCharIndex(prev => prev + 1);
      } else if (!isDeleting && charIndex === text.length) {
        setTimeout(() => setIsDeleting(true), 2500);
      } else if (isDeleting && charIndex > 0) {
        setDisplayedText(text.slice(0, charIndex - 1));
        setCharIndex(prev => prev - 1);
      } else if (isDeleting && charIndex === 0) {
        setIsDeleting(false);
      }
    }, currentSpeed);

    return () => clearTimeout(timer);
  }, [charIndex, isDeleting, text]);

  return (
    <div className="text-[11px] font-mono bg-sky-950/40 border border-sky-800/50 px-3 py-1 rounded text-sky-400 font-bold flex items-center gap-1 shadow-sm shadow-sky-500/10">
      <span className="tracking-wide">{displayedText}</span>
      <span className="w-1.5 h-3 bg-sky-400 animate-pulse inline-block rounded-sm" />
    </div>
  );
}

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [ulds, setUlds] = useState<ULD[]>([]);
  const [token, setToken] = useState<string | null>(null);
  
  // Loading states
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // Navigation / Modal States
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminTab, setAdminTab] = useState<'alerts' | 'audits' | 'tracking' | 'backups' | 'users'>('alerts');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [currentForm, setCurrentForm] = useState<'add' | 'status' | 'send' | 'receive' | 'remove' | null>(null);

  // Modern unique toast notification state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    actionName?: string;
    visible: boolean;
    txId?: string;
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success', actionName: string = 'SYSTEM') => {
    const randomHex = Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, '0');
    const txId = `TX-${actionName.substring(0,4).toUpperCase()}-${randomHex}`;
    setToast({ message, type, actionName, visible: true, txId });
    setTimeout(() => {
      setToast(prev => prev && prev.txId === txId ? { ...prev, visible: false } : prev);
    }, 4500);
  };

  // Security breach state (when non-admin attempts to open Admin Panel via raw API exploits)
  const [securityBreachAlert, setSecurityBreachAlert] = useState<{
    active: boolean;
    path: string;
    attemptedEmail: string;
  } | null>(null);

  // 1. Listen for local session state changes
  useEffect(() => {
    const savedSession = localStorage.getItem('uld_user_session');
    if (savedSession) {
      try {
        const { token: savedToken, user: savedUser } = JSON.parse(savedSession);
        setFirebaseUser(savedUser);
        setToken(savedToken);
      } catch (err) {
        console.error('Error parsing stored session:', err);
        localStorage.removeItem('uld_user_session');
      }
    }
    setAuthLoading(false);
  }, []);

  // 2. Load user profile and database records once token is loaded
  useEffect(() => {
    if (token) {
      loadProfileAndData();
    }
  }, [token]);

  // 3. Real-time stream updates listener (SSE)
  useEffect(() => {
    if (!token) return;

    const eventSource = new EventSource(`/api/realtime/stream?token=${encodeURIComponent(token)}`);

    const handleUpdate = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        console.log('[REALTIME] Update received:', payload);
        
        if (payload.type === 'ulds_changed') {
          handleRefreshData();
        } else if (payload.type === 'users_changed') {
          // Re-load profile and full user data if status/roles change
          loadProfileAndData();
        }
      } catch (err) {
        console.error('[REALTIME] Failed to parse payload:', err);
      }
    };

    eventSource.addEventListener('update', handleUpdate as any);

    eventSource.onerror = () => {
      // Quiet reconnection listener for SSE background stream
      console.log('[REALTIME] SSE connection refreshed');
    };

    return () => {
      eventSource.removeEventListener('update', handleUpdate as any);
      eventSource.close();
    };
  }, [token]);

  const loadProfileAndData = async () => {
    if (!token) return;
    setProfileLoading(true);
    setDataLoading(true);

    try {
      // Load Profile
      const profileRes = await fetch('/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        setUserProfile(profile);
      }

      // Load live ULD list
      const uldsRes = await fetch('/api/ulds', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (uldsRes.ok) {
        const uldData = await uldsRes.json();
        setUlds(uldData);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setProfileLoading(false);
      setDataLoading(false);
    }
  };

  const handleRefreshData = async () => {
    if (!token) return;
    setDataLoading(true);
    try {
      const uldsRes = await fetch('/api/ulds', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (uldsRes.ok) {
        const uldData = await uldsRes.json();
        setUlds(uldData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/audit/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });
      } catch (err) {
        console.error('Logout logging failed:', err);
      }
    }
    showToast('Secure session terminated. Credentials purged from active memory.', 'info', 'SESSION_EXIT');
    localStorage.removeItem('uld_user_session');
    setFirebaseUser(null);
    setToken(null);
    setUserProfile(null);
    setUlds([]);
    setShowAdminPanel(false);
  };

  // Tab click with automated breach monitoring
  const handleTabClick = async (tab: 'alerts' | 'audits' | 'tracking' | 'backups' | 'users' | 'dashboard') => {
    setMobileSidebarOpen(false);
    if (tab === 'dashboard') {
      setShowAdminPanel(false);
      return;
    }

    if (!userProfile || !token) return;

    if (userProfile.role !== 'admin') {
      // Trigger suspicious activity breach log silently
      try {
        await fetch('/api/audit/access-attempt', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userProfile.email,
            path: `ADMIN_PANEL_${tab.toUpperCase()}`,
            allowed: false,
            role: userProfile.role,
          }),
        });
      } catch (err) {
        console.error(err);
      }

      // Show unique, modern toast alert instead of blocking full-screen alarm
      showToast(`ACCESS DENIED: Node ADMIN_PANEL_${tab.toUpperCase()} requires Administrator clearance level.`, 'error', 'SHIELD_WARN');
    } else {
      // Allowed access
      try {
        await fetch('/api/audit/access-attempt', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userProfile.email,
            path: `ADMIN_PANEL_${tab.toUpperCase()}`,
            allowed: true,
            role: userProfile.role,
          }),
        });
      } catch (err) {
        console.error(err);
      }
      setAdminTab(tab);
      setShowAdminPanel(true);
    }
  };

  // Safe handler for entering Admin Panel with breach alert mechanism
  const handleAdminPanelEnter = async () => {
    handleTabClick('alerts');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-mono text-xs text-sky-400 gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-sky-500" />
        <span>INITIALIZING SECURE GATEWAYS...</span>
      </div>
    );
  }

  // Not Logged In -> Show Login Portal
  if (!firebaseUser) {
    return (
      <AuthPage
        onLoginSuccess={(authToken, user) => {
          localStorage.setItem('uld_user_session', JSON.stringify({ token: authToken, user }));
          setToken(authToken);
          setFirebaseUser(user);
        }}
      />
    );
  }

  // Profile data is loading, block rendering dashboard
  if (profileLoading && !userProfile) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-mono text-xs text-sky-400 gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-sky-500" />
        <span>VERIFYING ADMINISTRATIVE CLEARANCE...</span>
      </div>
    );
  }

  // Profile loaded, but does not have approved clearance status
  if (userProfile && userProfile.status !== 'approved') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Absolute background visual grid decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.08),rgba(0,0,0,0))]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.5)_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md text-center space-y-6">
          <div className="flex flex-col items-center mb-2">
            <div className={`p-4 rounded-full border mb-4 animate-pulse ${userProfile.status === 'rejected' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
              <Shield className="h-8 w-8" />
            </div>
            <h1 className="text-lg font-mono text-slate-400 tracking-widest uppercase">
              SECURITY COMMAND SYSTEM
            </h1>
            <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase">
              build by radoan rasel
            </p>
          </div>

          <div className="space-y-3">
            <div className={`p-3 rounded-lg text-xs font-mono font-bold tracking-wider inline-block uppercase ${userProfile.status === 'rejected' ? 'bg-red-950/40 text-red-400 border border-red-900/30' : 'bg-amber-950/40 text-amber-400 border border-amber-900/30'}`}>
              STATUS: {userProfile.status === 'rejected' ? 'ACCESS REJECTED' : 'PENDING APPROVAL'}
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 border border-slate-850 p-4 rounded-lg text-left font-sans">
              {userProfile.status === 'rejected' ? (
                <span>Clearance Denied. Your registration request has been rejected by the administrator. If this was an oversight, contact the administrator directly at <strong className="text-slate-100">codingmaster0088@gmail.com</strong>.</span>
              ) : (
                <span>Your operator account (<strong className="text-slate-100">{userProfile.email}</strong>) has been successfully registered. This platform is private; your account requires acceptance by the command administrator (<strong className="text-slate-100">codingmaster0088@gmail.com</strong>) before you are granted system clearance.</span>
              )}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={loadProfileAndData}
              className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition shadow-lg shadow-sky-500/10 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Check Authorization Status
            </button>
            <button
              onClick={handleLogout}
              className="w-full bg-slate-800 hover:bg-slate-700 active:bg-slate-850 text-slate-300 text-xs font-semibold py-2.5 px-4 rounded-xl border border-slate-700/60 transition cursor-pointer"
            >
              Sign Out / Switch Account
            </button>
          </div>

          <div className="text-[9px] font-mono text-slate-600">
            SECURE TERMINAL CLEARANCE // CLOUD SQL SYNC ACTIVE
          </div>
        </div>
      </div>
    );
  }

  // Suspicious Access Attempt Warning Alarm Modal
  if (securityBreachAlert?.active) {
    return (
      <div className="min-h-screen bg-red-950/95 flex flex-col items-center justify-center p-4 relative overflow-hidden font-mono z-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(239,68,68,0.2)_0%,rgba(0,0,0,0)_100%)] animate-pulse" />
        
        <div className="relative w-full max-w-lg bg-black border-2 border-red-500 rounded-2xl p-8 shadow-[0_0_50px_rgba(239,68,68,0.3)] text-center space-y-6">
          <div className="inline-block p-4 bg-red-500/15 border border-red-500/40 rounded-full animate-bounce">
            <ShieldAlert className="h-12 w-12 text-red-500" />
          </div>

          <h1 className="text-2xl font-bold tracking-wider text-red-500 uppercase animate-pulse">
            SECURITY BREACH ALERT
          </h1>

          <div className="space-y-2 text-left bg-red-950/20 border border-red-900/40 p-4 rounded-xl text-xs text-red-200 leading-relaxed">
            <p><span className="font-bold text-red-400">ATTEMPTED PATH:</span> {securityBreachAlert.path}</p>
            <p><span className="font-bold text-red-400">USER ACCOUNT:</span> {securityBreachAlert.attemptedEmail}</p>
            <p><span className="font-bold text-red-400">ACTION LOGGED:</span> FORBIDDEN_ACCESS_ATTEMPT</p>
            <p className="mt-2 text-red-300 italic">This access attempt has triggered real-time alerts. Local air terminal command nodes have been notified. Session termination initialized.</p>
          </div>

          <div className="text-[10px] text-slate-500">
            AUTO DISCONNECT IN PROGRESS // SECURE LOGOUT TERMINATING SESSION
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen w-full bg-slate-950 text-slate-200 font-sans overflow-hidden">
      
      {/* Mobile Top Header */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-sky-500 rounded flex items-center justify-center">
            <Plane className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight text-white">US BANGLA <span className="text-sky-400">ULD</span></span>
        </div>
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="p-1 text-slate-400 hover:text-white transition"
        >
          {mobileSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <div className={`
        fixed inset-y-0 left-0 lg:static w-64 bg-slate-900 border-r border-slate-800 flex flex-col z-40 transition-transform duration-300 transform
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="hidden lg:flex p-5 border-b border-slate-800 items-center gap-3 shrink-0">
          <div className="w-8 h-8 bg-sky-500 rounded flex items-center justify-center">
            <Plane className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight text-white">US BANGLA <span className="text-sky-400">ULD</span></span>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-2">Operations</div>
          
          <button
            onClick={() => handleTabClick('dashboard')}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-sm font-medium transition text-left ${
              !showAdminPanel
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Terminal className="h-4 w-4" />
            <span>Command Dashboard</span>
          </button>

          <div className="pt-4 text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 px-2">Security & Admin</div>
          
          <button
            onClick={() => handleTabClick('alerts')}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-sm font-medium transition text-left ${
              showAdminPanel && adminTab === 'alerts'
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Shield className="h-4 w-4" />
            <span className="flex items-center justify-between w-full">
              <span>Access Threats</span>
              {userProfile?.role !== 'admin' && <span className="text-xs text-amber-500 font-mono font-bold uppercase shrink-0">(admin)</span>}
            </span>
          </button>

          <button
            onClick={() => handleTabClick('audits')}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-sm font-medium transition text-left ${
              showAdminPanel && adminTab === 'audits'
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Users className="h-4 w-4" />
            <span className="flex items-center justify-between w-full">
              <span>Compliance Audit</span>
              {userProfile?.role !== 'admin' && <span className="text-xs text-amber-500 font-mono font-bold uppercase shrink-0">(admin)</span>}
            </span>
          </button>

          <button
            onClick={() => handleTabClick('tracking')}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-sm font-medium transition text-left ${
              showAdminPanel && adminTab === 'tracking'
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
            }`}
          >
            <History className="h-4 w-4" />
            <span className="flex items-center justify-between w-full">
              <span>ULD History Search</span>
              {userProfile?.role !== 'admin' && <span className="text-xs text-amber-500 font-mono font-bold uppercase shrink-0">(admin)</span>}
            </span>
          </button>

          <button
            onClick={() => handleTabClick('backups')}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-sm font-medium transition text-left ${
              showAdminPanel && adminTab === 'backups'
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Database className="h-4 w-4" />
            <span className="flex items-center justify-between w-full">
              <span>DATA BACKUP/RESTORE</span>
              {userProfile?.role !== 'admin' && <span className="text-xs text-amber-500 font-mono font-bold uppercase shrink-0">(admin)</span>}
            </span>
          </button>

          <button
            onClick={() => handleTabClick('users')}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-sm font-medium transition text-left ${
              showAdminPanel && adminTab === 'users'
                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Users className="h-4 w-4" />
            <span className="flex items-center justify-between w-full">
              <span>Roles Management</span>
              {userProfile?.role !== 'admin' && <span className="text-xs text-amber-500 font-mono font-bold uppercase shrink-0">(admin)</span>}
            </span>
          </button>
        </nav>

        {/* User profile details bottom drawer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-sm text-sky-400 border border-slate-700">
              {userProfile?.email ? userProfile.email.substring(0, 2).toUpperCase() : 'US'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate">{userProfile?.email || firebaseUser?.email}</div>
              <div className="text-xs text-slate-500 uppercase font-mono tracking-wider">
                Role: {userProfile?.role || 'user'}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-3 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-mono text-sm uppercase py-2 rounded transition border border-slate-700/50 cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col bg-slate-950 overflow-y-auto">
        
        {/* Top Control Header Bar */}
        <header className="hidden lg:flex h-14 border-b border-slate-800 items-center justify-between px-6 bg-slate-900/40 shrink-0 z-10">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span>SYSTEM STATE:</span>
              <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> ONLINE (CLOUDSYNC)
              </span>
            </div>
            <div className="h-4 w-px bg-slate-800"></div>
            <TypewriterText text="build by radoan rasel" />
          </div>

          <div className="flex items-center gap-4">
            {/* Top header action area */}
          </div>
        </header>

        {/* Load Spinner if refreshing/loading */}
        {(dataLoading || profileLoading) && (
          <div className="fixed top-4 right-4 bg-slate-900/95 border border-slate-800 text-sm font-mono py-2 px-3.5 rounded-xl flex items-center gap-2 text-sky-400 shadow-2xl backdrop-blur-sm z-50">
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-sky-400" />
            <span>SYNCING CLOUD DB...</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1">
          {showAdminPanel ? (
            <AdminPanel
              token={token!}
              userEmail={firebaseUser.email}
              ulds={ulds}
              onClose={() => setShowAdminPanel(false)}
              onRefreshData={handleRefreshData}
              activeTab={adminTab}
              setActiveTab={setAdminTab}
              showToast={showToast}
            />
          ) : (
            <Dashboard
              ulds={ulds}
              user={firebaseUser}
              userProfile={userProfile}
              onActionClick={(action) => setCurrentForm(action)}
              onAdminClick={handleAdminPanelEnter}
              onLogout={handleLogout}
              onRefreshData={handleRefreshData}
              showToast={showToast}
            />
          )}
        </div>
      </div>

      {/* Render ULD Management Action Forms Modals */}
      {currentForm && (
        <UldForms
          currentForm={currentForm}
          ulds={ulds}
          token={token!}
          onClose={() => setCurrentForm(null)}
          onSuccess={() => {
            setCurrentForm(null);
            handleRefreshData();
          }}
          showToast={showToast}
        />
      )}

      {/* Sleek, Modern, Cyberpunk Haptic-Style Notification Pop-up */}
      {toast && toast.visible && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-slide-up">
          <div className={`
            bg-slate-950 border-2 rounded-2xl p-4 shadow-2xl backdrop-blur-md relative overflow-hidden flex gap-4
            ${toast.type === 'success' ? 'border-emerald-500/50 shadow-emerald-500/10' : ''}
            ${toast.type === 'error' ? 'border-red-500/50 shadow-red-500/10' : ''}
            ${toast.type === 'info' ? 'border-sky-500/50 shadow-sky-500/10' : ''}
          `}>
            {/* Top progress line accent */}
            <div className={`
              absolute top-0 left-0 h-[3px] w-full animate-progress-bar
              ${toast.type === 'success' ? 'bg-emerald-500' : ''}
              ${toast.type === 'error' ? 'bg-red-500' : ''}
              ${toast.type === 'info' ? 'bg-sky-500' : ''}
            `} />

            {/* Glowing signal bullet */}
            <div className="flex flex-col items-center justify-center">
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  toast.type === 'success' ? 'bg-emerald-400' :
                  toast.type === 'error' ? 'bg-red-400' : 'bg-sky-400'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${
                  toast.type === 'success' ? 'bg-emerald-500' :
                  toast.type === 'error' ? 'bg-red-500' : 'bg-sky-500'
                }`}></span>
              </span>
            </div>

            {/* Content info */}
            <div className="flex-1 space-y-1.5 font-mono text-sm">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-bold text-slate-300 uppercase tracking-widest text-xs">
                  [ {toast.actionName || 'TELEMETRY'} ]
                </span>
                <span className="text-slate-500 text-xs font-mono">{toast.txId}</span>
              </div>
              <p className="text-white font-sans text-sm leading-relaxed">{toast.message}</p>
              <div className="text-slate-500 text-xs flex justify-between">
                <span>NODE_SYNC: OK</span>
                <span>STATUS: SECURE</span>
              </div>
            </div>

            {/* Close Button */}
            <button 
              onClick={() => setToast(null)}
              className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-white transition cursor-pointer self-start"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
