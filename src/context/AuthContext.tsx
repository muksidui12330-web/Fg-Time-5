import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  deleteUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, testConnection } from '../firebase';
import { UserProfile, UserSettings, DEFAULT_USER_SETTINGS } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (
    email: string,
    pass: string,
    displayName: string,
    username: string,
    interests?: string[]
  ) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateCurrentProfile: (updates: Partial<UserProfile>) => Promise<void>;
  updateUserSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  isDbConnected: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDbConnected, setIsDbConnected] = useState(true);

  // Initial connection test
  useEffect(() => {
    testConnection().then((connected) => {
      setIsDbConnected(connected);
    });
  }, []);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(userDocRef);

          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            if (!data.fgTimeId) {
              data.fgTimeId = `FG-${user.uid.slice(0, 6).toUpperCase()}`;
            }
            if (user.email === 'muksidui12330@gmail.com') {
              data.role = 'admin';
            }
            data.settings = {
              ...DEFAULT_USER_SETTINGS,
              ...(data.settings || {}),
            };
            setUserProfile(data);
          } else {
            // First time Google sign in default profile
            const cleanName = user.displayName || 'Green Explorer';
            const baseUsername = (user.email ? user.email.split('@')[0] : 'fg_' + user.uid.slice(0, 5))
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '_');

            const fgTimeId = `FG-${user.uid.slice(0, 6).toUpperCase()}`;
            const newProfile: UserProfile = {
              id: user.uid,
              displayName: cleanName,
              username: baseUsername,
              email: user.email || '',
              photoURL: user.photoURL || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
              bio: 'Planting mindful moments and blooming connections on FG TIME 🌿',
              fgTimeId,
              website: 'https://fgtime.eco',
              leafBadge: 'Forest Sprout 🌱',
              interests: ['#GreenLiving', '#Photography', '#Nature'],
              isPrivate: false,
              role: user.email === 'muksidui12330@gmail.com' ? 'admin' : 'user',
              isOnline: true,
              lastSeen: new Date().toISOString(),
              settings: DEFAULT_USER_SETTINGS,
              followersCount: 0,
              followingCount: 0,
              postsCount: 0,
              createdAt: new Date().toISOString(),
              blockedUsers: [],
            };

            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
          }

          // Initial presence online update
          updateDoc(userDocRef, {
            isOnline: true,
            lastSeen: new Date().toISOString(),
          }).catch(() => {});

          // Real-time listener on user profile
          const unsubProfile = onSnapshot(
            userDocRef,
            (snap) => {
              if (snap.exists()) {
                setUserProfile(snap.data() as UserProfile);
              }
            },
            (err) => {
              console.warn('Profile listener notice:', err.message);
            }
          );

          setLoading(false);
          return () => unsubProfile();
        } catch (error) {
          console.error('Error fetching/creating profile:', error);
          setLoading(false);
        }
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    const clean = username.trim().toLowerCase();
    if (!clean || clean.length < 3) return false;
    try {
      const q = query(collection(db, 'users'), where('username', '==', clean), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return true;
      // If belongs to current user, it is valid
      return snap.docs[0].id === currentUser?.uid;
    } catch {
      return true;
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Google Sign In Error:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (
    email: string,
    pass: string,
    displayName: string,
    username: string,
    interests: string[] = ['#GreenLiving', '#EcoLifestyle']
  ) => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      const user = res.user;
      const fgTimeId = `FG-${user.uid.slice(0, 6).toUpperCase()}`;

      const newProfile: UserProfile = {
        id: user.uid,
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim(),
        photoURL: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
        bio: 'Just sprouted on FG TIME! 🌿 Connecting hearts and growing together.',
        fgTimeId,
        website: '',
        leafBadge: 'Forest Sprout 🌱',
        interests,
        isPrivate: false,
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        createdAt: new Date().toISOString(),
        blockedUsers: [],
      };

      await setDoc(doc(db, 'users', user.uid), newProfile);
      setUserProfile(newProfile);
    } catch (error) {
      console.error('Sign Up Error:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error('Sign In Error:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Password Reset Error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
      setUserProfile(null);
    } catch (error) {
      console.error('Sign Out Error:', error);
    }
  };

  const deleteAccount = async () => {
    if (!currentUser) return;
    try {
      await deleteUser(currentUser);
      setUserProfile(null);
    } catch (error) {
      console.error('Delete user error:', error);
      throw error;
    }
  };

  const refreshProfile = async () => {
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, 'users', currentUser.uid));
      if (snap.exists()) {
        setUserProfile(snap.data() as UserProfile);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
    }
  };

  const updateCurrentProfile = async (updates: Partial<UserProfile>) => {
    if (!currentUser || !userProfile) return;
    try {
      const docRef = doc(db, 'users', currentUser.uid);
      const updated = { ...userProfile, ...updates };
      await setDoc(docRef, updated, { merge: true });
      setUserProfile(updated);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
    }
  };

  const updateUserSettings = async (newSettings: Partial<UserSettings>) => {
    if (!currentUser || !userProfile) return;
    const mergedSettings: UserSettings = {
      ...DEFAULT_USER_SETTINGS,
      ...(userProfile.settings || {}),
      ...newSettings,
    };
    try {
      const docRef = doc(db, 'users', currentUser.uid);
      await updateDoc(docRef, { settings: mergedSettings });
      setUserProfile({ ...userProfile, settings: mergedSettings });
      localStorage.setItem('fgtime_user_settings', JSON.stringify(mergedSettings));
    } catch (err) {
      console.warn('Settings firestore sync fallback:', err);
      setUserProfile({ ...userProfile, settings: mergedSettings });
      localStorage.setItem('fgtime_user_settings', JSON.stringify(mergedSettings));
    }
  };

  // Real presence heartbeat and tab visibility management
  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    const userDocRef = doc(db, 'users', uid);

    // Heartbeat every 60s while active
    const heartbeatTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        updateDoc(userDocRef, {
          isOnline: true,
          lastSeen: new Date().toISOString(),
        }).catch(() => {});
      }
    }, 60000);

    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      updateDoc(userDocRef, {
        isOnline: isVisible,
        lastSeen: new Date().toISOString(),
      }).catch(() => {});
    };

    const handleBeforeUnload = () => {
      updateDoc(userDocRef, {
        isOnline: false,
        lastSeen: new Date().toISOString(),
      }).catch(() => {});
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeatTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser]);

  // Apply font size and reduce motion styles whenever settings change
  useEffect(() => {
    if (!userProfile?.settings) return;
    const s = userProfile.settings;
    if (s.fontSize) {
      document.documentElement.setAttribute('data-font-size', s.fontSize);
      if (s.fontSize === 'sm') document.documentElement.style.fontSize = '14px';
      else if (s.fontSize === 'lg') document.documentElement.style.fontSize = '18px';
      else document.documentElement.style.fontSize = '16px';
    }
    if (s.reduceMotion) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
  }, [userProfile?.settings]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        signInWithGoogle,
        signUpWithEmail,
        signInWithEmail,
        resetPassword,
        signOut,
        deleteAccount,
        refreshProfile,
        updateCurrentProfile,
        updateUserSettings,
        checkUsernameAvailable,
        isDbConnected,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
