import { collection, query, orderBy, onSnapshot, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, UserSettings, ReportItem, PostItem } from '../types';

export interface PresenceInfo {
  isOnline: boolean;
  text: string;
  showDot: boolean;
}

/**
 * Calculates a verified presence status for any user.
 * Respects user's privacy settings (nobody, following, everyone) and Do Not Disturb mode.
 * Enforces a strict 90-second heartbeat timeout to guarantee users are NEVER falsely shown online.
 */
export function getUserPresenceStatus(
  targetUser?: UserProfile | null,
  viewerId?: string,
  isViewerFollowing: boolean = false
): PresenceInfo {
  if (!targetUser) {
    return { isOnline: false, text: 'Offline', showDot: false };
  }

  const settings = targetUser.settings;

  // 1. Check Do Not Disturb
  if (settings?.doNotDisturb) {
    return { isOnline: false, text: 'Do Not Disturb 🌙', showDot: false };
  }

  // 2. Check Online Visibility Privacy
  const visibility = settings?.onlineVisibility || 'everyone';
  if (visibility === 'nobody' && viewerId !== targetUser.id) {
    return { isOnline: false, text: 'Offline', showDot: false };
  }
  if (visibility === 'following' && viewerId !== targetUser.id && !isViewerFollowing) {
    return { isOnline: false, text: 'Offline', showDot: false };
  }

  // 3. Check Real-Time Heartbeat (within 90 seconds)
  if (targetUser.lastSeen) {
    const elapsedMs = Date.now() - new Date(targetUser.lastSeen).getTime();
    const isWithinHeartbeat = elapsedMs < 90000; // 90 seconds timeout

    if (targetUser.isOnline && isWithinHeartbeat) {
      return { isOnline: true, text: 'Active now', showDot: true };
    }

    // Format last seen realistically
    const minsAgo = Math.floor(elapsedMs / 60000);
    if (minsAgo < 1) return { isOnline: false, text: 'Active just now', showDot: false };
    if (minsAgo < 60) return { isOnline: false, text: `Active ${minsAgo}m ago`, showDot: false };
    const hoursAgo = Math.floor(minsAgo / 60);
    if (hoursAgo < 24) return { isOnline: false, text: `Active ${hoursAgo}h ago`, showDot: false };
    const daysAgo = Math.floor(hoursAgo / 24);
    return { isOnline: false, text: `Active ${daysAgo}d ago`, showDot: false };
  }

  return { isOnline: false, text: 'Offline', showDot: false };
}

/**
 * Calculates local browser storage usage in Kilobytes / Megabytes.
 */
export function calculateStorageUsage(): { totalKb: number; formatted: string } {
  try {
    let totalBytes = 0;
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        totalBytes += (localStorage[key]?.length || 0) * 2;
      }
    }
    const kb = Math.round(totalBytes / 1024);
    if (kb > 1024) {
      return { totalKb: kb, formatted: `${(kb / 1024).toFixed(2)} MB` };
    }
    return { totalKb: kb, formatted: `${kb} KB` };
  } catch {
    return { totalKb: 0, formatted: '0 KB' };
  }
}

/**
 * Clears temporary browser cache safely without removing user authentication or posts.
 */
export function clearLocalCacheSafely(): { success: boolean; clearedItems: number } {
  try {
    const keysToPreserve = [
      'firebase:authUser',
      'fgtime_user_settings',
    ];

    let cleared = 0;
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
      const isPreserved = keysToPreserve.some((p) => key.includes(p));
      if (!isPreserved) {
        localStorage.removeItem(key);
        cleared++;
      }
    }

    // Also clear session storage
    sessionStorage.clear();
    return { success: true, clearedItems: cleared };
  } catch (err) {
    console.error('Error clearing cache:', err);
    return { success: false, clearedItems: 0 };
  }
}

/**
 * Packages personal data (profile, sprouts, saves, settings) into a downloadable JSON file.
 */
