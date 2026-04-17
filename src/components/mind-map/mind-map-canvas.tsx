"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { MindMapNode, type MindMapNodeData } from "./mind-map-node";

type MindMapInput = {
  nodes: Array<{
    id: string;
    label: string;
    description: string;
    level: number;
    color: string;
    parentId: string | null;
  }>;
  edges: Array<{ source: string; target: string }>;
};

const nodeTypes = { mindMapNode: MindMapNode };

const getLayoutedElements = (
  inputNodes: MindMapInput["nodes"],
  inputEdges: MindMapInput["edges"]
): { nodes: Node<MindMapNodeData>[]; edges: Edge[] } => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 120 });

  const widths: Record<number, number> = { 0: 240, 1: 200, 2: 160 };
  const heights: Record<number, number> = { 0: 90, 1: 80, 2: 65 };

  for (const node of inputNodes) {
    g.setNode(node.id, {
      width: widths[node.level] ?? 160,
      height: heights[node.level] ?? 65,
    });
  }

  for (const edge of inputEdges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const nodes: Node<MindMapNodeData>[] = inputNodes.map((node) => {
    const pos = g.node(node.id);
    return {
      id: node.id,
      type: "mindMapNode",
      position: { x: pos.x - (widths[node.level] ?? 160) / 2, y: pos.y },
      data: {
        label: node.label,
        description: node.description,
        level: node.level,
        color: node.color,
      },
    };
  });

  const edges: Edge[] = inputEdges.map((edge, i) => {
    const sourceNode = inputNodes.find((n) => n.id === edge.source);
    const targetNode = inputNodes.find((n) => n.id === edge.target);
    return {
      id: `e-${i}`,
      source: edge.source,
      target: edge.target,
      type: "default",
      style: {
        stroke: targetNode?.color ?? sourceNode?.color ?? "#7c3aed",
        strokeWidth: 2,
        opacity: 0.6,
      },
      animated: false,
    };
  });

  return { nodes, edges };
};

export const MindMapCanvas = ({
  data,
}: {
  data: MindMapInput;
}): React.ReactNode => {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(data.nodes, data.edges),
    [data]
  );

  const [nodes, , onNodesChange] = useNodesState(layoutedNodes);
  const [edges, , onEdgesChange] = useEdgesState(layoutedEdges);

  return (
    <div className="h-[500px] rounded-2xl overflow-hidden" style={{ border: "1px solid var(--fm-glass-border)" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ background: "var(--fm-bg)" }}
      >
        <Background color="var(--fm-surface-border)" gap={20} size={1} />
        <Controls
          style={{
            background: "var(--fm-glass-bg)",
            border: "1px solid var(--fm-glass-border)",
            borderRadius: 12,
          }}
        />
        <MiniMap
          nodeColor={(node) => (node.data as MindMapNodeData)?.color ?? "#7c3aed"}
          maskColor="var(--fm-bg)"
          style={{
            background: "var(--fm-surface)",
            border: "1px solid var(--fm-glass-border)",
            borderRadius: 12,
          }}
        />
      </ReactFlow>
    </div>
  );
};
