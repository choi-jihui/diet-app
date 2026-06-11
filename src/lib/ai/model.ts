const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export function getGeminiModel(): string {
  const model = process.env.GEMINI_MODEL?.trim();
  return model && model.length > 0 ? model : DEFAULT_GEMINI_MODEL;
}

export function getWeeklyGeminiModel(): string {
  const weekly = process.env.GEMINI_MODEL_WEEKLY?.trim();
  if (weekly && weekly.length > 0) {
    return weekly;
  }
  return getGeminiModel();
}
