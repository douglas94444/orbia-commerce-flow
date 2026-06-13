import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSacKnowledge, useUpsertSacKnowledge } from "@/modules/sac/hooks/use-sac";

export const Route = createFileRoute("/_dashboard/sac/knowledge")({
  head: () => ({ meta: [{ title: "Base de Conhecimento — Orbia" }] }),
  component: SacKnowledgePage,
});

function SacKnowledgePage() {
  const { data: articles = [], isLoading } = useSacKnowledge();
  const { mutate: save, isPending } = useUpsertSacKnowledge();
  const [showForm, setShowForm] = useState(false);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const handleSave = () => {
    save(
      { slug, title, body, isPublic, botEnabled: true },
      { onSuccess: () => { setShowForm(false); setSlug(""); setTitle(""); setBody(""); } },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/sac"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <PageIntro eyebrow="Conteúdo" title="Base de Conhecimento" description="Artigos para chatbot e portal público /help." />
        </div>
        <Button onClick={() => setShowForm(!showForm)}><Plus className="h-4 w-4" /> Novo artigo</Button>
      </div>

      {showForm && (
        <Panel className="space-y-3">
          <Input placeholder="Slug (ex: politica-troca)" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Conteúdo" value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Público (/help/{slug || "slug"})
          </label>
          <Button onClick={handleSave} disabled={isPending}>Salvar</Button>
        </Panel>
      )}

      <Panel>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : articles.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum artigo cadastrado.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {articles.map((a) => (
              <div key={a.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{a.title}</p>
                  <p className="text-xs text-muted-foreground">/{a.slug} · {a.view_count} views</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {a.is_public ? "Público" : "Interno"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
