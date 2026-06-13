import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import {
  useWmsProducts,
  useUpsertWmsProduct,
  useUploadProductPhoto,
  useStockAlerts,
  useProductVariations,
  useRecentStockSyncs,
} from "@/modules/logistics/hooks/use-fulfillly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
type WmsProduct = {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  minStockUnits: number;
  ncm: string | null;
  photoUrl: string | null;
  parentProductId: string | null;
};

export const Route = createFileRoute("/_dashboard/logistics/products")({
  head: () => ({ meta: [{ title: "Produtos WMS — Fulfillly" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const { data: products = [], isLoading } = useWmsProducts();
  const { data: alerts = [] } = useStockAlerts();
  const { data: syncs = [] } = useRecentStockSyncs();
  const upsert = useUpsertWmsProduct();
  const uploadPhoto = useUploadProductPhoto();
  const [editing, setEditing] = useState<WmsProduct | null>(null);
  const [form, setForm] = useState({
    barcode: "",
    lengthMm: "",
    widthMm: "",
    heightMm: "",
    minStockUnits: "0",
    parentProductId: "",
  });
  const { data: variations = [] } = useProductVariations(editing?.id ?? null);

  const openEdit = (p: WmsProduct) => {
    setEditing(p);
    setForm({
      barcode: p.barcode ?? "",
      lengthMm: p.lengthMm?.toString() ?? "",
      widthMm: p.widthMm?.toString() ?? "",
      heightMm: p.heightMm?.toString() ?? "",
      minStockUnits: String(p.minStockUnits),
      parentProductId: p.parentProductId ?? "",
    });
  };

  const save = () => {
    if (!editing) return;
    upsert.mutate({
      sku: editing.sku,
      barcode: form.barcode || null,
      ncm: editing.ncm,
      lengthMm: form.lengthMm ? Number(form.lengthMm) : null,
      widthMm: form.widthMm ? Number(form.widthMm) : null,
      heightMm: form.heightMm ? Number(form.heightMm) : null,
      minStockUnits: Number(form.minStockUnits),
      parentProductId: form.parentProductId || null,
    });
    setEditing(null);
  };

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editing || !e.target.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = () => {
      uploadPhoto.mutate({ sku: editing.sku, dataUrl: reader.result as string });
    };
    reader.readAsDataURL(e.target.files[0]);
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly WMS"
        title="Produtos e dimensões"
        description="SKU, código de barras, foto e estoque mínimo. NCM e CFOP ficam no catálogo fiscal."
        action={
          <Link to="/catalog/fiscal">
            <Button size="sm" variant="outline">Configurar NCM / CFOP</Button>
          </Link>
        }
      />

      {alerts.length > 0 && (
        <Panel title="SKUs em alerta">
          <div className="flex flex-wrap gap-2">
            {alerts.map((a) => (
              <span
                key={a.sku}
                className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-mono"
              >
                {a.sku}: {a.available}/{a.minStockUnits}
              </span>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Catálogo WMS">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum produto cadastrado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2">Foto</th>
                  <th className="pb-2">SKU</th>
                  <th className="pb-2">Nome</th>
                  <th className="pb-2">Barcode</th>
                  <th className="pb-2">NCM</th>
                  <th className="pb-2">Dimensões (mm)</th>
                  <th className="pb-2">Estoque mín.</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2">
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt="" className="size-8 rounded object-cover" />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 font-mono">{p.sku}</td>
                    <td className="py-2">{p.name}</td>
                    <td className="py-2 font-mono text-muted-foreground">{p.barcode ?? "—"}</td>
                    <td className="py-2 font-mono text-muted-foreground">
                      {p.ncm ? (
                        <Link to="/catalog/fiscal" className="text-primary hover:underline">{p.ncm}</Link>
                      ) : (
                        <Link to="/catalog/fiscal" className="text-muted-foreground hover:underline">Configurar</Link>
                      )}
                    </td>
                    <td className="py-2 font-mono text-muted-foreground">
                      {p.lengthMm && p.widthMm && p.heightMm
                        ? `${p.lengthMm}×${p.widthMm}×${p.heightMm}`
                        : "—"}
                    </td>
                    <td className="py-2 font-mono">{p.minStockUnits}</td>
                    <td className="py-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {syncs.length > 0 && (
        <Panel title="Últimos syncs de estoque">
          <div className="space-y-1 text-sm">
            {syncs.slice(0, 10).map((s: { id: string; sku: string; status: string; created_at: string }) => (
              <div key={s.id} className="flex justify-between border-b border-border/50 py-1">
                <span className="font-mono">{s.sku}</span>
                <span>{s.status}</span>
                <span className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {editing && (
        <Panel title={`Editar ${editing.sku}`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
            <p className="text-sm text-muted-foreground sm:col-span-2">
              NCM: {editing.ncm ?? "—"} —{' '}
              <Link to="/catalog/fiscal" className="text-primary hover:underline">editar no catálogo fiscal</Link>
            </p>
            <Input placeholder="Comprimento mm" value={form.lengthMm} onChange={(e) => setForm({ ...form, lengthMm: e.target.value })} />
            <Input placeholder="Largura mm" value={form.widthMm} onChange={(e) => setForm({ ...form, widthMm: e.target.value })} />
            <Input placeholder="Altura mm" value={form.heightMm} onChange={(e) => setForm({ ...form, heightMm: e.target.value })} />
            <Input placeholder="Estoque mínimo" type="number" value={form.minStockUnits} onChange={(e) => setForm({ ...form, minStockUnits: e.target.value })} />
            <Input placeholder="ID produto pai (variação)" value={form.parentProductId} onChange={(e) => setForm({ ...form, parentProductId: e.target.value })} />
            <Input type="file" accept="image/*" onChange={onPhoto} />
          </div>
          {variations.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              Variações: {variations.map((v) => v.sku).join(", ")}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Button onClick={save} disabled={upsert.isPending}>Salvar</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
