import { SUPPORTIVE_COPY } from "@/constants/copy";

interface PlaceholderCardProps {
  title: string;
  description: string;
  phase: number;
}

export function PlaceholderCard({ title, description, phase }: PlaceholderCardProps) {
  return (
    <div className="rounded-3xl border border-gakk-sage/40 bg-white p-5 shadow-sm">
      <div className="mb-3 inline-flex rounded-full bg-gakk-lime/30 px-3 py-1 text-xs font-semibold text-gakk-text">
        Phase {phase} 예정
      </div>
      <h2 className="text-base font-semibold text-gakk-text">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-gakk-text-muted">{description}</p>
      <p className="mt-4 rounded-2xl bg-gakk-cream px-4 py-3 text-sm text-gakk-text-muted">
        {SUPPORTIVE_COPY.placeholderHint}
      </p>
    </div>
  );
}
