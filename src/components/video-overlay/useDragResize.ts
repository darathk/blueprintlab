import { useRef, useState, useCallback, useEffect } from 'react';

interface Pos { x: number; y: number }
interface Size { width: number }

interface UseDragResizeOptions {
    initialPos?: Pos;
    initialWidth?: number;
    minWidth?: number;
    maxWidth?: number;
}

interface UseDragResizeReturn {
    pos: Pos;
    size: Size;
    setPos: React.Dispatch<React.SetStateAction<Pos>>;
    setSize: React.Dispatch<React.SetStateAction<Size>>;
    containerRef: React.RefObject<HTMLDivElement | null>;
    cardRef: React.RefObject<HTMLDivElement | null>;
    onCardPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    onResizePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}

/**
 * Provides smooth drag + corner-resize for an absolutely-positioned card
 * inside a container div, using the Pointer Events API.
 * Works on mouse (desktop) and touch (mobile/iOS).
 */
export function useDragResize({
    initialPos = { x: 20, y: 20 },
    initialWidth = 280,
    minWidth = 160,
    maxWidth = 520,
}: UseDragResizeOptions = {}): UseDragResizeReturn {
    const [pos, setPos] = useState<Pos>(initialPos);
    const [size, setSize] = useState<Size>({ width: initialWidth });

    const containerRef = useRef<HTMLDivElement | null>(null);
    const cardRef = useRef<HTMLDivElement | null>(null);

    // Drag state — kept in refs to avoid stale closures in pointer handlers
    const dragging = useRef(false);
    const resizing = useRef(false);
    const dragStart = useRef<{ px: number; py: number; ox: number; oy: number }>({ px: 0, py: 0, ox: 0, oy: 0 });
    const resizeStart = useRef<{ px: number; ow: number }>({ px: 0, ow: 0 });

    const clampPos = useCallback((x: number, y: number, cardW: number, cardH: number) => {
        const container = containerRef.current;
        if (!container) return { x, y };
        const cw = container.offsetWidth;
        const ch = container.offsetHeight;
        return {
            x: Math.max(0, Math.min(x, cw - cardW)),
            y: Math.max(0, Math.min(y, ch - cardH)),
        };
    }, []);

    // ── Drag ─────────────────────────────────────────────────────────────
    const onCardPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        // Don't intercept resize handle clicks
        if ((e.target as HTMLElement).dataset.resize) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        dragStart.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y };
    }, [pos]);

    // ── Resize ────────────────────────────────────────────────────────────
    const onResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        resizing.current = true;
        resizeStart.current = { px: e.clientX, ow: size.width };
    }, [size.width]);

    // ── Global pointer move / up ──────────────────────────────────────────
    useEffect(() => {
        function onMove(e: PointerEvent) {
            if (dragging.current) {
                const dx = e.clientX - dragStart.current.px;
                const dy = e.clientY - dragStart.current.py;
                const newX = dragStart.current.ox + dx;
                const newY = dragStart.current.oy + dy;
                const cardH = cardRef.current?.offsetHeight ?? 120;
                const cardW = size.width;
                setPos(clampPos(newX, newY, cardW, cardH));
            }
            if (resizing.current) {
                const dx = e.clientX - resizeStart.current.px;
                const newW = Math.max(minWidth, Math.min(maxWidth, resizeStart.current.ow + dx));
                setSize({ width: newW });
                // Re-clamp pos so card stays inside container after resize
                setPos(prev => {
                    const cardH = cardRef.current?.offsetHeight ?? 120;
                    return clampPos(prev.x, prev.y, newW, cardH);
                });
            }
        }

        function onUp() {
            dragging.current = false;
            resizing.current = false;
        }

        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, [clampPos, minWidth, maxWidth, size.width]);

    return { pos, size, setPos, setSize, containerRef, cardRef, onCardPointerDown, onResizePointerDown };
}
