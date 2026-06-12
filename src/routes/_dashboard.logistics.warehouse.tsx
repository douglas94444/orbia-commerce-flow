import { createFileRoute, Link } from "@tanstack/react-router";
import { PageIntro, Panel } from "@/components/dashboard/panel";
import {
  useWarehouseLocations,
  useStockMovements,
  useAdjustStock,
  useUpsertWarehouseLocation,
  useLocationStock,
  useExpiringLots,
  useWarehouses,
  useUpsertWarehouse,
  useProductLots,
  useUpsertProductLot,
  useDeleteProductLot,
} from "@/modules/logistics/hooks/use-fulfillly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_dashboard/logistics/warehouse")({
  head: () => ({ meta: [{ title: "Armazém — Fulfillly" }] }),
  component: WarehousePage,
});

function WarehousePage() {
  const { data: locations = [], isLoading } = useWarehouseLocations();
  const [skuFilter, setSkuFilter] = useState("");
  const { data: movements = [] } = useStockMovements(skuFilter || undefined);
  const { data: locationStock = [] } = useLocationStock();
  const { data: expiringLots = [] } = useExpiringLots();
  const adjust = useAdjustStock();
  const upsertLocation = useUpsertWarehouseLocation();
  const { data: warehouses = [] } = useWarehouses();
  const upsertWarehouse = useUpsertWarehouse();
  const { data: allLots = [] } = useProductLots();
  const upsertLot = useUpsertProductLot();
  const deleteLot = useDeleteProductLot();
  const [whName, setWhName] = useState("");
  const [whCode, setWhCode] = useState("");
  const [lotSku, setLotSku] = useState("");
  const [lotCode, setLotCode] = useState("");
  const [lotExpires, setLotExpires] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [sku, setSku] = useState("");
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState("");
  const [locForm, setLocForm] = useState({
    aisle: "",
    shelf: "",
    level: "1",
    binCode: "",
    routeOrder: "0",
  });

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Fulfillly WMS"
        title="Armazém e movimentações"
        description="Endereçamento digital, ajustes com justificativa e histórico de movimentações."
      />
      <div className="flex flex-wrap gap-2">
        <Link to="/logistics/inventory">
          <Button variant="outline" size="sm">Inventário</Button>
        </Link>
        <Link to="/logistics/quarantine">
          <Button variant="outline" size="sm">Quarentena</Button>
        </Link>
      </div>

      <Panel title="Galpões" subtitle="Multi-galpão por lojista">
        {warehouses.length > 0 && (
          <ul className="mb-4 space-y-1 text-sm">
            {warehouses.map((w) => (
              <li key={w.id} className="font-mono text-xs text-muted-foreground">
                {w.code} — {w.name}
                {w.isDefault ? " (padrão)" : ""}
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Nome do galpão" value={whName} onChange={(e) => setWhName(e.target.value)} />
          <Input placeholder="Código (ex. SP01)" value={whCode} onChange={(e) => setWhCode(e.target.value)} />
        </div>
        <Button
          className="mt-3"
          size="sm"
          disabled={!whName || !whCode || upsertWarehouse.isPending}
          onClick={() => upsertWarehouse.mutate({ name: whName, code: whCode.toUpperCase() })}
        >
          Adicionar galpão
        </Button>
      </Panel>

      <Panel title="Nova posição">
        <div className="grid gap-3 sm:grid-cols-3">
          {warehouses.length > 0 && (
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs text-muted-foreground">Galpão</label>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
              >
                <option value="">Sem galpão vinculado</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Input placeholder="Corredor" value={locForm.aisle} onChange={(e) => setLocForm({ ...locForm, aisle: e.target.value })} />
          <Input placeholder="Prateleira" value={locForm.shelf} onChange={(e) => setLocForm({ ...locForm, shelf: e.target.value })} />
          <Input placeholder="Nível" value={locForm.level} onChange={(e) => setLocForm({ ...locForm, level: e.target.value })} />
          <Input placeholder="Bin code" value={locForm.binCode} onChange={(e) => setLocForm({ ...locForm, binCode: e.target.value })} />
          <Input placeholder="Ordem rota" type="number" value={locForm.routeOrder} onChange={(e) => setLocForm({ ...locForm, routeOrder: e.target.value })} />
          <Button
            onClick={() =>
              upsertLocation.mutate({
                aisle: locForm.aisle,
                shelf: locForm.shelf,
                level: locForm.level,
                binCode: locForm.binCode,
                routeOrder: Number(locForm.routeOrder),
                warehouseId: selectedWarehouseId || null,
              })
            }
            disabled={!locForm.binCode || !locForm.aisle}
          >
            Salvar posição
          </Button>
        </div>
      </Panel>

      <Panel title="Posições do galpão">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : locations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma posição cadastrada</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2">Bin</th>
                  <th className="pb-2">Corredor</th>
                  <th className="pb-2">Prateleira</th>
                  <th className="pb-2">Nível</th>
                  <th className="pb-2">Rota</th>
                  <th className="pb-2">Galpão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {locations.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 font-mono">{l.binCode}</td>
                    <td className="py-2">{l.aisle}</td>
                    <td className="py-2">{l.shelf}</td>
                    <td className="py-2">{l.level}</td>
                    <td className="py-2 font-mono">{l.routeOrder}</td>
                    <td className="py-2 font-mono text-xs">
                      {warehouses.find((w) => w.id === l.warehouseId)?.code ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Estoque por posição">
        {locationStock.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem estoque endereçado</p>
        ) : (
          <div className="overflow-x-auto text-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2">Bin</th>
                  <th className="pb-2">SKU</th>
                  <th className="pb-2">Qtd</th>
                  <th className="pb-2">Lote</th>
                  <th className="pb-2">Validade</th>
                </tr>
              </thead>
              <tbody>
                {locationStock.map((row) => (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="py-1 font-mono">{row.binCode}</td>
                    <td className="py-1 font-mono">{row.sku}</td>
                    <td className="py-1 font-mono">{row.qty}</td>
                    <td className="py-1">{row.lotCode ?? "—"}</td>
                    <td className="py-1">{row.expiresAt ? new Date(row.expiresAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Gestão de lotes">
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <Input placeholder="SKU" value={lotSku} onChange={(e) => setLotSku(e.target.value)} />
          <Input placeholder="Código do lote" value={lotCode} onChange={(e) => setLotCode(e.target.value)} />
          <Input type="date" value={lotExpires} onChange={(e) => setLotExpires(e.target.value)} />
          <Button
            disabled={!lotSku || !lotCode || upsertLot.isPending}
            onClick={() =>
              upsertLot.mutate({
                sku: lotSku,
                lotCode,
                expiresAt: lotExpires || null,
              })
            }
          >
            Salvar lote
          </Button>
        </div>
        {allLots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum lote cadastrado.</p>
        ) : (
          <div className="overflow-x-auto text-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2">SKU</th>
                  <th className="pb-2">Lote</th>
                  <th className="pb-2">Validade</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {allLots.map((lot) => (
                  <tr key={lot.id} className="border-b border-border/50">
                    <td className="py-1 font-mono">{lot.sku}</td>
                    <td className="py-1">{lot.lotCode}</td>
                    <td className="py-1">
                      {lot.expiresAt
                        ? new Date(lot.expiresAt).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="py-1 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteLot.mutate(lot.id)}
                        disabled={deleteLot.isPending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {expiringLots.length > 0 && (
        <Panel title="Lotes a vencer em 30 dias">
          <div className="space-y-1 text-sm">
            {expiringLots.map((lot) => (
              <div key={lot.id} className="flex justify-between border-b border-border/50 py-1">
                <span className="font-mono">{lot.sku}</span>
                <span>{lot.lotCode}</span>
                <span className="text-warning">{lot.daysUntilExpiry}d</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title="Ajuste manual de estoque">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
          <Input type="number" placeholder="Delta (+/-)" value={delta} onChange={(e) => setDelta(Number(e.target.value))} />
          <Input className="sm:col-span-2" placeholder="Justificativa (obrigatória)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button onClick={() => adjust.mutate({ sku, delta, reason })} disabled={!sku || !reason || adjust.isPending}>
            Aplicar ajuste
          </Button>
        </div>
      </Panel>

      <Panel title="Histórico de movimentações">
        <Input
          className="mb-3 max-w-xs"
          placeholder="Filtrar por SKU"
          value={skuFilter}
          onChange={(e) => setSkuFilter(e.target.value)}
        />
        <div className="max-h-64 overflow-y-auto space-y-1 text-sm">
          {movements.map((m) => (
            <div key={m.id} className="flex justify-between border-b border-border/50 py-1">
              <span className="font-mono">{m.sku}</span>
              <span className="text-muted-foreground">{m.movement_type}</span>
              <span className="font-mono">{m.qty}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
