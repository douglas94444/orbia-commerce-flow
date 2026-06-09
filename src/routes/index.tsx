import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/overview" });
  },
  // Members are redirected to /portal/overview by _dashboard and login gates
});
