"use client";

interface FilterOption<K extends string> {
  key: K;
  label: string;
}

interface FilterBarProps<K extends string> {
  options: FilterOption<K>[];
  value: K;
  onChange: (key: K) => void;
  id?: string;
}

export default function FilterBar<K extends string>({
  options,
  value,
  onChange,
  id = "filter",
}: FilterBarProps<K>) {
  return (
    <div className="flex items-center gap-1.5" role="tablist" aria-label="필터">
      {options.map((f) => (
        <button
          key={f.key}
          id={`${id}-tab-${f.key}`}
          type="button"
          role="tab"
          aria-selected={value === f.key}
          aria-controls={`${id}-panel-${f.key}`}
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
