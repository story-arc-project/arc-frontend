"use client";

import { useEffect, useMemo, useState } from "react";
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
import { buildProfilePatch, type ProfileFormState } from "./profile-patch";

interface ProfileEditFormProps {
  profile: Profile | null;
}

/** 읽기 포맷(affiliation)이 AFFILIATION_OPTIONS.value 와 일치할 때만 매핑, 아니면 미선택 */
function toAffiliation(affiliation: string | undefined): AffiliationStatus | "" {
  const match = AFFILIATION_OPTIONS.find((o) => o.value === affiliation);
  return match ? match.value : "";
}

/** profile(읽기 응답) → 폼 비교 스냅샷. 옵션 외 값은 걸러 폼이 표시 가능한 값만 남긴다. */
function toFormState(profile: Profile | null): ProfileFormState {
  return {
    name: profile?.name ?? "",
    birth: profile?.birth ?? "",
    phone: (profile?.phone ?? "").replace(/\D/g, ""),
    affiliation: toAffiliation(profile?.affiliation),
    school: profile?.school ?? "",
    department: profile?.department ?? "",
    worry: (profile?.worry ?? []).filter((w) =>
      (Q1_OPTIONS as readonly string[]).includes(w)
    ),
    interest: (profile?.interest ?? []).filter((i) =>
      (INTEREST_OPTIONS as readonly string[]).includes(i)
    ),
  };
}

export function ProfileEditForm({ profile }: ProfileEditFormProps) {
  const { refetch } = useAuth();
  const initial = useMemo(() => toFormState(profile), [profile]);

  const [name, setName] = useState(initial.name);
  const [birth, setBirth] = useState(initial.birth);
  const [phone, setPhone] = useState(initial.phone);
  const [affiliation, setAffiliation] = useState<AffiliationStatus | "">(initial.affiliation);
  const [school, setSchool] = useState(initial.school);
  const [department, setDepartment] = useState(initial.department);
  const [worry, setWorry] = useState<string[]>(initial.worry);
  const [interest, setInterest] = useState<string[]>(initial.interest);
  const [saving, setSaving] = useState(false);

  // 저장 후 refetch 로 profile 이 갱신되면 폼/baseline 을 재동기화해 dirty 를 초기화한다.
  useEffect(() => {
    setName(initial.name);
    setBirth(initial.birth);
    setPhone(initial.phone);
    setAffiliation(initial.affiliation);
    setSchool(initial.school);
    setDepartment(initial.department);
    setWorry(initial.worry);
    setInterest(initial.interest);
  }, [initial]);

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
  const patch = buildProfilePatch(initial, current);
  const isDirty = Object.keys(patch).length > 0;

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function handleSave() {
    if (!isDirty || saving) return;

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

    setSaving(true);
    try {
      await updateProfile(patch);
      await refetch();
      toast.success("프로필을 저장했어요.");
    } catch (e) {
      toast.error(
        e instanceof ApiError ? e.message : "저장에 실패했어요. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="default" padding="lg">
      <CardHeader>
        <CardTitle>프로필 편집</CardTitle>
      </CardHeader>

      <div className="flex flex-col gap-5">
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

        <div className="pt-1">
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
