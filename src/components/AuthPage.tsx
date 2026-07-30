import React, { useState, useEffect } from 'react';
import { PlaneTakeoff, Info, Mail, LogIn, Lock, UserPlus, CheckCircle2, ShieldAlert } from 'lucide-react';
// @ts-ignore
import uldImage from '../assets/images/uld_container_visual_1784391462277.jpg';

interface AuthPageProps {
  onLoginSuccess: (token: string, user: any) => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info', actionName?: string) => void;
}

// Typing visual effect for owner signature
const TypingText = () => {
  const [text, setText] = useState('');
  const fullText = 'build by radoan rasel';
  
  useEffect(() => {
    let index = 0;
    let isDeleting = false;
    const interval = setInterval(() => {
      if (!isDeleting) {
        setText(fullText.substring(0, index + 1));
        index++;
        if (index === fullText.length) {
          setTimeout(() => { isDeleting = true; }, 2000);
        }
      } else {
        setText(fullText.substring(0, index - 1));
        index--;
        if (index === 0) {
          isDeleting = false;
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="text-sm font-mono text-sky-400 tracking-widest uppercase">
      {text}
      <span className="animate-pulse">|</span>
    </span>
  );
};

export default function AuthPage({ onLoginSuccess, showToast }: AuthPageProps) {
  const [userMail, setUserMail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pop up modal state for pending user request
  const [showPendingModal, setShowPendingModal] = useState(false);

  // Save password prompt modal state
  const [savePasswordPrompt, setSavePasswordPrompt] = useState<{
    token: string;
    user: any;
    email: string;
    pass: string;
  } | null>(null);

  // Auto-fill saved credentials on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('saved_user_credentials');
      if (saved) {
        const { email, password } = JSON.parse(saved);
        if (email) setUserMail(email);
        if (password) setUserPassword(password);
      }
    } catch (e) {
      console.error('Failed to load saved credentials:', e);
    }
  }, []);

  // Handle Log In
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    const trimmedMail = userMail.trim();
    if (!trimmedMail || !userPassword) {
      setError('Please fill in both USER MAIL and USER PASSWORD.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedMail, password: userPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.status === 'pending' || data.error === 'PLEASE WAIT UNTIL RADOAN ACCEPT YOUR REQUEST') {
          setShowPendingModal(true);
          setLoading(false);
          return;
        }
        throw new Error(data.error || 'Log in failed.');
      }

      // Check if user already saved password or declined
      const savedCreds = localStorage.getItem('saved_user_credentials');
      const declined = localStorage.getItem(`declined_save_password_${data.user.email}`);

      if (!savedCreds && !declined) {
        // Show "Do you want to save the password?" modal prompt
        setSavePasswordPrompt({
          token: data.token,
          user: data.user,
          email: data.user.email,
          pass: userPassword,
        });
      } else {
        // Proceed directly
        onLoginSuccess(data.token, data.user);
        if (showToast) {
          showToast(`LOG IN GRANTED: Operator ${data.user.email.split('@')[0].toUpperCase()} authenticated.`, 'success', 'AUTHENTICATE');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Log in failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Register
  const handleRegister = async () => {
    setLoading(true);
    setError(null);

    const trimmedMail = userMail.trim();
    if (!trimmedMail || !userPassword) {
      setError('Please fill in both USER MAIL and USER PASSWORD before registering.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedMail, password: userPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      if (data.status === 'pending' || data.message === 'PLEASE WAIT UNTIL RADOAN ACCEPT YOUR REQUEST') {
        setShowPendingModal(true);
      } else if (data.token) {
        // Special Admin auto-approved register
        onLoginSuccess(data.token, data.user);
        if (showToast) {
          showToast(`ADMIN CREATED: Operator ${data.user.email.split('@')[0].toUpperCase()} granted admin clearance.`, 'success', 'AUTHENTICATE');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Save Password decision
  const handleConfirmSavePassword = (save: boolean) => {
    if (!savePasswordPrompt) return;

    if (save) {
      localStorage.setItem('saved_user_credentials', JSON.stringify({
        email: savePasswordPrompt.email,
        password: savePasswordPrompt.pass,
      }));
      if (showToast) {
        showToast('CREDENTIALS SAVED: Password saved for next time easy access.', 'success', 'PASSWORD_SAVED');
      }
    } else {
      localStorage.setItem(`declined_save_password_${savePasswordPrompt.email}`, 'true');
    }

    const { token, user } = savePasswordPrompt;
    setSavePasswordPrompt(null);
    onLoginSuccess(token, user);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Absolute background visual grid decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.12),rgba(0,0,0,0))]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.5)_1px,transparent_1px)] bg-[size:24px_24px]" />

      {/* Main card */}
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md z-10">
        
        {/* Banner with radar pulse */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative p-4 bg-sky-500/10 rounded-full border border-sky-500/20 mb-4 animate-pulse">
            <PlaneTakeoff className="h-8 w-8 text-sky-400" />
            <span className="absolute top-1 right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          
          <h1 className="text-xl font-extrabold font-display tracking-tight text-white text-center">
            US BANGLA AIRLINES
          </h1>
          <p className="text-sm font-mono text-slate-400 tracking-widest uppercase mt-1">
            ULD LOGISTICS SECURITY PLATFORM
          </p>
          <div className="h-5 flex items-center justify-center mt-1">
            <TypingText />
          </div>
        </div>

        {/* Photorealistic ULD Container Asset Visual */}
        <div className="relative w-full h-36 rounded-xl overflow-hidden mb-6 border border-slate-700/60 shadow-lg group">
          <img 
            src={uldImage} 
            alt="Airline ULD Container" 
            className="w-full h-full object-cover brightness-95 contrast-105 group-hover:scale-105 transition duration-700"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
          <div className="absolute bottom-2 left-3 font-mono text-xs text-sky-300 bg-slate-950/80 px-2 py-0.5 rounded border border-sky-500/30">
            ULD ASSET UNIT SPEC: AKE / PMC pallets
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-950/30 border border-red-900/40 text-red-200 text-xs p-3.5 rounded-lg flex items-start gap-2 animate-shake">
            <Info className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* USER MAIL */}
          <div>
            <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5 font-bold">
              USER MAIL
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Mail className="h-4 w-4" />
              </span>
              <input
                type="email"
                required
                placeholder="radoanrasel1122@gmail.com"
                value={userMail}
                onChange={(e) => setUserMail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 text-white text-sm pl-10 pr-4 py-2.5 rounded-xl transition font-sans outline-none"
              />
            </div>
          </div>

          {/* USER PASSWORD */}
          <div>
            <label className="block text-xs font-mono text-slate-300 uppercase tracking-wider mb-1.5 font-bold">
              USER PASSWORD
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 text-white text-sm pl-10 pr-4 py-2.5 rounded-xl transition font-sans outline-none"
              />
            </div>
          </div>

          {/* Bottom Action Buttons: LOG IN (Left) & REGISTER (Right) */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-sky-500/10 disabled:opacity-50 cursor-pointer text-xs uppercase tracking-wider"
            >
              <LogIn className="h-4 w-4 text-sky-100" />
              {loading ? 'VERIFYING...' : 'LOG IN'}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleRegister}
              className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-850 text-sky-400 hover:text-sky-300 font-bold py-2.5 px-4 rounded-xl border border-slate-700/60 transition-all cursor-pointer text-xs uppercase tracking-wider"
            >
              <UserPlus className="h-4 w-4 text-sky-400" />
              {loading ? 'PROCESSING...' : 'REGISTER'}
            </button>
          </div>

          <p className="text-center text-xs text-slate-500 leading-relaxed mt-4">
            Authorized US-Bangla Airlines Logistics Security Clearance Portal. First-time registrations default to Visitor role pending Administrator acceptance.
          </p>
        </form>
      </div>

      {/* Pop-up modal: "PLEASE WAIT UNTIL RADOAN ACCEPT YOUR REQUEST" */}
      {showPendingModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border-2 border-amber-500/60 rounded-2xl p-6 shadow-2xl text-center space-y-4 animate-scale-up">
            <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-full inline-block animate-pulse">
              <ShieldAlert className="h-10 w-10 text-amber-400" />
            </div>

            <h2 className="text-lg font-extrabold text-white tracking-wide font-mono uppercase">
              REQUEST PENDING APPROVAL
            </h2>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-amber-400 font-mono text-sm font-bold tracking-wider leading-relaxed uppercase">
              PLEASE WAIT UNTIL RADOAN ACCEPT YOUR REQUEST
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Your registration request is registered. The administrator (<strong className="text-white">radoanrasel1122@gmail.com</strong>) has been notified to grant system clearance.
            </p>

            <button
              onClick={() => setShowPendingModal(false)}
              className="w-full bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold font-mono text-xs uppercase py-2.5 rounded-xl transition cursor-pointer"
            >
              UNDERSTOOD / CLOSE
            </button>
          </div>
        </div>
      )}

      {/* Modal Prompt: "do you want to save the password?" with YES and NO option */}
      {savePasswordPrompt && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-sky-500/50 rounded-2xl p-6 shadow-2xl text-center space-y-4 animate-scale-up">
            <div className="p-3 bg-sky-500/15 border border-sky-500/30 rounded-full inline-block">
              <CheckCircle2 className="h-10 w-10 text-sky-400" />
            </div>

            <h2 className="text-lg font-extrabold text-white tracking-wide font-mono uppercase">
              SAVE CREDENTIALS
            </h2>

            <p className="text-sm font-semibold text-slate-200">
              Do you want to save the password for next time easy access?
            </p>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <button
                onClick={() => handleConfirmSavePassword(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-mono text-xs uppercase py-2.5 rounded-xl transition cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                YES
              </button>

              <button
                onClick={() => handleConfirmSavePassword(false)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold font-mono text-xs uppercase py-2.5 rounded-xl border border-slate-700 transition cursor-pointer"
              >
                NO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Footer Details */}
      <div className="absolute bottom-4 left-0 right-0 text-center text-xs font-mono text-slate-600 z-10 flex items-center justify-center gap-1">
        <Lock className="h-3 w-3" /> SECURE CONCURRENT GATEWAY ACTIVE // DATABASE ONLINE
      </div>
    </div>
  );
}
