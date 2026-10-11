import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Loader2,
  User,
  Radio,
} from 'lucide-react';
import { CallSession } from '../types';
import { useAuth } from '../context/AuthContext';
import { useMediaCoordinator } from '../context/MediaCoordinatorContext';
import {
  ICE_SERVERS,
  updateCallStatus,
  addIceCandidate,
  subscribeCallDoc,
  subscribeIceCandidates,
} from '../services/webrtcService';

interface CallModalProps {
  call: CallSession;
  isIncoming: boolean;
  onClose: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  call,
  isIncoming,
  onClose,
}) => {
  const { currentUser } = useAuth();
  const { stopAllMedia } = useMediaCoordinator();

  const [callStatus, setCallStatus] = useState<CallSession['status']>(call.status);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(call.type === 'voice');
  const [callDuration, setCallDuration] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const otherPersonName =
    currentUser?.uid === call.callerId ? call.receiverName || 'Gardener' : call.callerName;
  const otherPersonPhoto =
    currentUser?.uid === call.callerId ? call.receiverPhoto : call.callerPhoto;
  const otherPersonId =
    currentUser?.uid === call.callerId ? call.receiverId : call.callerId;

  // Stop background music and video when calling begins
  useEffect(() => {
    stopAllMedia();
  }, [stopAllMedia]);

  // Clean up local stream tracks & peer connection on unmount
  const cleanupCall = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  }, []);

  // Listen to remote changes on the call document
  useEffect(() => {
    const unsub = subscribeCallDoc(call.id, (updatedCall) => {
      if (!updatedCall) {
        onClose();
        return;
      }
      setCallStatus(updatedCall.status);
      if (updatedCall.status === 'declined' || updatedCall.status === 'ended') {
        cleanupCall();
        setTimeout(() => onClose(), 1200);
      }
    });
    return () => unsub();
  }, [call.id, onClose, cleanupCall]);

  // Duration timer when connected
  useEffect(() => {
    if (callStatus !== 'accepted') return;
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  // Setup PeerConnection
  const setupPeerConnection = useCallback(async () => {
    try {
      const isVideo = call.type === 'video';
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Handle remote track
      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && currentUser) {
          addIceCandidate(call.id, event.candidate.toJSON(), currentUser.uid);
        }
      };

      // Subscribe to ICE candidates from other peer
      subscribeIceCandidates(call.id, otherPersonId, async (candidate) => {
        try {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      });

      return pc;
    } catch (err: any) {
      console.error('Media permission error:', err);
      setPermissionError(
        err.name === 'NotAllowedError'
          ? 'Microphone/Camera permission was denied. Please allow access in browser settings.'
          : 'Unable to access media devices.'
      );
      return null;
    }
  }, [call.id, call.type, currentUser, otherPersonId]);

  // Outgoing Caller: Set up caller side
  useEffect(() => {
    if (isIncoming) return; // receiver waits for accept button

    let isMounted = true;
    (async () => {
      const pc = await setupPeerConnection();
      if (!pc || !isMounted) return;

      // When receiver accepts and writes answer
      const unsub = subscribeCallDoc(call.id, async (updated) => {
        if (updated?.status === 'accepted' && updated.answer && pc.signalingState !== 'stable') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(updated.answer));
          } catch (e) {
            console.warn('Error setting remote answer:', e);
          }
        }
      });
      return () => unsub();
    })();

    return () => {
      isMounted = false;
      cleanupCall();
    };
  }, [isIncoming, call.id, setupPeerConnection, cleanupCall]);

  // Incoming Call Handlers
  const handleAcceptIncomingCall = async () => {
    const pc = await setupPeerConnection();
    if (!pc) return;

    try {
      if (call.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(call.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await updateCallStatus(call.id, 'accepted', answer);
      }
    } catch (err) {
      console.error('Failed to accept call:', err);
    }
  };

  const handleDeclineIncomingCall = async () => {
    await updateCallStatus(call.id, 'declined');
    cleanupCall();
    onClose();
  };

  const handleEndCall = async () => {
    await updateCallStatus(call.id, 'ended');
    cleanupCall();
    onClose();
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // INCOMING CALL PROMPT SCREEN
  if (isIncoming && callStatus === 'calling') {
    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
        <div className="bg-white dark:bg-[#12372A] rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl border border-[#00C853]/40 space-y-6">
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 rounded-full bg-[#00C853]/30 animate-ping" />
            <img
              src={otherPersonPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={otherPersonName}
              className="relative w-24 h-24 rounded-full object-cover ring-4 ring-[#00C853] shadow-lg"
            />
          </div>

          <div>
            <h3 className="text-lg font-black text-[#12372A] dark:text-white">
              {otherPersonName}
            </h3>
            <p className="text-xs text-[#00C853] font-bold mt-1 flex items-center justify-center gap-1.5">
              {call.type === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              <span>Incoming {call.type === 'video' ? 'Video' : 'Voice'} Call...</span>
            </p>
          </div>

          {permissionError && (
            <p className="text-xs text-red-500 font-semibold">{permissionError}</p>
          )}

          <div className="flex items-center justify-center gap-6 pt-2">
            <button
              onClick={handleDeclineIncomingCall}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/30 active:scale-95 transition-transform cursor-pointer"
              title="Decline"
            >
              <PhoneOff className="w-6 h-6" />
            </button>

            <button
              onClick={handleAcceptIncomingCall}
              className="w-14 h-14 rounded-full bg-[#00C853] hover:bg-[#00A344] text-white flex items-center justify-center shadow-lg shadow-[#00C853]/40 active:scale-95 transition-transform cursor-pointer animate-pulse"
              title="Accept"
            >
              {call.type === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE / CONNECTING CALL WINDOW
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
      <div className="relative w-full max-w-2xl h-[560px] max-h-[90vh] bg-stone-900 rounded-3xl overflow-hidden shadow-2xl border border-[#00C853]/40 flex flex-col justify-between">
        {/* Top Call Info Bar */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between bg-black/40 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={otherPersonPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={otherPersonName}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-[#00C853]"
            />
            <div className="min-w-0">
              <h4 className="text-xs font-bold truncate">{otherPersonName}</h4>
              <p className="text-[10px] text-emerald-400 font-mono">
                {callStatus === 'accepted'
                  ? formatDuration(callDuration)
                  : callStatus === 'calling'
                  ? 'Calling...'
                  : callStatus === 'declined'
                  ? 'Call Declined'
                  : 'Call Ended'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#00C853]/20 text-[#69F0AE] border border-[#00C853]/40">
              {call.type === 'video' ? 'Video' : 'Voice'} Call
            </span>
          </div>
        </div>

        {/* Video Streams Container */}
        <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
          {call.type === 'video' ? (
            <>
              {/* Remote Video Stream */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Local Video Picture-in-Picture */}
              <div className="absolute bottom-20 right-4 w-28 sm:w-36 aspect-[3/4] bg-stone-800 rounded-2xl overflow-hidden shadow-xl border-2 border-[#00C853]/60 z-20">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                />
                {isCameraOff && (
                  <div className="absolute inset-0 bg-stone-900 flex items-center justify-center text-stone-400 text-xs">
                    <VideoOff className="w-5 h-5" />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Voice Call Screen with pulsating soundwaves */
            <div className="flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-[#00C853]/20 animate-ping" />
                <img
                  src={otherPersonPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={otherPersonName}
                  className="relative w-28 h-28 rounded-full object-cover ring-4 ring-[#00C853] shadow-2xl"
                />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white">{otherPersonName}</h3>
                <p className="text-xs text-emerald-400 font-mono mt-1">
                  {callStatus === 'accepted' ? formatDuration(callDuration) : 'Connecting botanical audio...'}
                </p>
              </div>

              {/* Invisible audio element for remote stream */}
              <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
            </div>
          )}

          {/* Status Overlay if calling or ending */}
          {callStatus === 'calling' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10 text-white space-y-3">
              <Loader2 className="w-10 h-10 animate-spin text-[#00C853]" />
              <p className="text-xs font-bold">Ringing {otherPersonName}...</p>
            </div>
          )}
        </div>

        {/* Bottom Call Controls Toolbar */}
        <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-center gap-4 bg-black/50 backdrop-blur-xl py-3 px-6 rounded-2xl border border-white/10">
          {/* Mute Mic */}
          <button
            onClick={toggleMic}
            className={`p-3 rounded-full transition-all cursor-pointer ${
              isMicMuted
                ? 'bg-amber-500 text-white'
                : 'bg-white/15 text-white hover:bg-white/25'
            }`}
            title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Camera toggle (if video call) */}
          {call.type === 'video' && (
            <button
              onClick={toggleCamera}
              className={`p-3 rounded-full transition-all cursor-pointer ${
                isCameraOff
                  ? 'bg-amber-500 text-white'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
              title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
          )}

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="p-3.5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/40 active:scale-95 transition-transform cursor-pointer"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
