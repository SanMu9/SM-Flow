import { useEffect, useRef } from "react";

// 流程节点组件
function FlowNode(props: any) {
    const { node, isEditing, onUpdateLabel } = props;
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        console.log('isEditing', isEditing, inputRef.current);
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    return (
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
            {isEditing ? (
                <input
                    ref={inputRef}
                    className="node-label-input"
                    type="text"
                    defaultValue={node.label}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            onUpdateLabel(e.currentTarget.value);
                        } else if (e.key === 'Escape') {
                            onUpdateLabel(node.label);
                        }
                    }}
                    onBlur={(e) => {
                        if (e.currentTarget.value) {
                            onUpdateLabel(e.currentTarget.value);
                        } else {
                            onUpdateLabel(node.label);
                        }
                    }}
                />
            ) : (
                <div className="node-label">{node.label}</div>
            )}
            <div className="node-type">{node.type}</div>
        </div>
    );
}

export default FlowNode;