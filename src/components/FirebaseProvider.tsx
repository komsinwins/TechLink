import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  getDocFromServer 
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { LookupTypes } from '../types';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  lookups: LookupTypes;
  addLookupItem: (category: keyof LookupTypes, item: string) => Promise<void>;
  deleteLookupItem: (category: keyof LookupTypes, item: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  isOffline: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

const defaultLookups: LookupTypes = {
  onsiteServiceTypes: ["Installation", "Preventive Maintenance", "Hardware Repair", "Software Support", "Network Setup"],
  oncallProductTypes: ["Server Admin", "Network Switch", "Firewall Policy", "Backup & Restore", "Software License"],
  claimProductTypes: ["IP Camera", "PoE Switch", "UPS Battery", "Hard Drive", "Network Router"],
  salespersons: ["สมชาย (Sales)", "สมศรี (Sales)", "วิชัย (Sales)", "สุรพงษ์ (Sales)"],
  technicians: ["ช่างสมยศ", "ช่างอุดม", "ช่างมานะ", "ช่างวิรัช", "ช่างเกรียงไกร"],
  equipmentList: ["NVR 16CH", "IP Camera 4MP", "PoE Switch 8 Port", "SFP Module 1G", "Fiber Optic Patch Cord", "Router Board", "UPS 1000VA"]
};

const guestUser = {
  uid: 'guest-user-wss',
  email: 'guest@wss.com',
  displayName: 'ผู้ใช้ทั่วไป (Guest)',
  emailVerified: true,
  isAnonymous: true,
} as any;

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookups, setLookups] = useState<LookupTypes>(defaultLookups);
  const [isOffline, setIsOffline] = useState(false);

  // Validate Firestore Connection on Boot
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('offline')) {
          console.warn("Please check your Firebase configuration or connection.");
          setIsOffline(true);
        }
      }
    }
    testConnection();
  }, []);

  // Monitor Authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const activeUser = currentUser || guestUser;
      setUser(activeUser);
      
      // Fetch or initialize customized lookup types
      try {
        const docRef = doc(db, 'settings', 'lookups');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setLookups({
            ...defaultLookups,
            ...data
          } as LookupTypes);
        } else {
          // Save defaults if not present
          await setDoc(docRef, {
            ...defaultLookups,
            updatedAt: new Date().toISOString()
          });
          setLookups(defaultLookups);
        }
      } catch (err) {
        console.error("Error reading settings doc:", err);
        setLookups(defaultLookups);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error("Error signing in with email:", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, displayName?: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      if (displayName && userCredential.user) {
        await updateProfile(userCredential.user, { displayName });
      }
    } catch (error) {
      console.error("Error signing up with email:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const addLookupItem = async (
    category: keyof LookupTypes,
    item: string
  ) => {
    const trimmed = item.trim();
    if (!trimmed) return;
    
    const currentList = lookups[category] || [];
    if (currentList.includes(trimmed)) return;
    
    const updatedValues = [...currentList, trimmed];
    const newLookups = { ...lookups, [category]: updatedValues };
    
    setLookups(newLookups);

    if (user) {
      try {
        await setDoc(doc(db, 'settings', 'lookups'), {
          ...newLookups,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Error updating settings doc:", err);
      }
    }
  };

  const deleteLookupItem = async (
    category: keyof LookupTypes,
    item: string
  ) => {
    const currentList = lookups[category] || [];
    const updatedValues = currentList.filter(v => v !== item);
    const newLookups = { ...lookups, [category]: updatedValues };
    
    setLookups(newLookups);

    if (user) {
      try {
        await setDoc(doc(db, 'settings', 'lookups'), {
          ...newLookups,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Error deleting setting item:", err);
      }
    }
  };

  return (
    <FirebaseContext.Provider value={{
      user,
      loading,
      lookups,
      addLookupItem,
      deleteLookupItem,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      logout,
      isOffline
    }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
