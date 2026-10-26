"use client";

export function useListEditor<T extends { id: number }>(
  value: T[],
  onChange: (next: T[]) => void,
  createItem: () => T,
) {
  const updateItem = (id: number, patch: Partial<T>) =>
    onChange(value.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const removeItem = (id: number) => onChange(value.filter((v) => v.id !== id));
  const addItem = () => onChange([...value, createItem()]);

  return { updateItem, removeItem, addItem };
}
