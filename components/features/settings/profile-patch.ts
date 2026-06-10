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
 */
export function buildProfilePatch(
  initial: ProfileFormState,
  current: ProfileFormState
): ProfilePatchPayload {
  const patch: ProfilePatchPayload = {};

  if (current.name !== initial.name) patch.name = current.name;
  if (current.birth !== initial.birth) patch.birth = current.birth;
  if (current.phone !== initial.phone) patch.phone = current.phone;
  if (!sameSet(current.worry, initial.worry)) patch.worry = current.worry;
  if (!sameSet(current.interest, initial.interest)) patch.interest = current.interest;

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
