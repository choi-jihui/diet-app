import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";

const MAX_WEEKLY_PLAN_GENERATIONS_PER_DAY = 2;

let appInstance: App | null = null;

export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
      process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  );
}

function getAdminApp(): App {
  if (appInstance) {
    return appInstance;
  }

  if (getApps().length > 0) {
    appInstance = getApp();
    return appInstance;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("admin_not_configured");
  }

  appInstance = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return appInstance;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

/** ID 토큰을 검증하고 uid를 반환한다. 실패 시 null. */
export async function verifyIdToken(token: string): Promise<string | null> {
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

/**
 * 하루 주간 식단 생성 횟수를 예약(증가)한다.
 * 한도 초과 시 allowed=false를 반환하고 증가시키지 않는다.
 */
export async function reserveWeeklyPlanGeneration(
  uid: string,
  dateKey: string,
): Promise<{ allowed: boolean }> {
  const db = getAdminDb();
  const ref = db.doc(`users/${uid}/aiUsage/${dateKey}`);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists
      ? Number(snap.data()?.weeklyPlanGenerations ?? 0)
      : 0;

    if (current >= MAX_WEEKLY_PLAN_GENERATIONS_PER_DAY) {
      return { allowed: false };
    }

    tx.set(
      ref,
      {
        weeklyPlanGenerations: current + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return { allowed: true };
  });
}

/** 생성이 실패했을 때 예약한 횟수를 되돌린다(0 미만으로 내려가지 않음). */
export async function releaseWeeklyPlanGeneration(
  uid: string,
  dateKey: string,
): Promise<void> {
  const db = getAdminDb();
  const ref = db.doc(`users/${uid}/aiUsage/${dateKey}`);

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists
        ? Number(snap.data()?.weeklyPlanGenerations ?? 0)
        : 0;

      tx.set(
        ref,
        {
          weeklyPlanGenerations: Math.max(0, current - 1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
  } catch {
    // 환불 실패는 치명적이지 않으므로 조용히 무시한다.
  }
}
