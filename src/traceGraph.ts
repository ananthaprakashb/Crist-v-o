export interface TraceNodeLike {
  id: string;
  dependsOn: string[];
}

export function collectTraceIds(nodes: TraceNodeLike[], startId: string) {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = nodes.find((item) => item.id === id);
    if (!node) return;
    node.dependsOn.forEach(visit);
    ordered.push(id);
  };

  const start = nodes.find((item) => item.id === startId);
  start?.dependsOn.forEach(visit);
  return ordered;
}
