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
  statusCode?: number;
  finishReason?: string;
  rawSample?: string;

  constructor(
    code: GeminiErrorCode,
    options?: {
      statusCode?: number;
      finishReason?: string;
      rawSample?: string;
    },
  ) {
    super(code);
    this.name = "GeminiError";
    this.code = code;
    this.statusCode = options?.statusCode;
    this.finishReason = options?.finishReason;
    this.rawSample = options?.rawSample;
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

  throw new GeminiError("invalid_json", {
    rawSample: body.slice(0, 800),
  });
}

export interface GenerateJsonContentParams {
  system: string;
  user: string;
  model?: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
  responseSchema?: unknown;
  signal?: AbortSignal;
}

export interface GenerateJsonContentResult {
  data: unknown;
  model: string;
  durationMs: number;
  finishReason: string;
}

/** 서버 전용. Gemini를 호출해 JSON으로 강제된 응답과 메타를 반환한다. */
export async function generateJsonContentWithMeta(
  params: GenerateJsonContentParams,
): Promise<GenerateJsonContentResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError("missing_key");
  }

  const model = params.model?.trim() || getGeminiModel();
  const url = `${GENERATE_ENDPOINT}/${model}:generateContent`;
  const startedAt = Date.now();

  let response: Response;
  try {
    const generationConfig: Record<string, unknown> = {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: params.maxOutputTokens ?? 8192,
    };
    if (params.responseSchema) {
      generationConfig.responseSchema = params.responseSchema;
    }

    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: params.system }] },
        contents: [{ role: "user", parts: [{ text: params.user }] }],
        generationConfig,
      }),
      signal:
        params.signal && typeof AbortSignal.any === "function"
          ? AbortSignal.any([params.signal, AbortSignal.timeout(params.timeoutMs ?? 90_000)])
          : (params.signal ?? AbortSignal.timeout(params.timeoutMs ?? 90_000)),
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
    throw new GeminiError("http_error", { statusCode: response.status });
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
    throw new GeminiError("truncated", { finishReason });
  }

  try {
    const data = parseModelJson(text);
    return {
      data,
      model,
      durationMs: Date.now() - startedAt,
      finishReason,
    };
  } catch (caught) {
    if (caught instanceof GeminiError) {
      console.error(`[gemini] invalid_json (${model}): length=${text.length}`);
      throw caught;
    }
    console.error(`[gemini] invalid_json (${model}): length=${text.length}`);
    throw new GeminiError("invalid_json");
  }
}

/** 서버 전용. 기존 호출 호환을 위한 래퍼. */
export async function generateJsonContent(
  params: GenerateJsonContentParams,
): Promise<unknown> {
  const result = await generateJsonContentWithMeta(params);
  return result.data;
}
