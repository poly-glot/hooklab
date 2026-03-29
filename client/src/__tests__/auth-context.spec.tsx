import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";

// Mock Firebase Auth
const mockOnAuthStateChanged = vi.fn();
const mockSignInAnonymously = vi.fn();
const mockSignInWithPopup = vi.fn();
const mockSignInWithEmailAndPassword = vi.fn();
const mockCreateUserWithEmailAndPassword = vi.fn();
const mockSignOut = vi.fn();
const mockLinkWithCredential = vi.fn();

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
  signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
  signInWithEmailAndPassword: (...args: unknown[]) =>
    mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) =>
    mockCreateUserWithEmailAndPassword(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  linkWithCredential: (...args: unknown[]) => mockLinkWithCredential(...args),
  GoogleAuthProvider: vi.fn(),
  EmailAuthProvider: {
    credential: vi.fn(() => ({ providerId: "password" })),
  },
}));

vi.mock("@/lib/firebase-init", () => ({
  auth: { currentUser: null },
  app: {},
  firestore: {},
  functions: {},
}));

const mockGetUserDocument = vi.fn();
const mockCreateUserDocument = vi.fn();
const mockUpdateLastLogin = vi.fn();
const mockSeedGuestData = vi.fn();

vi.mock("@/lib/firestore", () => ({
  getUserDocument: (...args: unknown[]) => mockGetUserDocument(...args),
  createUserDocument: (...args: unknown[]) => mockCreateUserDocument(...args),
  updateLastLogin: (...args: unknown[]) => mockUpdateLastLogin(...args),
  seedGuestData: (...args: unknown[]) => mockSeedGuestData(...args),
}));

// Import AuthProvider and useAuth after mocks
import { AuthProvider, useAuth } from "@/context/AuthContext";

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
  };
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: onAuthStateChanged calls callback with null (no user)
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      callback(null);
      return vi.fn(); // unsubscribe function
    });

    // Default mocks that return promises (AuthContext code calls .catch() on these)
    mockUpdateLastLogin.mockResolvedValue(undefined);
    mockCreateUserDocument.mockResolvedValue(undefined);
    mockSeedGuestData.mockResolvedValue(undefined);
    mockGetUserDocument.mockResolvedValue(null);
  });

  it("provides initial state with no user", async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.firebaseUser).toBeNull();
    expect(result.current.isAnonymous).toBe(false);
  });

  it("sets user when Firebase auth state changes", async () => {
    const mockFirebaseUser = {
      uid: "test-uid",
      email: "test@example.com",
      isAnonymous: false,
    };

    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      // Simulate async auth state change
      setTimeout(() => callback(mockFirebaseUser), 0);
      return vi.fn();
    });

    mockGetUserDocument.mockResolvedValue({
      id: "test-uid",
      email: "test@example.com",
      createdAt: new Date().toISOString(),
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 3000 });

    expect(result.current.user).toEqual(
      expect.objectContaining({
        id: "test-uid",
        email: "test@example.com",
      })
    );
    expect(result.current.isAnonymous).toBe(false);
  });

  it("creates user document for new users", async () => {
    const mockFirebaseUser = {
      uid: "new-uid",
      email: "new@example.com",
      isAnonymous: false,
    };

    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      setTimeout(() => callback(mockFirebaseUser), 0);
      return vi.fn();
    });

    // First call returns null (user doesn't exist), second returns the created user
    mockGetUserDocument
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "new-uid",
        email: "new@example.com",
        createdAt: new Date().toISOString(),
      });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 3000 });

    expect(mockCreateUserDocument).toHaveBeenCalledWith(
      "new-uid",
      "new@example.com",
      false
    );
  });

  it("identifies anonymous users", async () => {
    const mockFirebaseUser = {
      uid: "anon-uid",
      email: null,
      isAnonymous: true,
    };

    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      setTimeout(() => callback(mockFirebaseUser), 0);
      return vi.fn();
    });

    mockGetUserDocument.mockResolvedValue({
      id: "anon-uid",
      email: "guest_anon_uid@guest.local",
      createdAt: new Date().toISOString(),
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 3000 });

    expect(result.current.isAnonymous).toBe(true);
  });

  it("loginAsGuest calls signInAnonymously and seedGuestData", async () => {
    mockSignInAnonymously.mockResolvedValue({
      user: { uid: "guest-uid" },
    });
    mockSeedGuestData.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.loginAsGuest();
    });

    expect(mockSignInAnonymously).toHaveBeenCalled();
    expect(mockSeedGuestData).toHaveBeenCalled();
  });

  it("loginWithGoogle calls signInWithPopup", async () => {
    mockSignInWithPopup.mockResolvedValue({
      user: { uid: "google-uid" },
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.loginWithGoogle();
    });

    expect(mockSignInWithPopup).toHaveBeenCalled();
  });

  it("logout calls firebaseSignOut and clears user", async () => {
    mockSignOut.mockResolvedValue(undefined);

    // Start with a logged-in user
    const mockFirebaseUser = {
      uid: "logout-uid",
      email: "logout@example.com",
      isAnonymous: false,
    };

    let authCallback: (user: unknown) => void;
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      authCallback = callback;
      // Simulate async auth state change to logged-in user
      setTimeout(() => callback(mockFirebaseUser), 0);
      return vi.fn();
    });

    mockGetUserDocument.mockResolvedValue({
      id: "logout-uid",
      email: "logout@example.com",
      createdAt: new Date().toISOString(),
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.user).not.toBeNull();
    }, { timeout: 3000 });

    // Mock signOut to trigger auth state change to null
    mockSignOut.mockImplementation(async () => {
      authCallback(null);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(mockSignOut).toHaveBeenCalled();
    await waitFor(() => {
      expect(result.current.user).toBeNull();
    });
  });

  it("throws error when useAuth is used outside AuthProvider", () => {
    // Suppress console.error for this test
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow("useAuth must be used within an AuthProvider");

    spy.mockRestore();
  });
});
