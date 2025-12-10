import React, { useRef, useState, useCallback, useEffect } from 'react';
import * as fabric from 'fabric';
import { type TemplateType } from '../../utils/TemplateGenerators';
import { ArrowDownToLine, LayoutDashboard, BookHeart, SquareParking, SquareUser, Volleyball, PenTool, ImagePlus, Upload, Trash2, Sun } from 'lucide-react';
import heic2any from 'heic2any';
import { exportHighRes } from '../../utils/ExportUtils';
import { CanvasEditor } from '../CanvasEditor';
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

interface PapaWorkspaceProps {
    onSwitchTemplate: (template: TemplateType) => void;
}

// --- PATH DEFINITIONS ---

// PAPA Paths
const PATH_P1 = "M-0 0l1078.51 0c234.95,0 410.79,55.69 528.02,167.54 116.74,111.86 175.36,271.09 175.36,477.71 0,211.99 -63.99,378.06 -191.47,497.25 -127.49,119.67 -322.38,179.26 -584.2,179.26l-355.6 0 0 776.65 -650.62 0 0 -2098.41z";
const PATH_A1 = "M3161.29 1752.58l-734.64 0 -105.51 345.83 -661.86 0 789.83 -2098.41 709.73 0 786.41 2098.41 -678.95 0 -105.02 -345.83z";
const PATH_P2 = "M4146.99 0l1078.51 0c234.95,0 410.79,55.69 528.02,167.54 116.74,111.86 175.36,271.09 175.36,477.71 0,211.99 -63.99,378.06 -191.47,497.25 -127.49,119.67 -322.38,179.26 -584.2,179.26l-355.6 0 0 776.65 -650.62 0 0 -2098.41z";
const PATH_A2 = "M7296.28 1752.58l-710.65 0c-7.23,0 -13.37,4.54 -15.48,11.46l-98.52 322.91c-2.11,6.92 -8.25,11.46 -15.48,11.46l-626.49 0c-5.48,0 -10.19,-2.47 -13.31,-6.98 -3.12,-4.5 -3.77,-9.78 -1.84,-14.91l777.65 -2066.04c2.42,-6.43 8.28,-10.48 15.15,-10.48l687.31 0c6.88,0 12.74,4.06 15.15,10.5l774.28 2066.04c1.92,5.13 1.27,10.4 -1.85,14.9 -3.12,4.5 -7.83,6.96 -13.3,6.96l-643.6 0c-7.24,0 -13.38,-4.55 -15.49,-11.48l-98.04 -322.86c-2.1,-6.93 -8.25,-11.48 -15.49,-11.48z";

// MAMA Paths
const PATH_M1 = "M0 0 L701.09 0 L968.15 401.9 L1236.01 0 L1933.9 0 L1933.9 1720.09 L1499.07 1720.09 L1481.35 1192.84 L1168.28 1722.33 L975.36 1722.33 L774.29 1722.33 L417.11 1192.84 L434.83 1720.09 L0 1720.09 z";
const PATH_A_MAMA_1 = "M3330.47 1436.61 L2728.28 1436.61 L2641.8 1720.09 L2099.26 1720.09 L2746.7 0 L3328.47 0 L3973.1 1720.09 L3416.56 1720.09 z";
const PATH_M2 = "M4126.33 0.35 L4827.42 0.35 L5094.48 402.26 L5362.34 0.35 L6060.23 0.35 L6060.23 1720.45 L5625.4 1720.45 L5607.68 1193.19 L5294.61 1722.69 L4900.62 1722.69 L4543.44 1193.19 L4561.16 1720.45 L4126.33 1720.45 z";
const PATH_A_MAMA_2 = "M7466.54 1436.61 L6864.35 1436.61 L6777.86 1720.09 L6235.33 1720.09 L6882.77 0 L7464.54 0 L8109.17 1720.09 L7552.62 1720.09 z";

const PAPA_PATHS = [PATH_P1, PATH_A1, PATH_P2, PATH_A2];
const MAMA_PATHS = [PATH_M1, PATH_A_MAMA_1, PATH_M2, PATH_A_MAMA_2];

