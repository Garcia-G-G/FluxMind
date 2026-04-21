"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Position,
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

const WIDTHS: Record<number, number> = { 0: 240, 1: 200, 2: 160 };
const HEIGHTS: Record<number, number> = { 0: 90, 1: 80, 2: 65 };

const getLayoutedElements = (
  inputNodes: MindMapInput["nodes"],
  inputEdges: MindMapInput["edges"],
  extraData: (id: string) => Partial<MindMapNodeData>
): { nodes: Node<MindMapNodeData>[]; edges: Edge[] } => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 140, ranksep: 180 });

  for (const node of inputNodes) {
    g.setNode(node.id, {
      width: WIDTHS[node.level] ?? 160,
      height: HEIGHTS[node.level] ?? 65,
    });
  }

  for (const edge of inputEdges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const nodes: Node<MindMapNodeData>[] = inputNodes.map((node) => {
    const pos = g.node(node.id);
    const width = WIDTHS[node.level] ?? 160;
    return {
      id: node.id,
      type: "mindMapNode",
      position: { x: pos.x - width / 2, y: pos.y - (HEIGHTS[node.level] ?? 65) / 2 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        id: node.id,
        label: node.label,
        description: node.description,
        level: node.level,
        color: node.color,
        ...extraData(node.id),
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
      type: "smoothstep",
      style: {
        stroke: targetNode?.color ?? sourceNode?.color ?? "#7c3aed",
        strokeWidth: 1.75,
        opacity: 0.55,
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
  // Track which Level-1 subtopic ids are currently expanded. Default: all collapsed.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // When the incoming data changes (new map generated), reset expansion state.
  useEffect(() => {
    setExpanded(new Set());
  }, [data]);

  const handleToggle = useCallback((id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Compute which node ids have any children (used for showing +/- only when useful).
  const childrenMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const n of data.nodes) {
      if (n.parentId) {
        const arr = map.get(n.parentId) ?? [];
        arr.push(n.id);
        map.set(n.parentId, arr);
      }
    }
    return map;
  }, [data]);

  // Filter nodes: always include root (level 0) and Level-1 subtopics. Level-2+
  // only appears when their Level-1 ancestor is in the expanded set.
  const { filteredNodes, filteredEdges } = useMemo(() => {
    const visibleIds = new Set<string>();
    for (const n of data.nodes) {
      if (n.level <= 1) {
        visibleIds.add(n.id);
      }
    }
    // Walk descendants of every expanded Level-1 node so deeper levels also
    // show up if the LLM ever returns level >= 3.
    const expandDescendants = (id: string): void => {
      const kids = childrenMap.get(id) ?? [];
      for (const k of kids) {
        if (!visibleIds.has(k)) {
          visibleIds.add(k);
          expandDescendants(k);
        }
      }
    };
    for (const id of expanded) {
      expandDescendants(id);
    }

    const filteredNodes = data.nodes.filter((n) => visibleIds.has(n.id));
    const filteredEdges = data.edges.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target)
    );
    return { filteredNodes, filteredEdges };
  }, [data, expanded, childrenMap]);

  const layout = useMemo(
    () =>
      getLayoutedElements(filteredNodes, filteredEdges, (id) => {
        const node = data.nodes.find((n) => n.id === id);
        if (!node || node.level !== 1) return {};
        return {
          hasChildren: (childrenMap.get(id) ?? []).length > 0,
          isExpanded: expanded.has(id),
          onToggle: handleToggle,
        };
      }),
    [filteredNodes, filteredEdges, data, childrenMap, expanded, handleToggle]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);

  // Re-sync ReactFlow state whenever the layout changes (expand/collapse or data change).
  useEffect(() => {
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [layout, setNodes, setEdges]);

  return (
    <div
      className="h-[700px] rounded-2xl overflow-hidden"
      style={{ border: "1px solid var(--fm-glass-border)" }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        nodesDraggable
        nodesConnectable={false}
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
          nodeColor={(node) =>
            (node.data as MindMapNodeData)?.color ?? "#7c3aed"
          }
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
