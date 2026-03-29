import React, { createContext, useContext, useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  linkWithCredential,
  EmailAuthProvider,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase-init";
import {
  createUserDocument,
  getUserDocument,
  updateLastLogin,
  seedGuestData,
} from "@/lib/firestore";
import type { User } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  isAnonymous: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginAsGuest: () => Promise<void>;
  upgradeAccount: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        setIsAnonymous(fbUser.isAnonymous);

        // Try to get existing user document
        let appUser = await getUserDocument(fbUser.uid);

        if (!appUser) {
          // Create user document on first auth
          await createUserDocument(
            fbUser.uid,
            fbUser.email ?? `guest_${fbUser.uid.slice(0, 8)}@guest.local`,
            fbUser.isAnonymous
          );
          appUser = await getUserDocument(fbUser.uid);
        } else {
          await updateLastLogin(fbUser.uid).catch(() => {
            // Ignore - may fail if user doc doesn't have all fields yet
          });
        }

        setUser(appUser);
      } else {
        setFirebaseUser(null);
        setUser(null);
        setIsAnonymous(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginAsGuest = async () => {
    const credential = await signInAnonymously(auth);
    // Seed demo data for guest users
    try {
      await seedGuestData();
    } catch (e) {
      console.warn("Failed to seed guest data:", e);
    }
    return void credential;
  };

  const upgradeAccount = async (email: string, password: string) => {
    if (!auth.currentUser) {
      throw new Error("No current user to upgrade");
    }
    const credential = EmailAuthProvider.credential(email, password);
    await linkWithCredential(auth.currentUser, credential);
    // Update the user document
    await createUserDocument(auth.currentUser.uid, email, false);
  };

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        isAnonymous,
        login,
        register,
        loginWithGoogle,
        loginAsGuest,
        upgradeAccount,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
