import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Plus,
  X,
  Music,
  Sparkles,
  Loader2,
  UploadCloud,
  Film,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { ReelItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { useMediaCoordinator } from '../context/MediaCoordinatorContext';
import {
  subscribeReels,
  createReel,
  toggleLikeReel,
} from '../services/firestoreService';

const PRESET_NATURE_CLIPS = [
  {
    title: 'Forest Sunlight Stream',
    url: '/videos/forest-stream.mp4',
    sound: 'Original Nature - River Melody',
  },
  {
    title: 'Rain on Monstera Leaves',
    url: '/videos/monstera-leaves.mp4',
    sound: 'Monsoon Lo-Fi Greenery',
  },
  {
    title: 'Gentle Waterfall Canopy',
    url: '/videos/waterfall-canopy.mp4',
    sound: 'Cascading Water Resonance',
  },
];

const resolveReelUrl = (url: string) => {
  if (!url || url.includes('mixkit.co')) {
    return '/videos/forest-stream.mp4';
  }
  return url;
};

export const ReelsView: React.FC = () => {
  const { currentUser, userProfile, signInWithGoogle } = useAuth();
  const { requestPlayback, releasePlayback, registerMedia, isMediaActive } = useMediaCoordinator();
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Upload modal state
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [soundTitle, setSoundTitle] = useState('Original Botanical Audio');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [uploadError, setUploadError] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef<number | null>(null);

  const reelAudioKey = reels[currentIndex] ? `reel-${reels[currentIndex].id}` : 'reel-active';

  const stopReel = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  // Register with coordinator
  useEffect(() => {
    const unregister = registerMedia(reelAudioKey, stopReel);
    return () => {
      unregister();
      stopReel();
      releasePlayback(reelAudioKey);
    };
  }, [reelAudioKey, registerMedia, releasePlayback, stopReel]);

  // Sync with coordinator active state
  useEffect(() => {
    if (!isMediaActive(reelAudioKey) && isPlaying && !isMuted) {
      setIsMuted(true);
    }
  }, [isMediaActive, reelAudioKey, isPlaying, isMuted]);

  // When currentIndex changes, replay video smoothly
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      requestPlayback(reelAudioKey, 'reel');
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [currentIndex, reelAudioKey, requestPlayback]);

  // Keyboard Up/Down navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.min(reels.length - 1, prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reels.length]);

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMuted) {
      setIsMuted(false);
      requestPlayback(reelAudioKey, 'reel');
    } else {
      setIsMuted(true);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      releasePlayback(reelAudioKey);
    } else {
      requestPlayback(reelAudioKey, 'reel');
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  useEffect(() => {
    const unsub = subscribeReels((list) => {
      setReels(list);
    });
    return () => unsub();
  }, []);

  const handleLike = (reel: ReelItem) => {
    if (!currentUser) {
      signInWithGoogle();
      return;
    }
    const currentlyLiked = likedMap[reel.id];
    if (!currentlyLiked) {
      confetti({
        particleCount: 20,
        spread: 50,
        origin: { y: 0.6 },
        colors: ['#00C853', '#69F0AE', '#00A344'],
      });
      setLikedMap({ ...likedMap, [reel.id]: true });
      toggleLikeReel(reel.id, 1);
    } else {
      setLikedMap({ ...likedMap, [reel.id]: false });
      toggleLikeReel(reel.id, -1);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('Video file exceeds 50MB limit.');
      return;
    }
    setSelectedFile(file);
    setVideoUrl('');
  };

  const handleUploadReel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) return;
    if (!videoUrl.trim() && !selectedFile) {
      setUploadError('Please select a video file or pick a preset clip.');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setUploadProgressText('Preparing clip...');

    try {
      let finalVideoUrl = videoUrl.trim();

      if (selectedFile) {
        setUploadProgressText('Uploading video clip to server...');
        const formData = new FormData();
        formData.append('file', selectedFile);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to upload video clip.');
        }

        const data = await res.json();
        finalVideoUrl = data.url;
      }

      setUploadProgressText('Publishing Leaf Clip...');

      await createReel({
        authorId: currentUser.uid,
        authorName: userProfile.displayName,
        authorPhoto: userProfile.photoURL,
        videoUrl: finalVideoUrl,
        caption: caption.trim() || 'Soaking in green tranquility 🍃',
        soundTitle: soundTitle.trim() || 'Original Botanical Audio',
        createdAt: new Date().toISOString(),
      });

      setIsAddOpen(false);
      setVideoUrl('');
      setSelectedFile(null);
      setCaption('');
      setSoundTitle('Original Botanical Audio');
    } catch (err: any) {
      console.error('Error uploading reel:', err);
      setUploadError(err?.message || 'Failed to publish clip.');
    } finally {
      setIsUploading(false);
      setUploadProgressText('');
    }
  };

  const currentReel = reels[currentIndex];

  return (
    <div className="w-full flex flex-col items-center py-2 max-w-lg mx-auto">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between px-4 pb-3">
        <div>
          <h2 className="text-lg font-bold text-[#12372A] dark:text-white flex items-center gap-2">
            <span>Leaf Clips</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#00C853]/15 text-[#00C853] font-bold">
              Shorts
            </span>
          </h2>
          <p className="text-xs text-stone-500">
            Living reels, ambient nature sounds & visual loops
          </p>
        </div>

        <button
          onClick={() => {
            if (!currentUser) signInWithGoogle();
            else {
              setVideoUrl(PRESET_NATURE_CLIPS[0].url);
              setIsAddOpen(true);
            }
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#00C853] hover:bg-[#00A344] text-white text-xs font-bold shadow-md shadow-[#00C853]/25 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Sprout Clip</span>
        </button>
      </div>

      {/* Reel Container */}
      {reels.length > 0 && currentReel ? (
        <div
          ref={containerRef}
          onTouchStart={(e) => {
            touchStartY.current = e.touches[0].clientY;
          }}
          onTouchEnd={(e) => {
            if (touchStartY.current === null) return;
            const diff = touchStartY.current - e.changedTouches[0].clientY;
            if (diff > 50) {
              // Swiped up -> next
              setCurrentIndex((prev) => Math.min(reels.length - 1, prev + 1));
            } else if (diff < -50) {
              // Swiped down -> prev
              setCurrentIndex((prev) => Math.max(0, prev - 1));
            }
            touchStartY.current = null;
          }}
          onWheel={(e) => {
            if (Math.abs(e.deltaY) > 40) {
              if (e.deltaY > 0) {
                setCurrentIndex((prev) => Math.min(reels.length - 1, prev + 1));
              } else {
                setCurrentIndex((prev) => Math.max(0, prev - 1));
              }
            }
          }}
          className="relative w-full aspect-[9/16] max-h-[750px] bg-black rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center select-none cursor-pointer"
          onClick={togglePlay}
        >
          <video
            ref={videoRef}
            src={resolveReelUrl(currentReel.videoUrl)}
            loop
            muted={isMuted}
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Center Play Overlay when paused */}
          {!isPlaying && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
              <div className="w-16 h-16 rounded-full bg-[#00C853] text-white flex items-center justify-center shadow-2xl shadow-[#00C853]/50">
                <Play className="w-8 h-8 fill-white ml-1" />
              </div>
            </div>
          )}

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/50 backdrop-blur-md text-white hover:bg-black/70 transition-colors cursor-pointer"
            title={isMuted ? 'Unmute Clip Audio' : 'Mute Clip Audio'}
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-stone-300" /> : <Volume2 className="w-5 h-5 text-[#00C853]" />}
          </button>

          {/* Right Action Bar */}
          <div className="absolute right-3 bottom-20 z-20 flex flex-col items-center gap-4">
            {/* Author Avatar */}
            <div className="relative">
              <img
                src={currentReel.authorPhoto}
                alt={currentReel.authorName}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-[#00C853]"
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#00C853] text-white flex items-center justify-center text-[10px]">
                🌱
              </div>
            </div>

            {/* Like */}
            <button
              onClick={() => handleLike(currentReel)}
              className="flex flex-col items-center gap-1 text-white cursor-pointer"
            >
              <div
                className={`p-3 rounded-full backdrop-blur-md transition-transform active:scale-125 ${
                  likedMap[currentReel.id]
                    ? 'bg-[#00C853] text-white shadow-lg shadow-[#00C853]/40'
                    : 'bg-black/40 text-white'
                }`}
              >
                <Heart
                  className={`w-6 h-6 ${
                    likedMap[currentReel.id] ? 'fill-current' : ''
                  }`}
                />
              </div>
              <span className="text-[11px] font-bold">
                {currentReel.likesCount || 0}
              </span>
            </button>

            {/* Comments */}
            <button className="flex flex-col items-center gap-1 text-white cursor-pointer">
              <div className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white">
                <MessageCircle className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-bold">
                {currentReel.commentsCount || 0}
              </span>
            </button>

            {/* Share */}
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'FG TIME Leaf Clip',
                    text: currentReel.caption,
                    url: window.location.href,
                  });
                }
              }}
              className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white cursor-pointer"
            >
              <Share2 className="w-6 h-6" />
            </button>

            {/* Save */}
            <button
              onClick={() => {
                if (!currentUser) signInWithGoogle();
                else {
                  setSavedMap((prev) => ({ ...prev, [currentReel.id]: !prev[currentReel.id] }));
                }
              }}
              className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white cursor-pointer"
              title="Save Clip"
            >
              <Bookmark
                className={`w-6 h-6 ${
                  savedMap[currentReel.id] ? 'fill-[#00C853] text-[#00C853]' : ''
                }`}
              />
            </button>
          </div>

          {/* Bottom Overlay Info */}
          <div className="absolute bottom-4 inset-x-4 z-20 text-white flex flex-col gap-2">
            <div>
              <p className="font-bold text-sm drop-shadow-md">
                @{currentReel.authorName}
              </p>
              <p className="text-xs text-white/90 drop-shadow line-clamp-2 mt-0.5">
                {currentReel.caption}
              </p>
            </div>

            {/* Audio info pill */}
            <div className="flex items-center gap-2 text-[11px] text-[#69F0AE] bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-full w-fit">
              <Music className="w-3.5 h-3.5 animate-spin" />
              <span className="truncate max-w-[200px]">
                {currentReel.soundTitle}
              </span>
            </div>
          </div>

          {/* Navigation Controls */}
          {reels.length > 1 && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(currentIndex - 1)}
                className="p-2 rounded-full bg-black/40 text-white disabled:opacity-0 hover:bg-black/60 transition-opacity text-xs cursor-pointer"
              >
                ▲ Prev
              </button>
              <button
                disabled={currentIndex === reels.length - 1}
                onClick={() => setCurrentIndex(currentIndex + 1)}
                className="p-2 rounded-full bg-black/40 text-white disabled:opacity-0 hover:bg-black/60 transition-opacity text-xs cursor-pointer"
              >
                ▼ Next
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center bg-white dark:bg-[#12372A]/40 rounded-3xl border border-[#00C853]/20 dark:border-emerald-800 w-full">
          <p className="text-sm text-stone-500">
            No leaf clips sprouted yet. Be the first to share a nature loop! 🌿
          </p>
        </div>
      )}

      {/* Upload Reel Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12372A] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#00C853]/20 dark:border-emerald-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#12372A] dark:text-white flex items-center gap-2">
                <span>Sprout a Leaf Clip</span>
                <Sparkles className="w-4 h-4 text-[#00C853]" />
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="mb-3 p-3 rounded-xl bg-red-50 text-red-600 text-xs">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadReel} className="flex flex-col gap-4">
              {/* File upload from device */}
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center justify-between">
                  <span>Upload Video Clip (MP4 / WebM)</span>
                  <span className="text-[10px] text-stone-400">Up to 50MB</span>
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-4 rounded-xl border border-dashed border-[#00C853]/40 hover:bg-[#00C853]/5 flex items-center justify-center gap-2 text-xs font-bold text-[#00C853] transition-colors cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{selectedFile ? `Selected: ${selectedFile.name}` : 'Choose Video from Device'}</span>
                </button>
              </div>

              {/* Or Presets */}
              <div>
                <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-1.5 block">
                  Or pick an ambient nature clip preset:
                </span>
                <div className="flex flex-col gap-1.5">
                  {PRESET_NATURE_CLIPS.map((p) => (
                    <button
                      key={p.title}
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setVideoUrl(p.url);
                        setSoundTitle(p.sound);
                      }}
                      className={`px-3 py-2 text-left rounded-xl text-xs border transition-all cursor-pointer ${
                        videoUrl === p.url && !selectedFile
                          ? 'border-[#00C853] bg-[#00C853]/15 text-[#00C853] font-bold'
                          : 'border-stone-200 dark:border-emerald-900/60 hover:bg-stone-50 dark:hover:bg-emerald-900/20'
                      }`}
                    >
                      🌿 {p.title}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5 block">
                  Caption
                </label>
                <input
                  type="text"
                  placeholder="Forest frequency & green serenity 🍃"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-white dark:bg-[#101512] text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-[#00C853]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5 block">
                  Sound Track Title
                </label>
                <input
                  type="text"
                  placeholder="Original Audio - Stream Melody"
                  value={soundTitle}
                  onChange={(e) => setSoundTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-white dark:bg-[#101512] text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-[#00C853]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || (!videoUrl.trim() && !selectedFile)}
                  className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#00C853] hover:bg-[#00A344] rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{uploadProgressText || 'Posting Clip...'}</span>
                    </>
                  ) : (
                    <span>Publish Clip</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
