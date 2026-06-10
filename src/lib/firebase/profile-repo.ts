import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { PROFILE_DOC_ID } from "@/lib/firebase/paths";
import type { StoredProfileData } from "@/lib/storage/profile-storage";
import type { NutritionTargets } from "@/types/nutrition";
import type { UserProfile } from "@/types/user";

export const PROFILE_SCHEMA_VERSION = 1;

function profileDocRef(uid: string) {
  return doc(getFirebaseDb(), "users", uid, "profile", PROFILE_DOC_ID);
}

export async function fetchProfile(uid: string): Promise<StoredProfileData | null> {
  const snap = await getDoc(profileDocRef(uid));

  if (!snap.exists()) {
    return null;
  }

  const data = snap.data() as {
    profile?: UserProfile;
    targets?: NutritionTargets;
  };

  if (!data.profile || !data.targets) {
    return null;
  }

  return { profile: data.profile, targets: data.targets };
}

export async function profileExists(uid: string): Promise<boolean> {
  const snap = await getDoc(profileDocRef(uid));
  return snap.exists();
}

export async function saveProfileDoc(
  uid: string,
  profile: UserProfile,
  targets: NutritionTargets,
): Promise<void> {
  const ref = profileDocRef(uid);
  const existing = await getDoc(ref);

  const base = {
    profile,
    targets,
    schemaVersion: PROFILE_SCHEMA_VERSION,
    updatedAt: serverTimestamp(),
  };

  if (existing.exists()) {
    await setDoc(ref, base, { merge: true });
  } else {
    await setDoc(ref, { ...base, createdAt: serverTimestamp() });
  }
}
