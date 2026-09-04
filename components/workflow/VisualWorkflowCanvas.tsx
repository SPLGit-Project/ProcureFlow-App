import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
    Zap, GitBranch, UserCheck, Bell, Play, Plus, 
    ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, Save, 
    Sparkles, CheckCircle2, ArrowRight, Eye, Layout, Shield
} from 'lucide-react';
import { 
    CanvasNode, CanvasEdge, WorkflowCanvasData, 
    UnifiedWorkflowDefinition, WorkflowStageDefinition, 
    User, RoleDefinition, Site, EnhancedAppNotification 
} from '../../types';
import WorkflowNodeCard from './WorkflowNodeCard';
import WorkflowNodePalette from './WorkflowNodePalette';
import WorkflowNodeInspector from './WorkflowNodeInspector';
import { playNotificationChime } from '../../services/realtimeNotificationService';

interface VisualWorkflowCanvasProps {
    workflow: UnifiedWorkflowDefinition;
    users: User[];
    roles: RoleDefinition[];
    sites: Site[];
    onSaveWorkflow: (updated: UnifiedWorkflowDefinition) => Promise<void>;
    onTriggerInAppPopup?: (notif: EnhancedAppNotification) => void;
}

export const VisualWorkflowCanvas: React.FC<VisualWorkflowCanvasProps> = ({
    workflow,
    users,
    roles,
    sites,
    onSaveWorkflow,
    onTriggerInAppPopup
}) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 50, y: 50 });
    const [isPanning, setIsPanning] = useState(false);
    const [startPan, setStartPan] = useState({ x: 0, y: 0 });

    // Dragging Nodes
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Selected Node for Inspector Drawer
    const [selectedNode, setSelectedNode] = useState<CanvasNode | null>(null);
    const [isInspectorOpen, setIsInspectorOpen] = useState(false);

    // Flow Simulation State
    const [isSimulating, setIsSimulating] = useState(false);
    const [simActiveNodeId, setSimActiveNodeId] = useState<string | null>(null);

    // Fullscreen / Expanded View State
    const [isExpanded, setIsExpanded] = useState(false);

    // Unsaved Changes
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Listen for Escape key to exit fullscreen
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isExpanded) {
                setIsExpanded(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isExpanded]);

    // Lock body scroll when expanded to prevent background scrolling
    useEffect(() => {
        if (isExpanded) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isExpanded]);

    // Initial Node & Edge Generator from workflow stages (Horizontal Flow)
    const initializeCanvasData = useCallback((): { nodes: CanvasNode[]; edges: CanvasEdge[] } => {
        if (workflow.canvas_data?.nodes && workflow.canvas_data.nodes.length > 0) {
            // Check if existing saved nodes were vertically stacked (e.g. all x < 320 or x === 280)
            const isOldVertical = workflow.canvas_data.nodes.length > 1 &&
                workflow.canvas_data.nodes.every(n => n.x === 280 || n.x < 320);

            if (isOldVertical) {
                // Auto-upgrade vertically stacked nodes to horizontal layout!
                const upgradedNodes = workflow.canvas_data.nodes.map((node, idx) => ({
                    ...node,
                    x: 60 + idx * 380,
                    y: 200
                }));
                return {
                    nodes: upgradedNodes,
                    edges: workflow.canvas_data.edges || []
                };
            }

            return {
                nodes: workflow.canvas_data.nodes,
                edges: workflow.canvas_data.edges || []
            };
        }

        // Generate intelligent initial HORIZONTAL layout from existing stages
        const initialNodes: CanvasNode[] = [];
        const initialEdges: CanvasEdge[] = [];

        let currentX = 60;
        const baselineY = 200;

        // 1. Trigger Node
        const triggerNodeId = `trigger_${workflow.id}`;
        initialNodes.push({
            id: triggerNodeId,
            type: 'TRIGGER',
            title: workflow.name || 'Workflow Trigger',
            subtitle: workflow.trigger_event,
            x: currentX,
            y: baselineY,
            data: { trigger_event: workflow.trigger_event }
        });

        let lastNodeId = triggerNodeId;
        currentX += 380;

        // 2. Stages
        (workflow.stages || []).forEach((stage, idx) => {
            // Optional Condition Node before stage if condition exists
            if (stage.condition && stage.condition.field) {
                const condId = `cond_${stage.stage_id}`;
                initialNodes.push({
                    id: condId,
                    type: 'CONDITION',
                    title: `Rule: ${stage.condition.field}`,
                    subtitle: `${stage.condition.operator} ${stage.condition.value}`,
                    x: currentX,
                    y: baselineY,
                    data: { condition: stage.condition }
                });
                initialEdges.push({
                    id: `edge_${lastNodeId}_${condId}`,
                    source: lastNodeId,
                    target: condId
                });
                lastNodeId = condId;
                currentX += 380;
            }

            // Approval Node
            const approvalId = stage.stage_id;
            initialNodes.push({
                id: approvalId,
                type: 'APPROVAL',
                title: stage.stage_name || `Stage ${idx + 1}`,
                subtitle: `SLA: ${stage.sla_hours}h`,
                x: currentX,
                y: baselineY,
                data: {
                    approver_type: stage.approver_type,
                    approver_id: stage.approver_id,
                    approver_role: stage.approver_role,
                    approver_user_id: stage.approver_user_id,
                    sla_hours: stage.sla_hours,
                    escalate_to_role: stage.escalate_to_role,
                    escalate_after_hours: stage.escalate_after_hours
                }
            });

            initialEdges.push({
                id: `edge_${lastNodeId}_${approvalId}`,
                source: lastNodeId,
                target: approvalId
            });

            lastNodeId = approvalId;
            currentX += 380;
        });

        // 3. Notification Action Node
        const notifNodeId = `notif_${workflow.id}`;
        initialNodes.push({
            id: notifNodeId,
            type: 'NOTIFICATION',
            title: 'Multi-Channel Dispatch',
            subtitle: 'In-App Pop-up + Teams + Email',
            x: currentX,
            y: baselineY,
            data: {
                channel: 'IN_APP',
                severity: 'WARNING',
                notification_title: `Approval Required: ${workflow.name}`,
                notification_body: 'New procurement requisition requires review and sign-off.',
                action_label: 'Review PO',
                action_url: '/requests'
            }
        });

        initialEdges.push({
            id: `edge_${lastNodeId}_${notifNodeId}`,
            source: lastNodeId,
            target: notifNodeId
        });

        return { nodes: initialNodes, edges: initialEdges };
    }, [workflow]);

    const [nodes, setNodes] = useState<CanvasNode[]>(() => initializeCanvasData().nodes);
    const [edges, setEdges] = useState<CanvasEdge[]>(() => initializeCanvasData().edges);

    // Sync when active workflow changes
    useEffect(() => {
        const data = initializeCanvasData();
        setNodes(data.nodes);
        setEdges(data.edges);
        setHasUnsavedChanges(false);
    }, [workflow.id, initializeCanvasData]);

    // Canvas Pan Handlers
    const handleMouseDownCanvas = (e: React.MouseEvent) => {
        if (e.target === canvasRef.current || (e.target as HTMLElement).tagName === 'svg') {
            setIsPanning(true);
            setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
        } else if (draggingNodeId) {
            setNodes(prev => prev.map(n => {
                if (n.id === draggingNodeId) {
                    return {
                        ...n,
                        x: Math.round((e.clientX - dragOffset.x - pan.x) / (zoom * 10)) * 10,
                        y: Math.round((e.clientY - dragOffset.y - pan.y) / (zoom * 10)) * 10
                    };
                }
                return n;
            }));
            setHasUnsavedChanges(true);
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
        setDraggingNodeId(null);
    };

    const handleStartDragNode = (e: React.MouseEvent, node: CanvasNode) => {
        e.stopPropagation();
        setDraggingNodeId(node.id);
        setDragOffset({
            x: e.clientX - (node.x * zoom + pan.x),
            y: e.clientY - (node.y * zoom + pan.y)
        });
    };

    // Node Operations
    const handleSelectNode = (node: CanvasNode) => {
        setSelectedNode(node);
        setIsInspectorOpen(true);
    };

    const handleDeleteNode = (id: string) => {
        setNodes(prev => prev.filter(n => n.id !== id));
        setEdges(prev => prev.filter(e => e.source !== id && e.target !== id));
        setHasUnsavedChanges(true);
        if (selectedNode?.id === id) {
            setSelectedNode(null);
            setIsInspectorOpen(false);
        }
    };

    const handleDuplicateNode = (node: CanvasNode) => {
        const newId = `${node.type.toLowerCase()}_${Date.now()}`;
        const newNode: CanvasNode = {
            ...node,
            id: newId,
            title: `${node.title} (Copy)`,
            x: node.x + 40,
            y: node.y + 40
        };
        setNodes(prev => [...prev, newNode]);
        setHasUnsavedChanges(true);
    };

    const handleUpdateNode = (updated: CanvasNode) => {
        setNodes(prev => prev.map(n => n.id === updated.id ? updated : n));
        setHasUnsavedChanges(true);
    };

    // Auto-Align all nodes into a clean horizontal pipeline
    const handleAutoAlignHorizontal = () => {
        const startX = 60;
        const spacingX = 380;
        const baselineY = 200;

        setNodes(prev => prev.map((node, index) => ({
            ...node,
            x: startX + index * spacingX,
            y: baselineY
        })));
        setPan({ x: 50, y: 50 });
        setZoom(1);
        setHasUnsavedChanges(true);
    };

    // Add Node from Palette (Horizontal placement)
    const handleAddNodeFromPalette = (item: any) => {
        const newId = `${item.type.toLowerCase()}_${Date.now()}`;
        const lastNode = nodes[nodes.length - 1];
        const newX = lastNode ? lastNode.x + 380 : 60;
        const newY = lastNode ? lastNode.y : 200;

        const newNode: CanvasNode = {
            id: newId,
            type: item.type,
            title: item.title,
            subtitle: item.subtitle,
            x: newX,
            y: newY,
            data: item.defaultData || {}
        };

        setNodes(prev => [...prev, newNode]);

        // Auto-connect from previous node
        if (lastNode) {
            setEdges(prev => [...prev, {
                id: `edge_${lastNode.id}_${newId}`,
                source: lastNode.id,
                target: newId
            }]);
        }

        setHasUnsavedChanges(true);
    };

    // Quick-Insert between two nodes via (+) waypoint on connector
    const handleInsertNodeOnEdge = (edge: CanvasEdge) => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        if (!sourceNode || !targetNode) return;

        const midX = (sourceNode.x + targetNode.x) / 2;
        const midY = (sourceNode.y + targetNode.y) / 2;

        const newId = `approval_${Date.now()}`;
        const insertedNode: CanvasNode = {
            id: newId,
            type: 'APPROVAL',
            title: 'Additional Approval Gate',
            subtitle: 'SLA: 24h',
            x: midX,
            y: midY,
            data: {
                approver_type: 'ROLE',
                approver_id: 'APPROVER',
                approver_role: 'APPROVER',
                sla_hours: 24
            }
        };

        setNodes(prev => [...prev, insertedNode]);
        // Remove old edge, add two new edges
        setEdges(prev => [
            ...prev.filter(e => e.id !== edge.id),
            { id: `edge_${sourceNode.id}_${newId}`, source: sourceNode.id, target: newId },
            { id: `edge_${newId}_${targetNode.id}`, source: newId, target: targetNode.id }
        ]);

        setHasUnsavedChanges(true);
    };

    // Save Canvas Layout & Stages to Supabase
    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Compile nodes into stages and notification rules
            const compiledStages: WorkflowStageDefinition[] = [];
            nodes.filter(n => n.type === 'APPROVAL').forEach((n, idx) => {
                compiledStages.push({
                    stage_id: n.id,
                    stage_name: n.title,
                    approver_type: n.data.approver_type || 'ROLE',
                    approver_id: n.data.approver_id || 'APPROVER',
                    approver_role: n.data.approver_role,
                    approver_user_id: n.data.approver_user_id,
                    sla_hours: n.data.sla_hours || 24,
                    escalate_to_role: n.data.escalate_to_role,
                    escalate_after_hours: n.data.escalate_after_hours,
                    condition: n.data.condition
                });
            });

            const updatedWorkflow: UnifiedWorkflowDefinition = {
                ...workflow,
                stages: compiledStages.length > 0 ? compiledStages : workflow.stages,
                canvas_data: {
                    nodes,
                    edges,
                    zoom,
                    pan
                }
            };

            await onSaveWorkflow(updatedWorkflow);
            setHasUnsavedChanges(false);
        } catch (e) {
            console.error('Failed to save workflow canvas:', e);
        } finally {
            setIsSaving(false);
        }
    };

    // Flow Simulation Engine
    const handleSimulateFlow = async () => {
        if (isSimulating || nodes.length === 0) return;
        setIsSimulating(true);

        playNotificationChime('subtle');

        for (let i = 0; i < nodes.length; i++) {
            const current = nodes[i];
            setSimActiveNodeId(current.id);

            // Audio & Visual pulse
            if (current.type === 'TRIGGER') {
                playNotificationChime('subtle');
            } else if (current.type === 'CONDITION') {
                playNotificationChime('subtle');
            } else if (current.type === 'APPROVAL') {
                playNotificationChime('subtle');
            } else if (current.type === 'NOTIFICATION') {
                // Trigger real-time In-App Pop-up toast!
                playNotificationChime('alert');
                if (onTriggerInAppPopup) {
                    onTriggerInAppPopup({
                        id: `sim_notif_${Date.now()}`,
                        user_id: 'simulation',
                        title: current.data.notification_title || 'Purchase Order Approval Required: PO-2026-9042',
                        message: current.data.notification_body || 'PO-2026-9042 for $14,280.00 is awaiting review according to visual flow rules.',
                        type: 'PO_APPROVAL_REQUEST',
                        category: 'APPROVAL',
                        severity: (current.data.severity as any) || 'WARNING',
                        action_label: current.data.action_label || 'Review PO',
                        action_url: current.data.action_url || '/requests',
                        entity_type: 'PO',
                        entity_id: 'PO-2026-9042',
                        is_read: false,
                        metadata: {
                            po_number: 'PO-2026-9042',
                            total_amount: '$14,280.00',
                            site_name: 'Site - Adelaide'
                        },
                        created_at: new Date().toISOString()
                    });
                }
            }

            await new Promise(r => setTimeout(r, 900));
        }

        setSimActiveNodeId(null);
        setIsSimulating(false);
    };

    const canvasWorkspace = (
        <div className={`flex flex-col bg-[#f8f9fb] dark:bg-[#0e1017] select-none transition-all duration-200 ${
            isExpanded 
                ? 'fixed inset-0 z-[999999] w-screen h-screen rounded-none border-none' 
                : 'h-[760px] rounded-3xl border border-gray-200 dark:border-white/10 overflow-hidden shadow-xl relative'
        }`}>
            {/* Top Toolbar */}
            <div className="h-14 px-5 bg-white/90 dark:bg-[#151722]/90 backdrop-blur-md border-b border-gray-200 dark:border-white/10 flex items-center justify-between z-20 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                        <GitBranch size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                {workflow.name}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                Horizontal Pipeline
                            </span>
                            {isExpanded && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 flex items-center gap-1">
                                    <Maximize2 size={10} />
                                    Fullscreen Canvas
                                </span>
                            )}
                            {hasUnsavedChanges && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 animate-pulse">
                                    Unsaved Changes
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-gray-400">
                            Horizontal node flow • Connect actions from left to right • Click (+) to insert
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Auto-Align Flow (Horizontal) */}
                    <button
                        type="button"
                        onClick={handleAutoAlignHorizontal}
                        className="px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200 transition-colors shadow-sm"
                        title="Auto-align all nodes into a clean horizontal pipeline"
                    >
                        <Layout size={14} />
                        Auto-Align
                    </button>

                    {/* Expand / Fullscreen Canvas */}
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all shadow-sm ${
                            isExpanded 
                                ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700 shadow-purple-500/20' 
                                : 'border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-200'
                        }`}
                        title={isExpanded ? "Collapse back to normal size (Esc)" : "Expand canvas to full desktop screen"}
                    >
                        {isExpanded ? (
                            <>
                                <Minimize2 size={14} />
                                Exit Expand
                                <span className="text-[10px] opacity-80 font-mono">(Esc)</span>
                            </>
                        ) : (
                            <>
                                <Maximize2 size={14} />
                                Expand Canvas
                            </>
                        )}
                    </button>

                    {/* Live Simulation Button */}
                    <button
                        type="button"
                        onClick={handleSimulateFlow}
                        disabled={isSimulating}
                        className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all ${
                            isSimulating 
                                ? 'bg-amber-500 text-white animate-pulse' 
                                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 hover:bg-amber-100'
                        }`}
                        title="Simulate workflow execution from start to finish"
                    >
                        <Sparkles size={14} className={isSimulating ? 'animate-spin' : ''} />
                        {isSimulating ? 'Simulating Flow...' : 'Simulate Flow'}
                    </button>

                    {/* Save Flow */}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving || !hasUnsavedChanges}
                        className="px-4 py-1.5 bg-[var(--color-brand)] disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5"
                    >
                        <Save size={14} />
                        {isSaving ? 'Saving...' : 'Save Flow'}
                    </button>
                </div>
            </div>

            {/* Canvas Main Workspace */}
            <div className="flex-1 flex relative overflow-hidden">
                {/* Left Building Blocks Palette */}
                <div className="p-3 z-20 shrink-0">
                    <WorkflowNodePalette onAddNode={handleAddNodeFromPalette} />
                </div>

                {/* Infinite Canvas Area */}
                <div
                    ref={canvasRef}
                    onMouseDown={handleMouseDownCanvas}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    className="flex-1 h-full relative overflow-hidden cursor-crosshair"
                    style={{
                        backgroundImage: `radial-gradient(circle, rgba(150, 150, 150, 0.25) 1px, transparent 1px)`,
                        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
                        backgroundPosition: `${pan.x}px ${pan.y}px`
                    }}
                >
                    {/* Canvas Transformed Layer */}
                    <div
                        style={{
                            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                            transformOrigin: '0 0'
                        }}
                        className="absolute inset-0 pointer-events-none"
                    >
                        {/* SVG Connectors Layer */}
                        <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
                            <defs>
                                <linearGradient id="activeLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#10b981" />
                                    <stop offset="50%" stopColor="#06b6d4" />
                                    <stop offset="100%" stopColor="#8b5cf6" />
                                </linearGradient>
                            </defs>

                            {edges.map(edge => {
                                const sourceNode = nodes.find(n => n.id === edge.source);
                                const targetNode = nodes.find(n => n.id === edge.target);
                                if (!sourceNode || !targetNode) return null;

                                const isCondition = sourceNode.type === 'CONDITION';
                                const isNoBranch = edge.sourceHandle === 'no';

                                // Output port: Right side of source card (w=320, height approx 140)
                                const startX = sourceNode.x + 320;
                                const startY = isCondition 
                                    ? (isNoBranch ? sourceNode.y + 98 : sourceNode.y + 46)
                                    : sourceNode.y + 70;

                                // Input port: Left side of target card
                                const endX = targetNode.x;
                                const endY = targetNode.y + 70;

                                const dx = Math.max(50, Math.abs(endX - startX) / 2);
                                const pathData = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
                                const midX = (startX + endX) / 2;
                                const midY = (startY + endY) / 2;

                                return (
                                    <g key={edge.id} className="group pointer-events-auto">
                                        {/* Connector Shadow / Glow */}
                                        <path
                                            d={pathData}
                                            fill="none"
                                            stroke="rgba(0, 0, 0, 0.08)"
                                            strokeWidth={8}
                                            strokeLinecap="round"
                                        />

                                        {/* Main Connector Curve */}
                                        <path
                                            d={pathData}
                                            fill="none"
                                            stroke="url(#activeLineGradient)"
                                            strokeWidth={3}
                                            strokeDasharray={isSimulating ? '6 4' : 'none'}
                                            className={isSimulating ? 'animate-pulse' : ''}
                                        />

                                        {/* Inline Quick-Add (+) Button on Connector */}
                                        <g 
                                            transform={`translate(${midX}, ${midY})`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleInsertNodeOnEdge(edge);
                                            }}
                                            className="cursor-pointer hover:scale-125 transition-transform"
                                        >
                                            <circle
                                                r={12}
                                                className="fill-white dark:fill-[#151722] stroke-gray-300 dark:stroke-white/20 hover:stroke-[var(--color-brand)] shadow-md"
                                                strokeWidth={2}
                                            />
                                            <text
                                                textAnchor="middle"
                                                dy="4"
                                                className="fill-gray-600 dark:fill-gray-300 font-bold text-xs select-none"
                                            >
                                                +
                                            </text>
                                        </g>
                                    </g>
                                );
                            })}
                        </svg>

                        {/* Interactive Nodes Layer */}
                        <div className="absolute inset-0 pointer-events-auto">
                            {nodes.map(node => (
                                <WorkflowNodeCard
                                    key={node.id}
                                    node={node}
                                    isSelected={selectedNode?.id === node.id}
                                    isSimulating={isSimulating}
                                    isSimActive={simActiveNodeId === node.id}
                                    users={users}
                                    roles={roles}
                                    onSelect={handleSelectNode}
                                    onDelete={handleDeleteNode}
                                    onDuplicate={handleDuplicateNode}
                                    onStartDrag={handleStartDragNode}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Canvas Floating Zoom / Pan Controls */}
                    <div className="absolute bottom-5 right-5 z-20 flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/90 dark:bg-[#151722]/90 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-xl">
                        <button
                            type="button"
                            onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                            title="Zoom Out"
                        >
                            <ZoomOut size={16} />
                        </button>
                        <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300 w-12 text-center select-none">
                            {Math.round(zoom * 100)}%
                        </span>
                        <button
                            type="button"
                            onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}
                            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                            title="Zoom In"
                        >
                            <ZoomIn size={16} />
                        </button>
                        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-0.5" />
                        <button
                            type="button"
                            onClick={handleAutoAlignHorizontal}
                            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                            title="Auto-align all nodes horizontally"
                        >
                            <Layout size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setZoom(1);
                                setPan({ x: 50, y: 50 });
                            }}
                            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                            title="Reset View"
                        >
                            <RotateCcw size={16} />
                        </button>
                    </div>
                </div>

                {/* Node Inspector Drawer */}
                <WorkflowNodeInspector
                    node={selectedNode}
                    users={users}
                    roles={roles}
                    sites={sites}
                    isOpen={isInspectorOpen}
                    onClose={() => setIsInspectorOpen(false)}
                    onUpdateNode={handleUpdateNode}
                    onDeleteNode={handleDeleteNode}
                />
            </div>
        </div>
    );

    return (
        <>
            {isExpanded ? (
                <>
                    {/* Inline placeholder so page layout does not jump or collapse */}
                    <div className="h-[760px] bg-gray-50/60 dark:bg-white/[0.02] rounded-3xl border-2 border-dashed border-gray-200 dark:border-white/10 flex flex-col items-center justify-center gap-4 text-center p-8 transition-all select-none">
                        <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 shadow-inner">
                            <Maximize2 size={32} />
                        </div>
                        <div className="space-y-1.5">
                            <h4 className="text-base font-bold text-gray-900 dark:text-white">Workflow Studio Expanded</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                                The Visual Workflow Studio canvas is currently active in full-screen expanded mode across your display.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsExpanded(false)}
                            className="mt-2 px-5 py-2.5 bg-white dark:bg-[#151722] border border-gray-200 dark:border-white/10 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-all shadow-sm flex items-center gap-2"
                        >
                            <Minimize2 size={14} />
                            Exit Fullscreen (Esc)
                        </button>
                    </div>

                    {/* Portal directly to document.body bypassing ancestor CSS transforms */}
                    {typeof document !== 'undefined' ? createPortal(canvasWorkspace, document.body) : canvasWorkspace}
                </>
            ) : (
                canvasWorkspace
            )}
        </>
    );
};

export default VisualWorkflowCanvas;
