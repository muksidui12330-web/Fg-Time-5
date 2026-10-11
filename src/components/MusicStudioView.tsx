import React, { useState, useEffect, useRef } from 'react';
import {
  Music,
  Play,
  Pause,
  UploadCloud,
  Search,
  Sparkles,
  Heart,
  Volume2,
  VolumeX,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileAudio,
  Radio,
  Share2,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMediaCoordinator } from '../context/MediaCoordinatorContext';
import {
  subscribeMusicTracks,
  publishMusicTrack,
  VERIFIED_NATURE_TRACKS,
  resolveAudioUrl,
} from '../services/audioService';
import { MusicTrackItem, PostMusic } from '../types';

interface MusicStudioViewProps {
  onSelectTrackForPost?: (track: PostMusic) => void;
}

export const MusicStudioView: React.FC<MusicStudioViewProps> = ({
  onSelectTrackForPost,
}) => {
  const { currentUser, userProfile, signInWithGoogle } = useAuth();
  const { requestPlayback, releasePlayback, registerMedia, isMediaActive } = useMediaCoordinator();

  const [tracks, setTracks] = useState<MusicTrackItem[]>(VERIFIED_NATURE_TRACKS);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);

  // Currently playing track state
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadArtist, setUploadArtist] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Canopy Ambience');
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const studioPlayerKey = 'music-studio-player';

  // Stop playback callback registered with central coordinator
  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlayingTrackId(null);
    setIsAudioLoading(false);
  };

  useEffect(() => {
    const unregister = registerMedia(studioPlayerKey, stopPlayback);
    return () => {
      unregister();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      releasePlayback(studioPlayerKey);
    };
  }, [registerMedia, releasePlayback]);

  // Sync state if coordinator pauses studio
  useEffect(() => {
    if (!isMediaActive(studioPlayerKey) && playingTrackId) {
      stopPlayback();
    }
  }, [isMediaActive, playingTrackId]);

  // Subscribe to live tracks
  useEffect(() => {
    const unsub = subscribeMusicTracks((list) => {
      setTracks(list);
    });
    return () => unsub();
  }, []);

  const handleTogglePlay = async (track: MusicTrackItem) => {
    setPlaybackError(null);
    const resolvedUrl = resolveAudioUrl(track.audioUrl, track.title);

    if (playingTrackId === track.id) {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setPlayingTrackId(null);
        releasePlayback(studioPlayerKey);
      } else if (audioRef.current) {
        requestPlayback(studioPlayerKey, 'audio');
        try {
          await audioRef.current.play();
          setPlayingTrackId(track.id);
        } catch {
          setPlayingTrackId(null);
          releasePlayback(studioPlayerKey);
        }
      }
      return;
    }

    // Switch to new track
    setIsAudioLoading(true);
    requestPlayback(studioPlayerKey, 'audio');

    if (!audioRef.current) {
      audioRef.current = new Audio(resolvedUrl);
    } else {
      audioRef.current.src = resolvedUrl;
    }

    const audio = audioRef.current;
    audio.currentTime = 0;
    audio.muted = isMuted;

    audio.onloadedmetadata = () => {
      setDuration(audio.duration || 20);
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onended = () => {
      setPlayingTrackId(null);
      setCurrentTime(0);
      releasePlayback(studioPlayerKey);
    };

    audio.onerror = () => {
      setIsAudioLoading(false);
      setPlayingTrackId(null);
      setPlaybackError(`Cannot play "${track.title}". Track source unavailable.`);
      releasePlayback(studioPlayerKey);
    };

    try {
      await audio.play();
      setPlayingTrackId(track.id);
      setIsAudioLoading(false);
    } catch (err) {
      console.warn('Studio play error:', err);
      setIsAudioLoading(false);
      setPlayingTrackId(null);
      releasePlayback(studioPlayerKey);
      setPlaybackError('Playback prevented by browser permissions. Tap Play to listen.');
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const next = !isMuted;
      audioRef.current.muted = next;
      setIsMuted(next);
    }
  };

  const toggleFavorite = (trackId: string) => {
    setFavorites((prev) =>
      prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]
    );
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    if (!file.type.startsWith('audio/')) {
      setUploadError('Please select a valid audio file (.mp3, .wav, .ogg, .m4a).');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('Audio file exceeds 50MB limit.');
      return;
    }
    setSelectedAudioFile(file);
    if (!uploadTitle) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setUploadTitle(cleanName);
    }
  };

  const handleUploadTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) {
      signInWithGoogle();
      return;
    }

    if (!selectedAudioFile) {
      setUploadError('Please choose an audio file to upload.');
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError('Please enter a track title.');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', selectedAudioFile);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Server audio upload failed.');
      }

      const data = await res.json();
      if (!data.url) throw new Error('No audio URL returned.');

      const newTrack = await publishMusicTrack({
        title: uploadTitle.trim(),
        artist: uploadArtist.trim() || userProfile.displayName || 'Community Creator',
        audioUrl: data.url,
        category: uploadCategory,
        isOriginal: true,
        creatorId: currentUser.uid,
        creatorName: userProfile.displayName,
        creatorPhoto: userProfile.photoURL,
        duration: 30,
      });

      setTracks((prev) => [newTrack, ...prev]);
      setUploadSuccess(`"${newTrack.title}" published to Music Studio!`);
      setSelectedAudioFile(null);
      setUploadTitle('');
      setUploadArtist('');
      setTimeout(() => {
        setIsUploadOpen(false);
        setUploadSuccess('');
      }, 1500);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload audio track.');
    } finally {
      setIsUploading(false);
    }
  };

  const categories = [
    'all',
    'Canopy Ambience',
    'Water & Brooks',
    'Rain & Leaves',
    'Birdsong & Morning',
    'Wind & Bells',
    'Community Originals',
  ];

  const filteredTracks = tracks.filter((t) => {
    const matchesCat =
      activeCategory === 'all'
        ? true
        : activeCategory === 'Community Originals'
        ? t.isOriginal
        : t.category === activeCategory;
    const matchesSearch =
      searchQuery.trim() === ''
        ? true
        : t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.artist.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const activePlayingTrack = tracks.find((t) => t.id === playingTrackId);

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-6 pb-28 space-y-6">
      {/* Studio Header Card */}
      <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-[#12372A] via-[#1B5E20] to-[#00C853] text-white shadow-xl overflow-hidden border border-[#00C853]/40">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="p-2.5 rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/30">
                <Radio className="w-6 h-6 text-[#69F0AE]" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                FG TIME Music Studio
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-emerald-100/90 max-w-lg">
              Explore nature-infused soundscapes, soothing organic beats, and creator tracks for your Sprout posts and Leaf Clips.
            </p>
          </div>

          <button
            onClick={() => {
              if (!currentUser) signInWithGoogle();
              else setIsUploadOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-[#12372A] hover:bg-emerald-50 font-bold text-xs shadow-lg shadow-black/20 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 text-[#00C853]" />
            <span>Upload Original Audio</span>
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="relative z-10 mt-6 flex items-center bg-black/25 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-white/20">
          <Search className="w-4 h-4 text-emerald-300 mr-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracks by title, artist, or botanical mood..."
            className="w-full bg-transparent text-white placeholder-emerald-200/60 text-xs sm:text-sm focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-emerald-200 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeCategory === cat
                ? 'bg-[#00C853] text-white shadow-md shadow-[#00C853]/25 scale-105'
                : 'bg-white dark:bg-[#12372A]/70 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-emerald-800/40 hover:bg-[#00C853]/10 hover:text-[#00C853]'
            }`}
          >
            {cat === 'all' ? '🌿 All Soundscapes' : cat}
          </button>
        ))}
      </div>

      {/* Playback Error Banner */}
      {playbackError && (
        <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{playbackError}</span>
          </div>
          <button
            onClick={() => setPlaybackError(null)}
            className="font-bold underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Floating Active Player Dock if track playing */}
      {activePlayingTrack && (
        <div className="sticky top-16 z-30 p-3 sm:p-4 rounded-3xl bg-white/95 dark:bg-[#12372A]/95 backdrop-blur-xl border border-[#00C853]/40 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => handleTogglePlay(activePlayingTrack)}
              className="w-11 h-11 rounded-full bg-[#00C853] text-white flex items-center justify-center shrink-0 shadow-lg shadow-[#00C853]/30 hover:scale-105 active:scale-95 transition-all"
            >
              {isAudioLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Pause className="w-5 h-5 fill-white" />
              )}
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-[#00C853] animate-pulse" />
                <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-white truncate">
                  {activePlayingTrack.title}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                {activePlayingTrack.artist} • {activePlayingTrack.category}
              </p>
            </div>
          </div>

          {/* Progress Slider */}
          <div className="flex-1 w-full sm:w-auto flex items-center gap-2.5 px-2">
            <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400 w-8 text-right">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 20}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-stone-200 dark:bg-emerald-900 rounded-lg appearance-none cursor-pointer accent-[#00C853]"
            />
            <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400 w-8">
              {formatTime(duration || 20)}
            </span>
          </div>

          {/* Actions in Player Dock */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={toggleMute}
              className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-[#00C853]/10 hover:text-[#00C853]"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-stone-400" /> : <Volume2 className="w-4 h-4 text-[#00C853]" />}
            </button>
            {onSelectTrackForPost && (
              <button
                onClick={() => onSelectTrackForPost(activePlayingTrack)}
                className="px-3.5 py-1.5 rounded-xl bg-[#00C853] hover:bg-[#00A344] text-white text-xs font-bold shadow-sm"
              >
                Use in Sprout
              </button>
            )}
          </div>
        </div>
      )}

      {/* Track Library List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredTracks.map((track) => {
          const isThisPlaying = playingTrackId === track.id;
          const isFav = favorites.includes(track.id);

          return (
            <div
              key={track.id}
              className={`p-4 rounded-3xl border transition-all flex flex-col justify-between gap-3 ${
                isThisPlaying
                  ? 'bg-gradient-to-br from-[#00C853]/15 via-white to-white dark:from-emerald-950/80 dark:via-[#12372A] dark:to-[#12372A] border-[#00C853] shadow-md'
                  : 'bg-white dark:bg-[#12372A]/70 border-stone-200 dark:border-emerald-800/40 hover:border-[#00C853]/50 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => handleTogglePlay(track)}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md transition-all cursor-pointer ${
                      isThisPlaying
                        ? 'bg-[#00C853] text-white ring-4 ring-[#00C853]/30 scale-105'
                        : 'bg-emerald-50 dark:bg-emerald-950/60 text-[#00C853] hover:bg-[#00C853] hover:text-white'
                    }`}
                  >
                    {isThisPlaying && isAudioLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isThisPlaying ? (
                      <Pause className="w-5 h-5 fill-current" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-[#12372A] dark:text-white truncate">
                      {track.title}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                      {track.artist}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-[#00C853]">
                        {track.category}
                      </span>
                      {track.isOriginal ? (
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                          Community Original
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-[#00C853] bg-[#00C853]/15 px-2 py-0.5 rounded-full">
                          FG TIME Master
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => toggleFavorite(track.id)}
                  className="p-2 text-stone-400 hover:text-red-500 transition-colors"
                  title="Favorite"
                >
                  <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500 text-red-500' : ''}`} />
                </button>
              </div>

              {/* Bottom Track Controls */}
              <div className="pt-2 border-t border-stone-100 dark:border-emerald-800/40 flex items-center justify-between">
                <span className="text-[11px] text-stone-400 font-mono">
                  {track.usageCount ? `${track.usageCount} Sprouts used` : 'Ready to use'}
                </span>

                <div className="flex items-center gap-2">
                  {onSelectTrackForPost && (
                    <button
                      onClick={() => onSelectTrackForPost(track)}
                      className="px-3 py-1.5 rounded-xl bg-[#00C853]/15 hover:bg-[#00C853] text-[#00C853] hover:text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      Use in Post
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload Audio Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12372A] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#00C853]/30 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-emerald-800/50 pb-3">
              <div className="flex items-center gap-2">
                <FileAudio className="w-5 h-5 text-[#00C853]" />
                <h2 className="font-bold text-base text-[#12372A] dark:text-white">
                  Publish Original Audio Track
                </h2>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                ✕
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-300 text-red-600 text-xs">
                {uploadError}
              </div>
            )}
            {uploadSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-[#00C853] text-[#00C853] text-xs flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUploadTrack} className="space-y-3.5">
              {/* File Selector */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Audio File (MP3, WAV, OGG, max 50MB)
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="audio/*"
                  onChange={handleAudioFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed border-[#00C853]/40 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:bg-[#00C853]/5 cursor-pointer transition-colors"
                >
                  <UploadCloud className="w-6 h-6 text-[#00C853]" />
                  <span className="text-xs font-bold text-stone-700 dark:text-stone-200">
                    {selectedAudioFile ? selectedAudioFile.name : 'Choose Audio File'}
                  </span>
                  <span className="text-[10px] text-stone-400">
                    {selectedAudioFile
                      ? `${(selectedAudioFile.size / (1024 * 1024)).toFixed(2)} MB`
                      : 'High-quality stereo recording recommended'}
                  </span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Track Title
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Morning Forest Dewdrop Chimes"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800 text-xs focus:ring-2 focus:ring-[#00C853] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Artist / Creator Attribution
                </label>
                <input
                  type="text"
                  value={uploadArtist}
                  onChange={(e) => setUploadArtist(e.target.value)}
                  placeholder={userProfile?.displayName || 'Your Creator Handle'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800 text-xs focus:ring-2 focus:ring-[#00C853] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Category
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#101512] border border-stone-200 dark:border-emerald-800 text-xs focus:ring-2 focus:ring-[#00C853] focus:outline-none cursor-pointer"
                >
                  <option value="Canopy Ambience">Canopy Ambience</option>
                  <option value="Water & Brooks">Water & Brooks</option>
                  <option value="Rain & Leaves">Rain & Leaves</option>
                  <option value="Birdsong & Morning">Birdsong & Morning</option>
                  <option value="Wind & Bells">Wind & Bells</option>
                  <option value="Acoustic Lo-Fi">Acoustic Lo-Fi</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-emerald-950"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#00C853] hover:bg-[#00A344] text-white shadow-md shadow-[#00C853]/25 cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? 'Publishing...' : 'Publish Track'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
