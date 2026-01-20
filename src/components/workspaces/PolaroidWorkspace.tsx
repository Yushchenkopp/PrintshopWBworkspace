import React, { useState, useCallback, useEffect } from 'react';
import { CanvasEditor } from '../CanvasEditor';
import { type TemplateType } from '../../utils/TemplateGenerators';
import { Trash2, ImagePlus, ArrowDownToLine, LayoutDashboard, BookHeart, SquareParking, SquareUser, Volleyball, PenTool, Plus, Sun, Shirt, Check, Loader2, Type, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { AnimatePresence, motion } from 'framer-motion';
import * as fabric from 'fabric';
import heic2any from 'heic2any';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy
} from '@dnd-kit/sortable';
import { SortablePhoto } from '../SortablePhoto';
import { exportHighRes, generateHighResBlob } from '../../utils/ExportUtils';

interface PolaroidWorkspaceProps {
    onSwitchTemplate: (template: TemplateType) => void;
    onOpenMockup: () => void;
    onTransferToMockup?: (printData: string) => void;
    mockupPrintCount?: number;
}

// ... (skipping unchanged code)

// Constants for Polaroid Windows (Approximate - need calibration)
// Assuming 2480x3508 (A4) or similar. 
// We will load the image and center it.
const TEMPLATE_URL = '/templates/polaroids-bg.png';

// Calibrated slots coordinates
const SLOTS = [
    { x: 18, y: 22, w: 534, h: 477 },
    { x: 652, y: 24, w: 533, h: 472 }
];

const DEBUG_BOUNDARIES = false;

// Helper to check text width
const checkTextWidth = (text: string, fontSize: number, maxWidth: number): boolean => {
    // Create a temporary canvas context for measurement
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return true; // Fallback if context creation fails

    context.font = `${fontSize}px Caveat`;

    // Check each line separately
    const lines = text.split('\n');
    return lines.every(line => context.measureText(line).width <= maxWidth);
};


