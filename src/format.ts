export function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

export function formatInt(n: number): string {
  const sign = n < 0 ? "-" : "";
  const digits = Math.abs(Math.round(n)).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function rp(n: number): string {
  return `Rp${formatInt(n)}`;
}

export function maskName(name: string, wa: string): string {
  const first = name.trim().split(/\s+/)[0] || "Member";
  const last2 = wa.replace(/\D/g, "").slice(-2).padStart(2, "0");
  return `${first} ****${last2}`;
}

export function maskWa(canonical: string): string {
  const local = canonical.startsWith("62") ? `0${canonical.slice(2)}` : canonical;
  if (local.length < 8) return local;
  return `${local.slice(0, 4)}-xxxx-${local.slice(-4)}`;
}

export function prettyWa(canonical: string): string {
  const local = canonical.startsWith("62") ? `0${canonical.slice(2)}` : canonical;
  return local.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function safeNext(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("\n")) return fallback;
  return raw;
}

export function httpsUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function clip(raw: string, max: number): string {
  const t = raw.trim().replace(/\s+/g, " ");
  return t.length > max ? t.slice(0, max) : t;
}
