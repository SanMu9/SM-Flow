import {useEffect, useMemo, useRef, useState, useCallback} from "react";
import {useDrag, useDrop} from "react-dnd";
import {newInstance, type BrowserJsPlumbInstance, type Connection } from "@jsplumb/browser-ui";
// 1. 导入拖拽管理器
// import { DragManager  } from "@jsplumb/connector-bezier";

import "./mainView.css";
import FlowNode from "@/components/node/FlowNode";

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
    const nodesRef = useRef<PlacedNode[]>([]);
    // const dragManagerRef = useRef<DragManager | null>(null);
    const [nodes, setNodes] = useState<PlacedNode[]>([]);
    const [sidebarWidth, setSidebarWidth] = useState(220);
    const [isResizing, setIsResizing] = useState(false);
    const [contextMenu, setContextMenu] = useState<{
        type: 'node' | 'connection';
        x: number;
        y: number;
        nodeId?: string;
        connection?: Connection;
    } | null>(null);
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
    const [connectionDescriptions, setConnectionDescriptions] = useState<Map<string, string>>(new Map());
    const [zoom, setZoom] = useState(1);

    const palette = useMemo<PaletteItem[]>(() => ([
        {type: "start", label: "开始", color: "#16a34a"},
        {type: "task", label: "任务节点", color: "#3b82f6"},
        {type: "condition", label: "条件分支", color: "#f59e0b"},
        {type: "end", label: "结束", color: "#ef4444"},
    ]), []);

    // 初始化 jsPlumb - 只在组件挂载时初始化一次，不依赖 nodes
    useEffect(() => {
        if (!containerRef.current) return;
        const instance = newInstance({
            container: containerRef.current,
            elementsDraggable: true,
        });

        
        //  // 创建拖拽管理器，并与 jsPlumb 实例关联
        // const dragManager = DragManager({
        //     el: containerRef.current, // 指定可拖拽区域的容器
        //     jsPlumb: instance, // 传入jsPlumb实例，拖拽时自动更新连线
        // });
        // dragManagerRef.current = dragManager;
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

        // 监听连线创建
        instance.bind("connection", (val) => {
            // 连线创建后，可以通过画布右键菜单来操作
            console.log('connection', val);
            const connection = val.connection;
            const canvas = connection.connector.canvas;
            instance.on(canvas, "contextmenu", (e: MouseEvent) => {
                console.log('contextmenu', e);
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({
                    type: 'connection',
                    x: e.clientX,
                    y: e.clientY,
                    connection: connection as Connection,
                });
            });
        });


        jsPlumbRef.current = instance;
    
        return () => {
         
            instance.destroy();
            jsPlumbRef.current = null;
        };
    }, []); // 移除 nodes 依赖，只在组件挂载时初始化一次

    // 更新 nodesRef 以保持同步
    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    // 每次节点变化时，注册/刷新元素
    useEffect(() => {
        const instance = jsPlumbRef.current;
        const container = containerRef.current;
        // const dragManager = dragManagerRef.current;
        if (!instance || !container ) return;

        instance.batch(() => {
            nodes.forEach((node) => {
                const el = document.getElementById(node.id);
                if (!el) return;
                // dragManager.draggable(el);
                // 已管理元素只需刷新；未管理的添加到实例
                if (!instance.getManagedElement(node.id)) {
                    instance.manage(el);
                    // 添加右键菜单监听
                    el.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({
                            type: 'node',
                            x: e.clientX,
                            y: e.clientY,
                            nodeId: node.id,
                        });
                    });
                } else {
                    instance.revalidate(el);
                }
            });
        });
    }, [nodes]);

    // 画布滚轮缩放
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                const newZoom = Math.max(0.1, Math.min(3, zoom * delta));
                setZoom(newZoom);
                const instance = jsPlumbRef.current;
                if (instance) {
                    instance.setZoom(newZoom);
                    instance.repaintEverything();
                }
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', handleWheel);
        };
    }, [zoom]);

    // 侧边栏拖拽调整宽度
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        setIsResizing(true);
        e.preventDefault();
    }, []);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(0, Math.min(500, e.clientX));
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    // 恢复侧边栏宽度
    const handleRestoreSidebar = useCallback(() => {
        setSidebarWidth(220);
    }, []);

    // 侧边栏恢复箭头拖拽
    const [isRestoringSidebar, setIsRestoringSidebar] = useState(false);
    const handleRestoreDragStart = useCallback((e: React.MouseEvent) => {
        setIsRestoringSidebar(true);
        e.preventDefault();
    }, []);

    useEffect(() => {
        if (!isRestoringSidebar) return;

        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(0, Math.min(500, e.clientX));
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsRestoringSidebar(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isRestoringSidebar]);

    // 删除节点
    const handleDeleteNode = useCallback((nodeId: string) => {
        const instance = jsPlumbRef.current;
        if (instance) {
            // 删除节点相关的所有连线
            const sourceConnections = instance.getConnections({ source: nodeId as any });
            if (Array.isArray(sourceConnections)) {
                sourceConnections.forEach((conn: Connection) => instance.deleteConnection(conn));
            }
            const targetConnections = instance.getConnections({ target: nodeId as any });
            if (Array.isArray(targetConnections)) {
                targetConnections.forEach((conn: Connection) => instance.deleteConnection(conn));
            }
            // 删除节点元素
            const el = document.getElementById(nodeId);
            if (el) {
                instance.unmanage(el);
            }
        }
        setNodes(prev => prev.filter(n => n.id !== nodeId));
        setContextMenu(null);
    }, []);

    // 删除连线
    const handleDeleteConnection = useCallback((connection: Connection) => {
        const instance = jsPlumbRef.current;
        if (instance) {
            instance.deleteConnection(connection);
            // 删除连线描述
            const connId = `${connection.sourceId}-${connection.targetId}`;
            setConnectionDescriptions(prev => {
                const newMap = new Map(prev);
                newMap.delete(connId);
                return newMap;
            });
        }
        setContextMenu(null);
    }, []);

    // 更新节点名称
    const handleUpdateNodeLabel = useCallback((nodeId: string, newLabel: string) => {
        setNodes(prev => prev.map(n => 
            n.id === nodeId ? { ...n, label: newLabel } : n
        ));
        setEditingNodeId(null);
        setContextMenu(null);
    }, []);

    // 更新连线描述
    const handleUpdateConnectionDescription = useCallback((connection: Connection, description: string) => {
        const connId = `${connection.sourceId}-${connection.targetId}`;
        setConnectionDescriptions(prev => {
            const newMap = new Map(prev);
            newMap.set(connId, description);
            return newMap;
        });
        setEditingConnection(null);
        setContextMenu(null);
        
        // 更新连线上的标签显示
        const instance = jsPlumbRef.current;
        if (instance) {
            // 移除旧的标签覆盖层
            try {
                const overlays = Object.entries(connection.getOverlays());
                if (Array.isArray(overlays)) {
                    overlays.forEach((overlay: any) => {
                        if (overlay[1].type === 'Label') {
                            console.log('overlay', overlay);
                            instance.removeOverlay(connection, overlay[0]);
                        }
                    });
                }
            } catch (err) {
                // 忽略错误
            }
            
            // 添加新的标签覆盖层
            if (description) {
                instance.addOverlay(connection, {
                    type: "Label",
                    options: {
                        label: description,
                        location: 0.5,
                        cssClass: "connection-label",
                    }
                });
            }
        }
    }, []);

    // 点击外部关闭菜单 - 使用 mousedown 事件，避免与菜单项点击冲突
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // 如果点击的是菜单本身或其子元素，不关闭
            if (target.closest('.context-menu')) {
                return;
            }
            setContextMenu(null);
        };
        if (contextMenu) {
            // 使用 setTimeout 确保菜单项的点击事件先执行
            const timer = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 0);
            return () => {
                clearTimeout(timer);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [contextMenu]);

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
            <aside className="sidebar" style={{ width: `${sidebarWidth}px`, overflow: sidebarWidth === 0 ? 'hidden' : 'visible',padding: sidebarWidth === 0 ? 0 : '12px' }}>
                <div className="sidebar-header">预置控件</div>
                <div className="palette">
                    {palette.map((item) => (
                        <PaletteCard key={item.type} item={item}/>
                    ))}
                </div>
            </aside>
            {sidebarWidth > 0 && (
                <div 
                    className="sidebar-resizer"
                    onMouseDown={handleResizeStart}
                    style={{ left: `${sidebarWidth}px` }}
                />
            )}
            {sidebarWidth === 0 && (
                <div 
                    className="sidebar-restore-arrow"
                    onClick={handleRestoreSidebar}
                    onMouseDown={handleRestoreDragStart}
                    title="点击或拖拽恢复侧边栏"
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
            )}
            <section className="workspace">
                <div className="workspace-header">流程图工作台</div>
                <div ref={setCanvasRef} className="canvas" id="flow-canvas">
                    {nodes.length === 0 && (
                        <div className="canvas-placeholder">将左侧控件拖入此处</div>
                    )}
                    {nodes.map((node) => (
                        <FlowNode 
                            key={node.id} 
                            node={node}
                            isEditing={editingNodeId === node.id}
                            onUpdateLabel={(newLabel: string) => handleUpdateNodeLabel(node.id, newLabel)}
                        />
                    ))}
                </div>
            </section>

            {/* 右键菜单 */}
            {contextMenu && (
                <div 
                    className="context-menu"
                    style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    {contextMenu.type === 'node' && (
                        <>
                            <div 
                                className="context-menu-item"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (contextMenu.nodeId) {
                                        setEditingNodeId(contextMenu.nodeId);
                                        setContextMenu(null);
                                    }
                                }}
                            >
                                修改名称
                            </div>
                            <div 
                                className="context-menu-item context-menu-item-danger"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (contextMenu.nodeId) {
                                        handleDeleteNode(contextMenu.nodeId);
                                    }
                                }}
                            >
                                删除节点
                            </div>
                        </>
                    )}
                    {contextMenu.type === 'connection' && (
                        <>
                            <div 
                                className="context-menu-item"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (contextMenu.connection) {
                                        setEditingConnection(contextMenu.connection);
                                        setContextMenu(null);
                                    }
                                }}
                            >
                                添加描述
                            </div>
                            <div 
                                className="context-menu-item context-menu-item-danger"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (contextMenu.connection) {
                                        handleDeleteConnection(contextMenu.connection);
                                    }
                                }}
                            >
                                删除连线
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* 编辑节点名称对话框
            {editingNodeId && (
                <div className="edit-dialog-overlay" onClick={() => setEditingNodeId(null)}>
                    <div className="edit-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="edit-dialog-title">修改节点名称</div>
                        <input
                            className="edit-dialog-input"
                            type="text"
                            defaultValue={nodes.find(n => n.id === editingNodeId)?.label || ''}
                            autoFocus
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleUpdateNodeLabel(editingNodeId, e.currentTarget.value);
                                } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setEditingNodeId(null);
                                }
                            }}
                            onBlur={(e) => {
                                // 延迟执行，避免与点击事件冲突
                                setTimeout(() => {
                                    if (e.currentTarget.value) {
                                        handleUpdateNodeLabel(editingNodeId, e.currentTarget.value);
                                    } else {
                                        setEditingNodeId(null);
                                    }
                                }, 200);
                            }}
                        />
                    </div>
                </div>
            )} */}

            {/* 编辑连线描述对话框 */}
            {editingConnection && (
                <div className="edit-dialog-overlay" onClick={() => setEditingConnection(null)}>
                    <div className="edit-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="edit-dialog-title">添加连线描述</div>
                        <textarea
                            className="edit-dialog-textarea"
                            defaultValue={connectionDescriptions.get(
                                `${editingConnection.sourceId}-${editingConnection.targetId}`
                            ) || ''}
                            autoFocus
                            placeholder="请输入连线描述..."
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.ctrlKey) {
                                    handleUpdateConnectionDescription(editingConnection, e.currentTarget.value);
                                } else if (e.key === 'Escape') {
                                    setEditingConnection(null);
                                }
                            }}
                            onBlur={(e) => {
                                handleUpdateConnectionDescription(editingConnection, e.currentTarget.value);
                            }}
                        />
                        <div className="edit-dialog-hint">按 Ctrl+Enter 保存，Esc 取消</div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MainView;