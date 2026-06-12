/** Coordenadas aproximadas (lat, lng) para cidades BR comuns em entregas e-commerce */
const CITY_COORDS: Record<string, [number, number]> = {
  "sao paulo|sp": [-23.5505, -46.6333],
  "rio de janeiro|rj": [-22.9068, -43.1729],
  "belo horizonte|mg": [-19.9167, -43.9345],
  "brasilia|df": [-15.7975, -47.8919],
  "curitiba|pr": [-25.4284, -49.2733],
  "porto alegre|rs": [-30.0346, -51.2177],
  "salvador|ba": [-12.9777, -38.5016],
  "fortaleza|ce": [-3.7319, -38.5267],
  "recife|pe": [-8.0476, -34.877],
  "manaus|am": [-3.119, -60.0217],
  "goiania|go": [-16.6869, -49.2648],
  "campinas|sp": [-22.9099, -47.0626],
  "santos|sp": [-23.9608, -46.3336],
  "guarulhos|sp": [-23.4538, -46.5333],
  "niteroi|rj": [-22.8832, -43.1034],
  "florianopolis|sc": [-27.5954, -48.548],
  "vitoria|es": [-20.3155, -40.3128],
  "belem|pa": [-1.4558, -48.4902],
  "natal|rn": [-5.7945, -35.211],
  "joao pessoa|pb": [-7.1195, -34.845],
};

function normalizeCity(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function resolveCityCoords(city: string, state: string | null): [number, number] | null {
  const key = `${normalizeCity(city)}|${(state ?? "").toLowerCase()}`;
  if (CITY_COORDS[key]) return CITY_COORDS[key];

  const cityOnly = normalizeCity(city);
  for (const [k, coords] of Object.entries(CITY_COORDS)) {
    if (k.startsWith(`${cityOnly}|`)) return coords;
  }

  return null;
}
