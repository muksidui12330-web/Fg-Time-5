import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  AtSign,
  LogIn,
  UserPlus,
  KeyRound,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GreenLeafLogo } from './GreenLeafLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup' | 'forgot';
}

const INTERESTS_LIST = [
  '#GreenLiving',
  '#IndoorPlants',
  '#MonsteraLove',
  '#ForestBathing',
  '#NaturePhotography',
  '#Permaculture',
  '#EcoTech',
  '#UrbanGardening',
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
}) => {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    checkUsernameAvailable,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([
    '#GreenLiving',
    '#IndoorPlants',
  ]);
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken'
  >('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleUsernameChange = async (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(clean);
    if (clean.length >= 3) {
      setUsernameStatus('checking');
      const isAvailable = await checkUsernameAvailable(clean);
      setUsernameStatus(isAvailable ? 'available' : 'taken');
    } else {
      setUsernameStatus('idle');
    }
  };

  const toggleInterest = (tag: string) => {
    if (selectedInterests.includes(tag)) {
      setSelectedInterests(selectedInterests.filter((t) => t !== tag));
    } else {
      setSelectedInterests([...selectedInterests, tag]);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Google sign in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password);
        onClose();
      } else if (mode === 'signup') {
        if (password !== confirmPassword) {
          setErrorMsg('Passwords do not match.');
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          setErrorMsg('Password must be at least 6 characters.');
          setIsLoading(false);
          return;
        }
        if (usernameStatus === 'taken' || username.length < 3) {
          setErrorMsg('Please choose an available username (minimum 3 characters).');
          setIsLoading(false);
          return;
        }

        await signUpWithEmail(
          email.trim(),
          password,
          displayName.trim() || 'Botanical Explorer',
          username.trim(),
          selectedInterests
        );
        onClose();
      } else if (mode === 'forgot') {
        await resetPassword(email.trim());
        setSuccessMsg('Password reset link sent to your email! Please check your inbox.');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMsg('Invalid email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('This email is already registered. Try signing in instead.');
      } else {
        setErrorMsg(err.message || 'Authentication failed. Please check your details.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-[#12372A] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#00C853]/20 dark:border-emerald-800 max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-emerald-100 dark:border-emerald-800/40">
          <GreenLeafLogo size="sm" />
          <button
            onClick={onClose}
            className="p-1 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title & Mode Switcher */}
        <div className="pt-4 text-center">
          <h2 className="text-xl font-black text-[#12372A] dark:text-white">
            {mode === 'signin' && 'Welcome Back to FG TIME'}
            {mode === 'signup' && 'Sprout Your FG TIME Account'}
            {mode === 'forgot' && 'Reset Your Password'}
          </h2>
          <p className="text-xs text-stone-500 dark:text-emerald-200/80 mt-1">
            {mode === 'signin' && 'Sign in to water your connections and explore the feed.'}
            {mode === 'signup' && 'Join the thriving botanical social network today.'}
            {mode === 'forgot' && 'Enter your email to receive a recovery link.'}
          </p>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mt-4 p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/40 border border-[#00C853]/40 text-xs text-[#00C853] flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1-Click Google Sign In */}
        {mode !== 'forgot' && (
          <div className="pt-4 flex flex-col gap-3">
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl font-bold text-xs bg-white dark:bg-[#101512] text-stone-800 dark:text-white border border-stone-200 dark:border-emerald-800/80 hover:border-[#00C853] shadow-sm hover:shadow transition-all cursor-pointer"
            >
              {/* Google G Logo SVG */}
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center gap-2 my-1">
              <div className="flex-1 h-px bg-stone-200 dark:bg-emerald-900/40" />
              <span className="text-[10px] uppercase font-bold text-stone-400">
                Or with Email
              </span>
              <div className="flex-1 h-px bg-stone-200 dark:bg-emerald-900/40" />
            </div>
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleEmailAuth} className="flex flex-col gap-3 pt-2">
          {mode === 'signup' && (
            <>
              {/* Display Name */}
              <div>
                <label className="text-[11px] font-bold text-[#12372A] dark:text-stone-200 mb-1 block">
                  Display Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maya Leaf"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#00C853]"
                  />
                </div>
              </div>

              {/* Unique Username */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-[#12372A] dark:text-stone-200">
                    Unique Username
                  </label>
                  {usernameStatus === 'checking' && (
                    <span className="text-[10px] text-stone-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                    </span>
                  )}
                  {usernameStatus === 'available' && (
                    <span className="text-[10px] text-[#00C853] font-bold">
                      Available ✓
                    </span>
                  )}
                  {usernameStatus === 'taken' && (
                    <span className="text-[10px] text-red-500 font-bold">
                      Already taken ✗
                    </span>
                  )}
                </div>
                <div className="relative">
                  <AtSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. maya_leaf"
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#00C853]"
                  />
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <label className="text-[11px] font-bold text-[#12372A] dark:text-stone-200 mb-1 block">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#00C853]"
              />
            </div>
          </div>

          {/* Password */}
          {mode !== 'forgot' && (
            <div>
              <label className="text-[11px] font-bold text-[#12372A] dark:text-stone-200 mb-1 block">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#00C853]"
                />
              </div>
            </div>
          )}

          {/* Confirm Password */}
          {mode === 'signup' && (
            <div>
              <label className="text-[11px] font-bold text-[#12372A] dark:text-stone-200 mb-1 block">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#00C853]"
                />
              </div>
            </div>
          )}

          {/* Interests Chips (Sign Up only) */}
          {mode === 'signup' && (
            <div>
              <label className="text-[11px] font-bold text-[#12372A] dark:text-stone-200 mb-1.5 block">
                Select Your Botanical Interests
              </label>
              <div className="flex flex-wrap gap-1.5">
                {INTERESTS_LIST.map((tag) => {
                  const isSelected = selectedInterests.includes(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => toggleInterest(tag)}
                      className={`text-[10px] px-2.5 py-1 rounded-full font-semibold transition-all ${
                        isSelected
                          ? 'bg-[#00C853] text-white shadow-sm'
                          : 'bg-stone-100 dark:bg-emerald-900/40 text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Forgot Password link */}
          {mode === 'signin' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-[11px] font-medium text-[#00C853] hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 rounded-2xl font-bold text-xs text-white bg-gradient-to-r from-[#00C853] to-[#00A344] hover:from-[#00E676] hover:to-[#00C853] shadow-md shadow-[#00C853]/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'signin' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In to FG TIME</span>
              </>
            ) : mode === 'signup' ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Sprout Account</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Send Reset Link</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Mode Switch */}
        <div className="pt-4 text-center text-xs text-stone-500 dark:text-stone-400">
          {mode === 'signin' ? (
            <p>
              New to FG TIME?{' '}
              <button
                onClick={() => setMode('signup')}
                className="font-bold text-[#00C853] hover:underline"
              >
                Create an account
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                onClick={() => setMode('signin')}
                className="font-bold text-[#00C853] hover:underline"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
