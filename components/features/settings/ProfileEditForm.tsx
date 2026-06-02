"use client";

import { useState } from "react";
import {
  Input,
  DatePicker,
  Chip,
  Button,
  Card,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import {
  AFFILIATION_OPTIONS,
  Q1_OPTIONS,
  INTEREST_OPTIONS,
  formatPhone,
  type AffiliationStatus,
} from "@/app/(auth)/constants";
import type { Profile } from "@/types/auth";

interface ProfileEditFormProps {
  profile: Profile | null;
}

/** 읽기 포맷(education)이 AFFILIATION_OPTIONS.value 와 일치할 때만 매핑, 아니면 미선택 */
function toAffiliation(education: string | undefined): AffiliationStatus | "" {
  const match = AFFILIATION_OPTIONS.find((o) => o.value === education);
  return match ? match.value : "";
}

export function ProfileEditForm({ profile }: ProfileEditFormProps) {
  const [name, setName] = useState(profile?.name ?? "");
  const [birth, setBirth] = useState(profile?.birth ?? "");
  const [phone, setPhone] = useState((profile?.phone ?? "").replace(/\D/g, ""));
  const [affiliation, setAffiliation] = useState<AffiliationStatus | "">(
    toAffiliation(profile?.education)
  );
  const [school, setSchool] = useState(profile?.school ?? "");
  const [department, setDepartment] = useState(profile?.department ?? "");
  const [worry, setWorry] = useState<string[]>(
    (profile?.worry ?? []).filter((w) => (Q1_OPTIONS as readonly string[]).includes(w))
  );
  const [interest, setInterest] = useState<string[]>(
    (profile?.interest ?? []).filter((i) =>
      (INTEREST_OPTIONS as readonly string[]).includes(i)
    )
  );

  const showSchoolFields = affiliation === "student" || !!school || !!department;

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
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

        <div className="flex flex-col gap-2 pt-1">
          <p className="text-body-sm text-text-tertiary">프로필 저장 기능은 곧 제공돼요.</p>
          {/* TODO(BAC-5): lib/api/auth-api.ts 에 updateProfile() 추가 후 onSave 연동 + disabled 해제 */}
          <Button variant="primary" disabled className="sm:self-start">
            저장
          </Button>
        </div>
      </div>
    </Card>
  );
}
