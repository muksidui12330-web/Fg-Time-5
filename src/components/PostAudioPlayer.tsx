import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Music,
  Volume2,
  VolumeX,
  AlertCircle,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { PostMusic } from '../types';
import { useMediaCoordinator } from '../context/MediaCoordinatorContext';
import { resolveAudioUrl } from '../services/audioService';

interface PostAudioPlayerProps {
  music: PostMusic;
  postId: string;
}

export const PostAudioPlayer: React.FC<PostAudioPlayerProps> = ({ music, postId }) => {
  const { requestPlayback, releasePlayback, registerMedia, isMediaActive } = useMediaCoordinator();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerKey = `post-audio-${postId}`;
  const resolvedUrl = resolveAudioUrl(music.audioUrl, music.title);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  // Register with MediaCoordinator so any other video/audio immediately pauses this track
  useEffect(() => {
    const unregister = registerMedia(playerKey, stopPlayback);
    return () => {
      unregister();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      releasePlayback(playerKey);
    };
  }, [playerKey, registerMedia, releasePlayback, stopPlayback]);

  // Sync state if coordinator changes active media
  useEffect(() => {
    if (!isMediaActive(playerKey) && isPlaying) {
      stopPlayback();
    }
  }, [isMediaActive, playerKey, isPlaying, stopPlayback]);

  // Initialize or re-create audio element
  const getOrCreateAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio(resolvedUrl);
      audio.preload = 'metadata';

      audio.onplay = () => {
        setIsPlaying(true);
        setIsLoading(false);
        setErrorMessage('');
      };

      audio.onpause = () => {
        setIsPlaying(false);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        releasePlayback(playerKey);
      };

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };

      audio.onloadedmetadata = () => {
        setDuration(audio.duration || 20);
      };

      audio.onwaiting = () => {
        setIsLoading(true);
      };

      audio.oncanplay = () => {
        setIsLoading(false);
      };

      audio.onerror = () => {
        setIsLoading(false);
        setIsPlaying(false);
        setErrorMessage('Unable to load audio stream. Please check connection.');
        releasePlayback(playerKey);
      };

      audioRef.current = audio;
    } else if (audioRef.current.src !== resolvedUrl) {
      audioRef.current.src = resolvedUrl;
    }
    return audioRef.current;
  }, [resolvedUrl, playerKey, releasePlayback]);

  const handleTogglePlay = async () => {
    setErrorMessage('');
    const audio = getOrCreateAudio();

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      releasePlayback(playerKey);
    } else {
      setIsLoading(true);
      requestPlayback(playerKey, 'audio');

      try {
        await audio.play();
        setIsPlaying(true);
        setIsLoading(false);
      } catch (err: any) {
        console.warn('Audio playback error:', err);
        setIsLoading(false);
        setIsPlaying(false);
        releasePlayback(playerKey);
        setErrorMessage('Playback restricted by browser. Tap to play again.');
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const handleToggleMute = () => {
    if (audioRef.current) {
      const nextMuted = !isMuted;
      audioRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="mt-3 p-3 rounded-2xl bg-gradient-to-r from-[#00C853]/10 via-[#69F0AE]/10 to-[#12372A]/10 dark:from-emerald-950/70 dark:via-[#12372A]/60 dark:to-emerald-950/70 border border-[#00C853]/30 shadow-sm backdrop-blur-sm transition-all">
      <div className="flex items-center justify-between gap-3">
        {/* Play / Pause button */}
        <button
          type="button"
          onClick={handleTogglePlay}
          disabled={isLoading}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00C853] to-[#00A344] text-white flex items-center justify-center shrink-0 shadow-md shadow-[#00C853]/25 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-70"
          title={isPlaying ? 'Pause soundtrack' : 'Play soundtrack'}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4 fill-white" />
          ) : (
            <Play className="w-4 h-4 fill-white ml-0.5" />
          )}
        </button>

        {/* Track details & waveform bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Music className={`w-3.5 h-3.5 text-[#00C853] shrink-0 ${isPlaying ? 'animate-bounce' : ''}`} />
              <span className="text-xs font-bold text-stone-900 dark:text-white truncate">
                {music.title}
              </span>
            </div>
            <span className="text-[10px] font-mono text-stone-500 dark:text-stone-400 shrink-0">
              {formatTime(currentTime)} / {formatTime(duration || 20)}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 mb-1.5">
            <span className="truncate">{music.artist || 'FG TIME Botanical Sounds'}</span>
            <span className="text-[10px] uppercase font-bold text-[#00C853] px-1.5 py-0.2 rounded bg-[#00C853]/15 shrink-0">
              {isPlaying ? 'Playing' : 'Audio Track'}
            </span>
          </div>

          {/* Seek Progress Bar */}
          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 20}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-stone-200 dark:bg-emerald-900 rounded-lg appearance-none cursor-pointer accent-[#00C853]"
            />
          </div>
        </div>

        {/* Volume / Mute button */}
        <button
          type="button"
          onClick={handleToggleMute}
          className="p-2 rounded-xl text-stone-500 dark:text-stone-300 hover:text-[#00C853] hover:bg-[#00C853]/10 transition-colors shrink-0 cursor-pointer"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-stone-400" /> : <Volume2 className="w-4 h-4 text-[#00C853]" />}
        </button>
      </div>

      {/* Error message with retry */}
      {errorMessage && (
        <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-900/50 flex items-center justify-between text-xs text-red-600 dark:text-red-400">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={handleTogglePlay}
            className="flex items-center gap-1 font-bold text-[#00C853] hover:underline shrink-0 ml-2 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
      )}
    </div>
  );
};
