export const PROFILE_DOC_ID = "main";

export function userDocPath(uid: string): string {
  return `users/${uid}`;
}

export function profileDocPath(uid: string): string {
  return `users/${uid}/profile/${PROFILE_DOC_ID}`;
}

export function ingredientsCollectionPath(uid: string): string {
  return `users/${uid}/ingredients`;
}

export function ingredientDocPath(uid: string, ingredientId: string): string {
  return `users/${uid}/ingredients/${ingredientId}`;
}

export function mealPlansCollectionPath(uid: string): string {
  return `users/${uid}/mealPlans`;
}

export function mealPlanDocPath(uid: string, weekStartDate: string): string {
  return `users/${uid}/mealPlans/${weekStartDate}`;
}

export function cardioPlansCollectionPath(uid: string): string {
  return `users/${uid}/cardioPlans`;
}

export function cardioPlanDocPath(uid: string, weekStartDate: string): string {
  return `users/${uid}/cardioPlans/${weekStartDate}`;
}

export function dailyLogsCollectionPath(uid: string): string {
  return `users/${uid}/dailyLogs`;
}

export function dailyLogDocPath(uid: string, date: string): string {
  return `users/${uid}/dailyLogs/${date}`;
}

export function weeklyReportsCollectionPath(uid: string): string {
  return `users/${uid}/weeklyReports`;
}

export function weeklyReportDocPath(uid: string, weekStartDate: string): string {
  return `users/${uid}/weeklyReports/${weekStartDate}`;
}
