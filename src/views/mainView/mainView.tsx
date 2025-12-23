import {useEffect, useMemo, useRef, useState} from "react";
import {useDrag, useDrop} from "react-dnd";
import {newInstance, type BrowserJsPlumbInstance} from "@jsplumb/browser-ui";
import "./mainView.css";

type PaletteItem = {
    type: string;
    label: string;
    color: string;
};

type PlacedNode = PaletteItem & {
    id: string;
    x: number;
    y: number;
};

const DragType = "FLOW_NODE";

function PaletteCard({item}: { item: PaletteItem }) {
    const [, drag] = useDrag(() => ({
        type: DragType,
        item,
    }), [item]);

    return (
        <div ref={drag} className="palette-item" style={{borderLeftColor: item.color}}>
            {item.label}
        </div>
    );
}

function MainView() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const jsPlumbRef = useRef<BrowserJsPlumbInstance | null>(null);
    const [nodes, setNodes] = useState<PlacedNode[]>([]);

    const palette = useMemo<PaletteItem[]>(() => ([
        {type: "start", label: "开始", color: "#16a34a"},
        {type: "task", label: "任务节点", color: "#3b82f6"},
        {type: "condition", label: "条件分支", color: "#f59e0b"},
        {type: "end", label: "结束", color: "#ef4444"},
    ]), []);

    // 初始化 jsPlumb
    useEffect(() => {
        if (!containerRef.current) return;
        const instance = newInstance({
            container: containerRef.current,
            elementsDraggable: false, // 由 React 维护位置，避免位置被内部拖拽重置
        });
        instance.importDefaults({
            connector: {type: "Flowchart", options: {cornerRadius: 6}},
            paintStyle: {stroke: "#6b7280", strokeWidth: 2},
            endpointStyle: {fill: "#6b7280", outlineStroke: "transparent"},
            connectionOverlays: [
                {type: "Arrow", options: {width: 10, length: 10, location: 1}},
            ],
        });
        instance.addSourceSelector(".flow-node", {
            anchor: "Continuous",
            maxConnections: -1,
            allowLoopback: false,
        });
        instance.addTargetSelector(".flow-node", {
            anchor: "Continuous",
            maxConnections: -1,
            allowLoopback: false,
        });
        jsPlumbRef.current = instance;
        return () => {
            instance.destroy();
            jsPlumbRef.current = null;
        };
    }, []);

    // 每次节点变化时，注册/刷新元素
    useEffect(() => {
        const instance = jsPlumbRef.current;
        const container = containerRef.current;
        if (!instance || !container) return;

        instance.batch(() => {
            nodes.forEach((node) => {
                const el = document.getElementById(node.id);
                if (!el) return;
                // 已管理元素只需刷新；未管理的添加到实例
                if (!instance.getManagedElement(node.id)) {
                    instance.manage(el);
                } else {
                    instance.revalidate(el);
                }
            });
        });
    }, [nodes]);

    const [, drop] = useDrop(() => ({
        accept: DragType,
        drop: (item: PaletteItem, monitor) => {
            const offset = monitor.getClientOffset();
            const container = containerRef.current;
            if (!offset || !container) return;
            const rect = container.getBoundingClientRect();
            const x = offset.x - rect.left;
            const y = offset.y - rect.top;
            setNodes((prev) => [
                ...prev,
                {
                    ...item,
                    id: `node-${Date.now()}-${prev.length}`,
                    x,
                    y,
                },
            ]);
        },
    }), []);

    const setCanvasRef = (node: HTMLDivElement | null) => {
        containerRef.current = node;
        drop(node);
    };

    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="sidebar-header">预置控件</div>
                <div className="palette">
                    {palette.map((item) => (
                        <PaletteCard key={item.type} item={item}/>
                    ))}
                </div>
            </aside>
            <section className="workspace">
                <div className="workspace-header">流程图工作台</div>
                <div ref={setCanvasRef} className="canvas" id="flow-canvas">
                    {nodes.length === 0 && (
                        <div className="canvas-placeholder">将左侧控件拖入此处</div>
                    )}
                    {nodes.map((node) => (
                        <div
                            key={node.id}
                            id={node.id}
                            className="flow-node"
                            style={{
                                left: node.x,
                                top: node.y,
                                borderTopColor: node.color,
                            }}
                        >
                            <div className="node-label">{node.label}</div>
                            <div className="node-type">{node.type}</div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

export default MainView;