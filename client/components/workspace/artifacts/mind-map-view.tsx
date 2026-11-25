"use client";

import { useMemo, useState } from "react";
import dagre from "@dagrejs/dagre";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import { List, Network } from "lucide-react";

import "@xyflow/react/dist/style.css";

import { Button } from "@/components/ui/button";
import { CitationChip } from "@/components/workspace/citation-chip";
import { cn } from "@/lib/utils";
import type { ArtifactContent, MindMapNode } from "@/lib/artifact-types";

type MindMapContent = Extract<ArtifactContent, { kind: "mindmap" }>;

const NODE_WIDTH = 190;
const NODE_HEIGHT = 76;

const difficultyTone: Record<MindMapNode["difficulty"], string> = {
  intro: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  intermediate: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  advanced: "border-rose-500/40 bg-rose-500/10 text-rose-600",
};

function layoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 90 });

  nodes.forEach((node) => {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });
  dagre.layout(graph);

  return nodes.map((node) => {
    const position = graph.node(node.id);
    return {
      ...node,
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
    };
  });
}

export function MindMapView({ content }: { content: MindMapContent }) {
  const [textView, setTextView] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const ids = new Set(content.nodes.map((node) => node.id));
    const validEdges = content.edges.filter(
      (edge) => ids.has(edge.source) && ids.has(edge.target)
    );

    const flowNodes: Node[] = content.nodes.map((node, index) => ({
      id: node.id,
      position: { x: 0, y: 0 },
      data: {
        label: `${index + 1}. ${node.label}`,
        difficulty: node.difficulty,
      },
      style: {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        backgroundColor: "var(--card)",
        color: "var(--foreground)",
        border: "1px solid var(--border)",
        borderRadius: "0.75rem",
        fontSize: "11px",
        fontWeight: 600,
        padding: "8px",
        textAlign: "center",
        whiteSpace: "normal",
      },
      selected: node.id === selectedId,
    }));

    const flowEdges: Edge[] = validEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
      style: { stroke: "var(--color-primary)", strokeWidth: 1.2 },
      labelStyle: { fill: "var(--color-muted-foreground)", fontSize: 9 },
      labelBgStyle: {
        fill: "var(--card)",
        fillOpacity: 0.92,
      },
      labelBgPadding: [4, 3] as [number, number],
      labelBgBorderRadius: 4,
    }));

    return {
      nodes: layoutNodes(flowNodes, flowEdges),
      edges: flowEdges,
    };
  }, [content.nodes, content.edges, selectedId]);

  const selected = content.nodes.find((node) => node.id === selectedId) ?? null;
  const handleNodeClick: NodeMouseHandler = (_, node) => setSelectedId(node.id);

  return (
    <div className="space-y-3">
      <header className="flex items-start justify-between gap-2 border-b border-border pb-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Network className="h-4 w-4 text-primary" aria-hidden="true" />
            {content.title}
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {content.nodes.length} concepts · {content.edges.length} connections
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={textView}
          onClick={() => setTextView((value) => !value)}
          className="h-7 shrink-0 gap-1.5 px-2 text-[11px]"
        >
          <List className="h-3.5 w-3.5" aria-hidden="true" />
          {textView ? "Graph" : "Text"}
        </Button>
      </header>

      {textView ? (
        <ol className="space-y-3" aria-label="Mind map concepts, text alternative">
          {content.nodes.map((node, index) => (
            <li
              key={node.id}
              className="cursor-pointer rounded-xl border border-border bg-card p-3"
              onClick={() => setSelectedId(node.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold">
                  {index + 1}. {node.label}
                </h4>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] capitalize",
                    difficultyTone[node.difficulty]
                  )}
                >
                  {node.difficulty}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{node.summary}</p>
            </li>
          ))}
        </ol>
      ) : (
        <div
          role="region"
          aria-label={`Interactive concept graph for ${content.title}. Use the Text button for an accessible list.`}
          className="h-[22rem] overflow-hidden rounded-xl border border-border bg-background"
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesConnectable={false}
            nodesDraggable={false}
            elementsSelectable
            panOnScroll
            minZoom={0.4}
            maxZoom={1.6}
            onNodeClick={handleNodeClick}
            style={{ backgroundColor: "var(--background)", color: "var(--foreground)" }}
          >
            <Background color="var(--color-border)" gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      )}

      {selected && (
        <section
          aria-label={`Details for ${selected.label}`}
          className="rounded-xl border border-primary/25 bg-card p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold">{selected.label}</h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setSelectedId(null)}
            >
              Close
            </Button>
          </div>
          <p className="mt-1 text-xs leading-relaxed">{selected.description}</p>
          {selected.keyPoints.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
              {selected.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">Why it matters: </span>
            {selected.whyItMatters}
          </p>
          {selected.example && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Example: </span>
              {selected.example}
            </p>
          )}
          <div className="mt-2">
            <CitationChip
              label={selected.citation.label}
              title={selected.citation.title}
              url={selected.citation.url}
              page={selected.citation.page}
              startSeconds={selected.citation.startSeconds}
            />
          </div>
        </section>
      )}
    </div>
  );
}
