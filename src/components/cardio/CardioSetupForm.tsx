"use client";

import { useState } from "react";
import { PillSelect } from "@/components/ui/PillSelect";
import {
  CARDIO_DAY_OPTIONS,
  CARDIO_DURATION_OPTIONS,
  CARDIO_EXPERIENCE_OPTIONS,
  CARDIO_TYPE_OPTIONS,
} from "@/constants/cardio";
import type {
  CardioExperience,
  CardioSettings,
  CardioType,
  PreferredCardioDurationMin,
} from "@/types/cardio";

interface CardioSetupFormProps {
  targetCount: number;
  defaultSettings?: CardioSettings;
  saving: boolean;
  submitLabel: string;
  onSubmit: (settings: CardioSettings) => void;
}

export function CardioSetupForm({
  targetCount,
  defaultSettings,
  saving,
  submitLabel,
  onSubmit,
}: CardioSetupFormProps) {
  const [experience, setExperience] = useState<CardioExperience>(
    defaultSettings?.cardioExperience ?? "beginner",
  );
  const [durationMin, setDurationMin] = useState<PreferredCardioDurationMin>(
    defaultSettings?.preferredDurationMin ?? 30,
  );
  const [types, setTypes] = useState<CardioType[]>(
    defaultSettings?.preferredCardioTypes ?? ["walking"],
  );
  const [availableDays, setAvailableDays] = useState<number[]>(
    defaultSettings?.availableDays ?? [],
  );

  const toggleType = (type: CardioType) => {
    setTypes((prev) =>
      prev.includes(type)
        ? prev.filter((value) => value !== type)
        : [...prev, type],
    );
  };

  const toggleDay = (day: number) => {
    setAvailableDays((prev) =>
      prev.includes(day)
        ? prev.filter((value) => value !== day)
        : [...prev, day].sort((a, b) => a - b),
    );
  };

  const notEnoughDays = availableDays.length < targetCount;
  const noTypes = types.length === 0;
  const disabled = saving || notEnoughDays || noTypes;

  const handleSubmit = () => {
    if (disabled) {
      return;
    }
    onSubmit({
      cardioExperience: experience,
      preferredDurationMin: durationMin,
      preferredCardioTypes: types,
      availableDays,
    });
  };

  return (
    <div className="space-y-5">
      <PillSelect
        label="유산소 경험"
        options={CARDIO_EXPERIENCE_OPTIONS}
        value={experience}
        onChange={setExperience}
      />

      <PillSelect
        label="1회 운동 시간"
        options={CARDIO_DURATION_OPTIONS}
        value={durationMin}
        onChange={setDurationMin}
      />

      <div>
        <p className="text-sm font-medium text-gakk-text">선호하는 운동</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CARDIO_TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleType(option.value)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
                types.includes(option.value)
                  ? "bg-gakk-mint text-white"
                  : "bg-gakk-cream text-gakk-text-muted"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {noTypes ? (
          <p className="mt-2 text-xs text-gakk-text-muted">
            운동 종류를 1개 이상 골라주세요.
          </p>
        ) : null}
      </div>

      <div>
        <p className="text-sm font-medium text-gakk-text">운동 가능한 요일</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CARDIO_DAY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleDay(option.value)}
              className={`h-10 w-10 rounded-full text-sm font-medium ${
                availableDays.includes(option.value)
                  ? "bg-gakk-mint text-white"
                  : "bg-gakk-cream text-gakk-text-muted"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {notEnoughDays ? (
          <p className="mt-2 text-xs text-gakk-coral">
            주 {targetCount}회 계획을 만들려면 가능한 요일을 {targetCount}개
            이상 골라주세요.
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled}
        className={`w-full rounded-2xl py-3 text-sm font-semibold text-white ${
          disabled ? "bg-gakk-mint/40" : "bg-gakk-mint"
        }`}
      >
        {saving ? "계획 만드는 중..." : submitLabel}
      </button>
    </div>
  );
}
