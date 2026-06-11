"use client";

import { useState } from "react";
import {
  SLEEP_MAX_HOURS,
  WATER_MAX_ML,
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
} from "@/types/daily-log";

const inputClassName =
  "w-full rounded-xl border border-gakk-sage/50 bg-gakk-cream px-3 py-2 text-sm text-gakk-text placeholder:text-gakk-text-muted/60 focus:outline-none focus:ring-2 focus:ring-gakk-mint/30";

interface WaterSleepSectionProps {
  waterMl: number;
  waterGoalMl: number;
  sleepHours?: number;
  weightKg?: number;
  onAddWater: (deltaMl: number) => void;
  onSetWater: (valueMl: number) => void;
  onSaveSleep: (hours: number | null) => void;
  onSaveWeight: (weightKg: number | null) => void;
}

/**
 * 날짜 변경 시 부모에서 key={date}로 remount되므로
 * 입력 중이던 값이 다른 날짜로 저장될 일이 없다.
 * 수면·몸무게는 blur 시점에 저장한다(키 입력마다 저장 금지).
 */
export function WaterSleepSection({
  waterMl,
  waterGoalMl,
  sleepHours,
  weightKg,
  onAddWater,
  onSetWater,
  onSaveSleep,
  onSaveWeight,
}: WaterSleepSectionProps) {
  const [waterInput, setWaterInput] = useState("");
  const [showWaterInput, setShowWaterInput] = useState(false);
  const [sleepInput, setSleepInput] = useState(
    typeof sleepHours === "number" ? String(sleepHours) : "",
  );
  const [weightInput, setWeightInput] = useState(
    typeof weightKg === "number" ? String(weightKg) : "",
  );

  const applyWaterInput = () => {
    const value = Number(waterInput);
    if (!Number.isFinite(value) || value < 0 || value > WATER_MAX_ML) {
      return;
    }
    onSetWater(Math.round(value));
    setWaterInput("");
    setShowWaterInput(false);
  };

  const handleSleepBlur = () => {
    const trimmed = sleepInput.trim();
    if (trimmed === "") {
      if (typeof sleepHours === "number") {
        onSaveSleep(null);
      }
      return;
    }
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value < 0 || value > SLEEP_MAX_HOURS) {
      setSleepInput(typeof sleepHours === "number" ? String(sleepHours) : "");
      return;
    }
    const rounded = Math.round(value * 2) / 2; // 0.5시간 단위
    setSleepInput(String(rounded));
    if (rounded !== sleepHours) {
      onSaveSleep(rounded);
    }
  };

  const handleWeightBlur = () => {
    const trimmed = weightInput.trim();
    if (trimmed === "") {
      if (typeof weightKg === "number") {
        onSaveWeight(null);
      }
      return;
    }
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value < WEIGHT_MIN_KG || value > WEIGHT_MAX_KG) {
      setWeightInput(typeof weightKg === "number" ? String(weightKg) : "");
      return;
    }
    const rounded = Math.round(value * 10) / 10; // 0.1kg 단위
    setWeightInput(String(rounded));
    if (rounded !== weightKg) {
      onSaveWeight(rounded);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-gakk-sage/40 bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-gakk-text">물</p>
          <p className="text-sm text-gakk-text-muted">
            <span className="font-semibold text-gakk-text">
              {waterMl.toLocaleString()}
            </span>
            {" / "}
            {waterGoalMl.toLocaleString()} ml
          </p>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onAddWater(250)}
            className="flex-1 rounded-xl border border-gakk-sage/50 bg-gakk-cream py-2 text-sm font-medium text-gakk-text"
          >
            +250ml
          </button>
          <button
            type="button"
            onClick={() => onAddWater(500)}
            className="flex-1 rounded-xl border border-gakk-sage/50 bg-gakk-cream py-2 text-sm font-medium text-gakk-text"
          >
            +500ml
          </button>
          <button
            type="button"
            onClick={() => setShowWaterInput((prev) => !prev)}
            className="flex-1 rounded-xl border border-gakk-sage/50 bg-white py-2 text-sm font-medium text-gakk-text-muted"
          >
            직접 입력
          </button>
        </div>
        {showWaterInput ? (
          <div className="mt-2 flex gap-2">
            <input
              value={waterInput}
              onChange={(event) => setWaterInput(event.target.value)}
              type="number"
              inputMode="numeric"
              placeholder={`현재 총량으로 수정 (0~${WATER_MAX_ML})`}
              className={inputClassName}
            />
            <button
              type="button"
              onClick={applyWaterInput}
              className="shrink-0 rounded-xl bg-gakk-mint px-4 py-2 text-sm font-semibold text-white"
            >
              적용
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-gakk-sage/40 bg-white p-4 shadow-sm">
          <label htmlFor="sleep-hours" className="text-xs text-gakk-text-muted">
            수면 (시간 · 0.5 단위)
          </label>
          <input
            id="sleep-hours"
            value={sleepInput}
            onChange={(event) => setSleepInput(event.target.value)}
            onBlur={handleSleepBlur}
            type="number"
            inputMode="decimal"
            step={0.5}
            min={0}
            max={SLEEP_MAX_HOURS}
            placeholder="7"
            className="mt-2 w-full bg-transparent text-lg font-semibold text-gakk-text placeholder:text-gakk-text-muted/50 focus:outline-none"
          />
        </div>

        <div className="rounded-2xl border border-gakk-sage/40 bg-white p-4 shadow-sm">
          <label htmlFor="weight-kg" className="text-xs text-gakk-text-muted">
            몸무게 (kg · 선택)
          </label>
          <input
            id="weight-kg"
            value={weightInput}
            onChange={(event) => setWeightInput(event.target.value)}
            onBlur={handleWeightBlur}
            type="number"
            inputMode="decimal"
            step={0.1}
            min={WEIGHT_MIN_KG}
            max={WEIGHT_MAX_KG}
            placeholder="—"
            className="mt-2 w-full bg-transparent text-lg font-semibold text-gakk-text placeholder:text-gakk-text-muted/50 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-gakk-text-muted">
            원할 때만 기록해도 괜찮아요.
          </p>
        </div>
      </div>
    </div>
  );
}
