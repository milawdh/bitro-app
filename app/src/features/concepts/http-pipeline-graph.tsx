'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Background, BackgroundVariant, Controls, Handle, MarkerType, Position, ReactFlow, useNodesState, type Edge, type Node, type NodeProps } from '@xyflow/react';
import { Check, Database, Globe, Layers, Send, Server, ShieldCheck } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import './http-pipeline-graph.css';

const stages = [
  { label: 'مرورگر', subtitle: 'Client', icon: Globe },
  { label: 'درخواست HTTP', subtitle: 'GET /api/users', icon: Send },
  { label: 'میان‌افزار', subtitle: 'Middleware', icon: ShieldCheck },
  { label: 'کنترلر', subtitle: 'Controller', icon: Server },
  { label: 'سرویس', subtitle: 'Service', icon: Layers },
  { label: 'مخزن داده', subtitle: 'Repository', icon: Server },
  { label: 'پایگاه داده', subtitle: 'Database', icon: Database },
  { label: 'پاسخ ۲۰۰', subtitle: '200 OK', icon: Check },
];

type PipelineNodeData = {
  index: number; label: string; subtitle: string; active: boolean; visited: boolean;
  incoming: Position; outgoing: Position;
};
type PipelineNode = Node<PipelineNodeData, 'pipeline'>;

const PipelineStageNode = memo(function PipelineStageNode({ data }: NodeProps<PipelineNode>) {
  const Icon = data.visited ? Check : stages[data.index].icon;
  return <div className={`http-flow-node ${data.active ? 'active' : ''} ${data.visited ? 'visited' : ''}`} dir="rtl">
    {data.index > 0 && <Handle type="target" position={data.incoming} isConnectable={false} />}
    <span className="http-flow-icon"><Icon size={18} strokeWidth={1.5} /></span>
    <strong>{data.label}</strong>
    <small dir="ltr">{data.subtitle}</small>
    <span className="http-flow-index">{(data.index + 1).toLocaleString('fa-IR')}</span>
    {data.index < stages.length - 1 && <Handle type="source" position={data.outgoing} isConnectable={false} />}
  </div>;
});
const nodeTypes = { pipeline: PipelineStageNode };

function initialNodes(narrow: boolean): PipelineNode[] {
  const columns = narrow ? 2 : 4;
  return stages.map((stage, index) => {
    const row = Math.floor(index / columns);
    const positionInRow = index % columns;
    const reversed = row % 2 === 0;
    const column = reversed ? columns - 1 - positionInRow : positionInRow;
    const lastInRow = positionInRow === columns - 1;
    return {
      id: `stage-${index}`, type: 'pipeline',
      position: { x: column * (narrow ? 164 : 154), y: row * (narrow ? 91 : 150) },
      draggable: true, deletable: false, connectable: false,
      ariaLabel: `مرحلهٔ ${(index + 1).toLocaleString('fa-IR')}: ${stage.label}`,
      data: { index, label: stage.label, subtitle: stage.subtitle, active: false, visited: false,
        incoming: positionInRow === 0 && index > 0 ? Position.Top : reversed ? Position.Right : Position.Left,
        outgoing: lastInRow && index < stages.length - 1 ? Position.Bottom : reversed ? Position.Left : Position.Right },
    };
  });
}

function PipelineCanvas({ step, narrow }: { step: number; narrow: boolean }) {
  const [nodes, , onNodesChange] = useNodesState<PipelineNode>(initialNodes(narrow));
  const visibleNodes = useMemo(() => nodes.map(node => ({ ...node, data: { ...node.data, active: node.data.index === step, visited: node.data.index < step } })), [nodes, step]);
  const edges: Edge[] = useMemo(() => stages.slice(0, -1).map((_, index) => {
    const active = index === step - 1;
    const color = active ? 'var(--primary)' : index < step ? 'var(--green)' : 'var(--border)';
    return { id: `connection-${index}`, source: `stage-${index}`, target: `stage-${index + 1}`, type: 'smoothstep',
      animated: active, selectable: false, focusable: false, deletable: false,
      style: { stroke: color, strokeWidth: active ? 2 : 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
    };
  }), [step]);
  return <ReactFlow<PipelineNode> nodes={visibleNodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
    fitView fitViewOptions={{ padding: .14, maxZoom: 1.15 }} minZoom={.35} maxZoom={1.6}
    nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} zoomOnScroll={false}
    preventScrolling={false} panOnScroll={false} attributionPosition="bottom-left"
    ariaLabelConfig={{ 'controls.ariaLabel': 'کنترل نمای نمودار', 'controls.zoomIn.ariaLabel': 'بزرگ‌نمایی نمودار', 'controls.zoomOut.ariaLabel': 'کوچک‌نمایی نمودار', 'controls.fitView.ariaLabel': 'نمایش کامل نمودار', 'node.a11yDescription.default': 'برای انتخاب مرحله کلید ورود را بزنید؛ برای جابه‌جایی از کلیدهای جهت استفاده کنید.', 'node.a11yDescription.keyboardDisabled': 'مرحله‌های مسیر درخواست' }}>
    <Background variant={BackgroundVariant.Dots} gap={18} size={.75} color="var(--border)" />
    <Controls position="bottom-right" showInteractive={false} />
  </ReactFlow>;
}

/** A draggable, zoomable educational pipeline; step is controlled by the simulation engine. */
export function HttpPipelineGraph({ step }: { step: number }) {
  const container = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  const position = Math.max(0, Math.min(stages.length - 1, step));
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(entries => setNarrow(entries[0].contentRect.width < 440));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  return <div className={`http-pipeline-graph ${narrow ? 'narrow' : ''}`} ref={container} role="group" aria-label="نمودار تعاملی مسیر درخواست HTTP">
    <div className="http-flow-caption"><span>مسیر درخواست</span><small>مرحله‌ها را جابه‌جا کن یا نما را بزرگ کن</small></div>
    <PipelineCanvas key={narrow ? 'narrow' : 'wide'} step={position} narrow={narrow} />
    <p className="sr-only" aria-live="polite">مرحلهٔ فعلی: {stages[position].label}. {position.toLocaleString('fa-IR')} مرحله طی شده است.</p>
  </div>;
}
