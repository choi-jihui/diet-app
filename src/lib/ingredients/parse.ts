import type { ParsedIngredient } from "@/types/ingredient";

const QUANTITY_WORDS = new Set([
  "반",
  "한",
  "두",
  "세",
  "네",
  "약",
  "조금",
  "여러",
  "한두",
  "서너",
  "약간",
]);

function splitNameQuantity(item: string): ParsedIngredient {
  const tokens = item.split(/\s+/).filter(Boolean);

  if (tokens.length <= 1) {
    return { name: item, quantityText: "" };
  }

  let splitIndex = -1;
  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (/^\d/.test(token) || QUANTITY_WORDS.has(token)) {
      splitIndex = i;
      break;
    }
  }

  if (splitIndex === -1) {
    return { name: item, quantityText: "" };
  }

  return {
    name: tokens.slice(0, splitIndex).join(" "),
    quantityText: tokens.slice(splitIndex).join(" "),
  };
}

/** 이름을 비교용으로 정규화한다(공백 제거 + 소문자). */
export function normalizeName(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

/** 쉼표·줄바꿈으로 구분된 입력을 파싱한다. AI를 사용하지 않는다. */
export function parseIngredientsInput(text: string): ParsedIngredient[] {
  return text
    .split(/[\n,]+/)
    .map((piece) => piece.trim())
    .filter(Boolean)
    .map(splitNameQuantity);
}

/** 입력 내부의 중복(이름 기준)을 제거한다. */
export function dedupeParsed(list: ParsedIngredient[]): ParsedIngredient[] {
  const seen = new Set<string>();
  const result: ParsedIngredient[] = [];

  for (const item of list) {
    const key = normalizeName(item.name);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }

  return result;
}
