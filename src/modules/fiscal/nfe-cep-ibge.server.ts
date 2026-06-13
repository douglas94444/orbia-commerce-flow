interface ViaCepResponse {
  ibge?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

const ibgeCache = new Map<string, string>();

export async function resolveIbgeByCep(cep: string): Promise<string | null> {
  const digits = cep.replace(/\D/g, "").slice(0, 8);
  if (digits.length !== 8) return null;

  const cached = ibgeCache.get(digits);
  if (cached) return cached;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ViaCepResponse;
    if (data.erro || !data.ibge) return null;
    ibgeCache.set(digits, data.ibge);
    return data.ibge;
  } catch {
    return null;
  }
}
