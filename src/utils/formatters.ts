/**
 * Formatting utilities for Smart Pen Academy display values.
 */

/**
 * Formats student grade/class into a clean, human-readable label.
 * E.g.:
 * - "5" -> "Grade 5"
 * - "5th" -> "Grade 5th"
 * - "Grade 5" -> "Grade 5"
 * - "Class 4" -> "Class 4"
 * - "Std 6" -> "Std 6"
 * - "KG" -> "Grade KG"
 * - "" or undefined -> ""
 */
export function formatGradeClass(grade?: string | null): string {
  if (!grade) return '';
  const trimmed = String(grade).trim();
  if (!trimmed) return '';

  // If already prefixed with Grade, Class, Std, Standard, etc.
  if (/^(grade|class|std|standard)\b/i.test(trimmed)) {
    return trimmed;
  }

  return `Grade ${trimmed}`;
}

/**
 * Formats dominant handwriting hand to full descriptive label.
 * E.g.:
 * - "Right" -> "Right-handed"
 * - "Left" -> "Left-handed"
 * - "Right-handed" -> "Right-handed"
 * - "Left-handed" -> "Left-handed"
 * - undefined or "" -> "Right-handed" (standard default)
 */
export function formatDominantHand(hand?: string | null): string {
  if (!hand || !String(hand).trim()) {
    return 'Right-handed';
  }
  const clean = String(hand).trim();

  // If it already ends with handed (with or without hyphen/space)
  if (/handed$/i.test(clean)) {
    const prefix = clean.replace(/[\s-]+handed$/i, '');
    const capitalized = prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase();
    return `${capitalized}-handed`;
  }

  const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  return `${capitalized}-handed`;
}
