import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { MusicTrackItem, PostMusic } from '../types';

export const VERIFIED_NATURE_TRACKS: MusicTrackItem[] = [
  {
    id: 'track-forest-sunlight',
    title: 'Forest Sunlight Melody',
    artist: 'FG TIME Ambient Records',
    audioUrl: '/audio/forest-sunlight-melody.mp3',
    duration: 20,
    category: 'Canopy Ambience',
    isOriginal: false,
    usageCount: 142,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'track-dewdrop-stream',
    title: 'Dewdrop Stream Flow',
    artist: 'Botanical Waves',
    audioUrl: '/audio/dewdrop-stream-flow.mp3',
    duration: 20,
    category: 'Water & Brooks',
    isOriginal: false,
    usageCount: 98,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'track-rain-bamboo',
    title: 'Rain on Bamboo Canopy',
    artist: 'Serene Nature Beats',
    audioUrl: '/audio/rain-bamboo-canopy.mp3',
    duration: 20,
    category: 'Rain & Leaves',
    isOriginal: false,
    usageCount: 84,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'track-morning-birds',
    title: 'Morning Songbirds in Garden',
    artist: 'Roots Acoustic Collective',
    audioUrl: '/audio/morning-songbirds.mp3',
    duration: 20,
    category: 'Birdsong & Morning',
    isOriginal: false,
    usageCount: 120,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'track-meadow-breeze',
    title: 'Gentle Meadow Breeze',
    artist: 'Echoes of Earth',
    audioUrl: '/audio/gentle-meadow-breeze.mp3',
    duration: 20,
    category: 'Wind & Bells',
    isOriginal: false,
    usageCount: 76,
    createdAt: new Date().toISOString(),
  },
];

/**
 * Resolves any audio URL (handling legacy 404 Google actions URLs and mapping them to verified local audio files)
 */
export function resolveAudioUrl(url?: string, title?: string): string {
  if (!url) {
    if (title) {
      const match = VERIFIED_NATURE_TRACKS.find(
        (t) => t.title.toLowerCase().trim() === title.toLowerCase().trim()
      );
      if (match) return match.audioUrl;
    }
    return '';
  }

  // Handle broken Google Action URLs or legacy links
  if (url.includes('actions.google.com/sounds') || url.includes('.ogg')) {
    const lowerTitle = (title || '').toLowerCase();
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('forest_daytime') || lowerTitle.includes('forest sunlight') || lowerTitle.includes('sunlight')) {
      return '/audio/forest-sunlight-melody.mp3';
    }
    if (lowerUrl.includes('stream_water') || lowerTitle.includes('dewdrop') || lowerTitle.includes('stream')) {
      return '/audio/dewdrop-stream-flow.mp3';
    }
    if (lowerUrl.includes('rain') || lowerTitle.includes('bamboo') || lowerTitle.includes('rain')) {
      return '/audio/rain-bamboo-canopy.mp3';
    }
    if (lowerUrl.includes('birds') || lowerTitle.includes('songbirds') || lowerTitle.includes('bird')) {
      return '/audio/morning-songbirds.mp3';
    }
    if (lowerUrl.includes('wind') || lowerTitle.includes('breeze') || lowerTitle.includes('meadow')) {
      return '/audio/gentle-meadow-breeze.mp3';
    }
    return '/audio/forest-sunlight-melody.mp3';
  }

  return url;
}

/**
 * Subscribe to Music Studio tracks (seeded verified + community original tracks)
 */
export function subscribeMusicTracks(
  callback: (tracks: MusicTrackItem[]) => void
): () => void {
  try {
    const q = query(collection(db, 'tracks'), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(
      q,
      (snapshot) => {
        const customTracks: MusicTrackItem[] = [];
        snapshot.forEach((docSnap) => {
          customTracks.push(docSnap.data() as MusicTrackItem);
        });
        // Combine verified nature presets with custom user uploads
        const combined = [...VERIFIED_NATURE_TRACKS];
        customTracks.forEach((ct) => {
          if (!combined.some((t) => t.id === ct.id)) {
            combined.push(ct);
          }
        });
        callback(combined);
      },
      (error) => {
        console.warn('Tracks snapshot fallback to presets:', error);
        callback(VERIFIED_NATURE_TRACKS);
      }
    );
  } catch (err) {
    console.warn('Firestore tracks error:', err);
    callback(VERIFIED_NATURE_TRACKS);
    return () => {};
  }
}

/**
 * Publish an original sound / music track to FG TIME Music Studio
 */
export async function publishMusicTrack(track: Omit<MusicTrackItem, 'id' | 'createdAt'>): Promise<MusicTrackItem> {
  const id = `track-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newTrack: MusicTrackItem = {
    ...track,
    id,
    createdAt: new Date().toISOString(),
    usageCount: 1,
  };

  try {
    await setDoc(doc(db, 'tracks', id), newTrack);
  } catch (err) {
    console.error('Failed to save track in Firestore:', err);
  }
  return newTrack;
}
