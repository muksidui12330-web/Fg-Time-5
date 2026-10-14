/**
 * FG TIME - Android APK Configuration
 * 
 * Configurable HTTPS URL for downloading the signed FG TIME Android APK.
 * Can be configured via VITE_APK_DOWNLOAD_URL environment variable or
 * updated dynamically via the in-app configuration settings.
 */

export interface ApkMetadata {
  appName: string;
  packageName: string;
  version: string;
  versionCode: number;
  fileSize: string;
  fileName: string;
  minAndroid: string;
  targetAndroid: string;
  releaseDate: string;
  sha256Signature: string;
  features: string[];
  installationSteps: {
    step: number;
    title: string;
    description: string;
    tip?: string;
  }[];
}

export const FG_TIME_APK_METADATA: ApkMetadata = {
  appName: 'FG TIME',
  packageName: 'com.fgtime.app',
  version: 'v1.2.0',
  versionCode: 120,
  fileSize: '18.4 MB',
  fileName: 'FG-TIME-v1.2.0.apk',
  minAndroid: 'Android 8.0+ (Oreo, API 26 or newer)',
  targetAndroid: 'Android 15 (API 35)',
  releaseDate: 'October 2026',
  sha256Signature: '9B:2F:3A:4C:8E:1D:6B:7F:4A:2C:9E:8D:1B:3A:5C:7E:9F:0A:2B:4C:6D:8E:1F:3A',
  features: [
    'Instant push notifications for likes, whispers & sprout mentions',
    'High-resolution camera integration with live leaf filters',
    'Hardware-accelerated vertical Leaf Clips & Reels playback',
    'Low battery consumption with true OLED dark mode',
    'Offline caching for garden profiles and read sprouts',
  ],
  installationSteps: [
    {
      step: 1,
      title: 'Download the APK',
      description: 'Tap the Download APK button to download the signed FG TIME installer file (FG-TIME-v1.2.0.apk) to your Android device.',
      tip: 'The file will be saved in your device’s Downloads folder.',
    },
    {
      step: 2,
      title: 'Enable "Install from this source"',
      description: 'Open the downloaded file from your notification bar or file manager. If Android prompts "For your security, your phone is not allowed to install unknown apps", tap Settings and switch on "Allow from this source".',
      tip: 'This standard Android security prompt appears whenever installing apps outside of Google Play.',
    },
    {
      step: 3,
      title: 'Tap Install & Sprout!',
      description: 'Tap "Install" on the confirmation screen. Once finished, tap "Open" to launch FG TIME, log into your garden account, and enjoy the native Android experience!',
    },
  ],
};

const LOCAL_STORAGE_KEY = 'fgtime_custom_apk_download_url';

/**
 * Validates whether a provided string is a legitimate HTTPS download URL.
 */
export function isValidHttpsApkUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://')) return false;

  // Filter out dummy/example placeholders
  if (
    trimmed.includes('example.com') ||
    trimmed.includes('your-domain.com') ||
    trimmed.includes('placeholder') ||
    trimmed === 'https://'
  ) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && parsed.hostname.length > 3;
  } catch {
    return false;
  }
}

/**
 * Retrieves the currently configured APK download URL:
 * Priority:
 * 1. Runtime configured URL in localStorage (configured via UI modal)
 * 2. Environment variable VITE_APK_DOWNLOAD_URL
 * 3. Fallback: null if unconfigured
 */
export function getApkDownloadUrl(): string | null {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored && isValidHttpsApkUrl(stored)) {
        return stored.trim();
      }
    }
  } catch {
    // Ignore localStorage access errors
  }

  const envUrl = (import.meta.env.VITE_APK_DOWNLOAD_URL as string | undefined)?.trim();
  if (envUrl && isValidHttpsApkUrl(envUrl)) {
    return envUrl;
  }

  return null;
}

/**
 * Saves a new HTTPS APK download URL to client storage so the user can test/update it live.
 */
export function saveApkDownloadUrl(url: string | null): boolean {
  if (!url || url.trim() === '') {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  const trimmed = url.trim();
  if (!isValidHttpsApkUrl(trimmed)) {
    return false;
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, trimmed);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a valid signed APK URL is currently ready for users.
 */
export function isApkDownloadAvailable(): boolean {
  return isValidHttpsApkUrl(getApkDownloadUrl());
}
