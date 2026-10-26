import { useState, type ComponentType } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityListEditor } from "./ActivityListEditor";
import { AwardListEditor } from "./AwardListEditor";
import { CareerListEditor } from "./CareerListEditor";
import { CertificationListEditor } from "./CertificationListEditor";
import { ClubListEditor } from "./ClubListEditor";
import { EducationListEditor } from "./EducationListEditor";
import { LanguageListEditor } from "./LanguageListEditor";
import { ProjectListEditor } from "./ProjectListEditor";

type Item = { id: number } & Record<string, unknown>;
type EditorType = ComponentType<{ value: Item[]; onChange: (next: Item[]) => void }>;
const cases = [
  { name: "Activity", Editor: ActivityListEditor as unknown as EditorType, field: "활동명", add: "대외활동 추가", defaults: {
        id: 1,
        활동명: null,
        기관: null,
        기간_시작: null,
        기간_종료: null,
        기간_원문: null,
        진행중: false,
        역할: null,
        활동내용: [],
        성과: [],
  } },
  { name: "Award", Editor: AwardListEditor as unknown as EditorType, field: "수상명", add: "수상 추가", defaults: {
        id: 1,
        수상명: null,
        수여기관: null,
        수상년월: null,
        내용: null,
  } },
  { name: "Career", Editor: CareerListEditor as unknown as EditorType, field: "회사명", add: "경력 추가", defaults: {
        id: 1,
        회사명: null,
        부서: null,
        직위: null,
        고용형태: null,
        입사년월: null,
        퇴사년월: null,
        재직중: false,
        담당업무: [],
        성과: [],
  } },
  { name: "Certification", Editor: CertificationListEditor as unknown as EditorType, field: "자격증명", add: "자격증 추가", defaults: {
        id: 1,
        자격증명: null,
        발급기관: null,
        취득년월: null,
        자격구분: null,
  } },
  { name: "Club", Editor: ClubListEditor as unknown as EditorType, field: "단체명", add: "동아리·학회 추가", defaults: {
        id: 1,
        단체명: null,
        구분: null,
        기간_원문: null,
        역할: null,
        활동내용: [],
  } },
  { name: "Education", Editor: EducationListEditor as unknown as EditorType, field: "학교명", add: "학력 추가", defaults: {
        id: 1,
        학교명: null,
        학과: null,
        전공구분: null,
        학위: null,
        입학년월: null,
        졸업년월: null,
        졸업구분: null,
        학점: null,
        만점: null,
        비고: null,
  } },
  { name: "Language", Editor: LanguageListEditor as unknown as EditorType, field: "언어", add: "어학 추가", defaults: {
        id: 1,
        언어: null,
        시험명: null,
        점수등급: null,
        취득년월: null,
  } },
  { name: "Project", Editor: ProjectListEditor as unknown as EditorType, field: "프로젝트명", add: "프로젝트 추가", defaults: {
        id: 1,
        프로젝트명: null,
        소속기관: null,
        기간_시작: null,
        기간_종료: null,
        기간_원문: null,
        역할: null,
        사용기술: [],
        내용: [],
        성과: [],
  } },
];
afterEach(cleanup);

function Harness({ Editor, initial }: { Editor: EditorType; initial: Item[] }) {
  const [value, setValue] = useState(initial);
  return <><Editor value={value} onChange={setValue} /><output data-testid="value">{JSON.stringify(value)}</output></>;
}
const readValue = (): Item[] => JSON.parse(screen.getByTestId("value").textContent!);

describe.each(cases)("$name controlled list editor", ({ Editor, field, add, defaults }) => {
  it("retains exact defaults, saved fields, row order and focus through add/edit/remove", async () => {
    const user = userEvent.setup();
    const initial: Item = { ...defaults, id: 42, [field]: "saved", unknownField: { kept: true } };
    render(<Harness Editor={Editor} initial={[initial]} />);
    expect(readValue()).toEqual([initial]);
    await user.click(screen.getByRole("button", { name: add }));
    let value = readValue();
    expect(value[0]).toEqual(initial);
    expect(value[1]).toEqual({ ...defaults, id: expect.any(Number) });
    expect(value[1].id).toBeLessThan(0);
    const firstAddedId = value[1].id;
    const input = screen.getAllByLabelText(field)[1];
    await user.type(input, "new value");
    expect(screen.getAllByLabelText(field)[1]).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(readValue()[1]).toEqual({ ...defaults, id: firstAddedId, [field]: "new value" });
    await user.clear(input);
    expect(readValue()[1][field]).toBeNull();
    await user.type(input, "retained");
    await user.click(screen.getByRole("button", { name: add }));
    value = readValue();
    expect(value[2]).toEqual({ ...defaults, id: firstAddedId - 1 });
    expect(value[1][field]).toBe("retained");
    await user.click(screen.getAllByRole("button", { name: "삭제" })[0]);
    expect(readValue()).toEqual([value[1], value[2]]);
    expect(screen.getAllByLabelText(field)[0]).toBe(input);
    await user.click(input);
    await user.type(input, " after delete");
    expect(document.activeElement).toBe(input);
    expect(readValue()[0]).toEqual({ ...value[1], [field]: "retained after delete" });
  });
});
