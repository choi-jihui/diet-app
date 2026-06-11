import {
  deleteField,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import type { CardioSession, DailyLogCardio } from "@/types/cardio";
import type {
  CustomFoodEntry,
  DailyLog,
  FoodEntry,
  MealLog,
} from "@/types/daily-log";
import { WATER_MAX_ML } from "@/types/daily-log";
import type { MealSlotType } from "@/types/meal";

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

/** Firestore는 undefined 저장에 실패하므로 payload에서 제거한다. */
function cleanCustomEntry(entry: CustomFoodEntry): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {
    id: entry.id,
    name: entry.name,
    calories: entry.calories,
  };
  if (typeof entry.proteinG === "number") {
    cleaned.proteinG = entry.proteinG;
  }
  return cleaned;
}

function cleanFoodEntry(entry: FoodEntry): Record<string, unknown> {
  return {
    ...cleanCustomEntry(entry),
    category: entry.category,
  };
}

/**
 * 상태별로 필요한 필드만 포함해 stale 필드가 남지 않게 한다.
 * - planned: plannedOption만
 * - custom: customEntries만
 * - skipped: 상태만
 */
function cleanMealLog(mealLog: MealLog): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {
    slot: mealLog.slot,
    status: mealLog.status,
  };

  if (mealLog.status === "planned" && mealLog.plannedOption) {
    cleaned.plannedOption = {
      optionType: mealLog.plannedOption.optionType,
      title: mealLog.plannedOption.title,
      estimatedCalories: mealLog.plannedOption.estimatedCalories,
      estimatedProteinG: mealLog.plannedOption.estimatedProteinG,
    };
  }

  if (mealLog.status === "custom") {
    cleaned.customEntries = (mealLog.customEntries ?? []).map(cleanCustomEntry);
  }

  return cleaned;
}

/**
 * 문서가 없을 때만 date/createdAt을 생성하고, 있으면 update만 적용한다.
 * transaction이라 동시 저장에서도 createdAt이 덮어써지지 않는다.
 *
 * @param updates dot-path 허용 update 페이로드 (updatedAt은 내부에서 추가)
 * @param createFields 문서 신규 생성 시 함께 넣을 nested 필드
 */
async function mutateDailyLog(
  uid: string,
  date: string,
  updates: Record<string, unknown>,
  createFields: Record<string, unknown>,
): Promise<void> {
  requireUid(uid);
  const db = getFirebaseDb();
  const ref = dailyLogDocRef(uid, date);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);

      if (!snap.exists()) {
        tx.set(ref, {
          date,
          ...createFields,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return;
      }

      tx.update(ref, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    });
  } catch {
    throw new Error(SAVE_ERROR);
  }
}

export async function getDailyLog(
  uid: string,
  date: string,
): Promise<DailyLog | null> {
  requireUid(uid);

  try {
    const snap = await getDoc(dailyLogDocRef(uid, date));
    if (!snap.exists()) {
      return null;
    }
    return snap.data() as DailyLog;
  } catch {
    throw new Error(LOAD_ERROR);
  }
}

/**
 * 끼니 기록 저장. dot-path로 해당 슬롯 map 전체를 교체해
 * 다른 끼니·cardio·물·수면 필드를 건드리지 않는다.
 * mealLog=null이면 미기록으로 되돌리기(필드 삭제).
 */
export async function setMealLog(
  uid: string,
  date: string,
  slot: MealSlotType,
  mealLog: MealLog | null,
): Promise<void> {
  if (mealLog === null) {
    requireUid(uid);
    const db = getFirebaseDb();
    const ref = dailyLogDocRef(uid, date);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) {
          return; // 문서가 없으면 이미 unlogged
        }
        tx.update(ref, {
          [`meals.${slot}`]: deleteField(),
          updatedAt: serverTimestamp(),
        });
      });
    } catch {
      throw new Error(SAVE_ERROR);
    }
    return;
  }

  if (mealLog.status === "custom" && (mealLog.customEntries ?? []).length === 0) {
    throw new Error("음식 항목을 1개 이상 입력해 주세요.");
  }

  const cleaned = cleanMealLog(mealLog);
  await mutateDailyLog(
    uid,
    date,
    { [`meals.${slot}`]: cleaned },
    { meals: { [slot]: cleaned } },
  );
}

/** 추가 음식 배열 전체 교체 저장. */
export async function setExtraFoods(
  uid: string,
  date: string,
  foods: FoodEntry[],
): Promise<void> {
  const cleaned = foods.map(cleanFoodEntry);
  await mutateDailyLog(
    uid,
    date,
    { extraFoods: cleaned },
    { extraFoods: cleaned },
  );
}

/**
 * 물 증감. transaction 안에서 현재값 기준으로 계산해
 * 빠른 연속 클릭에도 증가량이 유실되지 않는다.
 */
export async function addWaterMl(
  uid: string,
  date: string,
  deltaMl: number,
): Promise<number> {
  requireUid(uid);
  const db = getFirebaseDb();
  const ref = dailyLogDocRef(uid, date);

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists()
        ? Number((snap.data() as DailyLog).waterMl ?? 0)
        : 0;
      const next = Math.min(WATER_MAX_ML, Math.max(0, current + deltaMl));

      if (!snap.exists()) {
        tx.set(ref, {
          date,
          waterMl: next,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.update(ref, {
          waterMl: next,
          updatedAt: serverTimestamp(),
        });
      }
      return next;
    });
  } catch {
    throw new Error(SAVE_ERROR);
  }
}

/** 물 직접 입력(절대값). */
export async function setWaterMl(
  uid: string,
  date: string,
  valueMl: number,
): Promise<void> {
  const clamped = Math.min(WATER_MAX_ML, Math.max(0, Math.round(valueMl)));
  await mutateDailyLog(uid, date, { waterMl: clamped }, { waterMl: clamped });
}

export async function setSleepHours(
  uid: string,
  date: string,
  hours: number | null,
): Promise<void> {
  if (hours === null) {
    await mutateDailyLog(uid, date, { sleepHours: deleteField() }, {});
    return;
  }
  await mutateDailyLog(uid, date, { sleepHours: hours }, { sleepHours: hours });
}

export async function setWeightKg(
  uid: string,
  date: string,
  weightKg: number | null,
): Promise<void> {
  if (weightKg === null) {
    await mutateDailyLog(uid, date, { weightKg: deleteField() }, {});
    return;
  }
  await mutateDailyLog(uid, date, { weightKg }, { weightKg });
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
