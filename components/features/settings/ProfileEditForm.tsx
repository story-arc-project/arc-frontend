"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Input,
  DatePicker,
  Chip,
  Button,
  Card,
  CardHeader,
  CardTitle,
  toast,
} from "@/components/ui";
import {
  AFFILIATION_OPTIONS,
  Q1_OPTIONS,
  INTEREST_OPTIONS,
  formatPhone,
  type AffiliationStatus,
} from "@/app/(auth)/constants";
import { updateProfile } from "@/lib/api/auth-api";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/hooks/useAuth";
import type { Profile } from "@/types/auth";
import {
  buildProfilePatch,
  partitionByOptions,
  type PreservedOptionValues,
  type ProfileFormState,
} from "./profile-patch";

interface ProfileEditFormProps {
  profile: Profile | null;
  className?: string;
}

/** 읽기 포맷(affiliation)이 AFFILIATION_OPTIONS.value 와 일치할 때만 매핑, 아니면 미선택 */
function toAffiliation(affiliation: string | undefined): AffiliationStatus | "" {
  const match = AFFILIATION_OPTIONS.find((o) => o.value === affiliation);
  return match ? match.value : "";
}

/**
 * profile(읽기 응답) → 폼 비교 스냅샷 + 보존 대상.
 * 옵션 외 값은 칩으로 그릴 수 없어 폼에서 걸러내되, 그대로 버리면 저장 시
 * 서버에서 영구 삭제되므로(FRT-260) preserved 로 따로 들고 있다가 다시 합친다.
 */
function toFormState(profile: Profile | null): {
  form: ProfileFormState;
  preserved: PreservedOptionValues;
} {
  const worry = partitionByOptions(profile?.worry ?? [], Q1_OPTIONS);
  const interest = partitionByOptions(profile?.interest ?? [], INTEREST_OPTIONS);
  return {
    form: {
      name: profile?.name ?? "",
      birth: profile?.birth ?? "",
      phone: (profile?.phone ?? "").replace(/\D/g, ""),
      affiliation: toAffiliation(profile?.affiliation),
      school: profile?.school ?? "",
      department: profile?.department ?? "",
      worry: worry.known,
      interest: interest.known,
    },
    preserved: { worry: worry.unknown, interest: interest.unknown },
  };
}

/** 칩 선택 순서는 저장 의미가 없으므로 값으로 비교한다. */
function sameFieldValue(a: string | string[], b: string | string[]) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value) => b.includes(value));
  }
  return a === b;
}

