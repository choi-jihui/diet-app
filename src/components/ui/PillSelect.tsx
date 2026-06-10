interface PillSelectProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function PillSelect<T extends string>({
  label,
  options,
  value,
  onChange,
}: PillSelectProps<T>) {
  return (
    <div>
      <p className="text-sm font-medium text-gakk-text">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
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