export const PapaWorkspace: React.FC<PapaWorkspaceProps> = ({ onSwitchTemplate }) => {
    const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
    const [images, setImages] = useState<({ id: string; url: string } | null)[]>([null, null, null, null]);
    const [isGrayscale, setIsGrayscale] = useState(false);
    const [brightness, setBrightness] = useState(0);
    const [isBorderEnabled, setIsBorderEnabled] = useState(false);
    const [templateMode, setTemplateMode] = useState<'PAPA' | 'MAMA'>('PAPA');
    const fileInputsRefs = useRef<(HTMLInputElement | null)[]>([]);

    // DND Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleCanvasReady = useCallback((c: fabric.Canvas) => {
        setCanvas(c);
    }, []);

    // Track frame readiness
    const [isReady, setIsReady] = useState(false);

    // Track previous structure to decide between Full Rebuild vs Quick Update
    const prevStructureRef = useRef<string>('');

    // MAIN SYNC LOGIC
    const syncCanvas = useCallback(async () => {
        if (!canvas) return;

        const structureKey = `${templateMode}-${images.map(i => i?.id).join(',')}-${isBorderEnabled}`;
        const hasObjects = canvas.getObjects().length > 0;

        // --- FAST PATH: Attributes Update Only (Brightness, B/W) ---
        // If structure hasn't changed and we have content, just update visuals in-place.
        // Including isBorderEnabled in the key means a border toggle will trigger a full rebuild,
        // which is acceptable as it's a click, not a continuous drag like brightness.
        if (structureKey === prevStructureRef.current && hasObjects) {
            canvas.getObjects().forEach((obj: any) => {
                if (obj.type === 'image') {
                    const filters: any[] = [];
                    if (isGrayscale) filters.push(new fabric.filters.Grayscale());
                    if (brightness !== 0) filters.push(new fabric.filters.Brightness({ brightness }));
                    obj.filters = filters;
                    obj.applyFilters();
                }
            });
            canvas.requestRenderAll();
            return;
        }

        // --- FULL PATH: Atomic Rebuild ---
        prevStructureRef.current = structureKey;

        // Visual Offset to center the heavy text
        const startX = 200;
        const startY = 400;

        const currentPaths = templateMode === 'PAPA' ? PAPA_PATHS : MAMA_PATHS;

        // --- NORMALIZATION LOGIC ---
        // 1. Measure Reference (PAPA) to get target height/center
        const getBounds = (paths: string[]) => {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            paths.forEach(p => {
                const pathObj = new fabric.Path(p);
                const b = pathObj.getBoundingRect();
                if (b.left < minX) minX = b.left;
                if (b.top < minY) minY = b.top;
                if (b.left + b.width > maxX) maxX = b.left + b.width;
                if (b.top + b.height > maxY) maxY = b.top + b.height;
            });
            return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, cx: minX + (maxX - minX) / 2, cy: minY + (maxY - minY) / 2 };
        };

        const papaBounds = getBounds(PAPA_PATHS);
        const currentGroupBounds = getBounds(currentPaths);

        let adjScale = 1;
        let adjDx = 0;
        let adjDy = 0;

        // If MAMA, scale to match PAPA height and center
        if (templateMode === 'MAMA') {
            adjScale = papaBounds.h / currentGroupBounds.h;
            // New Dimensions
            const newW = currentGroupBounds.w * adjScale;
            // const newH = currentGroupBounds.h * adjScale; // Should match papaBounds.h

            // Align Centers: 
            // Target Center = papaBounds.cx, papaBounds.cy (relative to their own coord system? No, absolute).
            // We want MAMA center to be at PAPA center.
            // Current MAMA Center Scaled = currentGroupBounds.cx * adjScale? 
            // Only if origin is 0,0. Yes paths have absolute coords.
            // So:
            // Target CX = papaBounds.cx
            // Current Scaled CX = currentGroupBounds.cx * adjScale + (unknown shift?)
            // dx = targetCX - (currentCX * scale)

            adjDx = papaBounds.cx - (currentGroupBounds.cx * adjScale);
            adjDy = papaBounds.cy - (currentGroupBounds.cy * adjScale);
        }

        // Prepare Promises for all slots
        const renderPromises = currentPaths.map((pathStr, i) => {
            return new Promise<fabric.Object[]>((resolve) => { // Resolve with an array of fabric.Object
                const imgData = images[i];

                // 1. Calculate Bounds with Adjustment
                const tempPath = new fabric.Path(pathStr);

                // Apply Adjustment to tempPath to get correct visual bounds
                // Note: path commands are not scaled by .scale(), only the object transform.
                // We must set scale/left/top on the object.
                // But wait, if we use this tempPath to calculate bounds for image clipping, 
                // we need the "Final" bounds.

                tempPath.set({
                    scaleX: adjScale,
                    scaleY: adjScale,
                    left: (tempPath.left || 0) * adjScale + adjDx, // This is tricky. fabric.Path from string likely has left=minX from path?
                    // actually new fabric.Path(d) sets left/top to the bbox of the path.
                    // If we want to transform the "Coordinate Space":
                    // The path coordinates are absolute.
                    // If we scale the object, we scale from origin (center or top/left).
                });

                // Let's use a group-like transform approach.
                // Easier: Use the original path bounds, scale them manually, and apply offset.
                const originalBounds = new fabric.Path(pathStr).getBoundingRect();

                // The "Visual" bounds for this letter after adjustment:
                // Width/Height scale simply.
                // Left/Top: 
                // The path's original visual Left is originalBounds.left.
                // Scaled: originalBounds.left * adjScale.
                // Shifted: + adjDx.
                // BUT, relative to global startX/startY.

                const finalLeft = (originalBounds.left * adjScale) + adjDx + startX;
                const finalTop = (originalBounds.top * adjScale) + adjDy + startY;
                const finalWidth = originalBounds.width * adjScale;
                const finalHeight = originalBounds.height * adjScale;

                const centerX = finalLeft + finalWidth / 2;
                const centerY = finalTop + finalHeight / 2;

                if (imgData) {
                    fabric.Image.fromURL(imgData.url, { crossOrigin: 'anonymous' }).then((img) => {
                        // Create Clip Path
                        // We must scale the clip path object to match!
                        const clipPath = new fabric.Path(pathStr, {
                            absolutePositioned: true,
                            originX: 'center',
                            originY: 'center',
                            scaleX: adjScale,
                            scaleY: adjScale,
                            left: centerX,
                            top: centerY
                        });

                        // Wait, applying just scale/position to clips might not align if the path data has offsets?
                        // fabric.Path(d) centers the path data around its origin? Yes.
                        // So setting left/top to centerX/centerY works if origin is center.
                        // And scaling works.
                        // We need to ensure logic matches 'adjDx' logic.
                        // adjDx was calculated to align the "Global Group Center".
                        // Is (originalBounds.left * adjScale + adjDx) valid?
                        // Yes, if we assume scale origin is (0,0).
                        // Let's verify `clipPath` creation.
                        // `new fabric.Path` auto-centers. 
                        // If we position it at `centerX`, it should be correct.
                        // Does `centerX` correctly represent the center of the scaled letter?
                        // originalBounds.left is the left edge in "1.0" space.
                        // * adjScale -> Left edge in scaled space.
                        // + adjDx -> Left edge aligned to PAPA.
                        // + startX -> Global canvas position.
                        // + finalWidth/2 -> Center.
                        // Yes, this seems correct.

                        // Image Setup
                        img.set({
                            originX: 'center',
                            originY: 'center',
                            left: centerX,
                            top: centerY
                        });

                        // Cover Logic
                        const scaleX = finalWidth / img.width!;
                        const scaleY = finalHeight / img.height!;
                        const scale = Math.max(scaleX, scaleY);
                        img.scale(scale);

                        // Filters
                        const filters: any[] = [];
                        if (isGrayscale) filters.push(new fabric.filters.Grayscale());
                        if (brightness !== 0) filters.push(new fabric.filters.Brightness({ brightness }));
                        img.filters = filters;
                        img.applyFilters();

                        // Apply Clip
                        img.clipPath = clipPath;

                        // Data
                        img.set('data', { id: imgData.id, type: 'image', index: i });

                        // Controls
                        img.set({
                            hasControls: true,
                            hasBorders: true,
                            borderColor: '#27272a',
                            cornerColor: '#ffffff',
                            cornerStrokeColor: '#27272a',
                            transparentCorners: false,
                            cornerSize: 60,
                            touchCornerSize: 60,
                            borderScaleFactor: 12
                        });

                        const objectsToResolve: fabric.Object[] = [img];

                        if (isBorderEnabled) {
                            const borderObj = new fabric.Path(pathStr, {
                                fill: 'transparent',
                                stroke: 'black',
                                strokeWidth: 9,
                                selectable: false,
                                evented: false,
                                scaleX: adjScale,
                                scaleY: adjScale,
                                originX: 'center',
                                originY: 'center',
                                left: centerX, // Use Calculated Center
                                top: centerY   // Use Calculated Center
                            });
                            objectsToResolve.push(borderObj);
                        }
                        resolve(objectsToResolve);
                    });
                } else {
                    // Placeholder Logic
                    const bgObj = new fabric.Path(pathStr, {
                        fill: '#f9f9fc',
                        stroke: isBorderEnabled ? 'black' : '#e4e4e7',
                        strokeWidth: 9,
                        selectable: false,
                        objectCaching: false,
                        shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.1)', blur: 30, offsetX: 0, offsetY: 20 }),
                        originX: 'center',
                        originY: 'center',
                        // We DO NOT set left/top here because it's in a group?
                        // Wait, in previous code: left: 0, top: 0. 
                        // Then group positioned at groupLeft/Top.
                        scaleX: adjScale,
                        scaleY: adjScale
                    });

                    // Group Position
                    // Must be the Calculated Center
                    const groupLeft = centerX;
                    const groupTop = centerY;

                    const group = new fabric.Group([bgObj], {
                        left: groupLeft, top: groupTop, originX: 'center', originY: 'center',
                        selectable: false, hoverCursor: 'pointer', subTargetCheck: true,
                        data: { type: 'placeholder', index: i }
                    } as any);

                    // Add Events
                    group.on('mouseover', () => {
                        bgObj.set({ fill: '#ffffff', stroke: isBorderEnabled ? 'black' : '#d4d4d8' });
                        bgObj.set({ shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.2)', blur: 60, offsetX: 0, offsetY: 30 }) });
                        group.animate({ scaleX: 1.035, scaleY: 1.035 }, { duration: 300, onChange: canvas.requestRenderAll.bind(canvas), easing: fabric.util.ease.easeOutQuad });
                        canvas.requestRenderAll();
                    });
                    group.on('mouseout', () => {
                        bgObj.set({ fill: '#f9f9fc', stroke: isBorderEnabled ? 'black' : '#e4e4e7' });
                        bgObj.set({ shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.1)', blur: 30, offsetX: 0, offsetY: 20 }) });
                        group.animate({ scaleX: 1, scaleY: 1 }, { duration: 300, onChange: canvas.requestRenderAll.bind(canvas), easing: fabric.util.ease.easeOutQuad });
                        canvas.requestRenderAll();
                    });
                    group.on('mousedown', () => { fileInputsRefs.current[i]?.click(); });

                    resolve([group]);
                }
            });
        });

        const results = await Promise.all(renderPromises);

        // Atomic Update
        canvas.clear();
        canvas.backgroundColor = '';

        // Flatten results (fabric.Object[][]) -> fabric.Object[]
        const flatObjects = results.flat();

        flatObjects.forEach(obj => {
            canvas.add(obj);
            if ((obj as any).data?.type === 'placeholder') {
                canvas.sendObjectToBack(obj);
            }
        });

        canvas.requestRenderAll();

        // Reveal with fade-in on first load
        if (!isReady) {
            setTimeout(() => setIsReady(true), 50);
        }

    }, [canvas, images, isGrayscale, brightness, isBorderEnabled, templateMode, isReady]);

    useEffect(() => {
        // Defer heavy canvas rendering to next frame to allow UI (Toggle) to update smoothly first
        const rAF = requestAnimationFrame(() => {
            syncCanvas();
        });
        return () => cancelAnimationFrame(rAF);
    }, [syncCanvas]);

    // HANDLERS
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetIndex?: number) => {
        if (!e.target.files) return;
        const files = Array.from(e.target.files);

        // Process files to URLs
        const newImagesData: { id: string; url: string }[] = [];
        for (const file of files) {
            let imageUrl: string;
            try {
                if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
                    const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg' });
                    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                    imageUrl = URL.createObjectURL(blob);
                } else {
                    imageUrl = URL.createObjectURL(file);
                }
                newImagesData.push({ id: crypto.randomUUID(), url: imageUrl });
            } catch (err) { console.error(err); }
        }

        setImages(prev => {
            const next = [...prev];
            let currentFileIndex = 0;

            // 1. Fill specific target if provided
            if (targetIndex !== undefined && targetIndex < 4) {
                if (newImagesData[currentFileIndex]) {
                    next[targetIndex] = newImagesData[currentFileIndex];
                    currentFileIndex++;
                }
            }

            // 2. Fill empty slots
            for (let i = 0; i < 4; i++) {
                if (currentFileIndex >= newImagesData.length) break;
                if (next[i] === null) {
                    next[i] = newImagesData[currentFileIndex];
                    currentFileIndex++;
                }
            }
            return next;
        });

        e.target.value = '';
    };

    const handleRemoveImage = (id: string) => {
        setImages(prev => prev.map(img => (img?.id === id ? null : img)));
    };

    const handleClearAll = () => {
        setImages([null, null, null, null]);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            setImages((items) => {
                const validItems = items.filter((x): x is { id: string; url: string } => x !== null);
                const oldIndex = validItems.findIndex(x => x.id === active.id);
                const newIndex = validItems.findIndex(x => x.id === over?.id);

                const reordered = arrayMove(validItems, oldIndex, newIndex);

                const nextSlots = [null, null, null, null] as ({ id: string; url: string } | null)[];
                for (let i = 0; i < reordered.length; i++) {
                    if (i < 4) nextSlots[i] = reordered[i];
                }
                return nextSlots;
            });
        }
    };

    const handleDownload = async () => {
        if (canvas) await exportHighRes(canvas);
    };

    return (
        <div className="h-screen bg-slate-100 flex flex-col overflow-hidden" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            {/* --- SIDEBAR --- */}
            <aside className="sidebar-panel">
                <div className="flex justify-center mb-6">
                    <img src="/logo.png" alt="Logo" className="w-40 opacity-80 drop-shadow-xl object-contain" />
                </div>

                {/* Workspace Switcher */}
                <div className="grid grid-cols-3 gap-2 mb-6">
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
                            className={`aspect-square flex items-center justify-center rounded-xl cursor-pointer group relative transition-all duration-200 ease-out transform-gpu will-change-transform [backface-visibility:hidden] ${item.id === 'papa' ? 'bg-zinc-900 text-white shadow-md' : 'bg-white/40 border border-zinc-900/10 shadow-sm text-zinc-600 hover:scale-105 hover:bg-white/80 hover:shadow-md hover:border-zinc-300 hover:text-zinc-900'}`}
                            title={item.label}
                        >
                            <item.icon className="w-5 h-5" />
                        </button>
                    ))}
                </div>

                {/* TEMPLATE TOGGLE (PAPA / MAMA) - Polaroid Style */}
                <div className="relative bg-[#F5F5F7] rounded-[10px] p-1 flex h-[36px] mb-6">
                    {/* Sliding Indicator */}
                    <div
                        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-[6px] shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${templateMode === 'PAPA' ? 'left-1' : 'left-[calc(50%)]'}`}
                    />

                    <button
                        onClick={() => setTemplateMode('PAPA')}
                        className={`flex-1 relative z-10 text-[13px] font-medium transition-colors duration-200 ${templateMode === 'PAPA' ? 'text-black' : 'text-[#8E8E93]'}`}
                    >
                        PAPA
                    </button>
                    <button
                        onClick={() => setTemplateMode('MAMA')}
                        className={`flex-1 relative z-10 text-[13px] font-medium transition-colors duration-200 ${templateMode === 'MAMA' ? 'text-black' : 'text-[#8E8E93]'}`}
                    >
                        MAMA
                    </button>
                </div>

                <section>
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">ФОТО ({templateMode})</h2>
                        <label className="p-1.5 bg-zinc-100/50 hover:bg-zinc-200/50 rounded-lg cursor-pointer transition-colors text-zinc-600">
                            <Upload className="w-3.5 h-3.5" />
                            <input type="file" className="hidden" multiple accept="image/*" onChange={(e) => handleImageUpload(e)} />
                        </label>
                    </div>

                    {images.every(img => img === null) ? (
                        <label className="upload-photo-block border-2 border-dashed border-zinc-200/50 hover:border-zinc-400 hover:bg-zinc-100/50 rounded-2xl h-32 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group">
                            <input type="file" className="hidden" multiple accept="image/*" onChange={(e) => handleImageUpload(e)} />
                            <ImagePlus className="w-8 h-8 text-zinc-300 mb-2 group-hover:text-zinc-400 transition-colors" />
                            <span className="text-sm font-medium text-zinc-600">Загрузить фото</span>
                        </label>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={images.filter((i): i is { id: string; url: string } => i !== null).map(img => img.id)} strategy={rectSortingStrategy}>
                                <div className="grid grid-cols-4 gap-2">
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
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}

                    {images.some(img => img !== null) && (
                        <button onClick={handleClearAll} className="mt-8 text-xs text-zinc-400 font-medium flex items-center gap-1 hover:bg-red-50 hover:text-red-600 rounded-md px-2 py-1 cursor-pointer">
                            <Trash2 className="w-3 h-3" /> Очистить всё
                        </button>
                    )}

                    {/* Hidden inputs for placeholder click targeting */}
                    {[0, 1, 2, 3].map(i => (
                        <input
                            key={i}
                            ref={el => { if (el) fileInputsRefs.current[i] = el; }}
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, i)}
                        />
                    ))}
                </section>

                <section className="mt-8">
                    <div className="flex flex-col gap-4">
                        {/* Brightness Control */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-1">
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
                        </div>

                        <div className="flex items-center justify-between">
                            {/* B/W Toggle */}
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Ч/Б</span>
                                <button
                                    onClick={() => setIsGrayscale(!isGrayscale)}
                                    className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${isGrayscale ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                                >
                                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${isGrayscale ? 'left-[18px]' : 'left-0.5'}`} />
                                </button>
                            </div>

                            {/* Border Toggle */}
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Обводка</span>
                                <button
                                    onClick={() => setIsBorderEnabled(!isBorderEnabled)}
                                    className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${isBorderEnabled ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                                >
                                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${isBorderEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex overflow-hidden relative">
                <div className="fixed top-6 right-6 flex gap-3 z-[100]">
                    <button onClick={handleDownload} className="flex items-center gap-2 bg-zinc-900 text-white rounded-full py-2.5 px-6 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all active:scale-95 font-medium text-sm cursor-pointer">
                        <ArrowDownToLine className="w-4 h-4" /> Файл
                    </button>
                </div>

                {/* CANVAS CONTAINER */}
                <div className={`flex-1 relative overflow-hidden transition-opacity duration-700 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
                    <CanvasEditor
                        onCanvasReady={handleCanvasReady}
                        logicalWidth={8085.14}
                        logicalHeight={2098.41}
                        padding={2500}
                    />
                </div>
            </main>
        </div>
    );
};
