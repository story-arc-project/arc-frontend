"use client"

import { useRef } from "react"
import { Check } from "lucide-react"
import { useRoleHistory } from "@/contexts/RoleHistoryContext"

/**
 * 화면에 그릴 역할 뱃지 목록. 등록된 역할(① '역할 이력')을 앞에 두고,
 * 등록 목록에 없는데 **이미 선택돼 있는 값**(구 데이터·손상값)을 뒤에 붙인다.
 * 후자가 없으면 선택돼 있는데 화면에 안 보여 **해제할 방법이 사라진다**(FRT-177 교훈).
 * 드롭다운에 새로 고를 수 있는 건 등록된 역할뿐이고, 이 함수는 "이미 붙어 있는 것까지
 * 포함해 무엇이 보여야 하는가"를 답한다 — 노출 판정과 렌더가 같은 계산을 쓰게 한다.
 */
export function roleChipOptions(roles: string[], selected: string[]): string[] {
  return [...roles, ...selected.filter(s => !roles.includes(s))]
}

interface RoleChipsProps {
  value: string[]
  onChange: (next: string[]) => void
  readOnly?: boolean
  /** 개조식 행 안처럼 라벨 없이 한 줄에 얹는 모드. 뱃지를 더 작게 그린다. */
  inline?: boolean
}

/**
 * 역할 태그 칩 (FRT-178). 선택지가 상수가 아니라 같은 폼의 '역할 이력'에서 파생되므로
 * RoleHistoryContext 를 통해 목록을 받는다. provider 밖(상세뷰·스토리북)에서는 읽기 전용.
 * ② 개조식 행과 ③ 반복 블록 셀이 이 컴포넌트를 공유한다.
 */
export default function RoleChips({ value, onChange, readOnly, inline }: RoleChipsProps) {
  const ctx = useRoleHistory()
  const roles = ctx?.roles ?? []
  const selected = Array.isArray(value) ? value : []
  const shown = roleChipOptions(roles, selected).filter(r => selected.includes(r))
  const editable = !readOnly && !!ctx

  const detailsRef = useRef<HTMLDetailsElement>(null)
  const summaryRef = useRef<HTMLElement>(null)

  function toggle(role: string) {
    onChange(selected.includes(role) ? selected.filter(r => r !== role) : [...selected, role])
  }

  /**
   * 드롭다운에서 고르는 경로. 값만 바꾸고 열어 두면 메뉴가 아래 입력칸을 가리고,
   * 닫으려면 방금 옆으로 밀려난 요약 버튼을 눈으로 다시 찾아야 한다(FRT-323).
   * 다중 선택은 그대로 살아 있다 — 두 번째 역할은 다시 열어서 붙인다.
   *
   * 닫기 **전에** 포커스를 요약 버튼으로 되돌린다. 안 옮기면 키보드 사용자의 포커스가
   * 방금 숨겨진 옵션에 남아 초점 표시가 사라지고, 이어지는 Enter/Space 가 보이지 않는
   * 항목을 계속 누른다. 브라우저의 포커스 보정 동작에 기대지 않는다.
   */
  function pick(role: string) {
    toggle(role)
    summaryRef.current?.focus()
    if (detailsRef.current) detailsRef.current.open = false
  }

  // 읽기 전용: 붙어 있는 뱃지만. 하나도 없으면 아무것도 그리지 않는다(빈 자리를 만들지 않는다).
  if (!editable) {
    if (shown.length === 0) return null
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {shown.map(role => (
          <span
            key={role}
            className="inline-flex shrink-0 items-center rounded-full bg-surface-brand px-2 py-0.5 text-caption font-medium text-brand-dark"
          >
            {role}
          </span>
        ))}
      </span>
    )
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${inline ? "" : "w-full"}`}>
      {/*
        details: 바깥 클릭 처리 없이 열고 닫히는 드롭다운. 고르면 pick() 이 닫는다.
        칩보다 **앞에** 둬야 태그가 붙어도 요약 버튼 자리가 밀리지 않는다 — 뒤에 두면
        고를 때마다 버튼이 오른쪽으로 이동하고 메뉴도 같이 튄다(FRT-323).
      */}
      <details ref={detailsRef} className="relative inline-block shrink-0">
        <summary ref={summaryRef} className="inline-flex cursor-pointer list-none items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-caption text-text-tertiary transition-colors hover:border-brand hover:text-brand">
          🏷️ 역할
        </summary>
        <div className="absolute left-0 top-full z-10 mt-1 min-w-40 rounded-lg border border-border bg-surface p-1 shadow-lg">
          {roles.length === 0 ? (
            <p className="px-2 py-1.5 text-caption text-text-tertiary">
              먼저 위 &quot;역할 이력&quot;에 역할을 등록해주세요
            </p>
          ) : (
            roles.map(role => {
              const on = selected.includes(role)
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => pick(role)}
                  aria-pressed={on}
                  className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-body-sm text-text-primary transition-colors hover:bg-surface-secondary"
                >
                  <span className="w-3.5 shrink-0 text-brand">
                    {on && <Check size={14} aria-hidden />}
                  </span>
                  {role}
                </button>
              )
            })
          )}
        </div>
      </details>

      {shown.map(role => {
        // 등록 목록에서 사라진 값(구 데이터·손상값)은 회색으로 구분해 그대로 지울 수 있게 둔다.
        const orphan = !roles.includes(role)
        return (
          <span
            key={role}
            className={[
              "inline-flex shrink-0 items-center gap-0.5 rounded-full border pl-2 pr-1 py-0.5 text-caption font-medium",
              orphan
                ? "border-border bg-surface-secondary text-text-tertiary"
                : "border-brand bg-surface-brand text-brand-dark",
            ].join(" ")}
          >
            {role}
            <button
              type="button"
              onClick={() => toggle(role)}
              className="rounded-full p-0.5 leading-none transition-colors hover:bg-brand-light"
              aria-label={`${role} 역할 태그 해제`}
            >
              ×
            </button>
          </span>
        )
      })}
    </span>
  )
}
