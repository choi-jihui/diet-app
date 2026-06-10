"use client";

import { createContext, useContext } from "react";
import type { User } from "firebase/auth";
import type { ProfileSyncStatus } from "@/lib/profile/profile-sync";

export type ProfileStatus = "idle" | "loading" | ProfileSyncStatus | "error";

export interface AuthContextValue {
  user: User | null;
  authLoading: boolean;
  signingIn: boolean;
  error: string | null;
  profileStatus: ProfileStatus;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  retryProfileSync: () => void;
  markProfileReady: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
