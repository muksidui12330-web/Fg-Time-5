import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, ChevronLeft, ChevronRight, Sparkles, Image as ImageIcon, Trash2, Eye, UploadCloud, Loader2 } from 'lucide-react';
import { StoryItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { useMediaCoordinator } from '../context/MediaCoordinatorContext';
import { createStory, subscribeStories, recordStoryView } from '../services/firestoreService';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

const NATURE_STORY_PRESETS = [
  {
    title: 'Emerald Dewdrop',
    url: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800&auto=format&fit=crop&q=80',
  },
  {
    title: 'Forest Sunlight',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&auto=format&fit=crop&q=80',
  },
  {
    title: 'Monstera Leaves',
    url: 'https://images.unsplash.com/photo-1463936575829-25148e1db1b8?w=800&auto=format&fit=crop&q=80',
  },
  {
    title: 'Alpine Meadow',
    url: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=800&auto=format&fit=crop&q=80',
  },
  {
    title: 'Bamboo Canopy',
    url: 'https://images.unsplash.com/photo-1511497584788-87676104235f?w=800&auto=format&fit=crop&q=80',
  },
];

export const StoriesBar: React.FC = () => {
  const { currentUser, userProfile, signInWithGoogle } = useAuth();
  const { requestPlayback, releasePlayback } = useMediaCoordinator();
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [selectedStoryFile, setSelectedStoryFile] = useState<File | null>(null);
  const [newCaption, setNewCaption] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const storyFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsub = subscribeStories((list) => {
      setStories(list);
    });
    return () => unsub();
  }, []);

  // Story viewer active media coordination
  useEffect(() => {
    if (activeStoryIndex !== null) {
      requestPlayback('story-viewer-modal', 'story');
    } else {
      releasePlayback('story-viewer-modal');
    }
    return () => {
      releasePlayback('story-viewer-modal');
    };
  }, [activeStoryIndex, requestPlayback, releasePlayback]);

  // Story viewer timer & progress
  useEffect(() => {
    if (activeStoryIndex === null) {
      setProgress(0);
      return;
    }

    const story = stories[activeStoryIndex];
    if (story && currentUser) {
      recordStoryView(story.id, currentUser.uid);
    }

    if (isPaused) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Advance to next story or close
          if (activeStoryIndex < stories.length - 1) {
            setActiveStoryIndex(activeStoryIndex + 1);
            return 0;
          } else {
            setActiveStoryIndex(null);
            return 0;
          }
        }
        return prev + 2; // ~5 seconds total
      });
    }, 100);

    return () => clearInterval(interval);
  }, [activeStoryIndex, isPaused, stories.length, currentUser]);

  const handleOpenAddStory = () => {
    if (!currentUser) {
      signInWithGoogle();
      return;
    }
    setNewMediaUrl(NATURE_STORY_PRESETS[0].url);
    setSelectedStoryFile(null);
    setUploadError('');
    setIsAddModalOpen(true);
  };

  const handleStoryFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('Story file exceeds 50MB limit.');
      return;
    }
    setSelectedStoryFile(file);
    setNewMediaUrl(URL.createObjectURL(file));
  };

  const handlePublishStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) return;
    if (!newMediaUrl.trim() && !selectedStoryFile) {
      setUploadError('Please choose a photo or select a preset.');
      return;
    }

    setIsPublishing(true);
    setUploadError('');

    try {
      let finalMediaUrl = newMediaUrl.trim();

      if (selectedStoryFile) {
        const formData = new FormData();
        formData.append('file', selectedStoryFile);
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) {
          throw new Error('Failed to upload story media to server.');
        }
        const data = await res.json();
        finalMediaUrl = data.url;
      }

      await createStory({
        authorId: currentUser.uid,
        authorName: userProfile.displayName,
        authorPhoto: userProfile.photoURL,
        mediaUrl: finalMediaUrl,
        caption: newCaption.trim(),
        createdAt: new Date().toISOString(),
        expiresAt: Date.now() + 86400000, // 24 hours
      });

      setIsAddModalOpen(false);
      setNewCaption('');
      setNewMediaUrl('');
      setSelectedStoryFile(null);
    } catch (err: any) {
      console.error('Error adding story:', err);
      setUploadError(err?.message || 'Failed to publish story.');
    } finally {
      setIsPublishing(false);
    }
  };

  const currentStory = activeStoryIndex !== null ? stories[activeStoryIndex] : null;

  return (
    <div className="w-full mb-6">
      <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
        {/* Add Story Button / User's story */}
        <div
          onClick={handleOpenAddStory}
          className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
        >
          <div className="relative w-16 h-16 rounded-full p-0.5 border-2 border-dashed border-[#00C853] group-hover:scale-105 transition-transform flex items-center justify-center bg-emerald-50/50 dark:bg-emerald-950/30">
            {userProfile?.photoURL ? (
              <img
                src={userProfile.photoURL}
                alt="My Profile"
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-[#00C853]/15 flex items-center justify-center text-[#00C853] font-bold">
                🌱
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#00C853] text-white flex items-center justify-center shadow-md">
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </div>
          </div>
          <span className="text-[11px] font-medium text-stone-600 dark:text-stone-300 max-w-[64px] truncate text-center">
            Add Story
          </span>
        </div>

        {/* Stories List */}
        {stories.map((story, index) => (
          <div
            key={story.id}
            onClick={() => {
              setActiveStoryIndex(index);
              setProgress(0);
            }}
            className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group"
          >
            <div className="w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-tr from-[#00C853] via-[#69F0AE] to-[#00A344] group-hover:scale-105 transition-transform shadow-sm">
              <div className="w-full h-full rounded-full bg-white dark:bg-[#12372A] p-[2px]">
                <img
                  src={story.authorPhoto || story.mediaUrl}
                  alt={story.authorName}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            </div>
            <span className="text-[11px] font-medium text-stone-700 dark:text-stone-200 max-w-[68px] truncate text-center">
              {story.authorName}
            </span>
          </div>
        ))}
      </div>

      {/* Story Viewer Modal */}
      {currentStory && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4"
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          <div className="relative w-full max-w-md h-[85vh] max-h-[720px] bg-stone-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between">
            {/* Top Progress & Author Header */}
            <div className="absolute top-0 inset-x-0 z-20 p-4 bg-gradient-to-b from-black/80 to-transparent">
              {/* Progress bar */}
              <div className="w-full bg-white/20 h-1 rounded-full overflow-hidden mb-3">
                <div
                  className="bg-[#00C853] h-full transition-all ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src={currentStory.authorPhoto}
                    alt={currentStory.authorName}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-[#00C853]"
                  />
                  <div>
                    <p className="text-white text-xs font-bold leading-none">
                      {currentStory.authorName}
                    </p>
                    <span className="text-[10px] text-[#69F0AE]">
                      Story • Active 24h
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {currentUser && currentUser.uid === currentStory.authorId && (
                    <button
                      onClick={async () => {
                        if (window.confirm('Delete this story?')) {
                          await deleteDoc(doc(db, 'stories', currentStory.id));
                          setActiveStoryIndex(null);
                        }
                      }}
                      className="p-1 rounded-full text-white/80 hover:text-red-400 hover:bg-white/10 cursor-pointer"
                      title="Delete Story"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setActiveStoryIndex(null)}
                    className="p-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Story Media Background */}
            <div className="w-full h-full flex items-center justify-center bg-black">
              <img
                src={currentStory.mediaUrl}
                alt={currentStory.caption || 'Story'}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Caption & Navigation Controls */}
            {currentStory.caption && (
              <div className="absolute bottom-6 inset-x-4 z-20 p-3 rounded-2xl bg-black/50 backdrop-blur-md text-white text-xs text-center border border-white/10">
                {currentStory.caption}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sprout a Story Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#12372A] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#00C853]/20 dark:border-emerald-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#12372A] dark:text-white flex items-center gap-2">
                <span>Sprout a Story</span>
                <Sparkles className="w-4 h-4 text-[#00C853]" />
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
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

            <form onSubmit={handlePublishStory} className="flex flex-col gap-4">
              {/* Device Photo selection */}
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5 block">
                  Select Photo from Gallery
                </label>
                <input
                  type="file"
                  ref={storyFileInputRef}
                  accept="image/*"
                  onChange={handleStoryFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => storyFileInputRef.current?.click()}
                  className="w-full py-3 px-4 rounded-xl border border-dashed border-[#00C853]/40 hover:bg-[#00C853]/5 flex items-center justify-center gap-2 text-xs font-bold text-[#00C853] transition-colors cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>
                    {selectedStoryFile
                      ? `Selected: ${selectedStoryFile.name}`
                      : 'Choose Photo from Device'}
                  </span>
                </button>
              </div>

              {/* Or Presets */}
              <div>
                <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 mb-2 block">
                  Or pick a botanical nature preset:
                </span>
                <div className="grid grid-cols-5 gap-2">
                  {NATURE_STORY_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.title}
                      onClick={() => {
                        setSelectedStoryFile(null);
                        setNewMediaUrl(preset.url);
                      }}
                      className={`h-12 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                        newMediaUrl === preset.url && !selectedStoryFile
                          ? 'border-[#00C853] scale-105 ring-2 ring-[#00C853]/40'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.title}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Caption */}
              <div>
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5 block">
                  Story Caption (Optional)
                </label>
                <input
                  type="text"
                  maxLength={150}
                  placeholder="Morning dew on leaves 🍃"
                  value={newCaption}
                  onChange={(e) => setNewCaption(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-emerald-800 bg-white dark:bg-[#101512] text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-[#00C853]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPublishing || (!newMediaUrl.trim() && !selectedStoryFile)}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#00C853] hover:bg-[#00A344] rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isPublishing ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Publishing...</span>
                    </span>
                  ) : (
                    'Share Story (24h)'
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
