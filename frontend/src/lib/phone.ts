export function normalizeKenyanPhone(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  const normalized = digits.startsWith('0') ? `254${digits.slice(1)}` : digits.startsWith('254') ? digits : `254${digits}`;
  return /^254(?:7|1)\d{8}$/.test(normalized) ? normalized : null;
}

export function isSafaricomPhone(value: string): boolean {
  const normalized = normalizeKenyanPhone(value);
  return normalized !== null && /^254(?:70|71|72|74|79)\d{7}$/.test(normalized);
}

export function displayKenyanPhone(value: string): string {
  const normalized = normalizeKenyanPhone(value);
  return normalized ? `0${normalized.slice(3, 6)} ${normalized.slice(6, 9)} ${normalized.slice(9)}` : value;
}
