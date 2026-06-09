export type ProfileRole = "orbia_admin" | "orbia_staff" | "member" | string;

export function isStaffRole(role: ProfileRole | undefined | null): boolean {
  return role === "orbia_admin" || role === "orbia_staff";
}

export function resolveHomePath(role: ProfileRole | undefined | null): string {
  return isStaffRole(role) ? "/overview" : "/portal/overview";
}
