import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import type { WeeklyCardioPlan } from "@/types/cardio";

export const CARDIO_PLAN_SCHEMA_VERSION = 1;

const LOAD_ERROR = "유산소 계획을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
const SAVE_ERROR = "유산소 계획을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
const AUTH_ERROR = "로그인이 필요해요. 다시 로그인해 주세요.";

function requireUid(uid: string): void {
  const current = getFirebaseAuth().currentUser;
  if (!current || current.uid !== uid) {
    throw new Error(AUTH_ERROR);
  }
}

function cardioPlanDocRef(uid: string, weekStartDate: string) {
  return doc(getFirebaseDb(), "users", uid, "cardioPlans", weekStartDate);
}

export async function getWeeklyCardioPlan(
  uid: string,
  weekStartDate: string,
): Promise<WeeklyCardioPlan | null> {
  requireUid(uid);

  try {
    const snap = await getDoc(cardioPlanDocRef(uid, weekStartDate));
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data() as { plan?: WeeklyCardioPlan };
    return data.plan ?? null;
  } catch {
    throw new Error(LOAD_ERROR);
  }
}

/** 동일 weekStartDate면 덮어쓰되 createdAt은 유지하고 updatedAt만 갱신한다. */
export async function saveWeeklyCardioPlan(
  uid: string,
  plan: Pick<WeeklyCardioPlan, "weekStartDate" | "settings" | "sessions">,
): Promise<void> {
  requireUid(uid);

  try {
    const ref = cardioPlanDocRef(uid, plan.weekStartDate);
    const existing = await getDoc(ref);

    const base = {
      plan: {
        weekStartDate: plan.weekStartDate,
        settings: plan.settings,
        sessions: plan.sessions,
      },
      schemaVersion: CARDIO_PLAN_SCHEMA_VERSION,
      updatedAt: serverTimestamp(),
    };

    if (existing.exists()) {
      await setDoc(ref, base, { merge: true });
    } else {
      await setDoc(ref, { ...base, createdAt: serverTimestamp() });
    }
  } catch {
    throw new Error(SAVE_ERROR);
  }
}
