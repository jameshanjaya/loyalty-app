export type PhoneChoice = "create" | "link" | "taken";

export function decidePhone(existing: { googleSub: string | null } | null): PhoneChoice {
  if (!existing) return "create";
  if (existing.googleSub) return "taken";
  return "link";
}

export function profileComplete(input: { name: string; wa: string | null; birthday: string | null; joinMethod?: string }): boolean {
  if (!input.name.trim() || !input.wa) return false;
  if (input.joinMethod === "wa" || input.joinMethod === "wa+google") return true;
  return Boolean(input.birthday);
}

/** Pelanggan hanya boleh mengisi tanggal lahir sekali. Owner boleh mengubah. */
export function birthdayEditAllowed(current: string | null, byOwner: boolean): boolean {
  if (byOwner) return true;
  return !current;
}
