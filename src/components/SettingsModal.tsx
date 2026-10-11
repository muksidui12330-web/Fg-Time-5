import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  X,
  Shield,
  Moon,
  Sun,
  UserX,
  Info,
  Database,
  Lock,
  LogOut,
  CheckCircle2,
  AlertCircle,
  FileText,
  KeyRound,
  Trash2,
  Search,
  Bell,
  MessageSquare,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Smartphone,
  Laptop,
  Download,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Check,
  Globe,
  HelpCircle,
  AlertTriangle,
  ShieldCheck,
  Wifi,
  Sliders,
  Sparkles,
  User,
  Palette,
  HardDrive,
  Copy,
  ExternalLink,
  Flag,
  Mail,
  Activity,
  BellRing,
  Clock,
  Video,
  FileDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { unblockUser } from '../services/firestoreService';
import {
  getUserPresenceStatus,
  calculateStorageUsage,
  clearLocalCacheSafely,
  exportPersonalDataJSON,
  subscribeAdminReports,
  dismissAdminReport,
  SETTINGS_TRANSLATIONS,
} from '../services/settingsService';
import { UserSettings, DEFAULT_USER_SETTINGS, ReportItem, PostItem } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

type SettingsSectionId =
  | 'account'
  | 'presence'
  | 'privacy'
  | 'notifications'
  | 'chat'
  | 'media'
  | 'appearance'
  | 'storage'
  | 'help'
  | 'admin';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isDarkMode,
  onToggleTheme,
}) => {
  const {
    currentUser,
    userProfile,
    signOut,
    resetPassword,
    deleteAccount,
    updateCurrentProfile,
    updateUserSettings,
    isDbConnected,
  } = useAuth();

  // Active section and search
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('account');
  const [searchQuery, setSearchQuery] = useState('');

  // Local settings draft state
  const [settingsDraft, setSettingsDraft] = useState<UserSettings>(() => ({
    ...DEFAULT_USER_SETTINGS,
    ...(userProfile?.settings || {}),
  }));

  // Account profile edit state
  const [editName, setEditName] = useState(userProfile?.displayName || '');
  const [editUsername, setEditUsername] = useState(userProfile?.username || '');
  const [editBio, setEditBio] = useState(userProfile?.bio || '');
  const [editPhone, setEditPhone] = useState(userProfile?.phone || '');
  const [editWebsite, setEditWebsite] = useState(userProfile?.website || '');
  const [editPhotoURL, setEditPhotoURL] = useState(userProfile?.photoURL || '');
  const [editBannerUrl, setEditBannerUrl] = useState(userProfile?.bannerUrl || '');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isResetSent, setIsResetSent] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [storageUsage, setStorageUsage] = useState<{ totalKb: number; formatted: string }>({ totalKb: 0, formatted: '0 KB' });
  const [cacheClearedMsg, setCacheClearedMsg] = useState('');
  const [pushStatus, setPushStatus] = useState<NotificationPermission | 'unsupported'>('default');

  // Help FAQ expanded state
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Admin state
  const [adminReports, setAdminReports] = useState<ReportItem[]>([]);
  const [serverHealth, setServerHealth] = useState<{ status: string; timestamp: string } | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  // Sync draft when user profile changes
  useEffect(() => {
    if (userProfile?.settings) {
      setSettingsDraft({
        ...DEFAULT_USER_SETTINGS,
        ...userProfile.settings,
      });
    }
    if (userProfile) {
      setEditName(userProfile.displayName || '');
      setEditUsername(userProfile.username || '');
      setEditBio(userProfile.bio || '');
      setEditPhone(userProfile.phone || '');
      setEditWebsite(userProfile.website || '');
      setEditPhotoURL(userProfile.photoURL || '');
      setEditBannerUrl(userProfile.bannerUrl || '');
    }
  }, [userProfile]);

  // Check notification permission and storage usage on mount
  useEffect(() => {
    if (isOpen) {
      setStorageUsage(calculateStorageUsage());
      if ('Notification' in window) {
        setPushStatus(Notification.permission);
      } else {
        setPushStatus('unsupported');
      }
    }
  }, [isOpen]);

  // Is user authorized administrator?
  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    return (
      currentUser.email === 'muksidui12330@gmail.com' ||
      userProfile?.role === 'admin'
    );
  }, [currentUser, userProfile]);

  // Subscribe to reports if user is admin
  useEffect(() => {
    if (isAdmin && activeSection === 'admin') {
      const unsub = subscribeAdminReports((reports) => {
        setAdminReports(reports);
      });
      return () => unsub();
    }
  }, [isAdmin, activeSection]);

  // Fetch server health when admin opens tab
  useEffect(() => {
    if (isAdmin && activeSection === 'admin') {
      setIsLoadingHealth(true);
      fetch('/api/health')
        .then((res) => res.json())
        .then((data) => setServerHealth(data))
        .catch(() => setServerHealth({ status: 'offline', timestamp: new Date().toISOString() }))
        .finally(() => setIsLoadingHealth(false));
    }
  }, [isAdmin, activeSection]);

  if (!isOpen) return null;

  // Selected language translations
  const langKey = settingsDraft.language || 'en';
  const t = SETTINGS_TRANSLATIONS[langKey] || SETTINGS_TRANSLATIONS.en;

  // Real presence calculation for current user preview
  const livePresence = getUserPresenceStatus(userProfile, currentUser?.uid);

  // Handlers
  const handleUpdateDraft = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettingsDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveAllSettings = async () => {
    setIsSaving(true);
    setErrorMessage('');
    setSaveSuccessMsg('');

    try {
      // 1. Update Profile fields
      await updateCurrentProfile({
        displayName: editName.trim() || userProfile?.displayName,
        username: editUsername.trim().toLowerCase() || userProfile?.username,
        bio: editBio.trim(),
        phone: editPhone.trim(),
        website: editWebsite.trim(),
        photoURL: editPhotoURL.trim() || userProfile?.photoURL,
        bannerUrl: editBannerUrl.trim(),
        isPrivate: settingsDraft.isPrivate,
      });

      // 2. Update Settings
      await updateUserSettings(settingsDraft);

      // 3. Apply Theme if changed
      if (settingsDraft.theme === 'dark' && !isDarkMode) {
        onToggleTheme();
      } else if (settingsDraft.theme === 'light' && isDarkMode) {
        onToggleTheme();
      }

      setSaveSuccessMsg(t.savedSuccess);
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setErrorMessage(err?.message || 'Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all settings to default values?')) {
      setSettingsDraft(DEFAULT_USER_SETTINGS);
    }
  };

  const handleCopyFgTimeId = () => {
    const idToCopy = userProfile?.fgTimeId || `FG-${userProfile?.id?.slice(0, 6).toUpperCase()}`;
    navigator.clipboard.writeText(idToCopy);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handlePasswordReset = async () => {
    if (!currentUser?.email) return;
    try {
      await resetPassword(currentUser.email);
      setIsResetSent(true);
      setTimeout(() => setIsResetSent(false), 5000);
    } catch (err: any) {
      alert(`Password reset failed: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleUnblock = async (blockedId: string) => {
    if (!currentUser || !userProfile) return;
    await unblockUser(currentUser.uid, blockedId, userProfile.blockedUsers);
  };

  const handleClearCache = () => {
    const res = clearLocalCacheSafely();
    if (res.success) {
      setStorageUsage(calculateStorageUsage());
      setCacheClearedMsg(`Cleaned ${res.clearedItems} cached items safely!`);
      setTimeout(() => setCacheClearedMsg(''), 4000);
    }
  };

  const handleExportData = () => {
    if (userProfile) {
      exportPersonalDataJSON(userProfile);
    }
  };

  const handleRequestPushNotification = async () => {
    if (!('Notification' in window)) {
      alert('Push notifications are not supported on this browser.');
      return;
    }
    const perm = await Notification.requestPermission();
    setPushStatus(perm);
    if (perm === 'granted') {
      handleUpdateDraft('pushEnabled', true);
    } else {
      handleUpdateDraft('pushEnabled', false);
    }
  };

  const handleDeleteAccountConfirm = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setIsDeleting(true);
    try {
      await deleteAccount();
      onClose();
    } catch (err: any) {
      alert(`Could not delete account: ${err?.message || 'Please sign in again and retry.'}`);
      setIsDeleting(false);
      setDeleteConfirm(false);
    }
  };

  // Filter sections by search query
  const sections = [
    { id: 'account' as const, label: t.secAccount, icon: User, keywords: 'name username bio email password logout session delete id' },
    { id: 'presence' as const, label: t.secPresence, icon: Activity, keywords: 'online offline active now presence status dnd quiet hours last seen' },
    { id: 'privacy' as const, label: t.secPrivacy, icon: ShieldCheck, keywords: 'private account public message permissions comment tags blocked 2fa' },
    { id: 'notifications' as const, label: t.secNotifications, icon: BellRing, keywords: 'alerts likes comments follows mentions whispers push sound quiet' },
    { id: 'chat' as const, label: t.secChat, icon: MessageSquare, keywords: 'whispers receipts typing indicator requests groups auto download' },
    { id: 'media' as const, label: t.secMedia, icon: Video, keywords: 'autoplay sound muted data saver upload quality reduce motion feed' },
    { id: 'appearance' as const, label: t.secAppearance, icon: Palette, keywords: 'theme dark daylight font size language english hindi spanish' },
    { id: 'storage' as const, label: t.secStorage, icon: HardDrive, keywords: 'cache data storage export json usage clean' },
    { id: 'help' as const, label: t.secHelp, icon: HelpCircle, keywords: 'help faq report bug abuse guidelines terms privacy support version' },
    ...(isAdmin
      ? [{ id: 'admin' as const, label: t.secAdmin, icon: Shield, keywords: 'admin moderation reports health overview stats' }]
      : []),
  ];

  const filteredSections = sections.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return s.label.toLowerCase().includes(q) || s.keywords.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#12372A] rounded-3xl max-w-4xl w-full shadow-2xl border border-[#00C853]/30 dark:border-emerald-800 flex flex-col h-[650px] max-h-[92vh] overflow-hidden">
        
        {/* ================= MODAL HEADER ================= */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#12372A] via-[#1B5E20] to-[#00C853] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center ring-2 ring-white/30 shrink-0">
              <Settings className="w-5 h-5 text-[#69F0AE]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-base sm:text-lg tracking-tight">
                  {t.settingsTitle}
                </h2>
                <span className="text-[10px] uppercase font-bold bg-[#00C853] px-2 py-0.5 rounded-full ring-1 ring-white/30">
                  v2.4
                </span>
              </div>
              <p className="text-xs text-white/80">
                FG TIME Preferences, Privacy & Community Controls
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Quick Language Selector */}
            <div className="flex items-center bg-black/30 backdrop-blur-sm rounded-xl px-2 py-1 text-xs border border-white/20">
              <Globe className="w-3.5 h-3.5 mr-1.5 text-[#69F0AE]" />
              <select
                value={settingsDraft.language}
                onChange={(e) => handleUpdateDraft('language', e.target.value as any)}
                className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="en" className="text-black">English</option>
                <option value="hi" className="text-black">हिंदी (Hindi)</option>
                <option value="es" className="text-black">Español</option>
              </select>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Close Settings"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-2.5 bg-stone-50 dark:bg-[#101512] border-b border-stone-200 dark:border-emerald-800/60 flex items-center gap-2">
          <Search className="w-4 h-4 text-stone-400 shrink-0" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-xs sm:text-sm bg-transparent text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-stone-400 hover:text-stone-600 font-bold"
            >
              Clear
            </button>
          )}
        </div>

        {/* ================= BODY SPLIT: SIDEBAR & CONTENT ================= */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Navigation Sidebar */}
          <aside className="w-full md:w-60 bg-stone-100/70 dark:bg-[#101512]/90 border-b md:border-b-0 md:border-r border-stone-200 dark:border-emerald-800/60 overflow-x-auto md:overflow-y-auto shrink-0 flex md:flex-col p-2 gap-1 scrollbar-none">
            {filteredSections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap cursor-pointer shrink-0 text-left ${
                    isActive
                      ? 'bg-[#00C853] text-white shadow-sm'
                      : 'text-stone-700 dark:text-stone-300 hover:bg-[#00C853]/10 hover:text-[#00C853]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#00C853]'}`} />
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </aside>

          {/* Section Main Viewport */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white dark:bg-[#12372A]/40 text-stone-800 dark:text-stone-100 text-xs sm:text-sm">
            
            {/* Save success banner */}
            {saveSuccessMsg && (
              <div className="mb-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-[#00C853]/40 text-[#00C853] font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* Error banner */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-300 text-red-600 font-bold flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* ================= SECTION 1: ACCOUNT & PROFILE ================= */}
            {activeSection === 'account' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#12372A] dark:text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-[#00C853]" />
                    <span>Account & Botanical Identity</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Manage your credentials, FG TIME ID, and public gardener presence.
                  </p>
                </div>

                {/* Identity Card */}
                <div className="p-4 rounded-3xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={editPhotoURL || userProfile?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                      alt="Avatar"
                      className="w-14 h-14 rounded-full object-cover ring-2 ring-[#00C853]"
                    />
                    <div>
                      <h4 className="font-bold text-sm text-[#12372A] dark:text-white">
                        {editName || userProfile?.displayName || 'Gardener'}
                      </h4>
                      <p className="text-xs text-stone-400">@{editUsername || userProfile?.username}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[11px] font-bold bg-[#00C853]/15 text-[#00C853] px-2 py-0.5 rounded-full border border-[#00C853]/30">
                          {userProfile?.fgTimeId || `FG-${userProfile?.id?.slice(0, 6).toUpperCase()}`}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyFgTimeId}
                          className="text-[11px] font-semibold text-[#00C853] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {copiedId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-[#00C853]">
                    {userProfile?.leafBadge || 'Forest Sprout 🌱'}
                  </span>
                </div>

                {/* Profile Edit Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Your Full Name"
                      className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800 text-xs focus:ring-2 focus:ring-[#00C853] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1">
                      Username (@handle)
                    </label>
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      placeholder="username"
                      className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800 text-xs focus:ring-2 focus:ring-[#00C853] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1">
                      Email Address
                    </label>
                    <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-emerald-950/40 border border-stone-200 dark:border-emerald-800 text-xs">
                      <span className="truncate">{currentUser?.email || 'No email attached'}</span>
                      <span className="text-[10px] font-bold text-[#00C853] uppercase bg-[#00C853]/15 px-1.5 py-0.5 rounded">
                        Verified
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800 text-xs focus:ring-2 focus:ring-[#00C853] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1">
                      Bio / Botanical Vision
                    </label>
                    <textarea
                      rows={2}
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="Share your love for nature and green living..."
                      className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800 text-xs focus:ring-2 focus:ring-[#00C853] focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1">
                      Avatar Photo URL
                    </label>
                    <input
                      type="url"
                      value={editPhotoURL}
                      onChange={(e) => setEditPhotoURL(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800 text-xs focus:ring-2 focus:ring-[#00C853] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Password & Security Actions */}
                <div className="p-4 rounded-3xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 space-y-3">
                  <h4 className="font-bold text-xs uppercase text-stone-500 tracking-wider">
                    Credentials & Active Sessions
                  </h4>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
                    <div>
                      <p className="font-bold text-xs">Security Password</p>
                      <p className="text-[11px] text-stone-500">
                        {isResetSent
                          ? 'Password reset email sent! Please check your inbox.'
                          : 'Change your login credentials securely.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      className="px-3.5 py-1.5 rounded-xl border border-[#00C853] text-[#00C853] hover:bg-[#00C853]/10 font-bold text-xs cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 inline mr-1" />
                      <span>Reset Password</span>
                    </button>
                  </div>

                  {/* Active Device Session */}
                  <div className="p-3 rounded-2xl bg-white dark:bg-[#12372A]/60 border border-stone-200 dark:border-emerald-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Laptop className="w-4 h-4 text-[#00C853]" />
                      <div>
                        <p className="font-bold text-xs">Current Active Session</p>
                        <p className="text-[10px] text-stone-400">
                          {navigator.platform || 'Web Browser'} • Authenticated via Firebase
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-[#00C853] bg-[#00C853]/15 px-2 py-0.5 rounded-full">
                      This Device
                    </span>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="p-4 rounded-3xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 space-y-3">
                  <h4 className="font-bold text-xs uppercase text-red-600 dark:text-red-400 tracking-wider">
                    Account Termination & Export
                  </h4>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs">Sign Out</p>
                      <p className="text-[11px] text-stone-500">End your current session safely.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        signOut();
                        onClose();
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-stone-200 dark:bg-emerald-900 text-stone-800 dark:text-stone-200 font-bold text-xs hover:bg-stone-300 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 inline mr-1" />
                      <span>Sign Out</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-red-200/60 dark:border-red-900/60">
                    <div>
                      <p className="font-bold text-xs text-red-600 dark:text-red-400">Delete Account</p>
                      <p className="text-[10px] text-stone-500">
                        {deleteConfirm
                          ? 'Irreversible! Confirm to permanently wipe your user profile and data.'
                          : 'Permanently remove your account and all credentials.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={handleDeleteAccountConfirm}
                      className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                      <span>{deleteConfirm ? 'Confirm Delete' : 'Delete Account'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ================= SECTION 2: PRESENCE & ACTIVITY ================= */}
            {activeSection === 'presence' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#12372A] dark:text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[#00C853]" />
                    <span>Active Status & Online Presence</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Real presence backed by an active heartbeat timeout. Never falsely marks users as online.
                  </p>
                </div>

                {/* Current Presence Live Preview */}
                <div className="p-4 rounded-3xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-stone-700 dark:text-stone-300">
                      Live Presence Preview
                    </h4>
                    <p className="text-[11px] text-stone-500">How other gardeners perceive your status right now.</p>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-[#12372A] border border-stone-200 dark:border-emerald-800">
                    {livePresence.showDot && (
                      <span className="w-2.5 h-2.5 rounded-full bg-[#00C853] animate-pulse" />
                    )}
                    <span className="font-bold text-xs text-[#00C853]">{livePresence.text}</span>
                  </div>
                </div>

                {/* Visibility Controls */}
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                    Who can see your online status:
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {[
                      { id: 'everyone', label: 'Everyone 🌐', desc: 'All community members' },
                      { id: 'following', label: 'Following Only 👥', desc: 'Only gardeners you follow back' },
                      { id: 'nobody', label: 'Nobody 🚫', desc: 'Completely appear offline' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleUpdateDraft('onlineVisibility', opt.id as any)}
                        className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                          settingsDraft.onlineVisibility === opt.id
                            ? 'bg-[#00C853]/15 border-[#00C853] shadow-sm'
                            : 'bg-stone-50 dark:bg-[#101512] border-stone-200 dark:border-emerald-800/60'
                        }`}
                      >
                        <p className="font-bold text-xs">{opt.label}</p>
                        <p className="text-[10px] text-stone-500 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Do Not Disturb Toggle */}
                <div className="p-4 rounded-3xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs">Do Not Disturb (DND) Mode 🌙</h4>
                    <p className="text-[11px] text-stone-500">
                      Silences all whisper sounds and hides the active online dot.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settingsDraft.doNotDisturb}
                    onChange={(e) => handleUpdateDraft('doNotDisturb', e.target.checked)}
                    className="w-5 h-5 accent-[#00C853] cursor-pointer"
                  />
                </div>

                {/* Quiet Hours */}
                <div className="p-4 rounded-3xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#00C853]" />
                        <span>Scheduled Quiet Hours</span>
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        Automatically mute alerts during resting periods.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsDraft.quietHoursEnabled}
                      onChange={(e) => handleUpdateDraft('quietHoursEnabled', e.target.checked)}
                      className="w-5 h-5 accent-[#00C853] cursor-pointer"
                    />
                  </div>

                  {settingsDraft.quietHoursEnabled && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-[11px] font-bold text-stone-500 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={settingsDraft.quietHoursStart}
                          onChange={(e) => handleUpdateDraft('quietHoursStart', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#12372A] border border-stone-200 dark:border-emerald-800 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-stone-500 mb-1">End Time</label>
                        <input
                          type="time"
                          value={settingsDraft.quietHoursEnd}
                          onChange={(e) => handleUpdateDraft('quietHoursEnd', e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#12372A] border border-stone-200 dark:border-emerald-800 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ================= SECTION 3: PRIVACY & PERMISSIONS ================= */}
            {activeSection === 'privacy' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#12372A] dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#00C853]" />
                    <span>Privacy & Interaction Permissions</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Control who can interact with your profile, comments, and posts.
                  </p>
                </div>

                {/* Private Account */}
                <div className="p-4 rounded-3xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-[#00C853]" />
                      <span>Private Account</span>
                    </h4>
                    <p className="text-[11px] text-stone-500">
                      When enabled, only gardeners you approve can view your posts and stories.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settingsDraft.isPrivate}
                    onChange={(e) => handleUpdateDraft('isPrivate', e.target.checked)}
                    className="w-5 h-5 accent-[#00C853] cursor-pointer"
                  />
                </div>

                {/* Interaction Dropdowns */}
                <div className="space-y-3.5">
                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs">Who Can Message You</p>
                      <p className="text-[10px] text-stone-500">Controls incoming direct chat permissions.</p>
                    </div>
                    <select
                      value={settingsDraft.whoCanMessage}
                      onChange={(e) => handleUpdateDraft('whoCanMessage', e.target.value as any)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#12372A] border border-stone-200 dark:border-emerald-800 text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="everyone">Everyone</option>
                      <option value="following">People I Follow</option>
                      <option value="nobody">Nobody</option>
                    </select>
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs">Who Can Comment on Your Sprouts</p>
                      <p className="text-[10px] text-stone-500">Controls comment section permissions.</p>
                    </div>
                    <select
                      value={settingsDraft.whoCanComment}
                      onChange={(e) => handleUpdateDraft('whoCanComment', e.target.value as any)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#12372A] border border-stone-200 dark:border-emerald-800 text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="everyone">Everyone</option>
                      <option value="following">People I Follow</option>
                    </select>
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs">Mentions & Tags (@mentions)</p>
                      <p className="text-[10px] text-stone-500">Who can mention you in posts and comments.</p>
                    </div>
                    <select
                      value={settingsDraft.whoCanMention}
                      onChange={(e) => handleUpdateDraft('whoCanMention', e.target.value as any)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#12372A] border border-stone-200 dark:border-emerald-800 text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="everyone">Everyone</option>
                      <option value="following">People I Follow</option>
                      <option value="nobody">Nobody</option>
                    </select>
                  </div>
                </div>

                {/* Blocked Users Section */}
                <div className="p-4 rounded-3xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs flex items-center gap-1.5">
                        <UserX className="w-4 h-4 text-[#00C853]" />
                        <span>Blocked Gardeners ({userProfile?.blockedUsers?.length || 0})</span>
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        Blocked members cannot view your posts or send you whispers.
                      </p>
                    </div>
                  </div>

                  {userProfile?.blockedUsers && userProfile.blockedUsers.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      {userProfile.blockedUsers.map((bId) => (
                        <div
                          key={bId}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-white dark:bg-[#12372A] border border-stone-200 dark:border-emerald-800 text-xs"
                        >
                          <span className="font-mono text-[11px] truncate max-w-[200px]">ID: {bId}</span>
                          <button
                            type="button"
                            onClick={() => handleUnblock(bId)}
                            className="text-xs font-bold text-[#00C853] hover:underline"
                          >
                            Unblock
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400 italic pt-1">No blocked members. Your community circle is clear! 🌿</p>
                  )}
                </div>
              </div>
            )}

            {/* ================= SECTION 4: NOTIFICATIONS ================= */}
            {activeSection === 'notifications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#12372A] dark:text-white flex items-center gap-2">
                    <BellRing className="w-5 h-5 text-[#00C853]" />
                    <span>Notification Preferences</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Customize which community alerts you want to receive.
                  </p>
                </div>

                {/* Push Notification Permission Box */}
                <div className="p-4 rounded-3xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs">Device Push Notifications</h4>
                    <p className="text-[11px] text-stone-500">
                      Permission Status: <span className="font-bold capitalize">{pushStatus}</span>
                    </p>
                  </div>
                  {pushStatus !== 'granted' ? (
                    <button
                      type="button"
                      onClick={handleRequestPushNotification}
                      className="px-3 py-1.5 rounded-xl bg-[#00C853] text-white font-bold text-xs shadow-sm hover:bg-[#00A344] cursor-pointer"
                    >
                      Enable Push
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-[#00C853] bg-[#00C853]/15 px-2.5 py-1 rounded-full">
                      Enabled
                    </span>
                  )}
                </div>

                {/* Notification Sound */}
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-xs">In-App Notification Sounds</p>
                    <p className="text-[10px] text-stone-500">Play delicate natural audio pings on incoming alerts.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settingsDraft.notifSound}
                    onChange={(e) => handleUpdateDraft('notifSound', e.target.checked)}
                    className="w-5 h-5 accent-[#00C853] cursor-pointer"
                  />
                </div>

                {/* Category Toggles */}
                <div className="p-4 rounded-3xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 space-y-3">
                  <h4 className="font-bold text-xs uppercase text-stone-500 tracking-wider">
                    Activity Alerts
                  </h4>

                  {[
                    { key: 'notifLikes' as const, label: 'Likes & Leaf Celebrations', desc: 'When someone likes your sprout or clip' },
                    { key: 'notifComments' as const, label: 'Comments & Replies', desc: 'When someone comments on your sprout' },
                    { key: 'notifFollows' as const, label: 'New Followers', desc: 'When another gardener follows your profile' },
                    { key: 'notifMessages' as const, label: 'Direct Whispers & Group Messages', desc: 'When you receive a chat message' },
                    { key: 'notifMentions' as const, label: 'Mentions & Tags (@)', desc: 'When someone tags you in a post or comment' },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between py-2 border-b border-stone-200/50 dark:border-emerald-800/30 last:border-none"
                    >
                      <div>
                        <p className="font-bold text-xs">{item.label}</p>
                        <p className="text-[10px] text-stone-500">{item.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settingsDraft[item.key]}
                        onChange={(e) => handleUpdateDraft(item.key, e.target.checked)}
                        className="w-5 h-5 accent-[#00C853] cursor-pointer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ================= SECTION 5: CHAT SETTINGS ================= */}
            {activeSection === 'chat' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#12372A] dark:text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-[#00C853]" />
                    <span>Direct Whispers & Group Chats</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Configure chat privacy, receipts, and group invitation rules.
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs">Read Receipts (Seen Checkmarks)</p>
                      <p className="text-[10px] text-stone-500">
                        Let people know when you have read their whispers.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsDraft.readReceipts}
                      onChange={(e) => handleUpdateDraft('readReceipts', e.target.checked)}
                      className="w-5 h-5 accent-[#00C853] cursor-pointer"
                    />
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs">Typing Indicators</p>
                      <p className="text-[10px] text-stone-500">
                        Show a real-time typing indicator while composing a reply.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsDraft.typingIndicators}
                      onChange={(e) => handleUpdateDraft('typingIndicators', e.target.checked)}
                      className="w-5 h-5 accent-[#00C853] cursor-pointer"
                    />
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs">Group Chat Invitations</p>
                      <p className="text-[10px] text-stone-500">
                        Who can add you to community group chats.
                      </p>
                    </div>
                    <select
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#12372A] border border-stone-200 dark:border-emerald-800 text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="everyone">Everyone</option>
                      <option value="following">People I Follow</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ================= SECTION 6: FEED, REELS & MEDIA ================= */}
            {activeSection === 'media' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#12372A] dark:text-white flex items-center gap-2">
                    <Video className="w-5 h-5 text-[#00C853]" />
                    <span>Media Playback & Data Saver</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Controls feed video autoplay, audio muting, and bandwidth usage.
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs">Autoplay Feed Videos</p>
                      <p className="text-[10px] text-stone-500">
                        Automatically play video clips as they scroll into view.
                      </p>
                    </div>
                    <select
                      value={settingsDraft.autoplay}
                      onChange={(e) => handleUpdateDraft('autoplay', e.target.value as any)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#12372A] border border-stone-200 dark:border-emerald-800 text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="always">Always Autoplay</option>
                      <option value="wifi">Wi-Fi Only</option>
                      <option value="never">Never (Tap to Play)</option>
                    </select>
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs">Default Sound: Muted</p>
                      <p className="text-[10px] text-stone-500">
                        Start all feed videos muted to prevent sudden loud noises.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsDraft.defaultMuted}
                      onChange={(e) => handleUpdateDraft('defaultMuted', e.target.checked)}
                      className="w-5 h-5 accent-[#00C853] cursor-pointer"
                    />
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs">Data Saver Mode</p>
                      <p className="text-[10px] text-stone-500">
                        Uses lower media resolutions to preserve mobile data limits.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settingsDraft.dataSaver}
                      onChange={(e) => handleUpdateDraft('dataSaver', e.target.checked)}
                      className="w-5 h-5 accent-[#00C853] cursor-pointer"
                    />
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs">Media Upload Quality</p>
                      <p className="text-[10px] text-stone-500">
                        Quality used when publishing new sprouts and leaf clips.
                      </p>
                    </div>
                    <select
                      value={settingsDraft.uploadQuality}
                      onChange={(e) => handleUpdateDraft('uploadQuality', e.target.value as any)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#12372A] border border-stone-200 dark:border-emerald-800 text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="high">High Quality (Original Clarity)</option>
                      <option value="standard">Standard (Faster Upload)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ================= SECTION 7: APPEARANCE & THEME ================= */}
            {activeSection === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#12372A] dark:text-white flex items-center gap-2">
                    <Palette className="w-5 h-5 text-[#00C853]" />
                    <span>Appearance & Visual Theme</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Customize colors, readability, and accessibility settings.
                  </p>
                </div>

                {/* Theme Selector */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                    Color Theme Mode:
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'light', label: 'Daylight Mode', icon: Sun, desc: 'Clean white & emerald accents' },
                      { id: 'dark', label: 'Night Forest', icon: Moon, desc: 'Deep botanical dark #12372A' },
                      { id: 'system', label: 'System Default', icon: Laptop, desc: 'Matches device preference' },
                    ].map((th) => {
                      const Icon = th.icon;
                      const isSel = settingsDraft.theme === th.id;
                      return (
                        <button
                          key={th.id}
                          type="button"
                          onClick={() => handleUpdateDraft('theme', th.id as any)}
                          className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                            isSel
                              ? 'bg-[#00C853]/15 border-[#00C853] shadow-sm ring-1 ring-[#00C853]'
                              : 'bg-stone-50 dark:bg-[#101512] border-stone-200 dark:border-emerald-800/60'
                          }`}
                        >
                          <Icon className={`w-5 h-5 mb-2 ${isSel ? 'text-[#00C853]' : 'text-stone-400'}`} />
                          <p className="font-bold text-xs">{th.label}</p>
                          <p className="text-[10px] text-stone-500 mt-0.5">{th.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Text Sizing */}
                <div className="p-4 rounded-3xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs">Text Size & Scale</h4>
                      <p className="text-[10px] text-stone-500">Adjusts font size across all screens.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {[
                      { id: 'sm', label: 'Small (14px)' },
                      { id: 'md', label: 'Medium (Default)' },
                      { id: 'lg', label: 'Large (18px)' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleUpdateDraft('fontSize', f.id as any)}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          settingsDraft.fontSize === f.id
                            ? 'bg-[#00C853] text-white border-[#00C853]'
                            : 'bg-white dark:bg-[#12372A] border-stone-200 dark:border-emerald-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reduce Motion */}
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-xs">Reduce Motion</p>
                    <p className="text-[10px] text-stone-500">Minimizes animations and transitions for sensitive users.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settingsDraft.reduceMotion}
                    onChange={(e) => handleUpdateDraft('reduceMotion', e.target.checked)}
                    className="w-5 h-5 accent-[#00C853] cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* ================= SECTION 8: DATA & STORAGE ================= */}
            {activeSection === 'storage' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#12372A] dark:text-white flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-[#00C853]" />
                    <span>Data, Cache & Storage Management</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    View local storage consumption and export your community records.
                  </p>
                </div>

                {/* Storage Meter */}
                <div className="p-4 rounded-3xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs">Browser Storage Consumption</h4>
                    <p className="text-[11px] text-stone-500">
                      Cached search history, session drafts & local settings.
                    </p>
                  </div>
                  <span className="font-mono font-bold text-sm text-[#00C853] bg-[#00C853]/15 px-3 py-1 rounded-full">
                    {storageUsage.formatted}
                  </span>
                </div>

                {/* Cache Clear */}
                <div className="p-4 rounded-3xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs">Clear Local Cache</h4>
                      <p className="text-[11px] text-stone-500">
                        Frees up local storage without logging you out or deleting your sprouts.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearCache}
                      className="px-3.5 py-1.5 rounded-xl border border-stone-300 dark:border-emerald-800 font-bold text-xs hover:bg-[#00C853]/10 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 inline mr-1" />
                      <span>Clear Cache</span>
                    </button>
                  </div>
                  {cacheClearedMsg && (
                    <p className="text-xs font-bold text-[#00C853] pt-1">{cacheClearedMsg}</p>
                  )}
                </div>

                {/* Download Personal Data */}
                <div className="p-4 rounded-3xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-[#00C853]/30 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-[#12372A] dark:text-white">
                      Export Personal Data (.json)
                    </h4>
                    <p className="text-[11px] text-stone-600 dark:text-stone-400">
                      Download a structured archive of your profile, posts, settings, and stats.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="px-4 py-2 rounded-xl bg-[#00C853] text-white font-bold text-xs shadow-md shadow-[#00C853]/20 hover:bg-[#00A344] cursor-pointer"
                  >
                    <FileDown className="w-4 h-4 inline mr-1" />
                    <span>Download JSON</span>
                  </button>
                </div>
              </div>
            )}

            {/* ================= SECTION 9: HELP & SUPPORT ================= */}
            {activeSection === 'help' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-[#12372A] dark:text-white flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-[#00C853]" />
                    <span>Help Center & Guidelines</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Frequently asked questions, reporting tools, and release notes.
                  </p>
                </div>

                {/* FAQ Accordion */}
                <div className="space-y-2">
                  <h4 className="font-bold text-xs uppercase text-stone-500 tracking-wider">
                    Frequently Asked Questions
                  </h4>

                  {[
                    {
                      q: 'How do Sprout posts with music work?',
                      a: 'When creating a post, you can attach any botanical ambient soundtrack or upload photos and videos. Only one video/audio track plays sound at a time to prevent audio overlap.',
                    },
                    {
                      q: 'How do 24-hour Stories expire?',
                      a: 'Stories expire automatically after 24 hours (86,400 seconds) based on their creation timestamp, keeping the Stories tray fresh and uncluttered.',
                    },
                    {
                      q: 'What are unique FG TIME IDs?',
                      a: 'Every gardener receives an official unique identifier (e.g. FG-XXXXXX). You can share this ID with friends to let them find you immediately in exact search.',
                    },
                    {
                      q: 'How does Follow-to-Chat work?',
                      a: 'When you follow another member, you can send them a direct whisper. If an account has private messaging rules, you can send an initial message request.',
                    },
                    {
                      q: 'How are group chats managed?',
                      a: 'The group creator becomes the primary Admin with ability to promote members, update group botanical photo, rename the group, or remove members.',
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="border border-stone-200 dark:border-emerald-800/80 rounded-2xl overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                        className="w-full p-3.5 flex items-center justify-between text-left font-bold text-xs bg-stone-50 dark:bg-[#101512] hover:bg-stone-100 transition-colors"
                      >
                        <span>{item.q}</span>
                        {expandedFaq === idx ? <ChevronDown className="w-4 h-4 text-[#00C853]" /> : <ChevronRight className="w-4 h-4 text-stone-400" />}
                      </button>
                      {expandedFaq === idx && (
                        <div className="p-3.5 bg-white dark:bg-[#12372A]/40 text-xs text-stone-600 dark:text-stone-300 leading-relaxed border-t border-stone-200 dark:border-emerald-800/60">
                          {item.a}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Support Contact */}
                <div className="p-4 rounded-3xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-[#00C853]" />
                      <span>Contact Support Team</span>
                    </h4>
                    <p className="text-[11px] text-stone-500">
                      Reach our green engineers at <code>support@fgtime.eco</code>
                    </p>
                  </div>
                  <a
                    href="mailto:support@fgtime.eco"
                    className="px-3.5 py-1.5 rounded-xl border border-[#00C853] text-[#00C853] font-bold text-xs hover:bg-[#00C853]/10"
                  >
                    Email Us
                  </a>
                </div>

                {/* Release Notes */}
                <div className="p-4 rounded-3xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-xs text-[#12372A] dark:text-white">
                      FG TIME Botanical Edition
                    </p>
                    <p className="text-[10px] text-stone-400">
                      Version 2.4.0 (Build 2026.10) • React 19 + TypeScript + Cloud Firestore
                    </p>
                  </div>
                  <span className="text-[10px] font-bold bg-[#00C853]/20 text-[#00C853] px-2.5 py-1 rounded-full">
                    Production
                  </span>
                </div>
              </div>
            )}

            {/* ================= SECTION 10: ADMIN OPERATIONS (PROTECTED) ================= */}
            {activeSection === 'admin' && (
              <div className="space-y-6">
                {!isAdmin ? (
                  <div className="p-8 text-center bg-red-50 dark:bg-red-950/40 border border-red-300 rounded-3xl">
                    <Shield className="w-10 h-10 text-red-600 mx-auto mb-2" />
                    <h3 className="font-bold text-sm text-red-700">Access Denied (403)</h3>
                    <p className="text-xs text-stone-500 mt-1">
                      This operations center is strictly restricted to verified administrators.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-[#12372A] dark:text-white flex items-center gap-2">
                          <Shield className="w-5 h-5 text-[#00C853]" />
                          <span>Admin Operations & Moderation Queue</span>
                        </h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                          Restricted tools for verified administrator: <code>{currentUser?.email}</code>
                        </p>
                      </div>

                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-[#00C853] border border-[#00C853]/40">
                        Admin Privileges Active
                      </span>
                    </div>

                    {/* Server Health Card */}
                    <div className="p-4 rounded-3xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-[#00C853]" />
                        <div>
                          <h4 className="font-bold text-xs">Cloud Run & Express Server Health</h4>
                          <p className="text-[10px] text-stone-400">
                            {isLoadingHealth
                              ? 'Pinging server health...'
                              : `Status: ${serverHealth?.status || 'OK'} • Timestamp: ${serverHealth?.timestamp || 'live'}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold bg-[#00C853]/15 text-[#00C853] px-2 py-0.5 rounded-full">
                        Healthy
                      </span>
                    </div>

                    {/* Moderation Queue */}
                    <div className="p-4 rounded-3xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-xs flex items-center gap-1.5">
                            <Flag className="w-4 h-4 text-amber-500" />
                            <span>Community Abuse Reports ({adminReports.length})</span>
                          </h4>
                          <p className="text-[11px] text-stone-500">
                            Live user reports awaiting moderation action.
                          </p>
                        </div>
                      </div>

                      {adminReports.length > 0 ? (
                        <div className="space-y-2.5 pt-1">
                          {adminReports.map((rep) => (
                            <div
                              key={rep.id}
                              className="p-3 rounded-2xl bg-white dark:bg-[#12372A] border border-stone-200 dark:border-emerald-800 flex items-center justify-between gap-3"
                            >
                              <div>
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 mr-2">
                                  {rep.targetType}
                                </span>
                                <span className="font-semibold text-xs text-stone-700 dark:text-stone-200">
                                  Reason: "{rep.reason}"
                                </span>
                                <p className="text-[10px] text-stone-400 mt-0.5">
                                  Target ID: {rep.targetId} • {new Date(rep.createdAt).toLocaleString()}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => dismissAdminReport(rep.id)}
                                className="px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-emerald-900 text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                              >
                                Dismiss Report
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-stone-400 italic pt-1">
                          Moderation queue is empty. No open reports! 🌿
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </main>
        </div>

        {/* ================= MODAL FOOTER ================= */}
        <div className="p-3.5 px-6 bg-white dark:bg-[#12372A] border-t border-stone-200 dark:border-emerald-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs font-bold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
          >
            {t.resetDefaults}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-emerald-950 cursor-pointer"
            >
              {t.cancel}
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveAllSettings}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-[#00C853] hover:bg-[#00A344] text-white shadow-md shadow-[#00C853]/25 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : t.saveChanges}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
