import { useCallback, useState } from "react";
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
import { saveAutomationFlow } from "../actions.functions";

const initialNodes: Node[] = [
  { id: "trigger", type: "input", position: { x: 250, y: 0 }, data: { label: "Gatilho" } },
  { id: "send-1", position: { x: 250, y: 120 }, data: { label: "Enviar WhatsApp", nodeType: "send", channel: "whatsapp" } },
  { id: "delay-1", position: { x: 250, y: 240 }, data: { label: "Aguardar 3h", nodeType: "delay", delayMinutes: 180 } },
  { id: "cond-1", position: { x: 250, y: 360 }, data: { label: "Se não abriu email", nodeType: "condition", conditionType: "previous_not_opened" } },
  { id: "send-2", position: { x: 250, y: 480 }, data: { label: "Enviar SMS", nodeType: "send", channel: "sms" } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "trigger", target: "send-1" },
  { id: "e2", source: "send-1", target: "delay-1" },
  { id: "e3", source: "delay-1", target: "cond-1" },
  { id: "e4", source: "cond-1", target: "send-2" },
];

interface FlowEditorProps {
  trigger?: string;
  name?: string;
  onSaved?: (sequenceId: string) => void;
}

function parseSendNode(label: string, data: Record<string, unknown>): {
  channel: "email" | "sms" | "whatsapp" | "push";
  delayMinutes: number;
  conditionType?: string;
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
  return { channel: channel as "email" | "sms" | "whatsapp" | "push", delayMinutes: 0 };
}

export function FlowEditor({ trigger = "carrinho_abandonado", name = "Novo fluxo", onSaved }: FlowEditorProps) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [saving, setSaving] = useState(false);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

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
          const match = label.match(/(\d+)\s*h/i);
          pendingDelay += match ? Number(match[1]) * 60 : Number(data.delayMinutes ?? 180);
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
          templateKey: trigger,
          conditionType: pendingCondition,
        });
        pendingDelay = 0;
        pendingCondition = undefined;
      }

      const result = await saveAutomationFlow({
        data: {
          name,
          trigger,
          steps,
          flowDefinition: { nodes, edges },
        },
      });
      onSaved?.(result.sequenceId);
    } finally {
      setSaving(false);
    }
  };

  return (
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
          {saving ? "Salvando…" : "Salvar fluxo"}
        </Button>
      </div>
    </div>
  );
}
