import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useListEditor } from "./useListEditor";

interface Item { id: number; name: string | null; tags: string[]; optional?: string }
const item = (id: number, name = "saved"): Item => ({ id, name, tags: ["kept"] });

describe("useListEditor", () => {
  it("creates an item only on add and appends without changing existing references", () => {
    const first = item(5);
    const value = Object.freeze([first]) as unknown as Item[];
    const onChange = vi.fn();
    const createItem = vi.fn(() => item(-1, "new"));
    const { result, rerender } = renderHook(() => useListEditor(value, onChange, createItem));
    rerender();
    expect(createItem).not.toHaveBeenCalled();
    result.current.addItem();
    expect(createItem).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual([first, item(-1, "new")]);
    expect(onChange.mock.calls[0][0][0]).toBe(first);
    expect(value).toEqual([first]);
  });

  it("shallow merges a patch and preserves untouched items and nested fields", () => {
    const first = Object.freeze(item(1));
    const second = Object.freeze(item(2));
    const value = Object.freeze([first, second]) as unknown as Item[];
    const onChange = vi.fn();
    const { result } = renderHook(() => useListEditor(value, onChange, () => item(-1)));
    result.current.updateItem(1, { name: null, optional: undefined });
    const next = onChange.mock.calls[0][0] as Item[];
    expect(next).toEqual([{ ...first, name: null, optional: undefined }, second]);
    expect(next[0]).not.toBe(first);
    expect(next[0].tags).toBe(first.tags);
    expect(next[1]).toBe(second);
    expect(first.name).toBe("saved");
    result.current.updateItem(1, { id: 8, tags: [] });
    expect(onChange.mock.calls[1][0][0]).toEqual({ ...first, id: 8, tags: [] });
  });

  it("keeps the existing duplicate-id map/filter semantics and survivor order", () => {
    const value = [item(2), item(1, "a"), item(1, "b"), item(3)];
    const onChange = vi.fn();
    const { result } = renderHook(() => useListEditor(value, onChange, () => item(-1)));
    result.current.updateItem(1, { name: "both" });
    expect(onChange.mock.calls[0][0].map((v: Item) => v.name)).toEqual(["saved", "both", "both", "saved"]);
    result.current.removeItem(1);
    expect(onChange.mock.calls[1][0]).toEqual([value[0], value[3]]);
    expect(onChange.mock.calls[1][0][0]).toBe(value[0]);
  });

  it("still emits a new array for an unmatched id and empty lists", () => {
    const value = [item(1)];
    const onChange = vi.fn();
    const { result, rerender } = renderHook(({ value }) => useListEditor(value, onChange, () => item(-1)), { initialProps: { value } });
    result.current.updateItem(99, { name: "missing" });
    result.current.removeItem(99);
    for (const [next] of onChange.mock.calls) {
      expect(next).toEqual(value);
      expect(next).not.toBe(value);
      expect(next[0]).toBe(value[0]);
    }
    rerender({ value: [] });
    result.current.removeItem(1);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("uses the latest controlled value, callback and factory after rerender", () => {
    const initial = { value: [item(1)], onChange: vi.fn(), createItem: vi.fn(() => item(-1)) };
    const latest = { value: [item(8), item(7)], onChange: vi.fn(), createItem: vi.fn(() => item(-2)) };
    const { result, rerender } = renderHook(({ value, onChange, createItem }) => useListEditor(value, onChange, createItem), { initialProps: initial });
    rerender(latest);
    result.current.updateItem(7, { name: "updated" });
    result.current.removeItem(8);
    result.current.addItem();
    expect(initial.onChange).not.toHaveBeenCalled();
    expect(initial.createItem).not.toHaveBeenCalled();
    expect(latest.onChange.mock.calls[0][0]).toEqual([latest.value[0], { ...latest.value[1], name: "updated" }]);
    expect(latest.onChange.mock.calls[1][0]).toEqual([latest.value[1]]);
    expect(latest.onChange.mock.calls[2][0]).toEqual([...latest.value, item(-2)]);
    expect(latest.createItem).toHaveBeenCalledTimes(1);
  });
});
