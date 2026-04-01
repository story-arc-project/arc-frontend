export interface TemplateField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'period' | 'select'
  required?: boolean
  options?: string[]
  placeholder?: string
}

export interface Template {
  id: string
  user_id: string
  label: string
  field_schema: TemplateField[]
  is_system?: boolean
}

export interface RawTextField {
  key: string
  label: string
  value: string
}

export interface Experience {
  id: string
  user_id: string
  templates_id: string
  raw_text: RawTextField[]
  created_at: string
  updated_at: string
}

/** Frontend-only: Experience with folder assignment (DB TBD) */
export interface ExperienceWithFolder extends Experience {
  folderId: string
}

/** Folder — frontend mock only, DB not yet designed */
export interface Folder {
  id: string
  name: string
  isSystem: boolean
}

export type CustomFieldType = 'text' | 'textarea' | 'date' | 'file'

export interface CustomField {
  id: string
  key: string
  label: string
  value: string
  type: CustomFieldType
}
