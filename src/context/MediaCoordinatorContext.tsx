import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';

export type MediaType = 'video' | 'audio' | 'voice' | 'reel' | 'story';

interface MediaCoordinatorContextType {
  activeMediaId: string | null;
  activeMediaType: MediaType | null;
  activeAudioId: string | null; // Backwards-compatible
  requestPlayback: (id: string, type?: MediaType) => void;
  releasePlayback: (id: string) => void;
  stopAllMedia: () => void;
  registerMedia: (id: string, onStop: () => void) => () => void;
  isMediaActive: (id: string) => boolean;
  requestAudioPlayback: (id: string) => void; // Backwards-compatible
  releaseAudioPlayback: (id: string) => void; // Backwards-compatible
  isAudioPlayingFor: (id: string) => boolean; // Backwards-compatible
}

const MediaCoordinatorContext = createContext<MediaCoordinatorContextType>({
  activeMediaId: null,
  activeMediaType: null,
  activeAudioId: null,
  requestPlayback: () => {},
  releasePlayback: () => {},
  stopAllMedia: () => {},
  registerMedia: () => () => {},
  isMediaActive: () => false,
  requestAudioPlayback: () => {},
  releaseAudioPlayback: () => {},
  isAudioPlayingFor: () => false,
});

export const MediaCoordinatorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [activeMediaType, setActiveMediaType] = useState<MediaType | null>(null);

  // Registry of stop callbacks for all registered active media instances
  const stopCallbacksRef = useRef<Map<string, () => void>>(new Map());

  // Register a media controller's stop callback
  const registerMedia = useCallback((id: string, onStop: () => void) => {
    stopCallbacksRef.current.set(id, onStop);
    return () => {
      stopCallbacksRef.current.delete(id);
    };
  }, []);

  // Request single active playback session
  const requestPlayback = useCallback((id: string, type: MediaType = 'video') => {
    // Immediately stop all other playing media across the app
    stopCallbacksRef.current.forEach((stopFn, registeredId) => {
      if (registeredId !== id) {
        try {
          stopFn();
        } catch (e) {
          console.warn('Error pausing media:', registeredId, e);
        }
      }
    });

    setActiveMediaId(id);
    setActiveMediaType(type);
  }, []);

  // Release a playback session
  const releasePlayback = useCallback((id: string) => {
    setActiveMediaId((curr) => {
      if (curr === id) {
        setActiveMediaType(null);
        return null;
      }
      return curr;
    });
  }, []);

  // Stop everything (e.g. page blur, tab change, modal close)
  const stopAllMedia = useCallback(() => {
    stopCallbacksRef.current.forEach((stopFn) => {
      try {
        stopFn();
      } catch (e) {
        console.warn('Error stopping media:', e);
      }
    });
    setActiveMediaId(null);
    setActiveMediaType(null);
  }, []);

  const isMediaActive = useCallback(
    (id: string) => activeMediaId === id,
    [activeMediaId]
  );

  // Backwards compatibility aliases
  const requestAudioPlayback = useCallback(
    (id: string) => requestPlayback(id, 'audio'),
    [requestPlayback]
  );

  const releaseAudioPlayback = useCallback(
    (id: string) => releasePlayback(id),
    [releasePlayback]
  );

  const isAudioPlayingFor = useCallback(
    (id: string) => activeMediaId === id,
    [activeMediaId]
  );

  // Automatically pause all media when browser tab is hidden or backgrounded
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAllMedia();
      }
    };

    const handlePageHide = () => {
      stopAllMedia();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [stopAllMedia]);

  return (
    <MediaCoordinatorContext.Provider
      value={{
        activeMediaId,
        activeMediaType,
        activeAudioId: activeMediaId,
        requestPlayback,
        releasePlayback,
        stopAllMedia,
        registerMedia,
        isMediaActive,
        requestAudioPlayback,
        releaseAudioPlayback,
        isAudioPlayingFor,
      }}
    >
      {children}
    </MediaCoordinatorContext.Provider>
  );
};

export const useMediaCoordinator = () => useContext(MediaCoordinatorContext);
