import { createRef, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordInput } from "./password-input";

afterEach(cleanup);

function Pair() {
  const [first, setFirst] = useState(false);
  const [second, setSecond] = useState(false);
  return <>
    <PasswordInput label="비밀번호" visible={first} onToggleVisibility={() => setFirst((v) => !v)} defaultValue="abc12345" />
    <PasswordInput label="확인" visible={second} onToggleVisibility={() => setSecond((v) => !v)} />
  </>;
}

describe("PasswordInput", () => {
  it("toggles each controlled input independently without replacing the input or value", () => {
    render(<Pair />);
    const first = screen.getByLabelText("비밀번호");
    const second = screen.getByLabelText("확인");
    fireEvent.click(screen.getAllByRole("button", { name: "보기" })[0]);
    expect(first).toHaveAttribute("type", "text");
    expect(second).toHaveAttribute("type", "password");
    expect(first).toHaveValue("abc12345");
    expect(screen.getByLabelText("비밀번호")).toBe(first);
    fireEvent.click(screen.getByRole("button", { name: "숨기기" }));
    expect(first).toHaveAttribute("type", "password");
  });

  it("forwards ref and Input metadata, events, errors, and disabled semantics", () => {
    const ref = createRef<HTMLInputElement>();
    const change = vi.fn();
    const toggle = vi.fn();
    render(<PasswordInput ref={ref} id="password" name="password" label="비밀번호" autoComplete="new-password" error="오류" required disabled className="extra" visible={false} onToggleVisibility={toggle} onChange={change} />);
    expect(ref.current).toBe(screen.getByLabelText(/비밀번호/));
    expect(ref.current).toHaveAttribute("autocomplete", "new-password");
    expect(ref.current).toHaveAttribute("name", "password");
    expect(ref.current).toHaveAttribute("aria-describedby", "password-error");
    expect(ref.current).toHaveAttribute("aria-invalid", "true");
    expect(ref.current).toBeRequired();
    expect(ref.current).toBeDisabled();
    expect(ref.current).toHaveClass("pr-14", "extra");
    // Existing pages disable only the input; the visibility button remains enabled.
    expect(screen.getByRole("button")).toBeEnabled();
    fireEvent.click(screen.getByRole("button"));
    expect(toggle).toHaveBeenCalledOnce();
    fireEvent.change(ref.current!, { target: { value: "secret" } });
    expect(change).toHaveBeenCalledOnce();
  });

  it("uses a non-submit button and does not reset focus or selection on programmatic activation", () => {
    const submit = vi.fn();
    render(<form onSubmit={submit}><Pair /></form>);
    const input = screen.getByLabelText("비밀번호") as HTMLInputElement;
    input.focus();
    input.setSelectionRange(1, 4);
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(submit).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button")[0]).toHaveAttribute("type", "button");
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(1);
    expect(input.selectionEnd).toBe(4);
  });
});
