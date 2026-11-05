/** True when this member is on the outlet's staff list, so the kasir must not stamp or redeem them. */
export function staffSelfDeal(staffIds: readonly string[], memberId: string): boolean {
  return staffIds.includes(memberId);
}

export const STAFF_FLAG_REASON = "sendiri";

export function staffFlagDetail(memberName: string): string {
  return `Kasir mencoba kasih stamp atau tukar ke ${memberName}, akun staf outlet ini.`;
}