export function exportPersonalDataJSON(profile: UserProfile, posts: PostItem[] = []) {
  const myPosts = posts.filter((p) => p.authorId === profile.id);
  const data = {
    app: 'FG TIME',
    exportDate: new Date().toISOString(),
    user: {
      id: profile.id,
      fgTimeId: profile.fgTimeId,
      displayName: profile.displayName,
      username: profile.username,
      email: profile.email,
      phone: profile.phone || null,
      bio: profile.bio,
      leafBadge: profile.leafBadge,
      joinedAt: profile.createdAt,
      followersCount: profile.followersCount,
      followingCount: profile.followingCount,
      postsCount: profile.postsCount,
    },
    settings: profile.settings || {},
    sprouts: myPosts.map((p) => ({
      id: p.id,
      content: p.content,
      createdAt: p.createdAt,
      likesCount: p.likesCount,
      commentsCount: p.commentsCount,
      mediaUrl: p.imageUrl || null,
      tags: p.tags || [],
    })),
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fgtime-data-export-${profile.username || 'user'}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Real-time listener on community abuse reports for authorized administrators.
 */
export function subscribeAdminReports(callback: (reports: ReportItem[]) => void) {
  const reportsRef = collection(db, 'reports');
  const q = query(reportsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snap) => {
      const items: ReportItem[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ReportItem, 'id'>),
      }));
      callback(items);
    },
    (err) => {
      console.warn('Admin reports notice:', err.message);
      callback([]);
    }
  );
}

/**
 * Dismisses or deletes a handled report.
 */
export async function dismissAdminReport(reportId: string) {
  try {
    await deleteDoc(doc(db, 'reports', reportId));
  } catch (err) {
    console.error('Failed to dismiss report:', err);
  }
}

/**
 * Supported UI translations for Settings Center.
 */
export const SETTINGS_TRANSLATIONS = {
  en: {
    settingsTitle: 'Settings Center',
    searchPlaceholder: 'Search settings, privacy, account...',
    saveChanges: 'Save Changes',
    cancel: 'Cancel',
    resetDefaults: 'Reset to Defaults',
    savedSuccess: 'Settings saved successfully! 🌿',
    // Sections
    secAccount: 'Account & Profile',
    secPresence: 'Active Status & Presence',
    secPrivacy: 'Privacy & Permissions',
    secNotifications: 'Notifications',
    secChat: 'Chat & Whispers',
    secMedia: 'Media, Feed & Playback',
    secAppearance: 'Appearance & Language',
    secStorage: 'Data & Storage',
    secHelp: 'Help & Support',
    secAdmin: 'Admin Operations',
  },
  hi: {
    settingsTitle: 'सेटिंग्स केंद्र (Settings Center)',
    searchPlaceholder: 'सेटिंग्स, गोपनीयता, खाता खोजें...',
    saveChanges: 'परिवर्तन सहेजें',
    cancel: 'रद्द करें',
    resetDefaults: 'डिफ़ॉल्ट रीसेट करें',
    savedSuccess: 'सेटिंग्स सफलतापूर्वक सहेजी गईं! 🌿',
    // Sections
    secAccount: 'खाता और प्रोफ़ाइल',
    secPresence: 'सक्रिय स्थिति और उपस्थिति',
    secPrivacy: 'गोपनीयता और अनुमतियाँ',
    secNotifications: 'सूचनाएं (Notifications)',
    secChat: 'चैट और संदेश',
    secMedia: 'मीडिया और फ़ीड प्लेबैक',
    secAppearance: 'रूप-रंग और भाषा',
    secStorage: 'डेटा और संग्रहण',
    secHelp: 'सहायता और समर्थन',
    secAdmin: 'व्यवस्थापक नियंत्रण (Admin)',
  },
  es: {
    settingsTitle: 'Centro de Configuración',
    searchPlaceholder: 'Buscar ajustes, privacidad, cuenta...',
    saveChanges: 'Guardar Cambios',
    cancel: 'Cancelar',
    resetDefaults: 'Restablecer Valores',
    savedSuccess: '¡Configuración guardada con éxito! 🌿',
    // Sections
    secAccount: 'Cuenta y Perfil',
    secPresence: 'Estado Activo y Presencia',
    secPrivacy: 'Privacidad y Permisos',
    secNotifications: 'Notificaciones',
    secChat: 'Chat y Susurros',
    secMedia: 'Medios, Feed y Reproducción',
    secAppearance: 'Apariencia e Idioma',
    secStorage: 'Datos y Almacenamiento',
    secHelp: 'Ayuda y Soporte',
    secAdmin: 'Operaciones de Administrador',
  },
};
