import type { FieldValidationError } from '@/types'

/** Field name → error message map for inline display on form inputs. */
export type FieldErrors = Record<string, string>

/**
 * Parse an Axios error response and split it into:
 *  - `fieldErrors`  — per-field messages for inline TextField display
 *  - `message`      — general message for snackbar / alert
 */
export function parseApiError(err: unknown): { fieldErrors: FieldErrors; message: string } {
  const data = (err as any)?.response?.data
  const fieldErrors: FieldErrors = {}

  if (data?.validationErrors?.length) {
    for (const ve of data.validationErrors as FieldValidationError[]) {
      fieldErrors[ve.field] = ve.message
    }
  }

  const message = data?.message || 'An unexpected error occurred'
  return { fieldErrors, message }
}

/** True when at least one field-level error is present. */
export function hasFieldErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0
}

/** Clear a single field from the errors map (call on field onChange). */
export function clearFieldError(errors: FieldErrors, field: string): FieldErrors {
  if (!errors[field]) return errors
  const next = { ...errors }
  delete next[field]
  return next
}
