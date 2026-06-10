import type { NutritionTargets } from "@/types/nutrition";
import type { UserProfile } from "@/types/user";
import {
  DEFAULT_MEAL_SLOTS,
  normalizeMealSlots,
} from "@/constants/meal-slots";

const LEGACY_STORAGE_KEY = "gakk_profile_v1";
const KEY_PREFIX = "gakk_profile_v1_";

function userKey(uid: string): string {
  return `${KEY_PREFIX}${uid}`;
}

export interface StoredProfileData {
  profile: UserProfile;
  targets: NutritionTargets;
}

interface LegacyProfile extends Record<string, unknown> {
  mealsPerDay?: 2 | 3;
  selectedMealSlots?: unknown;
}

const listeners = new Set<() => void>();

let activeUid: string | null = null;
let cachedRaw: string | null | undefined;
let cachedSnapshot: StoredProfileData | null | undefined;

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function invalidateCache(): void {
  cachedRaw = undefined;
  cachedSnapshot = undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function migrateProfile(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const legacy = raw as LegacyProfile;
  let selectedMealSlots = normalizeMealSlots(legacy.selectedMealSlots);

  if (!selectedMealSlots) {
    if (legacy.mealsPerDay === 2) {
      selectedMealSlots = ["breakfast", "dinner"];
    } else {
      selectedMealSlots = DEFAULT_MEAL_SLOTS;
    }
  }

  const profile: UserProfile = {
    gender:
      legacy.gender === "female" ||
      legacy.gender === "male" ||
      legacy.gender === "other"
        ? legacy.gender
        : "other",
    age: typeof legacy.age === "number" ? legacy.age : NaN,
    heightCm: typeof legacy.heightCm === "number" ? legacy.heightCm : NaN,
    weightKg: typeof legacy.weightKg === "number" ? legacy.weightKg : NaN,
    goalWeightKg:
      typeof legacy.goalWeightKg === "number" ? legacy.goalWeightKg : NaN,
    activityLevel:
      legacy.activityLevel === "sedentary" ||
      legacy.activityLevel === "light" ||
      legacy.activityLevel === "moderate" ||
      legacy.activityLevel === "active"
        ? legacy.activityLevel
        : "light",
    dietIntensity:
      legacy.dietIntensity === "light" ||
      legacy.dietIntensity === "normal" ||
      legacy.dietIntensity === "intensive"
        ? legacy.dietIntensity
        : "normal",
    cardioIntensity:
      legacy.cardioIntensity === "none" ||
      legacy.cardioIntensity === "two_days" ||
      legacy.cardioIntensity === "three_days" ||
      legacy.cardioIntensity === "five_days"
        ? legacy.cardioIntensity
        : "three_days",
    selectedMealSlots,
    allergies: toStringArray(legacy.allergies),
    dislikedFoods: toStringArray(legacy.dislikedFoods),
    cookingTools: toStringArray(legacy.cookingTools),
  };

  if (
    !Number.isFinite(profile.age) ||
    !Number.isFinite(profile.heightCm) ||
    !Number.isFinite(profile.weightKg) ||
    !Number.isFinite(profile.goalWeightKg)
  ) {
    return null;
  }

  return profile;
}

function isValidTargets(raw: unknown): raw is NutritionTargets {
  if (!raw || typeof raw !== "object") {
    return false;
  }

  const targets = raw as NutritionTargets;
  const range = targets.expectedWeeklyLossKgRange;

  return (
    typeof targets.bmr === "number" &&
    typeof targets.tdee === "number" &&
    typeof targets.targetCalories === "number" &&
    typeof targets.proteinGoalG === "number" &&
    typeof targets.waterGoalMl === "number" &&
    range !== null &&
    typeof range === "object" &&
    typeof range.min === "number" &&
    typeof range.max === "number"
  );
}

function migrateStoredData(raw: unknown): StoredProfileData | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as { profile?: unknown; targets?: unknown };
  const profile = migrateProfile(data.profile);
  const targets = isValidTargets(data.targets) ? data.targets : null;

  if (!profile || !targets) {
    return null;
  }

  return { profile, targets };
}

function parseStored(raw: string | null): StoredProfileData | null {
  if (!raw) {
    return null;
  }

  try {
    return migrateStoredData(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function readActiveSnapshot(): StoredProfileData | null {
  if (typeof window === "undefined" || !activeUid) {
    return null;
  }

  const raw = window.localStorage.getItem(userKey(activeUid));

  if (raw === cachedRaw && cachedSnapshot !== undefined) {
    return cachedSnapshot;
  }

  cachedRaw = raw;
  cachedSnapshot = parseStored(raw);
  return cachedSnapshot;
}

export function subscribeProfile(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStoreChange);
  }

  return () => {
    listeners.delete(onStoreChange);

    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStoreChange);
    }
  };
}

export function getProfileSnapshot(): StoredProfileData | null {
  return readActiveSnapshot();
}

export function getProfileServerSnapshot(): StoredProfileData | null {
  return null;
}

/** 활성 사용자(uid)를 전환한다. 계정 전환/로그아웃 시 메모리 캐시를 초기화한다. */
export function setActiveUser(uid: string | null): void {
  if (activeUid === uid) {
    return;
  }

  activeUid = uid;
  invalidateCache();
  notifyListeners();
}

/** 특정 uid의 localStorage 캐시를 읽는다. (활성 uid와 무관) */
export function readCachedProfile(uid: string): StoredProfileData | null {
  if (typeof window === "undefined") {
    return null;
  }

  return parseStored(window.localStorage.getItem(userKey(uid)));
}

/** uid 스코프 캐시에 프로필을 저장한다. 활성 uid면 즉시 화면에 반영한다. */
export function cacheProfile(uid: string, data: StoredProfileData): void {
  if (typeof window === "undefined") {
    return;
  }

  const serialized = JSON.stringify(data);
  window.localStorage.setItem(userKey(uid), serialized);

  if (uid === activeUid) {
    cachedRaw = serialized;
    cachedSnapshot = data;
    notifyListeners();
  }
}

/** 최초 마이그레이션 전용으로 레거시 키를 읽는다. */
export function readLegacyProfile(): StoredProfileData | null {
  if (typeof window === "undefined") {
    return null;
  }

  return parseStored(window.localStorage.getItem(LEGACY_STORAGE_KEY));
}

/** Firestore 업로드 성공 후 레거시 키를 삭제한다. */
export function clearLegacyProfile(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
}
