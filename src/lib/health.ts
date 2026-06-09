export function healthStatus(score: number): "saudavel" | "atencao" | "risco" {
  if (score >= 80) return "saudavel";
  if (score >= 50) return "atencao";
  return "risco";
}
