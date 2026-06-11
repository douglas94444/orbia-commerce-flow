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
  { id: "send-1", position: { x: 250, y: 120 }, data: { label: "Enviar WhatsApp" } },
  { id: "delay-1", position: { x: 250, y: 240 }, data: { label: "Aguardar 3h" } },
  { id: "send-2", position: { x: 250, y: 360 }, data: { label: "Enviar SMS" } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "trigger", target: "send-1" },
  { id: "e2", source: "send-1", target: "delay-1" },
  { id: "e3", source: "delay-1", target: "send-2" },
];

interface FlowEditorProps {
  trigger?: string;
  name?: string;
  onSaved?: (sequenceId: string) => void;
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
      const steps = nodes
        .filter((n) => n.id !== "trigger" && !String(n.data?.label ?? "").toLowerCase().includes("aguardar"))
        .map((n) => {
          const label = String(n.data?.label ?? "").toLowerCase();
          const channel = label.includes("sms")
            ? "sms"
            : label.includes("email")
              ? "email"
              : label.includes("push")
                ? "push"
                : "whatsapp";
          return {
            channel: channel as "email" | "sms" | "whatsapp" | "push",
            delayMinutes: 0,
            templateKey: trigger,
          };
        });

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
    <div className="h-[480px] rounded-xl border border-border overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
      <div className="border-t border-border bg-muted/20 p-3 flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando…" : "Salvar fluxo"}
        </Button>
      </div>
    </div>
  );
}
