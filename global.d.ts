export {}; // 确保文件被视为模块

declare global {
    interface Window {
        Electron_Global: {
            width: number;
            height: number;
            minHeight: number;
            minWidth: number;
        };
    }
}

