import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAutomationFlow } from "../actions.functions";
import { getAutomationFlow } from "../actions.functions";

const TRIGGERS = [
  "carrinho_abandonado",
  "pedido_entregue",
  "pedido_despachado",
  "nfe_autorizada",
  "reativacao_30d",
  "reativacao_jornada",
  "reativacao_60d",
  "reativacao_90d",
  "aniversario",
  "pos_entrega_7d",
  "estoque_favorito",
] as const;

function buildNodesFromSteps(
  trigger: string,
  steps: Array<{ channel: string; delay_minutes: number; template_key: string; condition_type?: string | null }>,
  flowDefinition?: Record<string, unknown>,
): { nodes: Node[]; edges: Edge[] } {
  const savedNodes = flowDefinition?.nodes as Node[] | undefined;
  const savedEdges = flowDefinition?.edges as Edge[] | undefined;
  if (savedNodes?.length && savedEdges?.length) {
    return { nodes: savedNodes, edges: savedEdges };
  }

  const nodes: Node[] = [
    { id: "trigger", type: "input", position: { x: 250, y: 0 }, data: { label: `Gatilho: ${trigger}` } },
  ];
  const edges: Edge[] = [];
  let y = 120;
  let prevId = "trigger";

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.delay_minutes > 0) {
      const delayId = `delay-${i}`;
      nodes.push({
        id: delayId,
        position: { x: 250, y },
        data: { label: `Aguardar ${s.delay_minutes}min`, nodeType: "delay", delayMinutes: s.delay_minutes },
      });
      edges.push({ id: `e-${prevId}-${delayId}`, source: prevId, target: delayId });
      prevId = delayId;
      y += 120;
    }
    if (s.condition_type) {
      const condId = `cond-${i}`;
      nodes.push({
        id: condId,
        position: { x: 250, y },
        data: { label: s.condition_type, nodeType: "condition", conditionType: s.condition_type },
      });
      edges.push({ id: `e-${prevId}-${condId}`, source: prevId, target: condId });
      prevId = condId;
      y += 120;
    }
    const sendId = `send-${i}`;
    const channelLabel = s.channel.charAt(0).toUpperCase() + s.channel.slice(1);
    nodes.push({
      id: sendId,
      position: { x: 250, y },
      data: { label: `Enviar ${channelLabel}`, nodeType: "send", channel: s.channel, templateKey: s.template_key },
    });
    edges.push({ id: `e-${prevId}-${sendId}`, source: prevId, target: sendId });
    prevId = sendId;
    y += 120;
  }

  return { nodes, edges };
}

interface FlowEditorProps {
  sequenceId?: string;
  trigger?: string;
  name?: string;
  onSaved?: (sequenceId: string) => void;
}

function parseSendNode(label: string, data: Record<string, unknown>): {
  channel: "email" | "sms" | "whatsapp" | "push";
  delayMinutes: number;
  conditionType?: string;
  templateKey?: string;
} {
  if (data.nodeType === "delay") {
    return { channel: "email", delayMinutes: Number(data.delayMinutes ?? 0) };
  }
  if (data.nodeType === "condition") {
    return {
      channel: "email",
      delayMinutes: 0,
      conditionType: String(data.conditionType ?? ""),
    };
  }
  const channel = (data.channel as string) ??
    (label.toLowerCase().includes("sms")
      ? "sms"
      : label.toLowerCase().includes("email")
        ? "email"
        : label.toLowerCase().includes("push")
          ? "push"
          : "whatsapp");
  return {
    channel: channel as "email" | "sms" | "whatsapp" | "push",
    delayMinutes: 0,
    templateKey: data.templateKey ? String(data.templateKey) : undefined,
  };
}

