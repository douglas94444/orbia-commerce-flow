import { useQuery } from "@tanstack/react-query";
import { getCurrentClient } from "../actions.functions";

export const CURRENT_CLIENT_KEY = ["current-client"] as const;

export function useCurrentClient() {
  return useQuery({
    queryKey: CURRENT_CLIENT_KEY,
    queryFn: () => getCurrentClient(),
    staleTime: 60_000,
  });
}
