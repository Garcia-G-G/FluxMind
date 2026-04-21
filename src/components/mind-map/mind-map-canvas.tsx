"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
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
// xyflow CSS is side-effect loaded here; because this module is only pulled
// in via `next/dynamic` from the Studio page, the stylesheet is not shipped
// with the main app chunk.
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

// Hoisted style prop — avoids creating a fresh object literal on every render
// of <ReactFlow>, which would invalidate its memoized prop checks.
const FLOW_STYLE: React.CSSProperties = { background: "var(--fm-bg)" };
const CONTROLS_STYLE: React.CSSProperties = {
  background: "var(--fm-glass-bg)",
  border: "1px solid var(--fm-glass-border)",
  borderRadius: 12,
};
const MINIMAP_STYLE: React.CSSProperties = {
  background: "var(--fm-surface)",
  border: "1px solid var(--fm-glass-border)",
  borderRadius: 12,
};

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
    // Expanding a branch triggers a full dagre re-layout. Running that inside
    // startTransition lets React yield to paint so the click feels instant
    // while the layout work happens in a lower-priority pass.
    startTransition(() => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    });
  }, []);

  // The layout compute reads `expanded` — deferring it decouples dagre
  // recomputation from the urgent toggle.
  const deferredExpanded = useDeferredValue(expanded);

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
    for (const id of deferredExpanded) {
      expandDescendants(id);
    }

    const filteredNodes = data.nodes.filter((n) => visibleIds.has(n.id));
    const filteredEdges = data.edges.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target)
    );
    return { filteredNodes, filteredEdges };
  }, [data, deferredExpanded, childrenMap]);

  const layout = useMemo(
    () =>
      getLayoutedElements(filteredNodes, filteredEdges, (id) => {
        const node = data.nodes.find((n) => n.id === id);
        if (!node || node.level !== 1) return {};
        return {
          hasChildren: (childrenMap.get(id) ?? []).length > 0,
          isExpanded: deferredExpanded.has(id),
          onToggle: handleToggle,
        };
      }),
    [filteredNodes, filteredEdges, data, childrenMap, deferredExpanded, handleToggle],
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
        style={FLOW_STYLE}
      >
        <Background color="var(--fm-surface-border)" gap={20} size={1} />
        <Controls style={CONTROLS_STYLE} />
        <MiniMap
          nodeColor={(node) =>
            (node.data as MindMapNodeData)?.color ?? "#7c3aed"
          }
          maskColor="var(--fm-bg)"
          style={MINIMAP_STYLE}
        />
      </ReactFlow>
    </div>
  );
};