export function FlowEditor({ sequenceId, trigger: initialTrigger = "carrinho_abandonado", name: initialName = "Novo fluxo", onSaved }: FlowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!sequenceId);
  const [flowName, setFlowName] = useState(initialName);
  const [trigger, setTrigger] = useState(initialTrigger);
  const [activeSequenceId, setActiveSequenceId] = useState(sequenceId);

  useEffect(() => {
    if (!sequenceId) {
      const { nodes: n, edges: e } = buildNodesFromSteps(trigger, [
        { channel: "email", delay_minutes: 60, template_key: trigger },
        { channel: "whatsapp", delay_minutes: 180, template_key: trigger },
      ]);
      setNodes(n);
      setEdges(e);
      setLoading(false);
      return;
    }

    setLoading(true);
    getAutomationFlow({ data: { sequenceId } })
      .then((data) => {
        setFlowName(data.sequence.name);
        setTrigger(data.sequence.trigger);
        setActiveSequenceId(data.sequence.id);
        const { nodes: n, edges: e } = buildNodesFromSteps(
          data.sequence.trigger,
          data.steps,
          data.sequence.flow_definition as Record<string, unknown>,
        );
        setNodes(n);
        setEdges(e);
      })
      .finally(() => setLoading(false));
  }, [sequenceId, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  const addNode = (type: "send" | "delay" | "condition", channel?: string) => {
    const id = `${type}-${Date.now()}`;
    const y = nodes.length * 100 + 120;
    const labels = {
      send: `Enviar ${channel ?? "WhatsApp"}`,
      delay: "Aguardar 3h",
      condition: "Se não abriu email",
    };
    setNodes((nds) => [
      ...nds,
      {
        id,
        position: { x: 250, y },
        data: {
          label: labels[type],
          nodeType: type,
          channel: channel ?? "whatsapp",
          delayMinutes: 180,
          conditionType: "previous_not_opened",
        },
      },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ordered = nodes.filter((n) => n.id !== "trigger");
      const steps: Array<{
        channel: "email" | "sms" | "whatsapp" | "push";
        delayMinutes: number;
        templateKey: string;
        conditionType?: string;
      }> = [];

      let pendingDelay = 0;
      let pendingCondition: string | undefined;

      for (const n of ordered) {
        const data = (n.data ?? {}) as Record<string, unknown>;
        const label = String(data.label ?? "");

        if (data.nodeType === "delay" || label.toLowerCase().includes("aguardar")) {
          pendingDelay += Number(data.delayMinutes ?? 180);
          continue;
        }

        if (data.nodeType === "condition") {
          pendingCondition = String(data.conditionType ?? "previous_not_opened");
          continue;
        }

        const parsed = parseSendNode(label, data);
        steps.push({
          channel: parsed.channel,
          delayMinutes: pendingDelay,
          templateKey: parsed.templateKey ?? trigger,
          conditionType: pendingCondition,
        });
        pendingDelay = 0;
        pendingCondition = undefined;
      }

      const result = await saveAutomationFlow({
        data: {
          sequenceId: activeSequenceId,
          name: flowName,
          trigger,
          steps,
          flowDefinition: { nodes, edges },
        },
      });
      setActiveSequenceId(result.sequenceId);
      onSaved?.(result.sequenceId);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-[520px] animate-pulse rounded-xl bg-muted/40" />;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-xs">Nome do fluxo</Label>
          <Input value={flowName} onChange={(e) => setFlowName(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Gatilho</Label>
          <select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {TRIGGERS.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => addNode("send", "email")}>+ Email</Button>
          <Button size="sm" variant="outline" onClick={() => addNode("send", "whatsapp")}>+ WA</Button>
          <Button size="sm" variant="outline" onClick={() => addNode("delay")}>+ Delay</Button>
          <Button size="sm" variant="outline" onClick={() => addNode("condition")}>+ Condição</Button>
        </div>
      </div>
      <div className="h-[520px] rounded-xl border border-border overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          colorMode="dark"
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
        <div className="border-t border-border bg-muted/20 p-3 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando…" : activeSequenceId ? "Atualizar fluxo" : "Salvar fluxo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
