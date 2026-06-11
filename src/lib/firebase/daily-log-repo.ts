import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import type { CardioSession, DailyLogCardio } from "@/types/cardio";

const LOAD_ERROR = "기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
const SAVE_ERROR = "기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
const AUTH_ERROR = "로그인이 필요해요. 다시 로그인해 주세요.";

function requireUid(uid: string): void {
  const current = getFirebaseAuth().currentUser;
  if (!current || current.uid !== uid) {
    throw new Error(AUTH_ERROR);
  }
}

function dailyLogDocRef(uid: string, date: string) {
  return doc(getFirebaseDb(), "users", uid, "dailyLogs", date);
}

/**
 * dailyLogs/{date}에 cardio 필드만 merge한다.
 * meal/water/sleep 등 다른 필드는 절대 건드리지 않는다(Phase 8 영역).
 */
export async function setCardioCompletion(
  uid: string,
  session: CardioSession,
  planWeekStartDate: string,
  completed: boolean,
): Promise<void> {
  requireUid(uid);

  const cardio: Omit<DailyLogCardio, "completedAt"> & {
    completedAt: ReturnType<typeof serverTimestamp> | null;
  } = {
    planWeekStartDate,
    plannedSessionId: session.id,
    plannedType: session.type,
    plannedDurationMin: session.durationMin,
    completed,
    completedAt: completed ? serverTimestamp() : null,
  };

  try {
    await setDoc(
      dailyLogDocRef(uid, session.date),
      {
        cardio,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch {
    throw new Error(SAVE_ERROR);
  }
}

/** 주어진 날짜들의 cardio 기록을 한 번에 읽는다. 문서가 없으면 null. */
export async function getCardioLogsByDates(
  uid: string,
  dates: string[],
): Promise<Record<string, DailyLogCardio | null>> {
  requireUid(uid);

  try {
    const entries = await Promise.all(
      dates.map(async (date) => {
        const snap = await getDoc(dailyLogDocRef(uid, date));
        if (!snap.exists()) {
          return [date, null] as const;
        }
        const data = snap.data() as { cardio?: DailyLogCardio };
        return [date, data.cardio ?? null] as const;
      }),
    );
    return Object.fromEntries(entries);
  } catch {
    throw new Error(LOAD_ERROR);
  }
}
