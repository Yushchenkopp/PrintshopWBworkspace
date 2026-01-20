import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import * as fabric from 'fabric';

interface CanvasEditorProps {
    onCanvasReady: (canvas: fabric.Canvas) => void;
    logicalHeight?: number; // Optional prop to control logical height
    logicalWidth?: number; // Optional prop to control logical width
    padding?: number; // Optional padding override
    autoZoomOnResize?: boolean; // Optional: Disable auto-fit on subsequent resizing
    children?: React.ReactNode;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({ onCanvasReady, logicalHeight = 800, logicalWidth = 2400, padding, autoZoomOnResize = true, children }) => {
    const canvasEl = useRef<HTMLCanvasElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const canvasInstance = useRef<fabric.Canvas | null>(null);

    // Viewport State
    const [scale, setScale] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });

    // Drag State
    const [isDragging, setIsDragging] = useState(false);
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
    const initialRenderRef = useRef(true);

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

        // Skip auto-zoom if disabled AND it's not the very first render (we still want initial fit)
        // Actually, preventing 'autoZoomOnResize' usually implies we want to keep current pan/scale.
        if (!autoZoomOnResize && !initialRenderRef.current) return;

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

        initialRenderRef.current = false; // Mark initial render complete

    }, [logicalHeight, logicalWidth]); // Re-run if logical height/width changes

    // 4. Space Key Listener (REMOVED - panning now works with left mouse button)
    // Kept for potential future use or middle-click panning indicator

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

    // 6. Pan Logic (Drag) - Now works with left mouse button on empty canvas area
    const handleMouseDown = (e: React.MouseEvent) => {
        // Pan with Middle Mouse Button (always)
        if (e.button === 1) {
            setIsDragging(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        // Pan with Left Mouse Button ONLY if clicking on empty space (not on canvas objects)
        if (e.button === 0) {
            const target = e.target as HTMLElement;
            // Check if we clicked on the fabric canvas interaction layer
            if (target.classList.contains('upper-canvas')) {
                // Check if there's an object under the cursor
                const canvas = canvasInstance.current;
                if (canvas) {
                    const objectUnderCursor = canvas.findTarget(e.nativeEvent as MouseEvent);

                    // If no object under cursor, start panning
                    if (!objectUnderCursor) {
                        setIsDragging(true);
                        lastMousePos.current = { x: e.clientX, y: e.clientY };
                        canvas.discardActiveObject();
                        canvas.requestRenderAll();
                    }
                }
            } else {
                // Clicked outside canvas (on wrapper), start panning
                setIsDragging(true);
                lastMousePos.current = { x: e.clientX, y: e.clientY };
                canvasInstance.current?.discardActiveObject();
                canvasInstance.current?.requestRenderAll();
            }
        }
    };

    // Update cursor on canvas when dragging state changes
    useEffect(() => {
        if (canvasInstance.current) {
            if (isDragging) {
                canvasInstance.current.defaultCursor = 'grabbing';
                canvasInstance.current.hoverCursor = 'grabbing';
            } else {
                canvasInstance.current.defaultCursor = 'default';
                canvasInstance.current.hoverCursor = 'move';
            }
            canvasInstance.current.requestRenderAll();
        }
    }, [isDragging]);



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
            className={`w-full h-full overflow-hidden bg-transparent relative ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
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
