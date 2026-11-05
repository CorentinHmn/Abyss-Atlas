const ID_PATTERN = /^[a-z0-9_-]+$/;

/**
 * MM-600: an id is made of lowercase letters, digits, `_` and `-`.
 */
export function isValidId(id: string): boolean {
  return ID_PATTERN.test(id);
}
