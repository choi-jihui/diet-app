import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";
import { PROFILE_DOC_ID } from "@/lib/firebase/paths";
import type { NutritionTargets } from "@/types/nutrition";
import type { UserProfile } from "@/types/user";
import type { IngredientInput } from "@/types/ingredient";

const MAX_WEEKLY_PLAN_GENERATIONS_PER_DAY = 2;
export const MAX_INSTANT_RECOMMENDATIONS_PER_DAY = 10;
const INSTANT_RECOMMENDATION_LEASE_MS = 75_000;

let appInstance: App | null = null;

function normalizeAdminPrivateKey(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }

  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  key = key.replace(/\\n/g, "\n").trim();
  if (!key.includes("BEGIN PRIVATE KEY")) {
    return null;
  }

  return key;
}

export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim() &&
      normalizeAdminPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
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

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = normalizeAdminPrivateKey(
    process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  );

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("admin_not_configured");
  }

  try {
    appInstance = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "admin_init_failed";
    console.error("[firebase-admin] init_failed", message.slice(0, 120));
    throw new Error("admin_init_failed");
  }
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

type InstantLeaseRejectReason = "limit" | "locked";

type InstantLeaseResult =
  | {
      allowed: true;
      expiresAt: number;
    }
  | {
      allowed: false;
      reason: InstantLeaseRejectReason;
      retryAfterMs?: number;
    };

interface UsageSnapshot {
  instantGenerations: number;
  instantLeaseRequestId: string | null;
  instantLeaseExpiresAt: number;
}

function parseUsageSnapshot(raw: Record<string, unknown> | undefined): UsageSnapshot {
  return {
    instantGenerations:
      raw && typeof raw.instantGenerations === "number"
        ? Math.max(0, Math.floor(raw.instantGenerations))
        : 0,
    instantLeaseRequestId:
      raw && typeof raw.instantLeaseRequestId === "string"
        ? raw.instantLeaseRequestId
        : null,
    instantLeaseExpiresAt:
      raw && typeof raw.instantLeaseExpiresAt === "number"
        ? Math.max(0, Math.floor(raw.instantLeaseExpiresAt))
        : 0,
  };
}

export async function reserveInstantRecommendationLease(
  uid: string,
  dateKey: string,
  requestId: string,
  nowMs = Date.now(),
): Promise<InstantLeaseResult> {
  const db = getAdminDb();
  const ref = db.doc(`users/${uid}/aiUsage/${dateKey}`);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const usage = parseUsageSnapshot(snap.data() as Record<string, unknown> | undefined);

    if (usage.instantGenerations >= MAX_INSTANT_RECOMMENDATIONS_PER_DAY) {
      return { allowed: false, reason: "limit" as const };
    }

    const leaseIsActive =
      Boolean(usage.instantLeaseRequestId) && usage.instantLeaseExpiresAt > nowMs;

    if (leaseIsActive && usage.instantLeaseRequestId !== requestId) {
      return {
        allowed: false,
        reason: "locked" as const,
        retryAfterMs: usage.instantLeaseExpiresAt - nowMs,
      };
    }

    const expiresAt = nowMs + INSTANT_RECOMMENDATION_LEASE_MS;

    tx.set(
      ref,
      {
        instantGenerations: usage.instantGenerations + 1,
        instantLeaseRequestId: requestId,
        instantLeaseExpiresAt: expiresAt,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return { allowed: true, expiresAt };
  });
}

export async function releaseInstantRecommendationLease(
  uid: string,
  dateKey: string,
  requestId: string,
  options?: { rollbackUsage?: boolean; nowMs?: number },
): Promise<void> {
  const db = getAdminDb();
  const ref = db.doc(`users/${uid}/aiUsage/${dateKey}`);
  const rollbackUsage = options?.rollbackUsage ?? false;
  const nowMs = options?.nowMs ?? Date.now();

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const usage = parseUsageSnapshot(snap.data() as Record<string, unknown> | undefined);
      const leaseIsActive =
        Boolean(usage.instantLeaseRequestId) && usage.instantLeaseExpiresAt > nowMs;
      const isOwner = usage.instantLeaseRequestId === requestId;

      if (rollbackUsage && leaseIsActive && !isOwner) {
        return;
      }

      const patch: Record<string, unknown> = {
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (rollbackUsage) {
        patch.instantGenerations = Math.max(0, usage.instantGenerations - 1);
      }

      if (isOwner || !leaseIsActive) {
        patch.instantLeaseRequestId = FieldValue.delete();
        patch.instantLeaseExpiresAt = FieldValue.delete();
      }

      tx.set(ref, patch, { merge: true });
    });
  } catch {
    // 잠금 해제 실패는 치명적이지 않으므로 무시한다.
  }
}

export async function getStoredProfileDocAdmin(
  uid: string,
): Promise<{ profile: UserProfile; targets: NutritionTargets } | null> {
  const db = getAdminDb();
  const snap = await db.doc(`users/${uid}/profile/${PROFILE_DOC_ID}`).get();
  if (!snap.exists) {
    return null;
  }

  const data = snap.data() as {
    profile?: UserProfile;
    targets?: NutritionTargets;
  };

  if (!data.profile || !data.targets) {
    return null;
  }

  return {
    profile: data.profile,
    targets: data.targets,
  };
}

export async function listStoredIngredientsAdmin(
  uid: string,
): Promise<Array<Pick<IngredientInput, "name" | "quantityText">>> {
  const db = getAdminDb();
  const snapshot = await db.collection(`users/${uid}/ingredients`).get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as { name?: unknown; quantityText?: unknown };
      if (typeof data.name !== "string" || data.name.trim().length === 0) {
        return null;
      }
      const quantityText =
        typeof data.quantityText === "string" ? data.quantityText : "";
      return {
        name: data.name,
        quantityText,
      };
    })
    .filter((item): item is Pick<IngredientInput, "name" | "quantityText"> =>
      Boolean(item),
    );
}
