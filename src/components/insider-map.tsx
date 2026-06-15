"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  Position,
  Handle,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Building2, Briefcase, User, UserCog, Loader2 } from "lucide-react";

interface MapNodeData {
  label: string;
  nodeType: "company" | "role" | "contact" | "manager";
  companyId?: string;
  leadId?: string;
  contactId?: string;
  title?: string;
  email?: string;
  relevanceScore?: number;
  isAlive?: boolean | null;
  url?: string;
}

interface InsiderMapProps {
  onSelectNode: (data: MapNodeData) => void;
}

function MapNode({ data }: { data: MapNodeData }) {
  const icons = {
    company: Building2,
    role: Briefcase,
    contact: User,
    manager: UserCog,
  };
  const Icon = icons[data.nodeType];
  const colors = {
    company: "border-accent/50 bg-accent/10 text-accent",
    role: "border-emerald-400/40 bg-emerald-500/10 text-emerald-400",
    contact: "border-border bg-card text-foreground",
    manager: "border-amber-400/40 bg-amber-500/10 text-amber-400",
  };

  return (
    <div className={`px-3 py-2 rounded-lg border text-xs min-w-[120px] max-w-[180px] ${colors[data.nodeType]}`}>
      <Handle type="target" position={Position.Left} className="!bg-muted !w-2 !h-2" />
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span className="font-medium truncate">{data.label}</span>
      </div>
      {data.title && <p className="text-[10px] text-muted mt-0.5 truncate">{data.title}</p>}
      {data.nodeType === "role" && data.relevanceScore != null && (
        <p className="text-[10px] mt-0.5">Score {data.relevanceScore}</p>
      )}
      <Handle type="source" position={Position.Right} className="!bg-muted !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { mapNode: MapNode };

export function InsiderMap({ onSelectNode }: InsiderMapProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leads/map")
      .then((r) => r.json())
      .then((data) => {
        const apiNodes = (data.nodes ?? []) as {
          id: string;
          type: MapNodeData["nodeType"];
          label: string;
          data: Record<string, unknown>;
        }[];
        const apiEdges = (data.edges ?? []) as { id: string; source: string; target: string }[];

        const companies = apiNodes.filter((n) => n.type === "company");
        const flowNodes: Node[] = apiNodes.map((n, i) => {
          let x = 0;
          let y = 0;
          if (n.type === "company") {
            const ci = companies.findIndex((c) => c.id === n.id);
            x = 0;
            y = ci * 280;
          } else if (n.type === "role") {
            const parent = apiEdges.find((e) => e.target === n.id)?.source;
            const ci = companies.findIndex((c) => c.id === parent);
            const roles = apiNodes.filter(
              (rn) => rn.type === "role" && apiEdges.some((e) => e.target === rn.id && e.source === parent)
            );
            const ri = roles.findIndex((r) => r.id === n.id);
            x = 280;
            y = (ci >= 0 ? ci : 0) * 280 + ri * 70;
          } else {
            const parent = apiEdges.find((e) => e.target === n.id && e.source.startsWith("company-"))?.source;
            const ci = companies.findIndex((c) => c.id === parent);
            const contacts = apiNodes.filter(
              (cn) =>
                (cn.type === "contact" || cn.type === "manager") &&
                apiEdges.some((e) => e.target === cn.id && e.source === parent)
            );
            const cti = contacts.findIndex((c) => c.id === n.id);
            x = 560;
            y = (ci >= 0 ? ci : 0) * 280 + cti * 55;
          }

          return {
            id: n.id,
            type: "mapNode",
            position: { x, y: y + (i % 3) * 5 },
            data: {
              label: n.label,
              nodeType: n.type,
              ...n.data,
            } satisfies MapNodeData,
          };
        });

        setNodes(flowNodes);
        setEdges(
          apiEdges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            animated: e.target.startsWith("role-"),
            style: { stroke: "var(--border)", strokeWidth: 1.5 },
          }))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectNode(node.data as unknown as MapNodeData);
    },
    [onSelectNode]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[min(520px,60vh)]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-16">
        No map data yet. Scan openings and enrich companies to build the insider map.
      </p>
    );
  }

  return (
    <div className="h-[min(520px,60vh)] rounded-xl border border-border overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} />
        <Controls showInteractive={false} />
        <MiniMap zoomable pannable className="!bg-card !border-border" />
      </ReactFlow>
    </div>
  );
}

export type { MapNodeData };
