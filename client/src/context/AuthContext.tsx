import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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
  isSignInWithEmailLink,
  signInWithEmailLink,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase-init";
import {
  createUserDocument,
  getUserDocument,
  updateLastLogin,
  upgradeUserDocument,
  seedGuestData,
} from "@/lib/firestore";
import type { User } from "@/lib/api";

const EMAIL_LINK_KEY = "emailForSignIn";

interface SendEmailLinkError extends Error {
  retryAfter?: number;
}

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  isAnonymous: boolean;
  pendingEmailConfirmation: boolean;
  emailLinkError: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  sendEmailLink: (email: string) => Promise<void>;
  confirmEmailLink: (email: string) => Promise<void>;
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
  const [emailLinkPending, setEmailLinkPending] = useState(
    () => isSignInWithEmailLink(auth, window.location.href)
  );
  const [pendingEmailConfirmation, setPendingEmailConfirmation] =
    useState(false);
  const [emailLinkError, setEmailLinkError] = useState<string | null>(null);

  const completeEmailLinkSignIn = useCallback(
    (email: string) =>
      signInWithEmailLink(auth, email, window.location.href)
        .then(() => {
          window.localStorage.removeItem(EMAIL_LINK_KEY);
          window.history.replaceState({}, "", "/auth");
        })
        .finally(() => {
          setEmailLinkPending(false);
          setPendingEmailConfirmation(false);
        }),
    []
  );

  // Complete email link sign-in if the user arrived via an email link
  useEffect(() => {
    if (!emailLinkPending) return;

    const email = window.localStorage.getItem(EMAIL_LINK_KEY);
    if (email) {
      completeEmailLinkSignIn(email).catch((err) => {
        console.error("Email link sign-in failed:", err);
        setEmailLinkError(
          "Sign-in link expired or invalid. Please request a new one."
        );
      });
    } else {
      // Opened in a different browser — ask user to confirm email via UI.
      // Must clear emailLinkPending so the auth state listener can run
      // and isLoading becomes false (otherwise the app stays on "Loading...").
      setEmailLinkPending(false);
      setPendingEmailConfirmation(true);
    }
  }, [emailLinkPending, completeEmailLinkSignIn]);

  // Delay auth listener until any email link sign-in is resolved
  useEffect(() => {
    if (emailLinkPending) return;

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
  }, [emailLinkPending]);

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

  const sendEmailLink = async (email: string) => {
    const res = await fetch("/api/email-auth/send-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err: SendEmailLinkError = new Error(
        data.error || "Failed to send sign-in link"
      );
      err.retryAfter = data.retryAfter;
      throw err;
    }
    window.localStorage.setItem(EMAIL_LINK_KEY, email);
    setEmailLinkError(null);
  };

  const confirmEmailLink = async (email: string) => {
    await completeEmailLinkSignIn(email);
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
    // Upgrade the user document: update email, isAnonymous, displayName, quotas
    await upgradeUserDocument(auth.currentUser.uid, email);
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
        sendEmailLink,
        confirmEmailLink,
        pendingEmailConfirmation,
        emailLinkError,
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
