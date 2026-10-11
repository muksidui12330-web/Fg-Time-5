import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Image as ImageIcon,
  Video,
  Sparkles,
  Wand2,
  MapPin,
  Tag,
  Loader2,
  Leaf,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Camera,
  Music,
  Plus,
  Play,
  Pause,
  Volume2,
  ChevronLeft,
  ChevronRight,
  AtSign,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMediaCoordinator } from '../context/MediaCoordinatorContext';
import { createPost, searchUsers } from '../services/firestoreService';
import { resolveAudioUrl } from '../services/audioService';
import { PostMusic, UserProfile } from '../types';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
  initialTrack?: PostMusic | null;
}

interface MediaItem {
  id: string;
  file?: File;
  previewUrl: string;
  type: 'image' | 'video';
  isPreset?: boolean;
}

export const NATURE_AUDIO_TRACKS: PostMusic[] = [
  {
    title: 'Forest Sunlight Melody',
    artist: 'FG TIME Ambient Records',
    audioUrl: '/audio/forest-sunlight-melody.mp3',
  },
  {
    title: 'Dewdrop Stream Flow',
    artist: 'Botanical Waves',
    audioUrl: '/audio/dewdrop-stream-flow.mp3',
  },
  {
    title: 'Rain on Bamboo Canopy',
    artist: 'Serene Nature Beats',
    audioUrl: '/audio/rain-bamboo-canopy.mp3',
  },
  {
    title: 'Morning Songbirds in Garden',
    artist: 'Roots Acoustic Collective',
    audioUrl: '/audio/morning-songbirds.mp3',
  },
  {
    title: 'Gentle Meadow Breeze',
    artist: 'Echoes of Earth',
    audioUrl: '/audio/gentle-meadow-breeze.mp3',
  },
];

