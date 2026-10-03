import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreditCharge } from "./CreditCharge";
import { DEFAULT_CREDIT_PACKAGES } from "@/lib/constants/credit-packages";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("CreditCharge", () => {
  it("reveals availability only after explicit payment click and never sends a mutation", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ packages: DEFAULT_CREDIT_PACKAGES })));
    vi.stubGlobal("fetch", fetchSpy);
    render(<CreditCharge />);
    const pay = screen.getByRole("button", { name: "결제하기" });
    expect(pay).toBeDisabled();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(await screen.findByRole("radio", { name: /Lite/ }));
    expect(pay).toBeEnabled();
    expect(screen.queryByText("크레딧 충전을 준비하고 있어요")).toBeNull();
    fireEvent.click(pay);
    expect(screen.getByRole("dialog", { name: "크레딧 충전 안내" })).toBeInTheDocument();
    expect(screen.getByText(/결제는 진행되지 않았으며/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("radio", { name: /Lite/ })).toBeChecked();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ method: "GET", credentials: "omit" });
  });

  it("keeps selection unavailable until the final catalog resolves", async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((done) => { resolve = done; })));
    render(<CreditCharge />);
    expect(screen.getByRole("status")).toHaveTextContent("패키지를 불러오는 중이에요");
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByRole("button", { name: "결제하기" })).toBeDisabled();
    resolve(new Response(JSON.stringify({ packages: [{ id: "new", name: "New", credits: 30, price_krw: 6000 }] })));
    expect(await screen.findByRole("radio", { name: /New/ })).not.toBeChecked();
    expect(screen.queryByRole("radio", { name: /Lite/ })).toBeNull();
  });

  it("uses the shared default catalog for malformed responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ packages: [] }))));
    render(<CreditCharge />);
    expect(await screen.findByRole("radio", { name: /Lite/ })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "결제하기" })).toBeDisabled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
