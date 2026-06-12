import { useQuery } from "@tanstack/react-query";
import { checkOpsAccessFn } from "@/modules/logistics/fulfillly.actions.functions";

export function useOpsAccess() {
  return useQuery({
    queryKey: ["ops-access"],
    queryFn: () => checkOpsAccessFn(),
    staleTime: 60_000,
  });
}