const NATURE_PRESETS = [
  {
    name: 'Dewy Leaf',
    type: 'image' as const,
    url: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=1200&auto=format&fit=crop&q=80',
  },
  {
    name: 'Redwood Mist',
    type: 'image' as const,
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200&auto=format&fit=crop&q=80',
  },
  {
    name: 'Monstera Jungle',
    type: 'image' as const,
    url: 'https://images.unsplash.com/photo-1463936575829-25148e1db1b8?w=1200&auto=format&fit=crop&q=80',
  },
  {
    name: 'Sunlight Canopy',
    type: 'image' as const,
    url: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=1200&auto=format&fit=crop&q=80',
  },
  {
    name: 'Forest Stream Loop',
    type: 'video' as const,
    url: 'https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4',
  },
  {
    name: 'Rain on Leaves',
    type: 'video' as const,
    url: 'https://assets.mixkit.co/videos/preview/mixkit-rain-drops-falling-on-leaves-of-a-plant-41315-large.mp4',
  },
];

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onPostCreated,
  initialTrack,
}) => {
  const { currentUser, userProfile, signInWithGoogle } = useAuth();
  const [content, setContent] = useState('');
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  // Audio / Music state
  const [selectedMusic, setSelectedMusic] = useState<PostMusic | null>(initialTrack || null);

  useEffect(() => {
    if (initialTrack) {
      setSelectedMusic(initialTrack);
    }
  }, [initialTrack]);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioPickerOpen, setIsAudioPickerOpen] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Camera stream capture state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoCameraRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Mention state & suggestions
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState<UserProfile[]>([]);
  const [mentions, setMentions] = useState<string[]>([]);
  const [showMentionBox, setShowMentionBox] = useState(false);

  const [location, setLocation] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['#FGTime', '#GreenLiving']);
  const [category, setCategory] = useState('nature');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up object URLs and camera streams on unmount or close
  useEffect(() => {
    return () => {
      mediaList.forEach((m) => {
        if (m.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(m.previewUrl);
        }
      });
      stopCamera();
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
    };
  }, []);

  const { requestPlayback, releasePlayback } = useMediaCoordinator();

  // Clean up audio preview on unmount or modal close
  useEffect(() => {
    return () => {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current.src = '';
      }
      releasePlayback('create-post-preview');
    };
  }, [releasePlayback]);

  // Handle audio player
  useEffect(() => {
    if (selectedMusic && selectedMusic.audioUrl) {
      const resolved = resolveAudioUrl(selectedMusic.audioUrl, selectedMusic.title);
      if (!audioPreviewRef.current) {
        audioPreviewRef.current = new Audio(resolved);
      } else {
        audioPreviewRef.current.src = resolved;
      }
      audioPreviewRef.current.onended = () => {
        setIsAudioPlaying(false);
        releasePlayback('create-post-preview');
      };
    } else {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      setIsAudioPlaying(false);
      releasePlayback('create-post-preview');
    }
  }, [selectedMusic, releasePlayback]);

  const toggleAudioPreview = async (track: PostMusic) => {
    const resolved = resolveAudioUrl(track.audioUrl, track.title);
    if (selectedMusic?.title === track.title && isAudioPlaying) {
      audioPreviewRef.current?.pause();
      setIsAudioPlaying(false);
      releasePlayback('create-post-preview');
    } else {
      setSelectedMusic({ ...track, audioUrl: resolved });
      requestPlayback('create-post-preview', 'audio');
      if (!audioPreviewRef.current) {
        audioPreviewRef.current = new Audio(resolved);
      } else {
        audioPreviewRef.current.src = resolved;
      }
      try {
        await audioPreviewRef.current.play();
        setIsAudioPlaying(true);
      } catch (err) {
        console.warn('Preview playback failed:', err);
        setIsAudioPlaying(false);
        releasePlayback('create-post-preview');
      }
    }
  };

  // Camera start / stop / capture
  const startCamera = async () => {
    setErrorMessage('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage('Camera access is not supported by your browser or environment.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      cameraStreamRef.current = stream;
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoCameraRef.current) {
          videoCameraRef.current.srcObject = stream;
          videoCameraRef.current.play().catch(() => {});
        }
      }, 150);
    } catch (err: any) {
      console.warn('Camera error:', err);
      setErrorMessage(
        'Unable to access camera. Please allow camera permissions in your browser or select files from gallery.'
      );
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhotoFromCamera = () => {
    if (!videoCameraRef.current) return;
    try {
      const video = videoCameraRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], `camera-sprout-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(file);
        setMediaList((prev) => [
          ...prev,
          {
            id: `cam-${Date.now()}`,
            file,
            previewUrl,
            type: 'image',
          },
        ]);
        setActiveMediaIndex(mediaList.length);
        stopCamera();
      }, 'image/jpeg', 0.9);
    } catch (err) {
      console.error('Camera capture error:', err);
    }
  };

  if (!isOpen) return null;

  // File gallery selection (supports multiple images up to 5)
  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMessage('');
    const newItems: MediaItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 50 * 1024 * 1024) {
        setErrorMessage(`File "${file.name}" exceeds the 50MB limit. Please choose smaller files.`);
        continue;
      }
      const isVideo = file.type.startsWith('video/');
      const blobUrl = URL.createObjectURL(file);
      newItems.push({
        id: `file-${Date.now()}-${i}-${Math.random()}`,
        file,
        previewUrl: blobUrl,
        type: isVideo ? 'video' : 'image',
      });
    }

    if (newItems.length > 0) {
      setMediaList((prev) => {
        const combined = [...prev, ...newItems].slice(0, 5); // limit to 5 media items
        return combined;
      });
    }

    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
    }
  };

  const handleSelectPreset = (preset: typeof NATURE_PRESETS[0]) => {
    setErrorMessage('');
    const item: MediaItem = {
      id: `preset-${Date.now()}`,
      previewUrl: preset.url,
      type: preset.type,
      isPreset: true,
    };
    setMediaList((prev) => [...prev, item].slice(0, 5));
  };

  const handleRemoveMedia = (index: number) => {
    setMediaList((prev) => {
      const item = prev[index];
      if (item && item.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.previewUrl);
      }
      const next = prev.filter((_, idx) => idx !== index);
      if (activeMediaIndex >= next.length) {
        setActiveMediaIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^#*/, '#');
      if (clean && clean.length > 1 && !tags.includes(clean) && tags.length < 10) {
        setTags([...tags, clean]);
        setTagInput('');
      }
    }
  };

  const removeTag = (tToRemove: string) => {
    setTags(tags.filter((t) => t !== tToRemove));
  };

  // Mention autocomplete search
  const handleSearchMentions = async (query: string) => {
    setMentionQuery(query);
    if (query.trim().length > 0) {
      try {
        const users = await searchUsers(query.trim());
        if (Array.isArray(users)) {
          setMentionSuggestions(users.slice(0, 5));
          setShowMentionBox(true);
        }
      } catch {
        setMentionSuggestions([]);
      }
    } else {
      setMentionSuggestions([]);
      setShowMentionBox(false);
    }
  };

  const handleSelectMention = (u: UserProfile) => {
    const handle = `@${u.username}`;
    if (!mentions.includes(handle)) {
      setMentions([...mentions, handle]);
      // Also append to content text
      setContent((prev) => (prev ? `${prev} ${handle} ` : `${handle} `));
    }
    setMentionQuery('');
    setShowMentionBox(false);
  };

  const handleRemoveMention = (mToRemove: string) => {
    setMentions(mentions.filter((m) => m !== mToRemove));
  };

  // AI Eco Caption generator
  const handleAiGenerateCaption = async () => {
    setIsAiLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: content.trim() || 'A refreshing green moment in the garden',
          mood: 'inspiring and mindful',
        }),
      });
      const data = await res.json();
      if (data.caption) setContent(data.caption);
      if (data.hashtags && Array.isArray(data.hashtags)) {
        const unique = Array.from(new Set([...tags, ...data.hashtags])).slice(0, 8);
        setTags(unique);
      }
    } catch {
      // fallback
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI Polish Post
  const handleAiPolishPost = async () => {
    if (!content.trim()) return;
    setIsAiLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/ai/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content }),
      });
      const data = await res.json();
      if (data.enhanced) setContent(data.enhanced);
    } catch {
      // fallback
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!currentUser) {
      setErrorMessage('Please sign in with Google to publish your sprout.');
      try {
        await signInWithGoogle();
        return;
      } catch (err: any) {
        setErrorMessage(err?.message || 'Sign in was cancelled or failed.');
        return;
      }
    }

    const hasText = content.trim().length > 0;
    const hasMedia = mediaList.length > 0;

    if (!hasText && !hasMedia) {
      setErrorMessage('Please write some thoughts or choose a photo/video for your sprout.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(10);
    setUploadStatusText('Preparing sprout moments...');

    try {
      const uploadedUrls: string[] = [];
      let primaryMediaType: 'image' | 'video' = 'image';

      // 1. Upload files to /api/upload
      if (mediaList.length > 0) {
        for (let i = 0; i < mediaList.length; i++) {
          const item = mediaList[i];
          const stepPercent = Math.round(15 + ((i + 1) / mediaList.length) * 60);
          setUploadProgress(stepPercent);

          if (item.file) {
            setUploadStatusText(`Uploading media ${i + 1} of ${mediaList.length}...`);
            const formData = new FormData();
            formData.append('file', item.file);

            const uploadRes = await fetch('/api/upload', {
              method: 'POST',
              body: formData,
            });

            if (!uploadRes.ok) {
              const errData = await uploadRes.json().catch(() => ({}));
              throw new Error(errData.error || `Upload failed with status ${uploadRes.status}`);
            }

            const uploadData = await uploadRes.json();
            if (!uploadData.url) {
              throw new Error('Server returned empty media URL.');
            }
            uploadedUrls.push(uploadData.url);
            if (item.type === 'video') primaryMediaType = 'video';
          } else if (item.isPreset || item.previewUrl) {
            uploadedUrls.push(item.previewUrl);
            if (item.type === 'video') primaryMediaType = 'video';
          }
        }
      }

      setUploadProgress(85);
      setUploadStatusText('Planting post into Roots feed...');

      // 2. Save post record to Cloud Firestore
      const authorDisplayName = userProfile?.displayName || currentUser.displayName || 'Green Explorer';
      const authorUsername =
        userProfile?.username ||
        (currentUser.email ? currentUser.email.split('@')[0].replace(/[^a-z0-9_]/g, '') : 'member');
      const authorPhoto =
        userProfile?.photoURL || currentUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';

      const primaryUrl = uploadedUrls[0] || undefined;

      await createPost({
        authorId: currentUser.uid,
        authorName: authorDisplayName,
        authorUsername: authorUsername,
        authorPhoto: authorPhoto,
        content: content.trim(),
        imageUrl: primaryUrl,
        mediaUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
        mediaType: primaryUrl ? primaryMediaType : undefined,
        tags: tags,
        mentions: mentions.length > 0 ? mentions : undefined,
        music: selectedMusic ? selectedMusic : undefined,
        location: location.trim() || undefined,
        category: category,
        createdAt: new Date().toISOString(),
      });

      setUploadProgress(100);
      setSuccessMessage('Sprout published successfully to the garden! 🌿✨');
      setUploadStatusText('');

      // Clean up form
      setContent('');
      setMediaList([]);
      setSelectedMusic(null);
      setMentions([]);
      setLocation('');
      setTags(['#FGTime', '#GreenLiving']);

      if (onPostCreated) {
        onPostCreated();
      }

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Post submission error:', err);
      let readableError = 'Failed to submit post. Please check your network and try again.';
      if (err?.message) {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed.error) readableError = parsed.error;
        } catch {
          readableError = err.message;
        }
      }
      setErrorMessage(readableError);
    } finally {
      setIsSubmitting(false);
      setUploadStatusText('');
      setUploadProgress(0);
    }
  };

  const currentActiveMedia = mediaList[activeMediaIndex];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-[#12372A] rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-[#00C853]/20 dark:border-emerald-800 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-emerald-100 dark:border-emerald-800/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#00C853]/10 text-[#00C853]">
              <Leaf className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#12372A] dark:text-white">
                Sprout a New Post
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-emerald-300">
                FG TIME • Grow Moments. Share Roots.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            disabled={isSubmitting}
            className="p-1 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="mt-3 p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-[#00C853]/40 text-xs text-[#00C853] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-bold">{successMessage}</span>
          </div>
        )}

        {/* Upload Progress Bar if submitting */}
        {isSubmitting && (
          <div className="mt-3 p-3 rounded-2xl bg-[#00C853]/10 border border-[#00C853]/30 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-[#00C853]">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{uploadStatusText || 'Publishing sprout...'}</span>
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-emerald-200 dark:bg-emerald-900 rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#00C853] h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-3">
          {/* Author snippet */}
          {currentUser ? (
            <div className="flex items-center gap-3">
              <img
                src={userProfile?.photoURL || currentUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={userProfile?.displayName || 'Author'}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-[#00C853]/40"
              />
              <div>
                <p className="text-xs font-bold text-[#12372A] dark:text-white">
                  {userProfile?.displayName || currentUser.displayName || 'Green Explorer'}
                </p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00C853]/15 text-[#00C853] font-bold">
                  {userProfile?.leafBadge || 'Forest Sprout 🌱'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-[#00C853]/30">
              <div className="flex items-center gap-2">
                <Leaf className="w-4 h-4 text-[#00C853]" />
                <span className="text-xs text-[#12372A] dark:text-emerald-200 font-medium">
                  Sign in with Google to sprout posts in Roots feed
                </span>
              </div>
              <button
                type="button"
                onClick={signInWithGoogle}
                className="px-3 py-1.5 rounded-xl bg-[#00C853] text-white text-xs font-bold hover:bg-[#00A344] transition-colors cursor-pointer"
              >
                Sign In
              </button>
            </div>
          )}

          {/* Text Area */}
          <div>
            <textarea
              rows={3}
              maxLength={2000}
              placeholder="What moments or green thoughts are sprouting today? (Type #tags or @mentions)..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3.5 text-xs sm:text-sm rounded-2xl border border-stone-200 dark:border-emerald-800/80 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#00C853] resize-none"
            />

            {/* AI Assist & Count */}
            <div className="flex items-center justify-between text-[11px] text-stone-400 px-1 mt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isAiLoading || isSubmitting}
                  onClick={handleAiGenerateCaption}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[#00C853] bg-[#00C853]/10 hover:bg-[#00C853]/20 font-bold transition-colors text-[11px] cursor-pointer disabled:opacity-50"
                >
                  {isAiLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>AI Eco Caption</span>
                </button>

                {content.trim() && (
                  <button
                    type="button"
                    disabled={isAiLoading || isSubmitting}
                    onClick={handleAiPolishPost}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-teal-600 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 font-bold transition-colors text-[11px] cursor-pointer disabled:opacity-50"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>AI Polish</span>
                  </button>
                )}
              </div>

              <span>{content.length}/2000</span>
            </div>
          </div>

          {/* ADVANCED MEDIA UPLOAD SECTION: Gallery, Camera & Carousel */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-[#12372A] dark:text-stone-200 flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-[#00C853]" />
                <span>Media Attachments ({mediaList.length}/5)</span>
              </label>

              <div className="flex items-center gap-2">
                {/* Open Camera Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (isCameraActive) stopCamera();
                    else startCamera();
                  }}
                  className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-xl font-bold transition-colors cursor-pointer ${
                    isCameraActive
                      ? 'bg-red-500 text-white'
                      : 'bg-emerald-50 dark:bg-emerald-950 text-[#00C853] border border-[#00C853]/30 hover:bg-[#00C853]/15'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{isCameraActive ? 'Close Camera' : 'Open Camera'}</span>
                </button>

                {/* Upload from Gallery Button */}
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-xl bg-[#00C853]/10 text-[#00C853] font-bold hover:bg-[#00C853]/20 transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Gallery</span>
                </button>
              </div>
            </div>

            {/* Hidden File Input (supports multiple selections) */}
            <input
              type="file"
              ref={galleryInputRef}
              accept="image/*,video/*"
              multiple
              onChange={handleFilesSelect}
              className="hidden"
            />

            {/* Active Live Camera View */}
            {isCameraActive && (
              <div className="relative rounded-2xl overflow-hidden bg-black mb-3 border-2 border-[#00C853] flex flex-col items-center">
                <video
                  ref={videoCameraRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-60 object-cover"
                />
                <div className="p-3 w-full bg-black/60 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={capturePhotoFromCamera}
                    className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#00C853] text-white font-bold text-xs shadow-lg hover:bg-[#00A344] active:scale-95 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Snap Photo</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2 rounded-full bg-stone-800 text-stone-200 text-xs font-semibold hover:bg-stone-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Media Preview Box or Empty Placeholder */}
            {mediaList.length === 0 && !isCameraActive ? (
              <div
                onClick={() => galleryInputRef.current?.click()}
                className="w-full border-2 border-dashed border-[#00C853]/40 dark:border-emerald-800 rounded-2xl p-5 text-center cursor-pointer hover:bg-[#00C853]/5 transition-colors flex flex-col items-center gap-1.5"
              >
                <div className="w-10 h-10 rounded-full bg-[#00C853]/10 flex items-center justify-center text-[#00C853]">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-[#12372A] dark:text-white">
                  Add photos or videos from gallery or camera
                </p>
                <p className="text-[10px] text-stone-400">
                  Multiple photos supported (up to 5 items • JPEG, PNG, MP4 up to 50MB)
                </p>
              </div>
            ) : mediaList.length > 0 ? (
              <div className="flex flex-col gap-2">
                {/* Main Carousel Display */}
                {currentActiveMedia && (
                  <div className="relative rounded-2xl overflow-hidden max-h-60 bg-black flex items-center justify-center border border-stone-200 dark:border-emerald-800">
                    {currentActiveMedia.type === 'video' ? (
                      <video
                        src={currentActiveMedia.previewUrl}
                        controls
                        className="w-full max-h-60 object-contain"
                      />
                    ) : (
                      <img
                        src={currentActiveMedia.previewUrl}
                        alt="Preview"
                        className="w-full max-h-60 object-contain"
                      />
                    )}

                    {/* Carousel Nav buttons if multiple items */}
                    {mediaList.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMediaIndex((prev) => (prev > 0 ? prev - 1 : mediaList.length - 1))
                          }
                          className="absolute left-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMediaIndex((prev) => (prev < mediaList.length - 1 ? prev + 1 : 0))
                          }
                          className="absolute right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* Badge & Item Counter */}
                    <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-bold flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-[#00C853]" />
                      <span>
                        {activeMediaIndex + 1}/{mediaList.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(activeMediaIndex)}
                      className="absolute top-2 right-2 px-2 py-1 rounded-full bg-red-600/80 text-white text-[10px] font-bold hover:bg-red-700 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {/* Thumbnails row to quickly jump between media */}
                <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
                  {mediaList.map((m, idx) => (
                    <div
                      key={m.id}
                      onClick={() => setActiveMediaIndex(idx)}
                      className={`relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 cursor-pointer transition-all ${
                        activeMediaIndex === idx
                          ? 'border-[#00C853] scale-105 ring-2 ring-[#00C853]/40'
                          : 'border-stone-200 dark:border-emerald-900 opacity-60 hover:opacity-100'
                      }`}
                    >
                      {m.type === 'video' ? (
                        <div className="w-full h-full bg-[#12372A] flex items-center justify-center text-[#00C853]">
                          <Video className="w-4 h-4" />
                        </div>
                      ) : (
                        <img src={m.previewUrl} alt="" className="w-full h-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveMedia(idx);
                        }}
                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] font-bold"
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {/* Add more button if < 5 */}
                  {mediaList.length < 5 && (
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="w-14 h-14 rounded-xl border-2 border-dashed border-[#00C853]/50 flex flex-col items-center justify-center text-[#00C853] hover:bg-[#00C853]/10 shrink-0 text-[10px] font-bold cursor-pointer"
                      title="Add more media"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add</span>
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {/* Curated Presets */}
            <div className="mt-2.5">
              <span className="text-[10px] uppercase font-bold text-stone-400 block mb-1">
                Or pick a curated botanical preset:
              </span>
              <div className="grid grid-cols-6 gap-1.5">
                {NATURE_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    title={p.name}
                    className="h-10 rounded-xl overflow-hidden border border-stone-200 dark:border-emerald-900 hover:border-[#00C853] opacity-75 hover:opacity-100 transition-all cursor-pointer"
                  >
                    {p.type === 'video' ? (
                      <div className="w-full h-full bg-[#12372A] flex items-center justify-center text-[#00C853]">
                        <Video className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* INSTAGRAM-STYLE AUDIO / MUSIC FEATURE */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-[#00C853]/25">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#00C853]/15 text-[#00C853]">
                  <Music className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#12372A] dark:text-white block">
                    Add Music & Ambient Nature Soundtrack
                  </span>
                  <span className="text-[10px] text-stone-400">
                    Instagram-style sound overlays for your sprout
                  </span>
                </div>
              </div>

              {selectedMusic ? (
                <button
                  type="button"
                  onClick={() => {
                    audioPreviewRef.current?.pause();
                    setSelectedMusic(null);
                    setIsAudioPlaying(false);
                  }}
                  className="text-[10px] font-bold text-red-500 hover:underline"
                >
                  Remove Audio
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAudioPickerOpen(!isAudioPickerOpen)}
                  className="text-[11px] font-bold text-[#00C853] hover:underline cursor-pointer"
                >
                  {isAudioPickerOpen ? 'Hide Tracks' : '+ Choose Track'}
                </button>
              )}
            </div>

            {/* Currently selected track preview badge */}
            {selectedMusic && (
              <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#101512] border border-[#00C853]/40 mt-1">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleAudioPreview(selectedMusic)}
                    className="p-1.5 rounded-full bg-[#00C853] text-white hover:bg-[#00A344] shrink-0 cursor-pointer"
                  >
                    {isAudioPlaying ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5 ml-0.5" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-800 dark:text-stone-100 truncate">
                      🎵 {selectedMusic.title}
                    </p>
                    <p className="text-[10px] text-stone-400 truncate">{selectedMusic.artist}</p>
                  </div>
                </div>

                <span className="text-[10px] text-[#00C853] font-bold uppercase tracking-wider shrink-0 px-2 py-0.5 bg-[#00C853]/10 rounded-full">
                  Attached
                </span>
              </div>
            )}

            {/* Audio Track Selector Drawer */}
            {(isAudioPickerOpen || (!selectedMusic && isAudioPickerOpen)) && (
              <div className="mt-2 pt-2 border-t border-emerald-100 dark:border-emerald-800/40 flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase text-stone-400">
                  Select a nature audio track:
                </span>
                {NATURE_AUDIO_TRACKS.map((track) => (
                  <div
                    key={track.title}
                    className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                      selectedMusic?.title === track.title
                        ? 'bg-[#00C853]/15 border border-[#00C853]'
                        : 'bg-white dark:bg-[#101512] border border-stone-200 dark:border-emerald-900 hover:border-[#00C853]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleAudioPreview(track)}
                        className="p-1.5 rounded-full bg-[#00C853]/15 text-[#00C853] hover:bg-[#00C853] hover:text-white transition-colors cursor-pointer"
                        title="Preview audio"
                      >
                        {selectedMusic?.title === track.title && isAudioPlaying ? (
                          <Pause className="w-3 h-3" />
                        ) : (
                          <Play className="w-3 h-3 ml-0.5" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-stone-800 dark:text-stone-100 truncate">
                          {track.title}
                        </p>
                        <p className="text-[10px] text-stone-400 truncate">{track.artist}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMusic(track);
                        setIsAudioPickerOpen(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#00C853] text-white text-[10px] font-bold hover:bg-[#00A344] cursor-pointer"
                    >
                      Use
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* USER MENTIONS / TAGGING SECTION */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-[#12372A] dark:text-stone-200 flex items-center gap-1">
                <AtSign className="w-3.5 h-3.5 text-[#00C853]" />
                <span>Tag Friends / Mention Gardeners</span>
              </label>
              <span className="text-[10px] text-stone-400">Search by username</span>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Type username to mention..."
                value={mentionQuery}
                onChange={(e) => handleSearchMentions(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C853]"
              />

              {/* Suggestions Dropdown */}
              {showMentionBox && mentionSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-[#12372A] rounded-2xl shadow-xl border border-stone-200 dark:border-emerald-800 p-1.5 flex flex-col gap-1 max-h-48 overflow-y-auto">
                  {mentionSuggestions.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => handleSelectMention(user)}
                      className="flex items-center gap-2 p-2 rounded-xl hover:bg-[#00C853]/10 cursor-pointer"
                    >
                      <img
                        src={user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-stone-800 dark:text-stone-100 truncate">
                          {user.displayName}
                        </p>
                        <p className="text-[10px] text-[#00C853] truncate">@{user.username}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Mention Chips */}
            {mentions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {mentions.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold border border-teal-200 dark:border-teal-800"
                  >
                    {m}
                    <button
                      type="button"
                      onClick={() => handleRemoveMention(m)}
                      className="hover:text-red-500 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Location & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-[#12372A] dark:text-stone-200 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#00C853]" />
                <span>Location (Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Kyoto Bamboo Grove, Japan"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C853]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#12372A] dark:text-stone-200 mb-1 block">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C853]"
              >
                <option value="nature">🌿 Nature & Flora</option>
                <option value="vibes">🍃 Botanical Vibes</option>
                <option value="green-tech">🔋 Eco Tech & Living</option>
                <option value="general">✨ Community Garden</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-[11px] font-bold text-[#12372A] dark:text-stone-200 mb-1 block">
              Hashtags (Type and press Enter)
            </label>
            <input
              type="text"
              placeholder="#UrbanJungle"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-stone-50 dark:bg-[#101512] text-stone-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00C853]"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] bg-[#00C853]/15 text-[#00C853] font-bold"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      className="hover:text-red-500 font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-emerald-100 dark:border-emerald-800/40">
            {uploadStatusText ? (
              <span className="text-[11px] text-[#00C853] font-semibold flex items-center gap-1.5 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{uploadStatusText}</span>
              </span>
            ) : (
              <span className="text-[10px] text-stone-400">
                Visible to all gardeners in Roots feed
              </span>
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-emerald-900/30 rounded-xl disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (!content.trim() && mediaList.length === 0)}
                className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-[#00C853] to-[#00A344] hover:from-[#00E676] hover:to-[#00C853] rounded-xl shadow-md shadow-[#00C853]/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sprouting...</span>
                  </>
                ) : !currentUser ? (
                  <>
                    <Leaf className="w-4 h-4" />
                    <span>Sign In & Sprout</span>
                  </>
                ) : (
                  <>
                    <Leaf className="w-4 h-4" />
                    <span>Publish Sprout</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
