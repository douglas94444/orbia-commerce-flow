import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { getPublicKbArticle } from "@/modules/sac/public.functions";

export const Route = createFileRoute("/help/$slug")({
  head: () => ({ meta: [{ title: "Ajuda — Orbia" }] }),
  component: HelpArticlePage,
});

function HelpArticlePage() {
  const { slug } = Route.useParams();
  const clientSlug = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("loja") ?? "default";

  const { data: article, isLoading, error } = useQuery({
    queryKey: ["help-article", clientSlug, slug],
    queryFn: () => getPublicKbArticle({ data: { clientSlug, slug } }),
  });

  if (isLoading) return <p className="p-6 text-muted-foreground">Carregando...</p>;
  if (error || !article) return <p className="p-6 text-muted-foreground">Artigo não encontrado.</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <PageIntro eyebrow="Ajuda" title={article.title} description={article.clientName as string} />
      <Panel>
        <div className="prose prose-invert max-w-none text-sm whitespace-pre-wrap">{article.body}</div>
      </Panel>
    </div>
  );
}
