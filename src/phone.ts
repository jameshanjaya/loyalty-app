/** Nomor WA Indonesia jadi bentuk 62xxxxxxxxxx. */
export function normalizeWa(input: string): string | null {
  let d = input.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  if (!/^628[1-9]\d{6,10}$/.test(d)) return null;
  return d;
}

export function validPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

export function weakPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true;
  if ("01234567890".includes(pin) || "09876543210".includes(pin)) return true;
  return false;
}

export function validName(name: string): boolean {
  const t = name.trim();
  return t.length >= 2 && t.length <= 40 && /^[\p{L}\p{M} .'-]+$/u.test(t);
}

export function validOutletPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}
