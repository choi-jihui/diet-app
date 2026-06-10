"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { FullScreenLoading } from "@/components/auth/AuthStates";
import { useAuth } from "@/lib/auth/useAuth";
import { saveProfileDoc } from "@/lib/firebase/profile-repo";
import {
  ACTIVITY_OPTIONS,
  CARDIO_INTENSITY_OPTIONS,
  DIET_INTENSITY_OPTIONS,
  GENDER_OPTIONS,
} from "@/constants/onboarding-labels";
import {
  DEFAULT_MEAL_SLOTS,
  MEAL_SLOT_OPTIONS,
  MEAL_SLOT_ORDER,
} from "@/constants/meal-slots";
import { calculateNutritionTargets } from "@/lib/calculations";
import { cacheProfile } from "@/lib/storage/profile-storage";
import type {
  ActivityLevel,
  CardioIntensity,
  DietIntensity,
  Gender,
  MealSlot,
  UserProfile,
} from "@/types/user";

interface FormState {
  gender: Gender;
  age: string;
  heightCm: string;
  weightKg: string;
  goalWeightKg: string;
  activityLevel: ActivityLevel;
  dietIntensity: DietIntensity;
  cardioIntensity: CardioIntensity;
  selectedMealSlots: MealSlot[];
  allergies: string;
  dislikedFoods: string;
  cookingTools: string;
}

const INITIAL_FORM: FormState = {
  gender: "female",
  age: "",
  heightCm: "",
  weightKg: "",
  goalWeightKg: "",
  activityLevel: "light",
  dietIntensity: "normal",
  cardioIntensity: "three_days",
  selectedMealSlots: [...DEFAULT_MEAL_SLOTS],
  allergies: "",
  dislikedFoods: "",
  cookingTools: "",
};

function parseListText(text: string): string[] {
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateForm(form: FormState): string | null {
  const age = Number(form.age);
  const heightCm = Number(form.heightCm);
  const weightKg = Number(form.weightKg);
  const goalWeightKg = Number(form.goalWeightKg);

  if (form.selectedMealSlots.length === 0) {
    return "관리할 끼니를 1개 이상 선택해 주세요.";
  }

  if (!Number.isFinite(age) || age < 14 || age > 80) {
    return "나이는 14~80 사이로 입력해 주세요.";
  }

  if (!Number.isFinite(heightCm) || heightCm < 120 || heightCm > 220) {
    return "키는 120~220cm 사이로 입력해 주세요.";
  }

  if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 200) {
    return "현재 몸무게는 30~200kg 사이로 입력해 주세요.";
  }

  if (!Number.isFinite(goalWeightKg) || goalWeightKg < 30 || goalWeightKg > 200) {
    return "목표 몸무게는 30~200kg 사이로 입력해 주세요.";
  }

  return null;
}

function toProfile(form: FormState): UserProfile {
  return {
    gender: form.gender,
    age: Number(form.age),
    heightCm: Number(form.heightCm),
    weightKg: Number(form.weightKg),
    goalWeightKg: Number(form.goalWeightKg),
    activityLevel: form.activityLevel,
    dietIntensity: form.dietIntensity,
    cardioIntensity: form.cardioIntensity,
    selectedMealSlots: MEAL_SLOT_ORDER.filter((slot) =>
      form.selectedMealSlots.includes(slot),
    ),
    allergies: parseListText(form.allergies),
    dislikedFoods: parseListText(form.dislikedFoods),
    cookingTools: parseListText(form.cookingTools),
  };
}

interface OptionGroupProps<T extends string | number> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

function OptionGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: OptionGroupProps<T>) {
  return (
    <div>
      <p className="text-sm font-semibold text-gakk-text">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              value === option.value
                ? "bg-gakk-mint text-white"
                : "bg-gakk-cream text-gakk-text-muted"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MealSlotSelector({
  selected,
  onChange,
}: {
  selected: MealSlot[];
  onChange: (slots: MealSlot[]) => void;
}) {
  const toggleSlot = (slot: MealSlot) => {
    if (selected.includes(slot)) {
      onChange(selected.filter((item) => item !== slot));
      return;
    }

    onChange(
      MEAL_SLOT_ORDER.filter((item) => selected.includes(item) || item === slot),
    );
  };

  return (
    <div>
      <p className="text-sm font-semibold text-gakk-text">GAKK가 관리할 끼니</p>
      <p className="mt-1 text-xs leading-relaxed text-gakk-text-muted">
        급식·회사밥처럼 앱이 관리하지 않아도 되는 끼니는 빼도 괜찮아요.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {MEAL_SLOT_OPTIONS.map((option) => {
          const isSelected = selected.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleSlot(option.value)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                isSelected
                  ? "bg-gakk-mint text-white"
                  : "bg-gakk-cream text-gakk-text-muted"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OnboardingForm() {
  const router = useRouter();
  const { user, authLoading, markProfileReady } = useAuth();
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);
  const [error, setError] = useState<string | null>(null);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!user) {
      setError("로그인이 필요해요. 다시 로그인해 주세요.");
      return;
    }

    const profile = toProfile(form);
    const targets = calculateNutritionTargets(profile);

    setSubmitting(true);
    setError(null);

    try {
      await saveProfileDoc(user.uid, profile, targets);
      cacheProfile(user.uid, { profile, targets });
      markProfileReady();
      router.push("/dashboard");
    } catch {
      setError("저장 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return <FullScreenLoading />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5 pb-10">
      <div className="rounded-3xl border border-gakk-sage/40 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-gakk-text">기본 정보</p>
        <div className="mt-4 space-y-4">
          <OptionGroup
            label="성별"
            options={GENDER_OPTIONS}
            value={form.gender}
            onChange={(value) => updateField("gender", value)}
          />

          {[
            { key: "age" as const, label: "나이", placeholder: "25" },
            { key: "heightCm" as const, label: "키 (cm)", placeholder: "165" },
            { key: "weightKg" as const, label: "현재 몸무게 (kg)", placeholder: "58" },
            { key: "goalWeightKg" as const, label: "목표 몸무게 (kg)", placeholder: "52" },
          ].map((field) => (
            <div key={field.key}>
              <label htmlFor={field.key} className="text-xs text-gakk-text-muted">
                {field.label}
              </label>
              <input
                id={field.key}
                type="number"
                inputMode="decimal"
                value={form[field.key]}
                onChange={(event) => updateField(field.key, event.target.value)}
                placeholder={field.placeholder}
                className="mt-1 w-full rounded-2xl border border-gakk-sage/50 bg-gakk-cream px-4 py-3 text-sm text-gakk-text placeholder:text-gakk-text-muted/60 focus:outline-none focus:ring-2 focus:ring-gakk-mint/40"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-gakk-sage/40 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-gakk-text">생활 패턴</p>
        <div className="mt-4 space-y-4">
          <MealSlotSelector
            selected={form.selectedMealSlots}
            onChange={(slots) => updateField("selectedMealSlots", slots)}
          />
          <OptionGroup
            label="활동량"
            options={ACTIVITY_OPTIONS}
            value={form.activityLevel}
            onChange={(value) => updateField("activityLevel", value)}
          />
          <OptionGroup
            label="다이어트 강도"
            options={DIET_INTENSITY_OPTIONS}
            value={form.dietIntensity}
            onChange={(value) => updateField("dietIntensity", value)}
          />
          <OptionGroup
            label="유산소 강도"
            options={CARDIO_INTENSITY_OPTIONS}
            value={form.cardioIntensity}
            onChange={(value) => updateField("cardioIntensity", value)}
          />
        </div>

        {form.dietIntensity === "intensive" ? (
          <p className="mt-4 rounded-2xl bg-gakk-cream px-4 py-3 text-sm leading-relaxed text-gakk-text-muted">
            강한 페이스는 단기적으로만 추천해요. 컨디션이 안 좋으면 강도를 낮춰보세요.
          </p>
        ) : null}
      </div>

      <div className="rounded-3xl border border-gakk-sage/40 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-gakk-text">선호 · 제약</p>
        <div className="mt-4 space-y-4">
          {[
            {
              key: "allergies" as const,
              label: "알레르기",
              placeholder: "예: 땅콩, 새우 (쉼표로 구분)",
            },
            {
              key: "dislikedFoods" as const,
              label: "싫어하는 음식",
              placeholder: "예: 브로콜리, 두유",
            },
            {
              key: "cookingTools" as const,
              label: "조리도구",
              placeholder: "예: 전자레인지, 에어프라이어",
            },
          ].map((field) => (
            <div key={field.key}>
              <label htmlFor={field.key} className="text-xs text-gakk-text-muted">
                {field.label}
              </label>
              <textarea
                id={field.key}
                value={form[field.key]}
                onChange={(event) => updateField(field.key, event.target.value)}
                placeholder={field.placeholder}
                rows={2}
                className="mt-1 w-full resize-none rounded-2xl border border-gakk-sage/50 bg-gakk-cream px-4 py-3 text-sm text-gakk-text placeholder:text-gakk-text-muted/60 focus:outline-none focus:ring-2 focus:ring-gakk-mint/40"
              />
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl bg-gakk-sage/20 px-4 py-3 text-sm text-gakk-text">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-gakk-mint py-4 text-base font-semibold text-white disabled:opacity-60"
      >
        {submitting ? "저장 중..." : "저장하고 시작하기"}
      </button>

      <Link
        href="/dashboard"
        className="block text-center text-sm font-medium text-gakk-mint"
      >
        나중에 할게요 →
      </Link>
    </form>
  );
}
