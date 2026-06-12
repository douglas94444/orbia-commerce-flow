import { useQuery } from "@tanstack/react-query";
import { getBenchmarkSummary } from "../actions.functions";

export function useBenchmarkSummary() {
  return useQuery({
    queryKey: ["benchmark-summary"],
    queryFn: () => getBenchmarkSummary(),
    staleTime: 120_000,
  });
}
