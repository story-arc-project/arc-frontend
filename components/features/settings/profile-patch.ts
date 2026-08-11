import type { AffiliationStatus } from "@/app/(auth)/constants";
import type { ProfilePatchPayload } from "@/lib/api/auth-api";

/** 프로필 편집 폼의 비교 가능한 상태 스냅샷 */
export interface ProfileFormState {
  name: string;
  birth: string;
  phone: string; // 숫자만 (구분자 없음)
  affiliation: AffiliationStatus | "";
  school: string;
  department: string;
  worry: string[];
  interest: string[];
}

/**
 * 화면이 표시할 수 있는 값(known)과 그럴 수 없는 값(unknown)을 가른다.
 * 표시 필터와 보존 대상은 반드시 같은 술어로 갈라야 한다 — 술어가 어긋나면
 * 어느 값은 양쪽에 다 들어가 중복되고, 어느 값은 어디에도 없어 사라진다.
 */
export function partitionByOptions(
  values: readonly string[],
  options: readonly string[]
): { known: string[]; unknown: string[] } {
  const known: string[] = [];
  const unknown: string[] = [];
  for (const v of values) {
    if (options.includes(v)) known.push(v);
    else unknown.push(v);
  }
  return { known, unknown };
}

/**
 * 옵션 목록에 없어 화면에 그릴 수 없는 값들. 저장 시 다시 합쳐 보내지 않으면
 * PATCH 의 필드 단위 전체 교체로 서버에서 영구 삭제된다(FRT-260).
 */
export interface PreservedOptionValues {
  worry: string[];
  interest: string[];
}

const NO_PRESERVED: PreservedOptionValues = { worry: [], interest: [] };

/** 화면 값 뒤에 보존 값을 잇는다. 순서는 무의미하지만 중복은 허용하지 않는다. */
function mergePreserved(visible: string[], preserved: string[]): string[] {
  if (preserved.length === 0) return visible;
  const seen = new Set(visible);
  return [...visible, ...preserved.filter((v) => !seen.has(v))];
}

/** 순서 무관 집합 비교 (worry/interest는 토글 순서가 의미 없음) */
function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sb = new Set(b);
  return a.every((v) => sb.has(v));
}

/**
 * 초기 스냅샷 대비 변경된 필드만 담은 PATCH 페이로드를 만든다.
 * - 빈 객체 = 변경 없음(저장 비활성 판단에 사용).
 * - affiliation === "" (미선택)은 전송하지 않는다.
 * - school/department는 현재 affiliation === "student"일 때만, 그리고 affiliation이 바뀌었거나
 *   값이 바뀐 경우에만 포함한다 → student가 아닌 값으로 바뀌면 동봉하지 않아 교차검증 400을 피한다.
 * - preserved(옵션 밖 값)는 **dirty 판정에서 제외**하고 실제로 필드를 실을 때만 합친다.
 *   판정에 넣으면 화면에서 아무것도 안 만졌는데 저장 버튼이 켜진다.
 */
export function buildProfilePatch(
  initial: ProfileFormState,
  current: ProfileFormState,
  preserved: PreservedOptionValues = NO_PRESERVED
): ProfilePatchPayload {
  const patch: ProfilePatchPayload = {};

  if (current.name !== initial.name) patch.name = current.name;
  if (current.birth !== initial.birth) patch.birth = current.birth;
  if (current.phone !== initial.phone) patch.phone = current.phone;
  if (!sameSet(current.worry, initial.worry)) {
    patch.worry = mergePreserved(current.worry, preserved.worry);
  }
  if (!sameSet(current.interest, initial.interest)) {
    patch.interest = mergePreserved(current.interest, preserved.interest);
  }

  const affiliationChanged = current.affiliation !== initial.affiliation;
  if (affiliationChanged && current.affiliation !== "") {
    patch.affiliation = current.affiliation;
  }

  if (current.affiliation === "student") {
    if (affiliationChanged || current.school !== initial.school) {
      patch.school = current.school;
    }
    if (affiliationChanged || current.department !== initial.department) {
      patch.department = current.department;
    }
  }

  return patch;
}
