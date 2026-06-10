import { jsonrepair } from "jsonrepair";
import { getGeminiModel } from "@/lib/ai/model";

export { getGeminiModel } from "@/lib/ai/model";
const GENERATE_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiErrorCode =
  | "missing_key"
  | "http_error"
  | "empty_response"
  | "invalid_json"
  | "timeout"
  | "truncated";

export class GeminiError extends Error {
  code: GeminiErrorCode;

  constructor(code: GeminiErrorCode) {
    super(code);
    this.name = "GeminiError";
    this.code = code;
  }
}

interface GeminiCandidatePart {
  text?: string;
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiCandidatePart[] };
    finishReason?: string;
  }[];
}

function parseModelJson(text: string): unknown {
  let body = text.trim();

  const fence = body.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fence) {
    body = fence[1].trim();
  }

  const attempts = [body];
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start >= 0 && end > start) {
    attempts.push(body.slice(start, end + 1));
  }

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        return JSON.parse(jsonrepair(candidate));
      } catch {
        // 다음 후보 시도
      }
    }
  }

  throw new GeminiError("invalid_json");
}

/** 서버 전용. Gemini를 호출해 JSON으로 강제된 응답을 파싱해 반환한다. */
export async function generateJsonContent(params: {
  system: string;
  user: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError("missing_key");
  }

  const model = getGeminiModel();
  const url = `${GENERATE_ENDPOINT}/${model}:generateContent`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: params.system }] },
        contents: [{ role: "user", parts: [{ text: params.user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
          maxOutputTokens: params.maxOutputTokens ?? 8192,
        },
      }),
      signal: AbortSignal.timeout(params.timeoutMs ?? 90_000),
    });
  } catch {
    throw new GeminiError("timeout");
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    let reason = detail;
    try {
      const parsed = JSON.parse(detail) as { error?: { message?: string } };
      reason = parsed.error?.message ?? detail;
    } catch {
      // detail이 JSON이 아니면 원문 일부만 사용
    }
    console.error(
      `[gemini] http ${response.status} (${model}): ${reason.slice(0, 200)}`,
    );
    throw new GeminiError("http_error");
  }

  const data = (await response.json()) as GeminiResponse;
  const candidate = data.candidates?.[0];
  const finishReason = candidate?.finishReason ?? "unknown";
  const text =
    candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

  if (!text.trim()) {
    throw new GeminiError("empty_response");
  }

  if (finishReason === "MAX_TOKENS") {
    console.error(`[gemini] truncated (${model}): length=${text.length}`);
    throw new GeminiError("truncated");
  }

  try {
    return parseModelJson(text);
  } catch (caught) {
    if (caught instanceof GeminiError) {
      console.error(`[gemini] invalid_json (${model}): length=${text.length}`);
      throw caught;
    }
    console.error(`[gemini] invalid_json (${model}): length=${text.length}`);
    throw new GeminiError("invalid_json");
  }
}
