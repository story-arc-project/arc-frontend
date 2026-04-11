"use client";

interface FilterOption<K extends string> {
  key: K;
  label: string;
}

interface FilterBarProps<K extends string> {
  options: FilterOption<K>[];
  value: K;
  onChange: (key: K) => void;
}

export default function FilterBar<K extends string>({
  options,
  value,
  onChange,
}: FilterBarProps<K>) {
  return (
    <div className="flex items-center gap-1.5" role="tablist">
      {options.map((f) => (
        <button
          key={f.key}
          type="button"
          role="tab"
          aria-selected={value === f.key}
          onClick={() => onChange(f.key)}
          className={[
            "px-3 py-1.5 rounded-md text-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1",
            value === f.key
              ? "bg-brand text-white"
              : "text-text-secondary hover:text-text-primary hover:bg-surface-secondary border border-border",
          ].join(" ")}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