export const PolaroidWorkspace: React.FC<PolaroidWorkspaceProps> = ({ onSwitchTemplate, onOpenMockup, onTransferToMockup, mockupPrintCount }) => {
    const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
    const [parent] = useAutoAnimate();
    // Fixed 2 slots for Polaroid: [Left, Right]
    const [images, setImages] = useState<({ id: string; url: string } | null)[]>([null, null]);
    const [isReady, setIsReady] = useState(false);
    const templateRef = React.useRef<fabric.Image | null>(null);

    const [textVariant, setTextVariant] = useState<'wife' | 'husband'>('wife');
    const [customTexts, setCustomTexts] = useState<[string, string]>([
        "Интересно, когда я вырасту,\nкто будет моей женой?",
        "Я буду!"
    ]);
    // ['center', 'right'] default for wife/husband templates
    const [textAlignments, setTextAlignments] = useState<['left' | 'center' | 'right', 'left' | 'center' | 'right']>(['center', 'right']);

    // Debug State
    const [debugInfo, setDebugInfo] = useState<{ [key: number]: { padding: number, width: number } }>({});

    const [brightness, setBrightness] = useState<number>(0);
    const [isTransferring, setIsTransferring] = useState(false);
    const [isTransferSuccess, setIsTransferSuccess] = useState(false);

    // Reset texts when variant changes
    useEffect(() => {
        setCustomTexts([
            textVariant === 'wife'
                ? "Интересно, когда я вырасту,\nкто будет моей женой?"
                : "Интересно, когда я вырасту,\nкто будет моим мужем?",
            "Я буду!"
        ]);
        // Reset alignment to defaults matching the template style
        setTextAlignments(['center', 'right']);
    }, [textVariant]);

    // We only need 2 images for Polaroid, but we keep the list flexible for the sidebar
    // However, the canvas will only display the first 2.

    const handleCanvasReady = useCallback((c: fabric.Canvas) => {
        setCanvas(c);
        // Transparent background for "floating" effect
        c.backgroundColor = 'transparent';
        c.backgroundColor = 'transparent';
        c.renderAll();
    }, []);

    const handleToMockup = async () => {
        if (!canvas || !onTransferToMockup || isTransferring) return;

        setIsTransferring(true);
        setIsTransferSuccess(false);

        await new Promise(resolve => setTimeout(resolve, 300));

        const blob = await generateHighResBlob(canvas);

        setIsTransferring(false);

        if (blob) {
            const url = URL.createObjectURL(blob);
            onTransferToMockup(url);
            setIsTransferSuccess(true);
            setTimeout(() => setIsTransferSuccess(false), 2000);
        } else {
            alert("Не удалось создать макет.");
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetSlotIndex?: number) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);

            // Process files first
            const processedImages: { id: string; url: string }[] = [];
            for (const file of files) {
                let imageUrl: string;
                if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
                    try {
                        const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg' });
                        const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                        imageUrl = URL.createObjectURL(blob);
                    } catch (error) { continue; }
                } else {
                    imageUrl = URL.createObjectURL(file);
                }
                processedImages.push({ id: crypto.randomUUID(), url: imageUrl });
            }

            setImages((prev) => {
                const newSlots = [...prev];
                let currentFileIndex = 0;

                // 1. If targetSlotIndex is provided, try to fill that specific slot first
                if (targetSlotIndex !== undefined && targetSlotIndex !== null && targetSlotIndex < newSlots.length) {
                    if (processedImages[currentFileIndex]) {
                        newSlots[targetSlotIndex] = processedImages[currentFileIndex];
                        currentFileIndex++;
                    }
                }

                // 2. Fill remaining empty slots with remaining files
                for (let i = 0; i < newSlots.length; i++) {
                    if (currentFileIndex >= processedImages.length) break;
                    if (newSlots[i] === null) {
                        newSlots[i] = processedImages[currentFileIndex];
                        currentFileIndex++;
                    }
                }

                return newSlots;
            });

            // Clear input value to allow re-uploading the same file
            e.target.value = '';
        }
    };

    const handleRemoveImage = (id: string) => {
        setImages(prev => prev.map(img => (img && img.id === id) ? null : img));
    };
    const handleClearCanvas = () => setImages([null, null]);

    // DND Kit Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setImages((items) => {
                // We need to handle nulls. 
                // Since sidebar only shows non-nulls, we are reordering the non-null items?
                // Or are we swapping slots?
                // For simplicity, let's just swap the slots if we can find them.
                // But DND kit works on the filtered list.
                // Let's just map the filtered list back to slots? 
                // Actually, if we have fixed slots, dragging in sidebar might be confusing if we don't visualize slots.
                // Let's assume sidebar reordering just re-fills the slots in new order.

                const currentNonNulls = items.filter((i): i is { id: string; url: string } => i !== null);
                const oldIndex = currentNonNulls.findIndex((item) => item.id === active.id);
                const newIndex = currentNonNulls.findIndex((item) => item.id === over?.id);

                const reordered = arrayMove(currentNonNulls, oldIndex, newIndex);

                // Now put them back into slots. 
                // Strategy: Fill slots from left to right with reordered items.
                // Any remaining slots become null.
                const newSlots: ({ id: string; url: string } | null)[] = [null, null];
                for (let i = 0; i < 2; i++) {
                    if (reordered[i]) newSlots[i] = reordered[i];
                }
                return newSlots;
            });
        }
    };

    // --- POLAROID RENDERING LOGIC ---
    useEffect(() => {
        if (!canvas) return;

        const renderPolaroid = async () => {
            const bottomLayer: fabric.Object[] = []; // Photos & Placeholders
            const topLayer: fabric.Object[] = [];    // Text

            try {
                // Ensure font is loaded before rendering to prevent layout shifts
                // Robust Font Loading Check
                const fontStack = "Caveat";
                try {
                    await document.fonts.load(`44px "${fontStack}"`);
                    await document.fonts.load(`55px "${fontStack}"`);
                    await document.fonts.ready;

                    // Double-check if the font is actually in the loaded set
                    let isFontLoaded = document.fonts.check(`44px "${fontStack}"`);
                    let attempts = 0;
                    // Increased to 50 attempts * 100ms = 5 seconds max wait
                    while (!isFontLoaded && attempts < 50) {
                        await new Promise(r => setTimeout(r, 100));
                        isFontLoaded = document.fonts.check(`44px "${fontStack}"`);
                        attempts++;
                    }
                } catch (fontErr) {
                    console.warn("Font loading warning:", fontErr);
                }

                let templateImg = templateRef.current;
                if (!templateImg) {
                    templateImg = await fabric.Image.fromURL(TEMPLATE_URL, {
                        crossOrigin: 'anonymous'
                    });
                    templateRef.current = templateImg;
                }

                // Scale template to fit canvas width (assuming 1200 logical width)
                // We'll scale it to fit nicely.
                const canvasWidth = 1200;
                const LOGICAL_CANVAS_WIDTH = 2400; // From CanvasEditor
                const LOGICAL_CANVAS_HEIGHT = 1200; // From JSX
                const OFFSET_X = (LOGICAL_CANVAS_WIDTH - canvasWidth) / 2;

                const scale = canvasWidth / templateImg.width!;
                templateImg.scale(scale);

                const scaledHeight = templateImg.height! * scale;
                const OFFSET_Y = (LOGICAL_CANVAS_HEIGHT - scaledHeight) / 2;

                // Center the template
                templateImg.set({
                    left: OFFSET_X,
                    top: OFFSET_Y,
                    selectable: false,
                    evented: false,
                });

                // --- PRE-LOAD CONTENT ---
                // activeImages is just images (fixed 2 slots)
                const activeImages = images;

                // 1. Prepare Images & Placeholders
                for (let i = 0; i < 2; i++) {
                    const slot = SLOTS[i];
                    // Adjust for scale (slots are already in canvas coords now)
                    const slotX = slot.x + OFFSET_X;
                    const slotY = slot.y + OFFSET_Y;
                    const slotW = slot.w;
                    const slotH = slot.h;

                    const imgData = activeImages[i];

                    if (imgData) {
                        const img = await fabric.Image.fromURL(imgData.url, { crossOrigin: 'anonymous' });

                        // Scale Logic: COVER + Tiny Buffer
                        // We take the larger scale to ensure the slot is fully covered.
                        const scaleX = slotW / img.width!;
                        const scaleY = slotH / img.height!;
                        const imgScale = Math.max(scaleX, scaleY) * 1.001; // 0.1% buffer to avoid precision bugs

                        img.scale(imgScale);

                        // Apply Brightness Filter
                        if (brightness !== 0) {
                            img.filters = [new fabric.filters.Brightness({ brightness: brightness })];
                            img.applyFilters();
                        }

                        // Calculate centered position (Top/Left origin)
                        // We want the center of the image to match the center of the slot.
                        // Image Center = Left + Width/2
                        // Slot Center = SlotX + SlotW/2
                        // Left + Width/2 = SlotX + SlotW/2




                        // Create Clip Path (The Slot)
                        const clipPath = new fabric.Rect({
                            left: slotX + slotW / 2,
                            top: slotY + slotH / 2,
                            width: slotW,
                            height: slotH,
                            originX: 'center',
                            originY: 'center',
                            absolutePositioned: true,
                        });

                        img.set({
                            selectable: true,
                            evented: true,
                            originX: 'center',
                            originY: 'center',
                            left: slotX + slotW / 2,
                            top: slotY + slotH / 2,
                            clipPath: clipPath,
                            hasControls: true,
                            hasBorders: true,
                            borderColor: '#27272a', // Zinc-800
                            cornerColor: '#ffffff',
                            cornerStrokeColor: '#27272a',
                            transparentCorners: false,
                            cornerSize: 10,
                            borderScaleFactor: 2,
                        });

                        bottomLayer.push(img);

                    } else {
                        // Placeholder
                        const placeholder = new fabric.Rect({
                            left: slotX,
                            top: slotY,
                            width: slotW,
                            height: slotH,
                            fill: '#e4e4e7', // Reverted to gray
                            selectable: false,
                            hoverCursor: 'pointer'
                        });

                        // Create ImagePlus Icon (Lucide style)
                        const createIcon = (color: string) => {
                            const strokeWidth = 2;
                            // Lucide ImagePlus paths (24x24 grid)

                            // Frame: M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7
                            const frame = new fabric.Path('M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7', {
                                fill: '', stroke: color, strokeWidth, strokeLineCap: 'round', strokeLineJoin: 'round'
                            });

                            // Plus H: M16 5h6
                            const plusH = new fabric.Line([16, 5, 22, 5], {
                                stroke: color, strokeWidth, strokeLineCap: 'round'
                            });

                            // Plus V: M19 2v6
                            const plusV = new fabric.Line([19, 2, 19, 8], {
                                stroke: color, strokeWidth, strokeLineCap: 'round'
                            });

                            // Sun: circle cx=9 cy=9 r=2
                            const sun = new fabric.Circle({
                                left: 7, top: 7, radius: 2, fill: '', stroke: color, strokeWidth
                            });

                            // Mountain: m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21
                            const mountain = new fabric.Path('m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21', {
                                fill: '', stroke: color, strokeWidth, strokeLineCap: 'round', strokeLineJoin: 'round'
                            });

                            return new fabric.Group([frame, plusH, plusV, sun, mountain], {
                                originX: 'center', originY: 'center',
                                left: slotX + slotW / 2,
                                top: slotY + slotH / 2,
                                scaleX: 2.5, // Smaller initial scale
                                scaleY: 2.5,
                                selectable: false
                            });
                        };

                        const iconGroup = createIcon('#9CA3AF'); // Initial color: zinc-400

                        const group = new fabric.Group([placeholder, iconGroup], {
                            selectable: false,
                            evented: true,
                            hoverCursor: 'pointer',
                            subTargetCheck: true // Allow checking sub-targets if needed, though we handle group hover
                        });

                        // Hover Effects
                        group.on('mouseover', () => {
                            // Darken icon
                            iconGroup.forEachObject((obj) => {
                                obj.set({ stroke: '#374151' }); // zinc-700
                            });

                            // Smooth Scale Up (1.1x of 2.5 = 2.75)
                            iconGroup.animate({ scaleX: 2.75, scaleY: 2.75 }, {
                                duration: 200, // 0.2s
                                onChange: canvas.requestRenderAll.bind(canvas),
                                easing: fabric.util.ease.easeOutQuad
                            });
                        });

                        group.on('mouseout', () => {
                            // Restore icon
                            iconGroup.forEachObject((obj) => {
                                obj.set({ stroke: '#9CA3AF' }); // zinc-400
                            });

                            // Smooth Scale Down
                            iconGroup.animate({ scaleX: 2.5, scaleY: 2.5 }, {
                                duration: 200, // 0.2s
                                onChange: canvas.requestRenderAll.bind(canvas),
                                easing: fabric.util.ease.easeOutQuad
                            });
                        });

                        // Add Events - using screen coordinates to detect drag vs click
                        let mouseDownPos: { x: number; y: number } | null = null;
                        group.on('mousedown', (e) => {
                            const evt = e.e as MouseEvent;
                            mouseDownPos = { x: evt.clientX, y: evt.clientY };
                        });
                        group.on('mouseup', (e) => {
                            if (!mouseDownPos) return;
                            const evt = e.e as MouseEvent;
                            const distance = Math.sqrt(
                                Math.pow(evt.clientX - mouseDownPos.x, 2) +
                                Math.pow(evt.clientY - mouseDownPos.y, 2)
                            );
                            // Only trigger click if mouse didn't move much (not a pan)
                            if (distance < 10) {
                                document.getElementById(`polaroid-upload-${i}`)?.click();
                            }
                            mouseDownPos = null;
                        });
                        bottomLayer.push(group);
                    }
                }

                // 2. Prepare Text Fields
                // Use customTexts state
                const currentTexts = customTexts;
                const currentAligns = textAlignments;

                for (let i = 0; i < 2; i++) {
                    const slot = SLOTS[i];
                    // Adjust for scale and offset
                    const slotX = slot.x + OFFSET_X;
                    const slotY = slot.y + OFFSET_Y;
                    const slotW = slot.w;
                    const slotH = slot.h;

                    let textTop = slotY + slotH;
                    if (i === 1) textTop -= 5; // Adjustment for right text to be slightly higher

                    let textLeft: number;
                    let originX: 'center' | 'right' | 'left' = 'center';
                    let fontSize: number;
                    const align = currentAligns[i];

                    // Standardize Font Size for both to looks consistent, or keep distinct?
                    // Previous: 44 (left), 55 (right).
                    // Let's keep distinct defaults as requested "intuitive", but alignment changes position.

                    if (i === 0) {
                        fontSize = 44;
                    } else {
                        fontSize = 55;
                    }

                    // Calculate position based on alignment
                    if (align === 'left') {
                        textLeft = slotX + 30; // Padding from left
                        originX = 'left';
                    } else if (align === 'right') {
                        textLeft = slotX + slotW - 30; // Padding from right
                        originX = 'right';
                    } else {
                        // center
                        textLeft = slotX + slotW / 2;
                        originX = 'center';
                    }

                    // Adjustment for right text horizontal position
                    if (i === 1) {
                        textLeft += 5;
                    }

                    // Use Text to prevent unwanted auto-wrapping (enforces explicit newlines)
                    const text = new fabric.Text(currentTexts[i], {
                        left: textLeft,
                        top: textTop,
                        // Removed width to prevent wrapping. Text will strictly follow \n
                        fontFamily: 'Caveat',
                        fontSize: fontSize,
                        fill: '#27272a',
                        originX: originX,
                        originY: 'top',
                        textAlign: align,
                        lineHeight: 0.8,
                        selectable: false, // Disable selection/movement
                        evented: false, // Disable events
                        hasControls: false,
                        lockRotation: true,
                        lockScalingX: true,
                        lockScalingY: true,
                        lockMovementX: true,
                        lockMovementY: true,
                    });

                    // Constraints removed for static text to prevent accidental shifts
                    // The initial position is calculated correctly above.

                    topLayer.push(text);

                    // --- DEBUG VISUALIZATION ---
                    if (DEBUG_BOUNDARIES) {
                        const padding = 30;
                        const debugRect = new fabric.Rect({
                            left: slotX + padding,
                            top: textTop,
                            width: slotW - (padding * 2),
                            height: 120, // Arbitrary visual height for text area
                            fill: 'rgba(255, 0, 0, 0.1)',
                            stroke: 'red',
                            strokeWidth: 2,
                            strokeDashArray: [5, 5],
                            selectable: true,
                            evented: true,
                            transparentCorners: false,
                            cornerColor: 'red',
                            hasControls: true,
                            lockRotation: true,
                            lockUniScaling: false,
                            uniformScaling: false
                        });

                        debugRect.setControlsVisibility({
                            mt: true, mb: true, ml: true, mr: true,
                            bl: true, br: true, tl: true, tr: true,
                            mtr: false
                        });

                        const updateDebugInfo = () => {
                            const padding = Math.round(debugRect.left - slotX);
                            const width = Math.round(debugRect.getScaledWidth());
                            setDebugInfo(prev => ({
                                ...prev,
                                [i]: { padding, width }
                            }));
                        };

                        // Initial set
                        updateDebugInfo();

                        // Real-time updates
                        debugRect.on('modified', updateDebugInfo);
                        debugRect.on('scaling', updateDebugInfo);
                        debugRect.on('moving', updateDebugInfo);

                        topLayer.push(debugRect);
                    }
                }

                // --- SYNCHRONOUS SWAP ---
                // 1. Remove everything
                canvas.remove(...canvas.getObjects());

                // 2. Add Bottom Layer (Photos/Placeholders)
                canvas.add(...bottomLayer);

                // 3. Add Template
                canvas.add(templateImg);

                // 4. Add Top Layer (Text)
                canvas.add(...topLayer);

                canvas.requestRenderAll();
                // Explicit Deselection Handler for Polaroid
                // (CanvasEditor handles this, but adding here ensures specific behavior for this mode if needed)
                canvas.requestRenderAll();
                canvas.on('mouse:down', (e) => {
                    if (!e.target) {
                        canvas.discardActiveObject();
                        canvas.requestRenderAll();
                    }
                });

                // FORCE UPDATE to fix font metrics race condition
                setTimeout(() => {
                    topLayer.forEach(obj => {
                        if (obj instanceof fabric.Text) {
                            obj.initDimensions();
                        }
                    });
                    canvas.requestRenderAll();
                }, 100);

                setTimeout(() => {
                    canvas.requestRenderAll();
                }, 500);

                canvas.requestRenderAll();

                if (!isReady) setIsReady(true);
            } catch (err) {
                console.error("Error loading template", err);
            }
        };

        renderPolaroid();

    }, [canvas, images]); // Removed textVariant and brightness to prevent re-render

    // --- SMART UPDATE: TEXT ---
    useEffect(() => {
        if (!canvas) return;

        // Find and update text objects
        const textObjects = canvas.getObjects().filter(obj => obj.type === 'text') as fabric.Text[];

        // Sort by X position to guarantee Order: [Left, Right]
        textObjects.sort((a, b) => (a.left || 0) - (b.left || 0));

        // Re-calculate constants for positioning updates
        const canvasWidth = 1200;
        const LOGICAL_CANVAS_WIDTH = 2400; // From CanvasEditor
        const LOGICAL_CANVAS_HEIGHT = 1200; // From JSX
        const OFFSET_X = (LOGICAL_CANVAS_WIDTH - canvasWidth) / 2;
        // Template scaling calculation mirrored from render
        // Ideal way would be to store these metrics or calculate them once, but re-calc is cheap here.
        // Assuming template image is approx width we expect... 
        // Let's rely on relative updating: 
        // Actually, we need exact coords for alignment changes.
        // Let's re-use SLOTS + OFFSET_X if template scaling is consistent (it is forced to 1200 width).
        const imageWidth = 2480; // Approximate
        const scale = canvasWidth / imageWidth;
        // Wait, in renderPolaroid we assume templateImg.width is standard.
        // Let's assume the renderPolaroid logic for OFFSET_X is correct and consistent.

        // Let's just update based on SLOTS + OFFSET_X
        // Since we know the Canvas is 1200 wide (offset applied inside parent component via viewBox?),
        // Wait, CanvasEditor internal canvas is LOGICAL_CANVAS_WIDTH (2400).
        // renderPolaroid uses:
        // const canvasWidth = 1200;
        // const OFFSET_X = (2400 - 1200) / 2 = 600.

        // This seems correct.

        const OFFSET_Y = (1200 - (3508 * (1200 / 2480))) / 2; // Rough approximation, but we only need X for alignment.

        const updateTextObject = (obj: fabric.Text, index: number) => {
            const align = textAlignments[index];
            const text = customTexts[index];
            const slot = SLOTS[index];
            const slotX = slot.x + OFFSET_X;
            const slotW = slot.w;

            let newLeft: number;
            let newOriginX: string;

            if (align === 'left') {
                newLeft = slotX + 30;
                newOriginX = 'left';
            } else if (align === 'right') {
                newLeft = slotX + slotW - 30;
                newOriginX = 'right';
            } else {
                newLeft = slotX + slotW / 2;
                newOriginX = 'center';
            }

            // check if update needed
            let needsUpdate = false;
            if (obj.text !== text) { obj.set({ text }); needsUpdate = true; }
            if (obj.textAlign !== align) { obj.set({ textAlign: align }); needsUpdate = true; }
            if (obj.originX !== newOriginX) { obj.set({ originX: newOriginX }); needsUpdate = true; }
            // Float comparison for left
            if (Math.abs((obj.left || 0) - newLeft) > 1) { obj.set({ left: newLeft }); needsUpdate = true; }

            return needsUpdate;
        };

        if (textObjects.length >= 2) {
            let changed = false;
            if (updateTextObject(textObjects[0], 0)) changed = true;
            if (updateTextObject(textObjects[1], 1)) changed = true;

            if (changed) canvas.requestRenderAll();
        }

    }, [canvas, customTexts, textAlignments]);

    // --- SMART UPDATE: BRIGHTNESS ---
    useEffect(() => {
        if (!canvas) return;
        // Find actual images (not placeholders)
        // Images are in bottomLayer, type 'image' (if we added them as fabric.Image)
        // We specifically added them as fabric.Image from URL.
        const imageObjects = canvas.getObjects().filter(obj => obj.type === 'image' && obj !== templateRef.current) as fabric.Image[];

        imageObjects.forEach(img => {
            // Apply Brightness Filter
            // Note: In Fabric, we replace the filter array or update it.
            // Since we only have one filter (Brightness), replacement is safe/fast.
            if (brightness !== 0) {
                img.filters = [new fabric.filters.Brightness({ brightness: brightness })];
            } else {
                img.filters = [];
            }
            img.applyFilters();
        });
        canvas.requestRenderAll();

    }, [canvas, brightness]);

    return (
        <div className="h-screen bg-slate-100 flex flex-col overflow-hidden" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            {/* Font Warmer: Invisible element to force browser to download font immediately */}
            <div style={{ fontFamily: 'Caveat', position: 'absolute', opacity: 0, pointerEvents: 'none', zIndex: -1 }}>
                Font Warmer: Интересно, когда я вырасту
            </div>
            <aside className="sidebar-panel">
                <div className="flex justify-center">
                    <img src="/logo.webp" alt="Logo" className="w-[220px] object-contain" />
                </div>
                <div className="">
                    <div className="flex flex-row justify-between w-full">
                        {[
                            { id: 'collage', icon: LayoutDashboard, label: 'Коллаж' },
                            { id: 'polaroid', icon: BookHeart, label: 'Полароид' },
                            { id: 'papa', icon: SquareParking, label: 'PAPA' },
                            { id: 'baby', icon: SquareUser, label: 'Отчество' },
                            { id: 'jersey', icon: Volleyball, label: 'Спорт' },
                            { id: 'constructor', icon: PenTool, label: 'Конструктор' }
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => onSwitchTemplate(item.id as TemplateType)}
                                className={`w-[44px] h-[44px] flex items-center justify-center rounded-xl cursor-pointer group relative transition-all duration-200 ease-out transform-gpu will-change-transform [backface-visibility:hidden] active:scale-90 active:translate-y-0 ${item.id === 'polaroid' ? 'bg-zinc-900 text-white shadow-md' : 'bg-white/40 border border-zinc-900/10 shadow-sm text-zinc-600 hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-md hover:border-zinc-300 hover:text-zinc-900 active:bg-zinc-200 active:border-zinc-200 active:shadow-none'}`}
                                title={item.label}
                            >
                                <item.icon className="w-[18px] h-[18px] transform-gpu will-change-transform antialiased [backface-visibility:hidden] [transform:translateZ(0)]" />
                            </button>
                        ))}
                    </div>
                </div>

                <section>

                    <div className="relative bg-[#F5F5F7] rounded-[10px] p-1 flex h-[36px]">
                        {/* Sliding Indicator */}
                        <div
                            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-[6px] shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${textVariant === 'wife' ? 'left-1' : 'left-[calc(50%)]'}`}
                        />

                        <button
                            onClick={() => setTextVariant('wife')}
                            className={`flex-1 relative z-10 text-[13px] font-medium transition-colors duration-200 ${textVariant === 'wife' ? 'text-black' : 'text-[#8E8E93]'}`}
                        >
                            Жена
                        </button>
                        <button
                            onClick={() => setTextVariant('husband')}
                            className={`flex-1 relative z-10 text-[13px] font-medium transition-colors duration-200 ${textVariant === 'husband' ? 'text-black' : 'text-[#8E8E93]'}`}
                        >
                            Муж
                        </button>
                    </div>

                    {/* Editable Text Inputs */}
                    <div className="mt-4 space-y-3">
                        {/* Text 1 (Left) */}
                        <div className="flex gap-2 items-start">
                            <div className="relative flex-1 group">
                                <Type className="absolute left-3 top-3 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" />
                                <textarea
                                    value={customTexts[0]}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        // Max Width ~534px, Font Size 44, 2 lines max
                                        if (val.split('\n').length <= 2 && checkTextWidth(val, 44, 534)) {
                                            setCustomTexts([val, customTexts[1]]);
                                        }
                                    }}
                                    className="w-full pl-10 pr-3 py-2.5 bg-zinc-100 rounded-xl border-transparent text-sm outline-none shadow-inner transition-all duration-200 placeholder:text-zinc-400 focus:bg-white focus:shadow-md focus:ring-2 focus:ring-zinc-200 h-[66px] resize-none leading-tight"
                                    placeholder=" Текст слева"
                                />
                            </div>
                            <div className="flex flex-col bg-zinc-100 rounded-lg p-0.5 h-[66px] justify-between">
                                {[
                                    { id: 'left', icon: AlignLeft },
                                    { id: 'center', icon: AlignCenter },
                                    { id: 'right', icon: AlignRight }
                                ].map((align) => (
                                    <button
                                        key={align.id}
                                        onClick={() => setTextAlignments([align.id as any, textAlignments[1]])}
                                        className={`p-1 rounded-md transition-all flex-1 flex items-center justify-center ${textAlignments[0] === align.id ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
                                    >
                                        <align.icon className="w-3.5 h-3.5" />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Text 2 (Right) */}
                        <div className="flex gap-2 items-start">
                            <div className="relative flex-1 group">
                                <Type className="absolute left-3 top-3 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" />
                                <textarea
                                    value={customTexts[1]}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        // Max Width ~527px, Font Size 55, 2 lines max
                                        if (val.split('\n').length <= 2 && checkTextWidth(val, 55, 527)) {
                                            setCustomTexts([customTexts[0], val]);
                                        }
                                    }}
                                    className="w-full pl-10 pr-3 py-2.5 bg-zinc-100 rounded-xl border-transparent text-sm outline-none shadow-inner transition-all duration-200 placeholder:text-zinc-400 focus:bg-white focus:shadow-md focus:ring-2 focus:ring-zinc-200 h-[66px] resize-none leading-tight"
                                    placeholder="Текст справа"
                                />
                            </div>
                            <div className="flex flex-col bg-zinc-100 rounded-lg p-0.5 h-[66px] justify-between">
                                {[
                                    { id: 'left', icon: AlignLeft },
                                    { id: 'center', icon: AlignCenter },
                                    { id: 'right', icon: AlignRight }
                                ].map((align) => (
                                    <button
                                        key={align.id}
                                        onClick={() => setTextAlignments([textAlignments[0], align.id as any])}
                                        className={`p-1 rounded-md transition-all flex-1 flex items-center justify-center ${textAlignments[1] === align.id ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
                                    >
                                        <align.icon className="w-3.5 h-3.5" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>


                </section>

                <section>

                    {images.every(img => img === null) ? (
                        <label className="upload-photo-block border-2 border-dashed border-zinc-200/50 hover:border-zinc-400 hover:bg-zinc-100/50 rounded-2xl h-[110px] flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group">
                            <input type="file" className="hidden" multiple accept="image/*" onChange={(e) => {
                                handleImageUpload(e);
                            }} />
                            <ImagePlus className="w-8 h-8 text-zinc-300 mb-2 group-hover:text-zinc-400 transition-colors" />
                            <span className="text-sm font-medium text-zinc-600">Загрузить фото</span>
                        </label>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={images.filter((i): i is { id: string; url: string } => i !== null).map(img => img.id)} strategy={rectSortingStrategy}>
                                <div ref={parent} className="grid grid-cols-4 gap-2">
                                    {images.map((img, idx) => (
                                        img ? (
                                            <SortablePhoto
                                                key={img.id}
                                                id={img.id}
                                                url={img.url}
                                                index={idx + 1}
                                                onRemove={() => handleRemoveImage(img.id)}
                                            />
                                        ) : null
                                    ))}
                                    {images.filter(x => x !== null).length < 2 && (
                                        <label className="aspect-square flex items-center justify-center border border-zinc-200 bg-white hover:bg-zinc-50 rounded-[10px] cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md transform-gpu group">
                                            <input type="file" className="hidden" multiple accept="image/*" onChange={(e) => handleImageUpload(e)} />
                                            <Plus className="w-6 h-6 text-zinc-400 group-hover:text-zinc-600 transition-colors transform-gpu" />
                                        </label>
                                    )}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                    {images.some(img => img !== null) && (
                        <button onClick={handleClearCanvas} className="mt-4 text-xs text-zinc-400 font-medium flex items-center gap-1 hover:bg-red-50 hover:text-red-600 rounded-md px-2 py-1 cursor-pointer">
                            <Trash2 className="w-3 h-3" /> Очистить всё
                        </button>
                    )}
                    {/* Dedicated inputs for each slot to guarantee correct targeting */}
                    <input
                        id="polaroid-upload-0"
                        type="file"
                        className="hidden"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 0)}
                    />
                    <input
                        id="polaroid-upload-1"
                        type="file"
                        className="hidden"
                        multiple
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 1)}
                    />
                </section>

                <section>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-zinc-500 tracking-wide flex items-center gap-1">
                            <Sun className="w-3 h-3" /> Яркость
                        </span>
                        <span className="text-[10px] font-medium text-zinc-400">{(brightness * 100).toFixed(0)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="0.2"
                        step="0.01"
                        value={brightness}
                        onChange={(e) => setBrightness(parseFloat(e.target.value))}
                        className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer shadow-inner [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-200 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110"
                    />
                </section>

                {/* Primary Action Button (Section Style / Large) */}


                <div className="pt-6 border-t border-zinc-200/50 mt-auto">
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={handleToMockup}
                            disabled={isTransferring}
                            className={`h-12 border rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden
                                ${isTransferSuccess
                                    ? 'bg-zinc-900 border-zinc-900 text-white'
                                    : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:shadow-md hover:-translate-y-0.5 active:scale-95'
                                }
                            `}
                        >
                            <AnimatePresence mode="wait" initial={false}>
                                {isTransferring ? (
                                    <motion.div
                                        key="loading"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.15 }}
                                        className="flex items-center gap-2"
                                    >
                                        <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                                        <span className="text-zinc-400 font-medium">Создание...</span>
                                    </motion.div>
                                ) : isTransferSuccess ? (
                                    <motion.div
                                        key="success"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.5 }} // Exit scale down cleanly
                                        transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                        className="flex items-center gap-2"
                                    >
                                        <Check className="w-4 h-4" />
                                        <span>Готово</span>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="idle"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.15 }}
                                        className="flex items-center gap-2"
                                    >
                                        <Shirt className="w-4 h-4" />
                                        <span>На макет</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </button>
                        <button
                            onClick={() => canvas && exportHighRes(canvas)}
                            className="h-12 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-bold text-sm shadow-lg shadow-zinc-900/20 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                        >
                            <ArrowDownToLine className="w-4 h-4" />
                            Скачать
                        </button>
                    </div>
                </div>

                {/* Website Link */}
                <a
                    href="https://printshopspb.ru/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 py-3 flex items-center justify-center gap-2 text-zinc-400 hover:text-zinc-600 transition-all duration-300 group"
                >
                    <span className="text-sm font-medium tracking-wide group-hover:tracking-wider transition-all duration-300">printshopspb.ru</span>
                    <svg className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                </a>
            </aside>

            <main className="flex-1 flex overflow-hidden relative">
                <div className="fixed top-6 right-6 flex gap-3 z-[100] items-center">
                    <button
                        onClick={onOpenMockup}
                        className="relative group w-14 h-14 bg-white/90 backdrop-blur-md border border-zinc-200/50 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center cursor-pointer overflow-visible"
                        title="Перейти к макету"
                    >
                        <Shirt className="w-6 h-6 text-zinc-700 group-hover:text-zinc-900 transition-colors" opacity={0.8} strokeWidth={1.5} />
                        <div key={mockupPrintCount} className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-zinc-900 text-white text-xs font-bold flex items-center justify-center rounded-full shadow-md border-2 border-white transform scale-100 group-hover:scale-110 transition-transform animate-[bounce_0.5s_ease-out]">
                            {mockupPrintCount || 0}
                        </div>
                    </button>
                </div>
                <div className={`flex-1 relative overflow-hidden transition-opacity duration-700 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
                    <CanvasEditor onCanvasReady={handleCanvasReady} logicalHeight={1200} />
                </div>
            </main>
        </div>
    );
};
