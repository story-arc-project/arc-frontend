import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import ExperienceCard from "./ExperienceCard"
import { careerExperience, customLibrary } from "./__fixtures__/archive.fixtures"
let viewportHeight = 240
let submenuHeight = 1000
let anchorTop = 120
const rect = (top: number, left: number, width: number, height: number) => ({ top, left, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON() {} })
function pointerEvent(element: Element, type: "pointerOver" | "pointerOut", pointerType: string) {
  const event = createEvent[type](element)
  Object.defineProperty(event, "pointerType", { value: pointerType })
  fireEvent(element, event)
}
function openMenu(libraryCount = 30) {
  const onMoveToLibrary = vi.fn()
  render(<ExperienceCard experience={careerExperience} selected={false} libraries={Array.from({ length: libraryCount }, (_, i) => ({ ...customLibrary, id: `lib-${i}`, name: `Library ${i}`, experienceIds: [] }))} onClick={vi.fn()} onEdit={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()} onMoveToLibrary={onMoveToLibrary} />)
  fireEvent.click(screen.getByLabelText("더보기"))
  return { menu: screen.getByText("편집").parentElement!, onMoveToLibrary }
}
beforeEach(() => {
  viewportHeight = 240
  submenuHeight = 1000
  anchorTop = 120
  vi.spyOn(window, "innerHeight", "get").mockImplementation(() => viewportHeight)
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(320)
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.getAttribute("aria-label") === "더보기") return rect(200, 280, 24, 24)
    if (this.textContent === "라이브러리 이동") return rect(anchorTop, 144, 160, 36)
    if (this.hasAttribute("data-archive-popover")) return rect(0, 0, this.textContent?.includes("편집") ? 160 : 144, Math.min(this.textContent?.includes("편집") ? 180 : submenuHeight, viewportHeight - 16))
    return rect(0, 0, 0, 0)
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe("ExperienceCard viewport menus", () => {
  it("opens above a low trigger using the measured menu height", () => {
    const { menu } = openMenu()
    expect(Number.parseFloat(menu.style.top)).toBe(16)
  })
  it("bounds a menu taller than the viewport and reflows on resize", () => {
    const { menu } = openMenu()
    viewportHeight = 100
    fireEvent(window, new Event("resize"))
    expect(Number.parseFloat(menu.style.top)).toBe(8)
    expect(menu.style.maxHeight).toBe("84px")
    expect(menu.style.overflowY).toBe("auto")
  })
  it("keeps internal scroll open, preserves last-item callback and closes on external scroll", () => {
    const { menu, onMoveToLibrary } = openMenu()
    fireEvent.click(screen.getByText("라이브러리 이동"))
    const submenu = screen.getByText("Library 29").closest("[data-archive-popover]") as HTMLElement
    expect(Number.parseFloat(submenu.style.top)).toBe(8)
    expect(submenu.style.maxHeight).toBe("224px")
    fireEvent.scroll(submenu)
    expect(screen.getByText("Library 29")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Library 29"))
    expect(onMoveToLibrary).toHaveBeenCalledWith("lib-29")
    fireEvent.scroll(menu)
    expect(screen.getByText("편집")).toBeInTheDocument()
    fireEvent.scroll(window)
    expect(screen.queryByText("편집")).not.toBeInTheDocument()
  })
  it("keeps the submenu reachable while crossing the portal gap", () => {
    vi.useFakeTimers()
    openMenu()
    const trigger = screen.getByText("라이브러리 이동")
    pointerEvent(trigger.parentElement!, "pointerOver", "mouse")
    const submenu = screen.getByText("Library 29").closest("[data-archive-popover]")!
    pointerEvent(trigger.parentElement!, "pointerOut", "mouse")
    pointerEvent(submenu, "pointerOver", "mouse")
    vi.advanceTimersByTime(200)
    expect(screen.getByText("Library 29")).toBeInTheDocument()
    vi.useRealTimers()
  })
  it("opens on a touch tap even when compatibility hover events fire", () => {
    openMenu()
    const trigger = screen.getByText("라이브러리 이동")
    pointerEvent(trigger.parentElement!, "pointerOver", "touch")
    fireEvent.mouseEnter(trigger.parentElement!)
    fireEvent.click(trigger)
    expect(screen.getByText("Library 29")).toBeInTheDocument()
  })
  it("clamps submenu left placement within a narrow viewport", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(170)
    const { menu } = openMenu()
    expect(Number.parseFloat(menu.style.left)).toBe(8)
    fireEvent.click(screen.getByText("라이브러리 이동"))
    const submenu = screen.getByText("Library 29").closest("[data-archive-popover]") as HTMLElement
    expect(Number.parseFloat(submenu.style.left)).toBe(8)
    expect(submenu.style.maxWidth).toBe("154px")
  })
  it("keeps a short submenu anchored when its scrollable parent moves the trigger", () => {
    viewportHeight = 140
    submenuHeight = 40
    anchorTop = 80
    const { menu } = openMenu(1)
    fireEvent.click(screen.getByText("라이브러리 이동"))
    const submenu = screen.getByText("Library 0").closest("[data-archive-popover]") as HTMLElement
    expect(submenu.style.top).toBe("80px")
    anchorTop = 40
    fireEvent.scroll(menu)
    expect(submenu.style.top).toBe("40px")
    expect(screen.getByText("편집")).toBeInTheDocument()
    fireEvent.scroll(submenu)
    expect(submenu.style.top).toBe("40px")
  })
  it("preserves Escape and outside dismissal", () => {
    openMenu()
    fireEvent.keyDown(window, { key: "Escape" })
    expect(screen.queryByText("편집")).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText("더보기"))
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText("편집")).not.toBeInTheDocument()
  })
})