export function ProfileEditForm({ profile, className = "" }: ProfileEditFormProps) {
  const { refetch } = useAuth();
  const derived = useMemo(() => toFormState(profile), [profile]);

  /**
   * dirty 판정의 비교 기준선. 서버 값(profile)에서 출발하지만 profile 에 **묶여 있지는 않다** —
   * 저장이 성공하면 방금 저장한 값으로 앞당긴다. 기준선이 prop 에서만 파생되면, 저장 직후의
   * refetch 가 실패해 prop 이 그대로일 때 구값(기준선) vs 신값(폼)의 차이가 다시 patch 로
   * 잡혀 저장한 내용이 "저장되지 않은 변경사항"으로 되살아난다(FRT-294).
   */
  const [baseline, setBaseline] = useState(derived);
  // PATCH 성공 직후부터 refetch effect도 제출한 스냅샷을 기준으로 비교해야 한다.
  const baselineRef = useRef(derived);
  const mountedRef = useRef(false);
  const savingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const { form: initial, preserved } = baseline;

  const [name, setName] = useState(derived.form.name);
  const [birth, setBirth] = useState(derived.form.birth);
  const [phone, setPhone] = useState(derived.form.phone);
  const [affiliation, setAffiliation] = useState<AffiliationStatus | "">(derived.form.affiliation);
  const [school, setSchool] = useState(derived.form.school);
  const [department, setDepartment] = useState(derived.form.department);
  const [worry, setWorry] = useState<string[]>(derived.form.worry);
  const [interest, setInterest] = useState<string[]>(derived.form.interest);
  const [saving, setSaving] = useState(false);

  // 서버 갱신은 이전 기준선과 같은 필드에만 적용한다. 사용자가 고친 필드는
  // 새 기준선과 비교해 계속 dirty로 남긴다(동일 값의 새 profile 참조도 포함).
  useEffect(() => {
    const previous = baselineRef.current.form;
    baselineRef.current = derived;
    setBaseline(derived);
    setName((value) => sameFieldValue(value, previous.name) ? derived.form.name : value);
    setBirth((value) => sameFieldValue(value, previous.birth) ? derived.form.birth : value);
    setPhone((value) => sameFieldValue(value, previous.phone) ? derived.form.phone : value);
    setAffiliation((value) => sameFieldValue(value, previous.affiliation) ? derived.form.affiliation : value);
    setSchool((value) => sameFieldValue(value, previous.school) ? derived.form.school : value);
    setDepartment((value) => sameFieldValue(value, previous.department) ? derived.form.department : value);
    setWorry((value) => sameFieldValue(value, previous.worry) ? derived.form.worry : value);
    setInterest((value) => sameFieldValue(value, previous.interest) ? derived.form.interest : value);
  }, [derived]);

  // 학생일 때만 학교/학과를 노출한다 — 백엔드 교차검증(student→school/department만 허용)과 정합.
  const showSchoolFields = affiliation === "student";

  const current: ProfileFormState = {
    name,
    birth,
    phone,
    affiliation,
    school,
    department,
    worry,
    interest,
  };
  const patch = buildProfilePatch(initial, current, preserved);
  const isDirty = Object.keys(patch).length > 0;

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function handleSave() {
    if (!isDirty || savingRef.current) return;

    if (patch.name !== undefined && patch.name.trim() === "") {
      toast.error("이름을 입력해주세요.");
      return;
    }
    if (patch.birth !== undefined && patch.birth === "") {
      toast.error("생년월일을 입력해주세요.");
      return;
    }
    if (patch.phone !== undefined && patch.phone.length !== 11) {
      toast.error("전화번호를 정확히 입력해주세요. (숫자 11자리)");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await updateProfile(patch);
    } catch (e) {
      if (!mountedRef.current) return;
      toast.error(
        e instanceof ApiError ? e.message : "저장에 실패했어요. 잠시 후 다시 시도해주세요."
      );
      savingRef.current = false;
      setSaving(false);
      return;
    }

    // 저장 성공 — 제출 당시 폼 값으로 기준선을 앞당긴다. 이후 추가 입력은 포함하지 않는다.
    // 계정 교체·페이지 이동으로 사라진 폼의 상태나 토스트는 갱신하지 않는다.
    if (mountedRef.current) {
      // refetch 실패가 저장 완료를 뒤집지 않도록 기준선은 PATCH 성공 직후 갱신한다(FRT-294).
      // 옵션 밖 값은 patch에 합쳐 보냈으므로 보존한다(FRT-260).
      baselineRef.current = { form: current, preserved };
      setBaseline(baselineRef.current);
      toast.success("프로필을 저장했어요.");
    }

    // 페이지를 떠나도 헤더(이름/아바타)는 현재 세션의 프로필로 동기화한다.
    // refetch 실패가 저장 성공을 뒤집지 않도록 분리한다.
    try {
      await refetch();
    } catch {
      // 저장은 반영됨. 동기화 실패는 조용히 무시한다.
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }

  return (
    <Card variant="default" padding="lg" className={`flex flex-col ${className}`.trim()}>
      <CardHeader>
        <CardTitle>프로필 편집</CardTitle>
      </CardHeader>

      <div className="flex flex-1 flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름"
          />
          <DatePicker
            label="생년월일"
            mode="date"
            value={birth}
            onChange={(e) => setBirth(e.target.value)}
          />
          <Input
            label="전화번호"
            type="tel"
            inputMode="numeric"
            value={formatPhone(phone)}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
            placeholder="010-0000-0000"
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-label text-text-primary">소속</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AFFILIATION_OPTIONS.map((opt) => {
                const active = affiliation === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAffiliation(opt.value)}
                    className={[
                      "h-12 rounded-md border text-body-sm font-semibold transition-colors",
                      active
                        ? "border-brand bg-surface-brand text-brand-dark"
                        : "border-border text-text-secondary hover:border-brand hover:text-brand",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {showSchoolFields && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="학교"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="학교"
            />
            <Input
              label="학과"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="학과"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-label text-text-primary">고민</span>
          <div className="flex flex-wrap gap-2">
            {Q1_OPTIONS.map((opt) => (
              <Chip
                key={opt}
                selected={worry.includes(opt)}
                onClick={() => toggle(worry, setWorry, opt)}
              >
                {opt}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-label text-text-primary">관심사</span>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((opt) => (
              <Chip
                key={opt}
                selected={interest.includes(opt)}
                onClick={() => toggle(interest, setInterest, opt)}
              >
                {opt}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-1">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="sm:self-start"
          >
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
