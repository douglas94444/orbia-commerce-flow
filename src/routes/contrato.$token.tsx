import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/format";
import { PLAN_LABELS } from "@/shared/constants/plans";
import { usePublicContract, useSignContract } from "@/modules/sales/hooks/use-sales";

export const Route = createFileRoute("/contrato/$token")({
  head: () => ({ meta: [{ title: "Contrato — Orbia" }] }),
  component: ContratoPage,
});

function ContratoPage() {
  const { token } = Route.useParams();
  const { data, isLoading, refetch } = usePublicContract(token);
  const sign = useSignContract();
  const [accepted, setAccepted] = useState(false);
  const [signed, setSigned] = useState(false);

  if (isLoading || !data) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  if (data.status === "signed" || signed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center max-w-md">
          <Check className="h-16 w-16 text-green-400 mx-auto" />
          <h1 className="font-display text-2xl font-bold mt-4">Contrato assinado!</h1>
          <p className="text-muted-foreground mt-2">Bem-vindo à Orbia. Nossa equipe iniciará seu onboarding em breve.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 font-bold">Orbia — Contrato digital</header>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-2xl font-bold">{data.companyName}</h1>
        <p className="text-muted-foreground">Plano {PLAN_LABELS[data.plan as keyof typeof PLAN_LABELS]} — {formatBRL(data.monthlyCents / 100)}/mês</p>

        <div
          className="mt-8 prose prose-invert prose-sm max-w-none rounded-xl border border-border p-6"
          dangerouslySetInnerHTML={{ __html: data.html }}
        />

        <label className="mt-8 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1" />
          <span>Li e aceito os termos do contrato de prestação de serviços Orbia, incluindo política de cancelamento e LGPD.</span>
        </label>

        <Button
          className="mt-6 w-full"
          disabled={!accepted || sign.isPending}
          onClick={async () => {
            await sign.mutateAsync({
              token,
              signerName: data.contactName,
              signerEmail: data.email,
            });
            setSigned(true);
            refetch();
          }}
        >
          {sign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assinar contrato eletronicamente"}
        </Button>
      </div>
    </div>
  );
}
