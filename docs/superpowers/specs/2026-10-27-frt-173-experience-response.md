# FRT-173 Experience read response validation

Authorized scope: validate getExperiences/getExperience against existing backend ExperienceResponseData/ExperiencesResponseData; reject malformed data with ApiError(500), preserve valid original objects and unknown fields/types/content. No migrations or mutation changes.

Require record data, list contents array and nonnegative safe integer count; each experience requires nonempty string id/user_id/type, string created_at/updated_at (including empty strings for the existing date-display fallback), importance null or finite integer, and record content. Do not parse dates/UUIDs, enumerate types, constrain importance range, equate count with array length, or inspect content keys. Preserve demo delegation and transport errors.

Existing hooks catch errors; malformed responses will now expose clear Korean errors rather than corrupted state. Treat this as UI error-state behavior change and require current PR UI approval before merge.
