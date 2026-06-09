/** Demo mode — populates UI with seeded demo data for sales demos. */
export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === "true";
}
