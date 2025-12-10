import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import * as fabric from 'fabric';

interface CanvasEditorProps {
    onCanvasReady: (canvas: fabric.Canvas) => void;
    logicalHeight?: number; // Optional prop to control logical height
    logicalWidth?: number; // Optional prop to control logical width
    padding?: number; // Optional padding override
    children?: React.ReactNode;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({ onCanvasReady, logicalHeight = 800, logicalWidth = 2400, padding, children }) => {
    const canvasEl = useRef<HTMLCanvasElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const canvasInstance = useRef<fabric.Canvas | null>(null);

    // Viewport State
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });

    // Drag State
    const [isDragging, setIsDragging] = useState(false);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const lastMousePos = useRef({ x: 0, y: 0 });

    const logicalHeightRef = useRef(logicalHeight);
    const logicalWidthRef = useRef(logicalWidth);
    const SCALE_FACTOR = 3;
    // const logicalWidth = 800 * SCALE_FACTOR; // REPLACED BY PROP
    // Use provided padding or default calculation
    const CANVAS_PADDING = padding !== undefined ? padding : (60 * SCALE_FACTOR); // Padding for controls

    // 1. Initialize Canvas (High-DPI)
    useEffect(() => {
        if (!canvasEl.current) return;

        const canvas = new fabric.Canvas(canvasEl.current, {
            width: logicalWidthRef.current + CANVAS_PADDING * 2,
            height: logicalHeightRef.current + CANVAS_PADDING * 2,
            backgroundColor: 'transparent',
            preserveObjectStacking: true,
            selection: false, // Disable group selection (drag box)
            enableRetinaScaling: true, // High-DPI support
            controlsAboveOverlay: true // Ensure controls are always on top (fixes clipping/hiding issues)
        });

        // Set viewport transform to shift content
        canvas.setViewportTransform([1, 0, 0, 1, CANVAS_PADDING, CANVAS_PADDING]);

        // Customize controls
        fabric.Object.prototype.setControlsVisibility({
            mtr: false, // No rotation
            ml: false,
            mr: false,
            mt: false,
            mb: false
        });
        fabric.Object.prototype.transparentCorners = false;
        fabric.Object.prototype.cornerColor = '#ffffff';
        fabric.Object.prototype.cornerStrokeColor = '#000000';
        fabric.Object.prototype.borderColor = '#000000';
        fabric.Object.prototype.cornerSize = 10 * SCALE_FACTOR;
        fabric.Object.prototype.touchCornerSize = 10 * SCALE_FACTOR;
        fabric.Object.prototype.borderScaleFactor = 2 * SCALE_FACTOR;

        canvasInstance.current = canvas;
        onCanvasReady(canvas);

        // --- Smart Constraints Logic ---
        const applyConstraints = (obj: fabric.Object) => {
            if (!obj.clipPath) return;

            const clip = obj.clipPath;
            // With absolutePositioned: true, clip.left/top are absolute canvas coordinates
            // clip.width/height are the unscaled dimensions of the Rect
            // clip.scaleX/scaleY are usually 1, but let's be safe

            const clipWidth = clip.width! * (clip.scaleX || 1);
            const clipHeight = clip.height! * (clip.scaleY || 1);
            const clipLeft = clip.left! - (clipWidth / 2); // Origin is center
            const clipTop = clip.top! - (clipHeight / 2);   // Origin is center

            const clipRight = clipLeft + clipWidth;
            const clipBottom = clipTop + clipHeight;

            // 1. Min Scale Constraint
            // Image must cover the clip area
            const minScaleX = clipWidth / obj.width!;
            const minScaleY = clipHeight / obj.height!;
            const minScale = Math.max(minScaleX, minScaleY);

            if ((obj.scaleX || 1) < minScale) obj.scaleX = minScale;
            if ((obj.scaleY || 1) < minScale) obj.scaleY = minScale;

            // 2. Pan Limits (Boundary Constraint)
            // Image origin is 'center'
            const objScaleX = obj.scaleX || 1;
            const objScaleY = obj.scaleY || 1;

            const objWidth = obj.width! * objScaleX;
            const objHeight = obj.height! * objScaleY;

            const objLeft = obj.left!;
            const objTop = obj.top!;

            // Calculate edges of the image
            const imgLeftEdge = objLeft - objWidth / 2;
            const imgRightEdge = objLeft + objWidth / 2;
            const imgTopEdge = objTop - objHeight / 2;
            const imgBottomEdge = objTop + objHeight / 2;

            // Constrain Horizontal
            // Left edge cannot be > clipLeft (gap on left)
            if (imgLeftEdge > clipLeft) {
                obj.left = clipLeft + objWidth / 2;
            }
            // Right edge cannot be < clipRight (gap on right)
            if (imgRightEdge < clipRight) {
                obj.left = clipRight - objWidth / 2;
            }

            // Constrain Vertical
            // Top edge cannot be > clipTop (gap on top)
            if (imgTopEdge > clipTop) {
                obj.top = clipTop + objHeight / 2;
            }
            // Bottom edge cannot be < clipBottom (gap on bottom)
            if (imgBottomEdge < clipBottom) {
                obj.top = clipBottom - objHeight / 2;
            }
        };

        canvas.on('object:moving', (e) => {
            if (e.target) applyConstraints(e.target);
        });

        canvas.on('object:scaling', (e) => {
            if (e.target) applyConstraints(e.target);
        });

        // Deselect on background click OR click on non-selectable object
        canvas.on('mouse:down', (e) => {
            if (!e.target || (e.target && !e.target.selectable)) {
                canvas.discardActiveObject();
                canvas.requestRenderAll();
            }
        });

        // Enforce Single Selection (Prevent Shift+Click multi-select)
        const enforceSingleSelection = (e: any) => {
            if (e.selected && e.selected.length > 1) {
                const lastSelected = e.selected[e.selected.length - 1];
                canvas.setActiveObject(lastSelected);
                canvas.requestRenderAll();
            }
        };

        canvas.on('selection:created', enforceSingleSelection);
        canvas.on('selection:updated', enforceSingleSelection);

        return () => {
            canvas.dispose();
            canvasInstance.current = null;
        };
    }, [onCanvasReady]);

    // 2. Update Canvas Height
    useEffect(() => {
        logicalHeightRef.current = logicalHeight;
        logicalWidthRef.current = logicalWidth;
        if (canvasInstance.current) {
            canvasInstance.current.setDimensions({
                width: logicalWidth + CANVAS_PADDING * 2,
                height: logicalHeight + CANVAS_PADDING * 2
            });
            // Ensure transform is kept (setDimensions might not reset it, but safety first)
            // Actually, we don't need to reset it if it wasn't changed.
        }
    }, [logicalHeight]);

    // 3. Auto-Fit Logic (Initial Load)
    useLayoutEffect(() => {
        if (!viewportRef.current) return;

        const viewportW = viewportRef.current.clientWidth;
        const viewportH = viewportRef.current.clientHeight;

        // Canvas dimensions (Padded)
        const canvasW = logicalWidthRef.current + CANVAS_PADDING * 2;
        const canvasH = logicalHeight + CANVAS_PADDING * 2;

        // Padding 5%
        const padding = 0.95;

        // Calculate scale to fit
        const scaleX = viewportW / canvasW;
        const scaleY = viewportH / canvasH;
        const fitScale = Math.min(scaleX, scaleY) * padding;

        // Center
        const initialX = (viewportW - canvasW * fitScale) / 2;
        const initialY = (viewportH - canvasH * fitScale) / 2;

        setScale(fitScale);
        setPan({ x: initialX, y: initialY });

    }, [logicalHeight, logicalWidth]); // Re-run if logical height/width changes

    // 4. Space Key Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                // Prevent scrolling if focus is on body/viewport
                // But allow if user is typing in an input? 
                // Usually we check document.activeElement
                if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
                    return;
                }
                e.preventDefault();
                setIsSpacePressed(true);

                // Disable fabric selection while panning
                if (canvasInstance.current) {
                    canvasInstance.current.selection = false;
                    canvasInstance.current.defaultCursor = 'grab';
                    canvasInstance.current.hoverCursor = 'grab';
                    canvasInstance.current.requestRenderAll();
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                setIsSpacePressed(false);
                setIsDragging(false); // Stop dragging if space released

                // Re-enable fabric selection (but keep group selection disabled)
                if (canvasInstance.current) {
                    canvasInstance.current.selection = false; // Keep drag selection disabled
                    canvasInstance.current.defaultCursor = 'default';
                    canvasInstance.current.hoverCursor = 'move'; // or whatever default
                    canvasInstance.current.requestRenderAll();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // 5. Zoom Logic (Zoom to Point)
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const ZOOM_SPEED = 0.1;
        const rect = e.currentTarget.getBoundingClientRect();

        // Mouse relative to viewport
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Calculate new scale
        const newScale = e.deltaY < 0 ? scale + ZOOM_SPEED : scale - ZOOM_SPEED;
        const clampedScale = Math.min(Math.max(newScale, 0.1), 5); // Min 0.1, Max 5

        // Math: Shift pan so the point under cursor stays in place
        // P_viewport = P_world * scale + pan
        // We want P_viewport to be constant (mouseX, mouseY)
        // P_world = (mouseX - pan) / scale
        // newPan = mouseX - P_world * newScale

        const worldX = (mouseX - pan.x) / scale;
        const worldY = (mouseY - pan.y) / scale;

        const newPanX = mouseX - worldX * clampedScale;
        const newPanY = mouseY - worldY * clampedScale;

        setScale(clampedScale);
        setPan({ x: newPanX, y: newPanY });
    };

    // 6. Pan Logic (Drag)
    const handleMouseDown = (e: React.MouseEvent) => {
        // Pan if Space is pressed OR Middle Mouse Button
        if (isSpacePressed || e.button === 1) {
            setIsDragging(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            // Important: Stop propagation so Fabric doesn't get the click
            // But we are on the wrapper. Fabric is inside.
            // If we are on the wrapper (which covers the canvas?), we need to ensure we don't block Fabric if NOT panning.
            // The wrapper has the event handler.
            // If we don't call stopPropagation, it goes down? No, React events bubble UP.
            // We are on the PARENT.
            // So if we clicked on Canvas, the event bubbled up to here.
            // If we want to PREVENT Fabric from acting, we should have captured it?
            // Or, if we are panning, we just move the div. Fabric will move with it.
            // The issue is if Fabric ALSO selects an object.
            // By setting canvas.selection = false in useEffect, we disable selection box.
            // But object selection on click?
            // Fabric objects consume events. If we click an object, Fabric handles it and stops propagation usually?
            // If Fabric stops propagation, this handler might not even run if it's bubbling.
            // Let's assume we want to override Fabric.
            // If Space is pressed, we want to PAN, not select.
            // We can use Capture phase or just rely on the fact that we disabled selection?
            // Disabling selection only disables the blue box. Objects are still selectable.
            // To make objects unselectable: canvas.skipTargetFind = true;
        }

        // Deselect if clicking background (outside canvas)
        if (!isSpacePressed && e.button === 0) {
            const target = e.target as HTMLElement;
            // If we clicked something that is NOT the fabric canvas (interaction layer)
            if (!target.classList.contains('upper-canvas')) {
                canvasInstance.current?.discardActiveObject();
                canvasInstance.current?.requestRenderAll();
            }
        }
    };

    // Update canvas interactive state based on Space key
    useEffect(() => {
        if (canvasInstance.current) {
            // When Space is pressed, we want to disable interaction with objects
            canvasInstance.current.skipTargetFind = isSpacePressed;
            canvasInstance.current.requestRenderAll();
        }
    }, [isSpacePressed]);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;

        const deltaX = e.clientX - lastMousePos.current.x;
        const deltaY = e.clientY - lastMousePos.current.y;

        setPan(prev => ({
            x: prev.x + deltaX,
            y: prev.y + deltaY
        }));

        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    return (
        <div
            ref={viewportRef}
            className={`w-full h-full overflow-hidden bg-transparent relative ${isSpacePressed ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'}`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
        >
            {/* WORLD - Transformed Layer */}
            <div
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                    transformOrigin: '0 0',
                    willChange: 'transform',
                    position: 'absolute',
                    top: 0,
                    left: 0
                }}
            >
                {/* Canvas with High-DPI rendering */}
                <canvas
                    ref={canvasEl}
                    style={{
                        imageRendering: 'auto',
                        // Floating Effect:
                        // drop-shadow: Makes the CONTENT (Text/Photos) hover.
                        filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.2))'
                    }}
                // Note: 'image-rendering: high-quality' is not a standard CSS value in all browsers, 
                // but 'auto' or default usually uses bilinear/bicubic.
                // User requested "image-rendering: high-quality".
                />
                {children}
            </div>
        </div>
    );
};
