"use client";

import { isEmptySection, type PersonalInfo } from "@/types/resume";

interface Props {
  data: PersonalInfo;
}

export function PreviewPersonalInfo({ data }: Props) {
  if (isEmptySection(data as unknown as Record<string, unknown>)) return null;

  const contactLine = [data.이메일, data.전화번호, data.주소]
    .filter((v) => v && v.trim())
    .join("  ·  ");

  const links = (data.링크 ?? []).filter((l) => l?.url?.trim());

  return (
    <section className="resume-section mb-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          {data.이름 && (
            <h1 className="text-heading-2 text-text-primary">{data.이름}</h1>
          )}
          {data.영문명 && (
            <p className="text-body-sm text-text-secondary mt-0.5">
              {data.영문명}
            </p>
          )}
        </div>
        {data.생년월일 && (
          <p className="text-caption text-text-secondary">
            생년월일 {data.생년월일}
          </p>
        )}
      </div>
      {(contactLine || links.length > 0) && (
        <div className="mt-3 text-caption text-text-secondary space-y-0.5">
          {contactLine && <p>{contactLine}</p>}
          {links.length > 0 && (
            <p className="break-all">
              {links.map((l, i) => (
                <span key={i}>
                  {i > 0 && <span className="mx-1.5">·</span>}
                  {l.label ? `${l.label}: ` : ""}
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {l.url}
                  </a>
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
