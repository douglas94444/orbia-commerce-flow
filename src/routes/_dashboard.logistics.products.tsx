import { createFileRoute } from "@tanstack/react-router";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import { useWmsProducts } from "@/modules/logistics/hooks/use-fulfillly";

export const Route = createFileRoute("/_dashboard/logistics/products")({
  head: () => ({ meta: [{ title: "Produtos WMS — Fulfillly" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const { data: products = [], isLoading } = useWmsProducts();

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly WMS"
        title="Produtos e dimensões"
        description="SKU, código de barras e dimensões para sugestão de embalagem no packing."
      />
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
                  <th className="pb-2">SKU</th>
                  <th className="pb-2">Nome</th>
                  <th className="pb-2">Barcode</th>
                  <th className="pb-2">Dimensões (mm)</th>
                  <th className="pb-2">Estoque mín.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 font-mono">{p.sku}</td>
                    <td className="py-2">{p.name}</td>
                    <td className="py-2 font-mono text-muted-foreground">{p.barcode ?? "—"}</td>
                    <td className="py-2 font-mono text-muted-foreground">
                      {p.lengthMm && p.widthMm && p.heightMm
                        ? `${p.lengthMm}×${p.widthMm}×${p.heightMm}`
                        : "—"}
                    </td>
                    <td className="py-2 font-mono">{p.minStockUnits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
