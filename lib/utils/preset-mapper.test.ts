import { describe, expect, it } from "vitest";
import type { Block } from "@/types/archive";
import {
  type PresetDTO,
  toPreset,
  toPresetUpsertPayload,
} from "./preset-mapper";

// Preset API responses feed usePresets; block contents must survive unchanged.
function makeDTO(overrides: Partial<PresetDTO> = {}): PresetDTO {
  return {
    id: "preset-project",
    user_id: "owner-1",
    name: "프로젝트 기록",
    description: "다음 경험에 재사용할 항목",
    blocks: [
      {
        id: "block-summary",
        key: "project.summary",
        type: "textarea",
        label: "성과",
        required: false,
        value: { type: "textarea", text: "처리 시간 20% 단축" },
      },
      {
        id: "block-period",
        type: "period",
        label: "기간",
        value: { type: "period", start: "2026-01", end: "", isCurrent: true },
      },
    ],
    is_favorite: true,
    created_at: "2026-01-01T09:00:00+09:00",
    updated_at: "2026-02-02T12:30:00Z",
    ...overrides,
  };
}

describe("toPreset", () => {
  it("maps the API response to the domain shape without leaking wire-only fields", () => {
    expect(toPreset(makeDTO())).toStrictEqual({
      id: "preset-project",
      name: "프로젝트 기록",
      description: "다음 경험에 재사용할 항목",
      blocks: [
        {
          id: "block-summary",
          key: "project.summary",
          type: "textarea",
          label: "성과",
          required: false,
          value: { type: "textarea", text: "처리 시간 20% 단축" },
        },
        {
          id: "block-period",
          type: "period",
          label: "기간",
          value: { type: "period", start: "2026-01", end: "", isCurrent: true },
        },
      ],
      isFavorite: true,
      createdAt: "2026-01-01T09:00:00+09:00",
      updatedAt: "2026-02-02T12:30:00Z",
    });
  });

  it.each([null, undefined])("normalizes description %s to undefined", (description) => {
    expect(toPreset(makeDTO({ description })).description).toBeUndefined();
  });

  it("accepts a response with no optional description or owner", () => {
    const dto = makeDTO();
    delete dto.description;
    delete dto.user_id;
    expect(toPreset(dto).description).toBeUndefined();
    expect(toPreset(dto).id).toBe("preset-project");
  });

  it("preserves empty strings, an empty block list and a false favorite", () => {
    expect(toPreset(makeDTO({ name: "", description: "", blocks: [], is_favorite: false })))
      .toMatchObject({ name: "", description: "", blocks: [], isFavorite: false });
  });

  // The DTO declares blocks required; these cases pin the existing runtime fallback.
  it.each([null, undefined])("falls back to an empty list for blocks %s", (blocks) => {
    const dto = { ...makeDTO(), blocks } as unknown as PresetDTO;
    expect(toPreset(dto).blocks).toStrictEqual([]);
  });

  it("falls back when the blocks key is absent at runtime", () => {
    const { blocks: _blocks, ...dto } = makeDTO();
    expect(toPreset(dto as PresetDTO).blocks).toStrictEqual([]);
  });

  it("does not mutate response data or nested blocks", () => {
    const dto = makeDTO();
    const before = structuredClone(dto);
    toPreset(dto);
    expect(dto).toStrictEqual(before);
  });
});

describe("toPresetUpsertPayload", () => {
  it("emits only snake-case writable fields for a complete create input", () => {
    const input = {
      ...toPreset(makeDTO()),
      name: "면접 준비",
      description: "답변용 항목",
    };
    expect(toPresetUpsertPayload(input)).toStrictEqual({
      name: "면접 준비",
      description: "답변용 항목",
      blocks: makeDTO().blocks,
      is_favorite: true,
    });
  });

  it.each([
    {},
    { name: undefined, description: undefined, blocks: undefined, isFavorite: undefined },
  ])("omits absent and explicitly undefined update fields: %j", (input) => {
    // Strict equality catches own undefined-valued keys that JSON would silently drop.
    expect(toPresetUpsertPayload(input)).toStrictEqual({});
  });

  it.each([
    { input: { name: "새 이름" }, expected: { name: "새 이름" } },
    { input: { description: "새 설명" }, expected: { description: "새 설명" } },
    { input: { blocks: makeDTO().blocks }, expected: { blocks: makeDTO().blocks } },
    { input: { isFavorite: true }, expected: { is_favorite: true } },
    { input: { isFavorite: false }, expected: { is_favorite: false } },
  ])("keeps a partial update limited to its supplied field: $input", ({ input, expected }) => {
    expect(toPresetUpsertPayload(input)).toStrictEqual(expected);
  });

  it("includes explicit clearing values instead of treating them as omitted", () => {
    const payload = toPresetUpsertPayload({ name: "", description: "", blocks: [], isFavorite: false });
    expect(payload).toStrictEqual({ name: "", description: "", blocks: [], is_favorite: false });
    expect(JSON.parse(JSON.stringify(payload))).toStrictEqual({
      name: "", description: "", blocks: [], is_favorite: false,
    });
  });

  it("omits undefined siblings while retaining an explicit favorite removal", () => {
    expect(toPresetUpsertPayload({
      name: undefined, description: undefined, blocks: undefined, isFavorite: false,
    })).toStrictEqual({ is_favorite: false });
  });

  it("preserves nested block data and does not mutate the update input", () => {
    const blocks: Block[] = makeDTO().blocks;
    const input = { blocks, description: "更新" };
    const before = structuredClone(input);
    const payload = toPresetUpsertPayload(input);
    expect(payload.blocks).toStrictEqual(before.blocks);
    expect(input).toStrictEqual(before);
  });
});
