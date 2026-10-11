import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { CallSession } from '../types';

export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

/**
 * Initiates an outgoing voice or video call
 */
export async function createCallSession(params: {
  conversationId: string;
  callerId: string;
  callerName: string;
  callerPhoto?: string;
  receiverId: string;
  receiverName?: string;
  receiverPhoto?: string;
  type: 'voice' | 'video';
  offer: RTCSessionDescriptionInit;
}): Promise<string> {
  const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const callRef = doc(db, 'calls', callId);

  const callData: CallSession = {
    id: callId,
    conversationId: params.conversationId,
    callerId: params.callerId,
    callerName: params.callerName,
    callerPhoto: params.callerPhoto,
    receiverId: params.receiverId,
    receiverName: params.receiverName,
    receiverPhoto: params.receiverPhoto,
    type: params.type,
    status: 'calling',
    offer: {
      type: params.offer.type,
      sdp: params.offer.sdp,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(callRef, callData);
  return callId;
}

/**
 * Updates call status (e.g. accepted, declined, ended)
 */
export async function updateCallStatus(
  callId: string,
  status: 'accepted' | 'declined' | 'ended',
  answer?: RTCSessionDescriptionInit
): Promise<void> {
  const callRef = doc(db, 'calls', callId);
  const patch: any = {
    status,
    updatedAt: new Date().toISOString(),
  };
  if (answer) {
    patch.answer = {
      type: answer.type,
      sdp: answer.sdp,
    };
  }
  await updateDoc(callRef, patch);
}

/**
 * Adds an ICE candidate for peer connection signaling
 */
export async function addIceCandidate(
  callId: string,
  candidate: RTCIceCandidateInit,
  senderId: string
): Promise<void> {
  try {
    const candidatesCol = collection(db, 'calls', callId, 'candidates');
    await addDoc(candidatesCol, {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
      senderId,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to save ICE candidate:', err);
  }
}

/**
 * Subscribes to incoming calls for a user
 */
export function subscribeIncomingCalls(
  userId: string,
  onIncomingCall: (call: CallSession | null) => void
): () => void {
  try {
    const q = query(
      collection(db, 'calls'),
      where('receiverId', '==', userId),
      where('status', '==', 'calling')
    );

    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const latestDoc = snapshot.docs[0];
        onIncomingCall(latestDoc.data() as CallSession);
      } else {
        onIncomingCall(null);
      }
    });
  } catch (err) {
    console.warn('Incoming calls listener error:', err);
    return () => {};
  }
}

/**
 * Subscribes to changes on an active call document
 */
export function subscribeCallDoc(
  callId: string,
  callback: (call: CallSession | null) => void
): () => void {
  const callRef = doc(db, 'calls', callId);
  return onSnapshot(callRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as CallSession);
    } else {
      callback(null);
    }
  });
}

/**
 * Subscribes to incoming ICE candidates from the other peer
 */
export function subscribeIceCandidates(
  callId: string,
  otherUserId: string,
  onCandidate: (candidate: RTCIceCandidateInit) => void
): () => void {
  const candidatesCol = collection(db, 'calls', callId, 'candidates');
  return onSnapshot(candidatesCol, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const data = change.doc.data();
        if (data.senderId === otherUserId && data.candidate) {
          onCandidate({
            candidate: data.candidate,
            sdpMid: data.sdpMid,
            sdpMLineIndex: data.sdpMLineIndex,
          });
        }
      }
    });
  });
}
