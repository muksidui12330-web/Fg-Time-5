import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Trash2,
  Flag,
  UserX,
  Send,
  Sparkles,
  Link2,
  Check,
  MapPin,
  CornerDownRight,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Layers,
  AtSign,
  AlertCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PostItem, CommentItem } from '../types';
import { useAuth } from '../context/AuthContext';
import { useMediaCoordinator } from '../context/MediaCoordinatorContext';
import { PostAudioPlayer } from './PostAudioPlayer';
import {
  checkIsPostLiked,
  toggleLikePost,
  checkIsPostSaved,
  toggleSavePost,
  deletePost,
  subscribeComments,
  addComment,
  deleteComment,
  blockUser,
} from '../services/firestoreService';

interface PostCardProps {
  post: PostItem;
  onOpenReport: (postId: string) => void;
  onSelectTag?: (tag: string) => void;
  onOpenAuthorProfile?: (authorId: string) => void;
  onRequireAuth?: () => void;
}

const resolvePostVideoUrl = (url?: string): string => {
  if (!url) return '';
  if (url.includes('mixkit.co')) {
    return '/videos/forest-stream.mp4';
  }
  return url;
};

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onOpenReport,
  onSelectTag,
  onOpenAuthorProfile,
  onRequireAuth,
}) => {
  const { currentUser, userProfile } = useAuth();

  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount || 0);
  const [isSaved, setIsSaved] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<CommentItem | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Video and audio playback state
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const [mediaLoadError, setMediaLoadError] = useState(false);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const cardContainerRef = useRef<HTMLElement | null>(null);

  const postVideoKey = `post-video-${post.id}`;
  const { requestPlayback, releasePlayback, registerMedia, isMediaActive } = useMediaCoordinator();

  // Stop video playback callback registered with central coordinator
  const stopVideoPlayback = useCallback(() => {
    if (videoElementRef.current) {
      videoElementRef.current.pause();
    }
    setIsVideoPlaying(false);
  }, []);

  useEffect(() => {
    if (post.mediaType === 'video') {
      const unregister = registerMedia(postVideoKey, stopVideoPlayback);
      return () => {
        unregister();
        stopVideoPlayback();
        releasePlayback(postVideoKey);
      };
    }
  }, [post.mediaType, postVideoKey, registerMedia, releasePlayback, stopVideoPlayback]);

  // Sync state if coordinator deactivates this media
  useEffect(() => {
    if (!isMediaActive(postVideoKey) && isVideoPlaying) {
      stopVideoPlayback();
    }
  }, [isMediaActive, postVideoKey, isVideoPlaying, stopVideoPlayback]);

  // Carousel state for multi-media posts
  const mediaList: string[] = post.mediaUrls && post.mediaUrls.length > 0
    ? post.mediaUrls
    : post.imageUrl
    ? [post.imageUrl]
    : [];
  const [currentMediaIdx, setCurrentMediaIdx] = useState(0);

  // IntersectionObserver: automatically pause videos when scrolled off-screen
  useEffect(() => {
    const cardEl = cardContainerRef.current;
    if (!cardEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // If scrolled off screen (< 30% visible), pause video immediately
          if (!entry.isIntersecting || entry.intersectionRatio < 0.3) {
            if (videoElementRef.current && isVideoPlaying) {
              videoElementRef.current.pause();
              setIsVideoPlaying(false);
              releasePlayback(postVideoKey);
            }
          }
        });
      },
      { threshold: [0, 0.3, 0.7] }
    );

    observer.observe(cardEl);
    return () => observer.disconnect();
  }, [isVideoPlaying, postVideoKey, releasePlayback]);

  // Check initial like and save state
  useEffect(() => {
    if (currentUser) {
      checkIsPostLiked(post.id, currentUser.uid).then((liked) => setIsLiked(liked));
      checkIsPostSaved(currentUser.uid, post.id).then((saved) => setIsSaved(saved));
    } else {
      setIsLiked(false);
      setIsSaved(false);
    }
    setLikesCount(post.likesCount || 0);
  }, [post.id, post.likesCount, currentUser]);

  // Subscribe to comments
  useEffect(() => {
    if (!showComments) return;
    const unsub = subscribeComments(post.id, (list) => {
      setComments(list);
    });
    return () => unsub();
  }, [showComments, post.id]);

  const requireAuth = () => {
    if (!currentUser) {
      if (onRequireAuth) onRequireAuth();
      return true;
    }
    return false;
  };

  const handleToggleLike = async () => {
    if (requireAuth()) return;
    if (!userProfile || !currentUser) return;

    if (!isLiked) {
      confetti({
        particleCount: 26,
        spread: 55,
        origin: { y: 0.7 },
        colors: ['#00C853', '#69F0AE', '#00A344'],
      });
      setIsLiked(true);
      setLikesCount((prev) => prev + 1);
    } else {
      setIsLiked(false);
      setLikesCount((prev) => Math.max(0, prev - 1));
    }

    try {
      await toggleLikePost(post.id, currentUser.uid, post.authorId, userProfile);
    } catch {
      setIsLiked(!isLiked);
      setLikesCount(post.likesCount);
    }
  };

  const handleToggleSave = async () => {
    if (requireAuth()) return;
    if (!currentUser) return;

    const nextState = !isSaved;
    setIsSaved(nextState);
    try {
      await toggleSavePost(currentUser.uid, post);
    } catch {
      setIsSaved(!nextState);
    }
  };

  const handleToggleVideoPlay = async () => {
    if (!videoElementRef.current) return;
    if (isVideoPlaying) {
      videoElementRef.current.pause();
      setIsVideoPlaying(false);
      releasePlayback(postVideoKey);
    } else {
      requestPlayback(postVideoKey, 'video');
      try {
        await videoElementRef.current.play();
        setIsVideoPlaying(true);
      } catch (err) {
        console.warn('Video play prevented by browser:', err);
        setIsVideoPlaying(false);
        releasePlayback(postVideoKey);
      }
    }
  };

  const handleToggleVideoMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoElementRef.current) {
      const nextMuted = !isVideoMuted;
      videoElementRef.current.muted = nextMuted;
      setIsVideoMuted(nextMuted);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requireAuth()) return;
    if (!currentUser || !userProfile || !commentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      const fullText = replyingTo
        ? `@${replyingTo.authorName} ${commentText.trim()}`
        : commentText.trim();

      await addComment(post.id, userProfile, fullText, post.authorId);
      setCommentText('');
      setReplyingTo(null);
    } catch (err) {
      console.error('Comment error:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeletePost = async () => {
    if (!currentUser || currentUser.uid !== post.authorId) return;
    if (window.confirm('Are you sure you want to delete this sprout post?')) {
      await deletePost(post.id, post.authorId);
    }
  };

  const handleBlockAuthor = async () => {
    if (requireAuth()) return;
    if (!currentUser || !userProfile) return;
    if (window.confirm(`Block @${post.authorUsername}? Their posts will be hidden.`)) {
      await blockUser(currentUser.uid, post.authorId, userProfile.blockedUsers);
      setShowMenu(false);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'FG TIME Post',
      text: post.content.slice(0, 100),
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // cancelled
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
    setShowMenu(false);
  };

  const timeAgo = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return 'Recently';
    }
  };

  const activeMedia = mediaList[currentMediaIdx];

  return (
    <article
      ref={cardContainerRef}
      className="w-full bg-white dark:bg-[#12372A]/70 rounded-3xl border border-[#00C853]/20 dark:border-emerald-800/40 shadow-sm hover:shadow-md transition-shadow overflow-hidden mb-5"
    >
      {/* Author Header */}
      <div className="p-4 flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => onOpenAuthorProfile && onOpenAuthorProfile(post.authorId)}
        >
          <img
            src={post.authorPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
            alt={post.authorName}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-[#00C853]/40 group-hover:scale-105 transition-transform"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-[#12372A] dark:text-white group-hover:text-[#00C853] transition-colors">
                {post.authorName}
              </span>
              <span className="text-xs text-stone-400">
                @{post.authorUsername}
              </span>
              {post.authorId === userProfile?.id && userProfile?.partnerUsername && (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-300 text-[10px] font-semibold"
                  title={`Linked with @${userProfile.partnerUsername} 💖`}
                >
                  <Heart className="w-2.5 h-2.5 fill-pink-500 text-pink-500" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-stone-400 flex-wrap">
              <span>{timeAgo(post.createdAt)}</span>
              {post.location && (
                <span className="flex items-center gap-0.5 text-stone-500 dark:text-emerald-300">
                  <MapPin className="w-3 h-3 text-[#00C853]" />
                  <span>{post.location}</span>
                </span>
              )}
              {post.category && (
                <span className="text-[#00C853] font-medium capitalize">
                  • {post.category}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Options Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-900/40 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors cursor-pointer"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-10 w-48 bg-white dark:bg-[#101512] rounded-2xl shadow-xl border border-stone-100 dark:border-emerald-800 p-1.5 z-20 flex flex-col gap-0.5">
              <button
                onClick={handleShare}
                className="flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/40 text-stone-700 dark:text-stone-200 text-left cursor-pointer"
              >
                {copiedLink ? <Check className="w-4 h-4 text-[#00C853]" /> : <Link2 className="w-4 h-4" />}
                <span>{copiedLink ? 'Link Copied!' : 'Share / Copy Link'}</span>
              </button>

              {currentUser && currentUser.uid === post.authorId ? (
                <button
                  onClick={handleDeletePost}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl hover:bg-red-50 text-red-600 text-left cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Sprout</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      onOpenReport(post.id);
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl hover:bg-amber-50 text-amber-600 text-left cursor-pointer"
                  >
                    <Flag className="w-4 h-4" />
                    <span>Report Content</span>
                  </button>
                  <button
                    onClick={handleBlockAuthor}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl hover:bg-red-50 text-red-600 text-left cursor-pointer"
                  >
                    <UserX className="w-4 h-4" />
                    <span>Block Author</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post Text Content */}
      <div className="px-5 pb-3">
        <p className="text-sm text-stone-800 dark:text-stone-100 leading-relaxed whitespace-pre-wrap">
          {post.content}
        </p>

        {/* Mentions tags */}
        {post.mentions && post.mentions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {post.mentions.map((mention) => (
              <span
                key={mention}
                className="inline-flex items-center gap-0.5 text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-full"
              >
                <AtSign className="w-3 h-3" />
                <span>{mention.replace(/^@/, '')}</span>
              </span>
            ))}
          </div>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {post.tags.map((tag) => (
              <button
                key={tag}
                onClick={() => onSelectTag && onSelectTag(tag)}
                className="text-xs font-semibold text-[#00C853] hover:underline cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Attached Music Audio Player */}
        {post.music && (
          <PostAudioPlayer music={post.music} postId={post.id} />
        )}
      </div>

      {/* Media: Image Carousel or Video */}
      {activeMedia && (
        <div className="w-full max-h-[520px] bg-stone-900 overflow-hidden flex items-center justify-center relative group">
          {mediaLoadError ? (
            <div className="w-full py-16 px-6 bg-emerald-950/20 dark:bg-emerald-950/50 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#00C853]/15 text-[#00C853] flex items-center justify-center text-xl mb-2">
                🌿
              </div>
              <p className="text-xs font-bold text-stone-700 dark:text-stone-200">Sprout Media Snapshot</p>
              <p className="text-[11px] text-stone-400 mt-1 max-w-xs">Attachment is securely archived on FG TIME.</p>
            </div>
          ) : post.mediaType === 'video' ? (
            <div
              className="relative w-full h-full max-h-[520px] cursor-pointer flex items-center justify-center bg-black"
              onClick={handleToggleVideoPlay}
            >
              <video
                ref={videoElementRef}
                src={resolvePostVideoUrl(activeMedia)}
                loop
                muted={isVideoMuted}
                playsInline
                onError={() => setMediaLoadError(true)}
                className="w-full h-full max-h-[520px] object-cover"
              />

              {/* Center Play Overlay when paused */}
              {!isVideoPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px] transition-all">
                  <div className="w-14 h-14 rounded-full bg-[#00C853] text-white flex items-center justify-center shadow-lg shadow-[#00C853]/40 hover:scale-110 active:scale-95 transition-transform">
                    <Play className="w-6 h-6 fill-white ml-0.5" />
                  </div>
                </div>
              )}

              {/* Top-right Video badge */}
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1 pointer-events-none">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse" />
                <span>Clip</span>
              </div>

              {/* Bottom Mute/Unmute button */}
              <button
                type="button"
                onClick={handleToggleVideoMute}
                className="absolute bottom-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer backdrop-blur-md transition-all shadow-md z-10"
                title={isVideoMuted ? 'Unmute video' : 'Mute video'}
              >
                {isVideoMuted ? <VolumeX className="w-4 h-4 text-stone-300" /> : <Volume2 className="w-4 h-4 text-[#00C853]" />}
              </button>
            </div>
          ) : (
            <img
              src={activeMedia}
              alt="Post media"
              onError={() => setMediaLoadError(true)}
              className="w-full h-full max-h-[520px] object-cover hover:scale-[1.01] transition-transform duration-300"
              loading="lazy"
            />
          )}

          {/* Carousel Arrows if multiple images */}
          {mediaList.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setCurrentMediaIdx((prev) => (prev > 0 ? prev - 1 : mediaList.length - 1))
                }
                className="absolute left-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer backdrop-blur-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentMediaIdx((prev) => (prev < mediaList.length - 1 ? prev + 1 : 0))
                }
                className="absolute right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer backdrop-blur-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Multi-Photo Carousel Indicators */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1 rounded-full bg-black/40 backdrop-blur-sm">
                {mediaList.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-2 h-2 rounded-full transition-all ${
                      currentMediaIdx === idx ? 'bg-[#00C853] w-4' : 'bg-white/60'
                    }`}
                  />
                ))}
              </div>

              {/* Counter badge top right */}
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center gap-1 backdrop-blur-sm">
                <Layers className="w-3 h-3 text-[#00C853]" />
                <span>
                  {currentMediaIdx + 1}/{mediaList.length}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className="px-4 py-3 border-t border-emerald-50 dark:border-emerald-800/30 flex items-center justify-between text-stone-600 dark:text-stone-300">
        <div className="flex items-center gap-3">
          {/* Like */}
          <button
            onClick={handleToggleLike}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1.5 rounded-xl transition-all cursor-pointer ${
              isLiked
                ? 'text-[#00C853] bg-[#00C853]/10'
                : 'hover:text-[#00C853] hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
            }`}
          >
            <Heart
              className={`w-5 h-5 transition-transform active:scale-125 ${
                isLiked ? 'fill-[#00C853] text-[#00C853]' : 'text-stone-500'
              }`}
            />
            <span>{likesCount}</span>
          </button>

          {/* Comment */}
          <button
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2 py-1.5 rounded-xl transition-all cursor-pointer ${
              showComments
                ? 'text-[#00C853] bg-[#00C853]/10'
                : 'hover:text-[#00C853] hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
            }`}
          >
            <MessageCircle className="w-5 h-5 text-stone-500" />
            <span>{comments.length > 0 ? comments.length : post.commentsCount || 0}</span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="p-2 rounded-xl hover:text-[#00C853] hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all cursor-pointer"
            title="Share"
          >
            <Share2 className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        {/* Save / Bookmark Button */}
        <button
          onClick={handleToggleSave}
          className={`p-2 rounded-xl transition-all cursor-pointer ${
            isSaved
              ? 'text-[#00C853] bg-[#00C853]/10'
              : 'hover:text-[#00C853] hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-stone-500'
          }`}
          title={isSaved ? 'Unsave Sprout' : 'Save to Garden'}
        >
          <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-[#00C853]' : ''}`} />
        </button>
      </div>

      {/* Comments Drawer */}
      {showComments && (
        <div className="p-4 bg-emerald-50/40 dark:bg-[#101512]/60 border-t border-emerald-100 dark:border-emerald-800/40 flex flex-col gap-3">
          {/* Comments List */}
          <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto pr-1">
            {comments.length > 0 ? (
              comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2.5 text-xs">
                  <img
                    src={c.authorPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                    alt={c.authorName}
                    className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                  />
                  <div className="flex-1 bg-white dark:bg-[#12372A]/80 p-2.5 rounded-2xl border border-emerald-100/60 dark:border-emerald-800/40">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-800 dark:text-stone-200">
                        {c.authorName}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-stone-400">
                          {timeAgo(c.createdAt)}
                        </span>
                        <button
                          onClick={() => setReplyingTo(c)}
                          className="text-[10px] text-[#00C853] font-semibold hover:underline cursor-pointer"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                    <p className="text-stone-700 dark:text-stone-300 mt-0.5">
                      {c.text}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-stone-400 text-center py-2">
                No thoughts sprouted yet. Be the first to comment! 🌿
              </p>
            )}
          </div>

          {/* Replying banner */}
          {replyingTo && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#00C853]/10 rounded-xl text-xs text-[#00C853]">
              <span className="flex items-center gap-1">
                <CornerDownRight className="w-3.5 h-3.5" />
                <span>Replying to <strong>@{replyingTo.authorName}</strong></span>
              </span>
              <button
                onClick={() => setReplyingTo(null)}
                className="text-[10px] text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Add Comment Input */}
          <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              placeholder={replyingTo ? `Reply to @${replyingTo.authorName}...` : 'Sprout a comment...'}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 px-3.5 py-2 text-xs rounded-full border border-stone-200 dark:border-emerald-800 bg-white dark:bg-[#101512] text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#00C853]"
            />
            <button
              type="submit"
              disabled={isSubmittingComment || !commentText.trim()}
              className="p-2 rounded-full bg-[#00C853] text-white hover:bg-[#00A344] disabled:opacity-40 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </article>
  );
};
