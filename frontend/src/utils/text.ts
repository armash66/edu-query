/**
 * Text formatting utilities for EduQuery Monochrome Glass UI.
 */

const PRESERVE_UPPERCASE = new Set([
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'AI', 'ML', 'IT', 'CS', 'EXTC', 'AIDS', 'AIML',
  'ESE', 'ISA', 'MSE', 'TW', 'PR', 'OR', 'TOT', 'TOT1', 'TOT2'
])

/**
 * Format all-caps student names or labels into clean Title Case for readability.
 * E.g., "PATEL ATHARV DEEPAK USHA" -> "Patel Atharv Deepak Usha".
 * Preserves uppercase acronyms and roman numerals.
 */
export function toTitleCase(input: string | null | undefined): string {
  if (!input) return ''
  const trimmed = input.trim()
  if (!trimmed) return ''

  return trimmed
    .split(/\s+/)
    .map((word) => {
      const upper = word.toUpperCase()
      if (PRESERVE_UPPERCASE.has(upper)) {
        return upper
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}
