import React, { useState, useCallback, useEffect } from 'react';
import { CanvasEditor } from '../CanvasEditor';
import { type TemplateType } from '../../utils/TemplateGenerators';
import { Upload, Trash2, ImagePlus, ArrowDownToLine, LayoutDashboard, BookHeart, SquareParking, SquareUser, Volleyball, PenTool } from 'lucide-react';
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

export const PolaroidWorkspace: React.FC<PolaroidWorkspaceProps> = ({ onSwitchTemplate }) => {
    const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
    const [images, setImages] = useState<{ id: string; url: string }[]>([]);
    const [isReady, setIsReady] = useState(false);
    // Calibrated slots coordinates
    const slots = [
        { x: 18, y: 22, w: 534, h: 477 },
        { x: 652, y: 24, w: 533, h: 472 }
    ];

    // We only need 2 images for Polaroid, but we keep the list flexible for the sidebar
    // However, the canvas will only display the first 2.

    const handleCanvasReady = useCallback((c: fabric.Canvas) => {
        setCanvas(c);
        // Transparent background for "floating" effect
        c.backgroundColor = 'transparent';
        c.renderAll();
    }, []);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const newImages: { id: string; url: string }[] = [];

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
                newImages.push({ id: crypto.randomUUID(), url: imageUrl });
            }
            setImages((prev) => [...prev, ...newImages]);
        }
    };

    const handleRemoveImage = (id: string) => setImages(prev => prev.filter(img => img.id !== id));
    const handleClearCanvas = () => setImages([]);

    // DND Kit Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setImages((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over?.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    // --- POLAROID RENDERING LOGIC ---
    useEffect(() => {
        if (!canvas) return;

        const renderPolaroid = async () => {
            canvas.clear();
            // canvas.backgroundColor = 'transparent'; // Already set

            try {
                const templateImg = await fabric.Image.fromURL(TEMPLATE_URL, {
                    crossOrigin: 'anonymous'
                });

                // Scale template to fit canvas width (assuming 1200 logical width)
                // We'll scale it to fit nicely.
                const canvasWidth = 1200;
                const scale = canvasWidth / templateImg.width!;
                templateImg.scale(scale);

                // Center the template
                templateImg.set({
                    left: 0,
                    top: 0,
                    selectable: false,
                    evented: false,
                });

                // --- PRODUCTION MODE ---
                // Render Images/Placeholders First (Bottom)
                const activeImages = images.slice(0, 2);

                // We need 2 slots.
                // Aggressive adjustment based on user feedback.
                // Define Windows (Approximate positions based on standard Polaroid layout)
                // Adjusted based on visual feedback (screenshot)
                // The previous guess was too small and off-center.
                // Assuming the template is roughly symmetrical.

                for (let i = 0; i < 2; i++) {
                    const slot = slots[i];
                    // Adjust for scale (slots are already in canvas coords now)
                    const slotX = slot.x;
                    const slotY = slot.y;
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

                        // Calculate centered position (Top/Left origin)
                        // We want the center of the image to match the center of the slot.
                        // Image Center = Left + Width/2
                        // Slot Center = SlotX + SlotW/2
                        // Left + Width/2 = SlotX + SlotW/2
                        // Left = SlotX + SlotW/2 - Width/2
                        const imgWidth = img.getScaledWidth();
                        const imgHeight = img.getScaledHeight();

                        const initialLeft = slotX + (slotW - imgWidth) / 2;
                        const initialTop = slotY + (slotH - imgHeight) / 2;

                        // Create Clip Path (The Slot)
                        const clipPath = new fabric.Rect({
                            left: slotX,
                            top: slotY,
                            width: slotW,
                            height: slotH,
                            absolutePositioned: true,
                        });

                        img.set({
                            selectable: true,
                            evented: true,
                            originX: 'left',   // CHANGED: Use Top/Left for simpler math
                            originY: 'top',    // CHANGED: Use Top/Left for simpler math
                            left: initialLeft,
                            top: initialTop,
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

                        // Constraint Logic: STRICT HARD WALL
                        const constrainImage = () => {
                            const currentWidth = img.getScaledWidth();
                            const currentHeight = img.getScaledHeight();

                            // Limits
                            const minLeft = slotX + slotW - currentWidth;
                            const maxLeft = slotX;
                            const minTop = slotY + slotH - currentHeight;
                            const maxTop = slotY;

                            // Clamp
                            let newLeft = img.left!;
                            let newTop = img.top!;

                            if (currentWidth >= slotW) {
                                newLeft = Math.min(Math.max(newLeft, minLeft), maxLeft);
                            } else {
                                newLeft = slotX + (slotW - currentWidth) / 2;
                            }

                            if (currentHeight >= slotH) {
                                newTop = Math.min(Math.max(newTop, minTop), maxTop);
                            } else {
                                newTop = slotY + (slotH - currentHeight) / 2;
                            }

                            img.set({ left: newLeft, top: newTop });
                        };

                        // Apply initially
                        constrainImage();

                        // Apply on EVERY move frame
                        img.on('moving', constrainImage);

                        // Apply on scaling
                        img.on('scaling', () => {
                            const currentScaleX = slotW / img.width!;
                            const currentScaleY = slotH / img.height!;
                            const minScale = Math.max(currentScaleX, currentScaleY);

                            if (img.scaleX < minScale || img.scaleY < minScale) {
                                img.scale(minScale);
                            }
                            constrainImage();
                        });

                        canvas.add(img);

                        // --- DEBUG: VISUALIZE SLOTS ---
                        // Adding a red border to show where the code thinks the window is.
                        // This helps verify if the coordinates (18, 22, etc.) are correct.
                        const debugRect = new fabric.Rect({
                            left: slotX,
                            top: slotY,
                            width: slotW,
                            height: slotH,
                            fill: 'transparent',
                            stroke: 'red',
                            strokeWidth: 2,
                            selectable: false,
                            evented: false,
                            opacity: 0.5
                        });
                        canvas.add(debugRect);
                        // -----------------------------

                    } else {
                        // Placeholder
                        const placeholder = new fabric.Rect({
                            left: slotX,
                            top: slotY,
                            width: slotW,
                            height: slotH,
                            fill: '#e4e4e7',
                            selectable: false,
                            hoverCursor: 'pointer'
                        });

                        const text = new fabric.Text('+', {
                            left: slotX + slotW / 2,
                            top: slotY + slotH / 2,
                            originX: 'center',
                            originY: 'center',
                            fontSize: 40,
                            fill: '#a1a1aa',
                            selectable: false
                        });

                        const group = new fabric.Group([placeholder, text], {
                            selectable: false,
                            hoverCursor: 'pointer'
                        });

                        group.on('mousedown', () => {
                            document.querySelector<HTMLInputElement>('input[type="file"]')?.click();
                        });
                        canvas.add(group);

                        // DEBUG for Placeholder too
                        const debugRect = new fabric.Rect({
                            left: slotX,
                            top: slotY,
                            width: slotW,
                            height: slotH,
                            fill: 'transparent',
                            stroke: 'red',
                            strokeWidth: 2,
                            selectable: false,
                            evented: false,
                            opacity: 0.5
                        });
                        canvas.add(debugRect);
                    }
                }

                // Add Template on Top
                canvas.add(templateImg);

                canvas.requestRenderAll();

                if (!isReady) setIsReady(true);

            } catch (err) {
                console.error("Error loading template", err);
            }
        };

        renderPolaroid();

    }, [canvas, images, slots]); // Removed isCalibration from deps

    return (
        <div className="h-screen bg-slate-100 flex flex-col overflow-hidden" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            <aside className="fixed left-6 top-6 w-[400px] h-auto max-h-[calc(100vh-48px)] bg-white/60 backdrop-blur-2xl rounded-3xl border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.05)] p-6 flex flex-col gap-6 overflow-y-auto z-[100] scrollbar-hide">
                <div className="flex justify-center">
                    <img src="/logo.png" alt="Logo" className="w-40 opacity-80 drop-shadow-xl object-contain" />
                </div>
                <div className="">
                    <div className="grid grid-cols-3 gap-2">
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
                                className={`aspect-square flex items-center justify-center rounded-xl cursor-pointer group relative transition-all duration-200 ease-out transform-gpu will-change-transform [backface-visibility:hidden] ${item.id === 'polaroid' ? 'bg-zinc-900 text-white shadow-md' : 'bg-white/40 border border-zinc-900/10 shadow-sm text-zinc-600 hover:scale-105 hover:bg-white/80 hover:shadow-md hover:border-zinc-300 hover:text-zinc-900'}`}
                                title={item.label}
                            >
                                <item.icon className="w-5 h-5" />
                            </button>
                        ))}
                    </div>
                </div>

                <section>
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">ФОТО</h2>
                        <label className="p-1.5 bg-zinc-100/50 hover:bg-zinc-200/50 rounded-lg cursor-pointer transition-colors text-zinc-600">
                            <Upload className="w-3.5 h-3.5" />
                            <input type="file" className="hidden" multiple accept="image/*" onChange={handleImageUpload} />
                        </label>
                    </div>
                    {images.length === 0 ? (
                        <label className="border-2 border-dashed border-zinc-200/50 hover:border-zinc-400 hover:bg-zinc-100/50 rounded-2xl h-32 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group">
                            <input type="file" className="hidden" multiple accept="image/*" onChange={handleImageUpload} />
                            <ImagePlus className="w-8 h-8 text-zinc-300 mb-2 group-hover:text-zinc-400 transition-colors" />
                            <span className="text-sm font-medium text-zinc-600">Загрузить фото</span>
                        </label>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={images.map(img => img.id)} strategy={rectSortingStrategy}>
                                <div className="grid grid-cols-4 gap-2">
                                    {images.map((img, idx) => (
                                        <SortablePhoto
                                            key={img.id}
                                            id={img.id}
                                            url={img.url}
                                            index={idx + 1}
                                            onRemove={() => handleRemoveImage(img.id)}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                    {images.length > 0 && (
                        <button onClick={handleClearCanvas} className="mt-8 text-xs text-zinc-400 font-medium flex items-center gap-1 hover:bg-red-50 hover:text-red-600 rounded-md px-2 py-1 cursor-pointer">
                            <Trash2 className="w-3 h-3" /> Очистить всё
                        </button>
                    )}
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
