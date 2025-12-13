import React, { useState, useCallback, useEffect } from 'react';
import { CanvasEditor } from '../CanvasEditor';
import { type TemplateType } from '../../utils/TemplateGenerators';
import { Trash2, ImagePlus, ArrowDownToLine, LayoutDashboard, BookHeart, SquareParking, SquareUser, Volleyball, PenTool, Plus, Sun } from 'lucide-react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
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
import { exportHighRes } from '../../utils/ExportUtils';

interface PolaroidWorkspaceProps {
    onSwitchTemplate: (template: TemplateType) => void;
}

// Constants for Polaroid Windows (Approximate - need calibration)
// Assuming 2480x3508 (A4) or similar. 
// We will load the image and center it.
const TEMPLATE_URL = '/templates/polaroids-bg.png';

// Calibrated slots coordinates
const SLOTS = [
    { x: 18, y: 22, w: 534, h: 477 },
    { x: 652, y: 24, w: 533, h: 472 }
];

export const PolaroidWorkspace: React.FC<PolaroidWorkspaceProps> = ({ onSwitchTemplate }) => {
    const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
    const [parent] = useAutoAnimate();
    // Fixed 2 slots for Polaroid: [Left, Right]
    const [images, setImages] = useState<({ id: string; url: string } | null)[]>([null, null]);
    const [isReady, setIsReady] = useState(false);
    const templateRef = React.useRef<fabric.Image | null>(null);

    const [textVariant, setTextVariant] = useState<'wife' | 'husband'>('wife');
    const [brightness, setBrightness] = useState<number>(0);

    // We only need 2 images for Polaroid, but we keep the list flexible for the sidebar
    // However, the canvas will only display the first 2.

    const handleCanvasReady = useCallback((c: fabric.Canvas) => {
        setCanvas(c);
        // Transparent background for "floating" effect
        c.backgroundColor = 'transparent';
        c.renderAll();
    }, []);

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
                await document.fonts.load('44px Caveat');
                await document.fonts.load('55px Caveat');

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

                        group.on('mousedown', () => {
                            document.getElementById(`polaroid-upload-${i}`)?.click();
                        });
                        bottomLayer.push(group);
                    }
                }

                // 2. Prepare Text Fields
                const textDefaults = [
                    textVariant === 'wife'
                        ? "Интересно, когда я вырасту,\nкто будет моей женой?"
                        : "Интересно, когда я вырасту,\nкто будет моим мужем?",
                    "Я буду!"
                ];

                for (let i = 0; i < 2; i++) {
                    const slot = SLOTS[i];
                    // Adjust for scale and offset
                    const slotX = slot.x + OFFSET_X;
                    const slotY = slot.y + OFFSET_Y;
                    const slotW = slot.w;
                    const slotH = slot.h;

                    const textTop = slotY + slotH; // Higher, directly under photo

                    let textLeft: number;
                    let originX: 'center' | 'right' | 'left';
                    let textAlign: 'center' | 'right' | 'left';
                    let fontSize: number;

                    if (i === 0) {
                        // First polaroid: Centered
                        textLeft = slotX + slotW / 2;
                        originX = 'center';
                        textAlign = 'center';
                        fontSize = 44;
                    } else {
                        // Second polaroid: Right aligned with padding
                        textLeft = slotX + slotW - 30; // Shifted left from edge
                        originX = 'right';
                        textAlign = 'right';
                        fontSize = 55; // Bigger font
                    }

                    // Use Text to prevent unwanted auto-wrapping (enforces explicit newlines)
                    const text = new fabric.Text(textDefaults[i], {
                        left: textLeft,
                        top: textTop,
                        // Removed width to prevent wrapping. Text will strictly follow \n
                        fontFamily: 'Caveat',
                        fontSize: fontSize,
                        fill: '#27272a',
                        originX: originX,
                        originY: 'top',
                        textAlign: textAlign,
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

    // --- SMART UPDATE: TEXT VARIANT ---
    useEffect(() => {
        if (!canvas) return;
        const textDefaults = [
            textVariant === 'wife'
                ? "Интересно, когда я вырасту,\nкто будет моей женой?"
                : "Интересно, когда я вырасту,\nкто будет моим мужем?",
            "Я буду!"
        ];

        // Find and update text objects
        // We identify them by type 'text'.
        const textObjects = canvas.getObjects().filter(obj => obj.type === 'text') as fabric.Text[];

        // Sort by X position to guarantee Order: [Left, Right]
        // This prevents "Я буду" from ending up on the left if stacking order is somehow flipped.
        textObjects.sort((a, b) => (a.left || 0) - (b.left || 0));

        if (textObjects.length >= 2) {
            // Update First Text (Left)
            if (textObjects[0].text !== textDefaults[0]) {
                textObjects[0].set({ text: textDefaults[0] });
            }
            // Update Second Text (Right)
            if (textObjects[1].text !== textDefaults[1]) {
                textObjects[1].set({ text: textDefaults[1] });
            }
            canvas.requestRenderAll();
        }

    }, [canvas, textVariant]);

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
            <aside className="sidebar-panel">
                <div className="flex justify-center">
                    <img src="/logo.png" alt="Logo" className="w-[90px] opacity-80 drop-shadow-xl object-contain" />
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
                                className={`w-[44px] h-[44px] flex items-center justify-center rounded-xl cursor-pointer group relative transition-all duration-200 ease-out transform-gpu will-change-transform [backface-visibility:hidden] ${item.id === 'polaroid' ? 'bg-zinc-900 text-white shadow-md' : 'bg-white/40 border border-zinc-900/10 shadow-sm text-zinc-600 hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-md hover:border-zinc-300 hover:text-zinc-900'}`}
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
                </section>

                <section>

                    {images.every(img => img === null) ? (
                        <label className="upload-photo-block border-2 border-dashed border-zinc-200/50 hover:border-zinc-400 hover:bg-zinc-100/50 rounded-2xl h-32 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group">
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
                        <button onClick={handleClearCanvas} className="mt-8 text-xs text-zinc-400 font-medium flex items-center gap-1 hover:bg-red-50 hover:text-red-600 rounded-md px-2 py-1 cursor-pointer">
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
            </aside>

            <main className="flex-1 flex overflow-hidden relative">
                <div className="fixed top-6 right-6 flex gap-3 z-[100]">
                    <button onClick={() => canvas && exportHighRes(canvas)} className="flex items-center gap-2 bg-zinc-900 text-white rounded-full py-2.5 px-6 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all active:scale-95 font-medium text-sm cursor-pointer">
                        <ArrowDownToLine className="w-4 h-4" /> Файл
                    </button>
                </div>
                <div className={`flex-1 relative overflow-hidden transition-opacity duration-700 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
                    <CanvasEditor onCanvasReady={handleCanvasReady} logicalHeight={1200} />
                </div>
            </main>
        </div>
    );
};
