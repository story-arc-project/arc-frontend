import { describe, expect, it } from "vitest"
import { parseNewExperienceType, withExperienceType } from "./archive-type-url"

describe("new experience type URL", () => {
  it("only accepts one currently selectable type, folding aliases", () => {
    expect(parseNewExperienceType(new URLSearchParams("type=career"))).toBe("career")
    expect(parseNewExperienceType(new URLSearchParams("type=team-project"))).toBe("personal-project")
    for (const query of ["", "type=", "type=nope", "type=sports", "type=__proto__", "type=career&type=award"]) {
      expect(parseNewExperienceType(new URLSearchParams(query))).toBeNull()
    }
  })
  it("preserves returnTo and hash while changing or removing type", () => {
    const url = new URL("https://arc.test/archive/new?returnTo=%2Farchive%3Flib%3Dx&type=career#form")
    expect(withExperienceType(url, "award")).toBe("/archive/new?returnTo=%2Farchive%3Flib%3Dx&type=award#form")
    expect(withExperienceType(url, null)).toBe("/archive/new?returnTo=%2Farchive%3Flib%3Dx#form")
  })
})
