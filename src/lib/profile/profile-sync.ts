import { fetchProfile, saveProfileDoc } from "@/lib/firebase/profile-repo";
import {
  cacheProfile,
  clearLegacyProfile,
  readCachedProfile,
  readLegacyProfile,
  type StoredProfileData,
} from "@/lib/storage/profile-storage";

export type ProfileSyncStatus = "ready" | "needs-onboarding";

export interface ProfileSyncResult {
  status: ProfileSyncStatus;
  data?: StoredProfileData;
}

const inFlight = new Map<string, Promise<ProfileSyncResult>>();
const completedUids = new Set<string>();

async function runSync(uid: string): Promise<ProfileSyncResult> {
  // A. Firestore 우선 조회 → B. 존재하면 source of truth
  const remote = await fetchProfile(uid);
  if (remote) {
    cacheProfile(uid, remote);
    return { status: "ready", data: remote };
  }

  // C-1. uid 캐시가 있으면 업로드 후 사용
  const cached = readCachedProfile(uid);
  if (cached) {
    await saveProfileDoc(uid, cached.profile, cached.targets);
    cacheProfile(uid, cached);
    return { status: "ready", data: cached };
  }

  // C-2. 레거시 키가 있으면 1회 업로드 후 레거시 삭제
  const legacy = readLegacyProfile();
  if (legacy) {
    await saveProfileDoc(uid, legacy.profile, legacy.targets);
    cacheProfile(uid, legacy);
    // Firestore 업로드 성공 시에만 레거시 삭제 (다른 계정에 재복사 방지)
    clearLegacyProfile();
    return { status: "ready", data: legacy };
  }

  // D. 아무 데이터도 없음
  return { status: "needs-onboarding" };
}

/** 로그인한 uid에 대해 1회만 localStorage→Firestore 동기화를 수행한다. */
export function syncProfileForUser(uid: string): Promise<ProfileSyncResult> {
  const existing = inFlight.get(uid);
  if (existing) {
    return existing;
  }

  const promise = runSync(uid)
    .then((result) => {
      completedUids.add(uid);
      return result;
    })
    .finally(() => {
      inFlight.delete(uid);
    });

  inFlight.set(uid, promise);
  return promise;
}

export function hasSyncedUser(uid: string): boolean {
  return completedUids.has(uid);
}
