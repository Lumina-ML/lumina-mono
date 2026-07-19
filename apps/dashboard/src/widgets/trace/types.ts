/**
 * Span tree shape used by Trace Explorer. Mirrors the backend's flat Span
 * model but reorganized into a parent/child hierarchy for the tree view.
 */
export interface SpanNode {
  id: string;
  parentSpanId: string | null;
  name: string;
  startTime: string;
  endTime: string | null;
  attributes: Record<string, unknown>;
  children: SpanNode[];
}

export function buildSpanTree(
  flat: Array<{
    id: string;
    parentSpanId: string | null;
    name: string;
    startTime: string;
    endTime: string | null;
    attributes: Record<string, unknown>;
  }>,
): SpanNode[] {
  const byId = new Map<string, SpanNode>();
  for (const s of flat) {
    byId.set(s.id, { ...s, attributes: s.attributes, children: [] });
  }
  const roots: SpanNode[] = [];
  for (const node of byId.values()) {
    if (node.parentSpanId && byId.has(node.parentSpanId)) {
      byId.get(node.parentSpanId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Stable order by start time.
  const sortByStart = (a: SpanNode, b: SpanNode) =>
    new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  const sortRecursive = (nodes: SpanNode[]) => {
    nodes.sort(sortByStart);
    for (const n of nodes) sortRecursive(n.children);
  };
  sortRecursive(roots);
  return roots;
}

/** Walk the tree to find a specific span by id. */
export function findSpan(roots: SpanNode[], id: string): SpanNode | null {
  for (const root of roots) {
    if (root.id === id) return root;
    const found = findSpan(root.children, id);
    if (found) return found;
  }
  return null;
}

/** Compute the time bounds across the whole tree. */
export function timeBounds(roots: SpanNode[]): { start: number; end: number } | null {
  let start = Infinity;
  let end = -Infinity;
  const visit = (node: SpanNode) => {
    const s = new Date(node.startTime).getTime();
    const e = node.endTime ? new Date(node.endTime).getTime() : s;
    if (s < start) start = s;
    if (e > end) end = e;
    for (const c of node.children) visit(c);
  };
  for (const r of roots) visit(r);
  if (!isFinite(start) || !isFinite(end)) return null;
  return { start, end };
}