"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import {
  getFirebaseAuth,
  googleAuthProvider,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import { syncProfileForUser } from "@/lib/profile/profile-sync";
import { setActiveUser } from "@/lib/storage/profile-storage";
import {
  AuthContext,
  type AuthContextValue,
  type ProfileStatus,
} from "@/lib/auth/useAuth";

const GENERIC_ERROR = "로그인 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
const CANCELLED_MESSAGE = "로그인이 취소되었어요. 준비되면 다시 시도해 주세요.";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(() => isFirebaseConfigured());
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("idle");
  const syncStartedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      return;
    }

    const auth = getFirebaseAuth();

    getRedirectResult(auth).catch(() => {
      setError(GENERIC_ERROR);
    });

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setActiveUser(nextUser ? nextUser.uid : null);

      if (!nextUser) {
        setProfileStatus("idle");
        syncStartedFor.current = null;
      }

      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  const startSync = useCallback((uid: string) => {
    syncStartedFor.current = uid;
    setProfileStatus("loading");
    syncProfileForUser(uid)
      .then((result) => {
        setProfileStatus(result.status);
      })
      .catch(() => {
        setProfileStatus("error");
      });
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (syncStartedFor.current === user.uid) {
      return;
    }

    startSync(user.uid);
  }, [user, startSync]);

  const signInWithGoogle = useCallback(async () => {
    if (signingIn) {
      return;
    }

    if (!isFirebaseConfigured()) {
      setError(GENERIC_ERROR);
      return;
    }

    setSigningIn(true);
    setError(null);

    try {
      await signInWithPopup(getFirebaseAuth(), googleAuthProvider);
    } catch (caught) {
      const code = (caught as { code?: string }).code ?? "";

      if (
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      ) {
        setError(CANCELLED_MESSAGE);
      } else if (
        code === "auth/popup-blocked" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        try {
          await signInWithRedirect(getFirebaseAuth(), googleAuthProvider);
        } catch {
          setError(GENERIC_ERROR);
        }
      } else {
        setError(GENERIC_ERROR);
      }
    } finally {
      setSigningIn(false);
    }
  }, [signingIn]);

  const signOutUser = useCallback(async () => {
    setError(null);
    try {
      await signOut(getFirebaseAuth());
    } finally {
      setActiveUser(null);
      setProfileStatus("idle");
      syncStartedFor.current = null;
    }
  }, []);

  const retryProfileSync = useCallback(() => {
    if (user) {
      startSync(user.uid);
    }
  }, [user, startSync]);

  const markProfileReady = useCallback(() => {
    setProfileStatus("ready");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      authLoading,
      signingIn,
      error,
      profileStatus,
      signInWithGoogle,
      signOutUser,
      retryProfileSync,
      markProfileReady,
    }),
    [
      user,
      authLoading,
      signingIn,
      error,
      profileStatus,
      signInWithGoogle,
      signOutUser,
      retryProfileSync,
      markProfileReady,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
