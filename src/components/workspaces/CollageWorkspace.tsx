import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CanvasEditor } from '../CanvasEditor';
import { generateCollageTemplate, updateCollageHeader, updateCollageFilters } from '../../utils/TemplateGenerators';
import type { TemplateType } from '../../utils/TemplateGenerators';
import { transliterate } from '../../utils/Transliteration';
import { exportHighRes } from '../../utils/ExportUtils';
import { Trash2, ImagePlus, ArrowDownToLine, Sun, Type, User, Calendar, LayoutDashboard, BookHeart, SquareParking, SquareUser, Volleyball, PenTool, Plus, Shirt } from 'lucide-react';
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
    rectSortingStrategy,
    horizontalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { SortablePhoto } from '../SortablePhoto';

interface CollageWorkspaceProps {
    onSwitchTemplate: (template: TemplateType) => void;
    onOpenMockup: () => void;
}

export const CollageWorkspace: React.FC<CollageWorkspaceProps> = ({ onSwitchTemplate, onOpenMockup }) => {
    const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
    const [parent] = useAutoAnimate();
    const [images, setImages] = useState<{ id: string; url: string }[]>([]);
    const [headerText, setHeaderText] = useState<string>("GIRLFRIEND");
    const [footerName, setFooterName] = useState<string>("VALERIA");
    const [footerDate, setFooterDate] = useState<string>("05.09.2025");
    const [isTranslitEnabled, setIsTranslitEnabled] = useState<boolean>(true);
    const [isBWEnabled, setIsBWEnabled] = useState<boolean>(true);
    const [isSinceEnabled, setIsSinceEnabled] = useState<boolean>(true);
    const [textColor, setTextColor] = useState<string>('#000000');
    const [brightness, setBrightness] = useState<number>(0);
    const [aspectRatio, setAspectRatio] = useState<number>(1);
    const [logicalCanvasHeight, setLogicalCanvasHeight] = useState<number>(800);
    const [headerLines, setHeaderLines] = useState<number>(2);
    const [signatureText, setSignatureText] = useState<string>('WANNA BE YOURS');
    const [isSignatureEnabled, setIsSignatureEnabled] = useState<boolean>(false);
    const [isBorderEnabled, setIsBorderEnabled] = useState<boolean>(false); // Canvas State (Delayed)
    const [visualBorderEnabled, setVisualBorderEnabled] = useState<boolean>(false); // UI State (Instant)
    const [signatureScale, setSignatureScale] = useState<number>(1);

    // Debounce signature text
    const [debouncedSignatureText, setDebouncedSignatureText] = useState<string>('WANNA BE YOURS');
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSignatureText(signatureText);
        }, 300);
        return () => clearTimeout(handler);
    }, [signatureText]);

    const [originalValues, setOriginalValues] = useState<{
        header: string; name: string; date: string;
    } | null>(null);

    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (isTranslitEnabled) {
            setOriginalValues({ header: headerText, name: footerName, date: footerDate });
            setHeaderText(prev => transliterate(prev).toUpperCase());
            setFooterName(prev => transliterate(prev).toUpperCase());
            setFooterDate(prev => transliterate(prev).toUpperCase());
        } else {
            if (originalValues) {
                setHeaderText(originalValues.header);
                setFooterName(originalValues.name);
                setFooterDate(originalValues.date);
                setOriginalValues(null);
            }
        }
    }, [isTranslitEnabled]);

    // Debounce Header Text
    const [debouncedHeaderText, setDebouncedHeaderText] = useState(headerText);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedHeaderText(headerText);
        }, 300);
        return () => clearTimeout(handler);
    }, [headerText]);

    const handleTextChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
        let newValue = value.toUpperCase();
        if (isTranslitEnabled) newValue = transliterate(newValue);
        setter(newValue);
    };

    const handleCanvasReady = useCallback((c: fabric.Canvas) => {
        setCanvas(c);
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
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Prevent accidental drags
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
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

    // --- ГЛАВНЫЙ ЭФФЕКТ ОТРИСОВКИ ---
    const prevPropsRef = useRef({
        imagesJson: '[]',
        aspectRatio: 1,
        isBWEnabled: true,
        brightness: 0,
        headerLines: 2,
        signatureText: 'WANNA BE YOURS',
        isSignatureEnabled: false,
        isBorderEnabled: false,
        signatureScale: 1
    });

    const lastDateRef = useRef('05.09.2025');

    // Calculate Structure Change (Render Phase)
    // We compare current props/state with the previously committed refs.
    // This allows us to pass 'true' to autoZoomOnResize specifically when structure changes.
    const currentImagesJson = JSON.stringify(images.map(img => img.url));
    const isStructureChanged =
        currentImagesJson !== prevPropsRef.current.imagesJson ||
        aspectRatio !== prevPropsRef.current.aspectRatio ||
        headerLines !== prevPropsRef.current.headerLines ||
        isBorderEnabled !== prevPropsRef.current.isBorderEnabled;

    const shouldAutoZoom = !isReady || isStructureChanged;

    useEffect(() => {
        if (canvas) {
            const renderTemplate = async () => {
                try {
                    // Access calculated values (re-calculate to be safe inside async or just use consts)
                    // Note: accessing 'isStructureChanged' from closure is fine as this effect runs on render.

                    const isFilterChanged =
                        isBWEnabled !== prevPropsRef.current.isBWEnabled ||
                        brightness !== prevPropsRef.current.brightness;

                    if (isStructureChanged || images.length === 0) { // Force render if empty to show placeholder
                        // Full Re-render

                        // CAPTURE CURRENT POSITIONS (PRESERVE PAN)
                        // Only if GRID Layout hasn't changed (Images & Aspect Ratio are same)
                        // If Images or Ratio change, we MUST recalculate positions to fit new grid.
                        const isGridChanged =
                            currentImagesJson !== prevPropsRef.current.imagesJson ||
                            aspectRatio !== prevPropsRef.current.aspectRatio ||
                            headerLines !== prevPropsRef.current.headerLines;

                        let manualPositions: { left: number, top: number }[] = [];

                        if (!isGridChanged) {
                            const currentObjects = canvas.getObjects().filter(o => o.type === 'image');
                            manualPositions = currentObjects.map(obj => ({
                                left: obj.left || 0,
                                top: obj.top || 0
                            }));
                        }

                        const imageUrls = images.map(img => img.url);
                        const newHeight = await generateCollageTemplate(canvas, imageUrls, aspectRatio, debouncedHeaderText, footerName, footerDate, isBWEnabled, isSinceEnabled, textColor, brightness, headerLines, debouncedSignatureText, isSignatureEnabled, isBorderEnabled, signatureScale, manualPositions);

                        if (newHeight !== logicalCanvasHeight) {
                            setLogicalCanvasHeight(newHeight);
                            // IMPORTANT: Do NOT update prevPropsRef yet.
                            // We want 'isStructureChanged' to remain TRUE for the next render (Triggered by setLogicalCanvasHeight),
                            // so that 'shouldAutoZoom' remains TRUE and CanvasEditor zooms to the new height.
                            return;
                        }

                        setLogicalCanvasHeight(newHeight); // Redundant if equal, but safe.

                        // Reveal canvas after first render and layout adjustment
                        if (!isReady) {
                            setTimeout(() => setIsReady(true), 150);
                        }
                    } else if (isFilterChanged) {
                        // Filter Update Only (No layout reset)
                        updateCollageFilters(canvas, isBWEnabled, brightness);
                    } else {
                        // Smart Update (Text Only + Signature)
                        const newHeight = updateCollageHeader(canvas, debouncedHeaderText, footerName, footerDate, isSinceEnabled, textColor, debouncedSignatureText, isSignatureEnabled, signatureScale);
                        // Update logical height if changed (e.g. signature added/removed)
                        if (newHeight && newHeight !== logicalCanvasHeight) {
                            setLogicalCanvasHeight(newHeight);
                            // Similar here: if height changed, we might want to defer ref update? 
                            // But for "Smart Update", we actually usually DON'T want auto-zoom.
                            // 'isStructureChanged' is FALSE here. So 'shouldAutoZoom' is FALSE.
                            // This is correct: stable/smart update should NOT zoom.
                            // So we CAN return, but it doesn't affect zoom. 
                            // However, if we return, we skip ref update, so 'isStructureChanged' logic holds.
                            // But 'isStructureChanged' checks structural props, not signature.
                            // So it's fine.
                            return;
                        }
                    }

                    // Update refs
                    prevPropsRef.current = {
                        imagesJson: currentImagesJson,
                        aspectRatio,
                        isBWEnabled,
                        brightness,
                        headerLines,
                        signatureText,
                        isSignatureEnabled,
                        isBorderEnabled,
                        signatureScale
                    };
                } catch (error) {
                    console.error("Error rendering template:", error);
                }
            };
            renderTemplate();
        }
    }, [canvas, images, aspectRatio, debouncedHeaderText, footerName, footerDate, isBWEnabled, isSinceEnabled, textColor, brightness, headerLines, debouncedSignatureText, isSignatureEnabled, isBorderEnabled, signatureScale, logicalCanvasHeight]); // Added logicalCanvasHeight

    return (
        <div className="h-screen bg-slate-100 flex flex-col overflow-hidden" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            <aside className="sidebar-panel">

                <div className="flex justify-center">
                    <img
                        src="/logo.png"
                        alt="Logo"
                        className="w-[90px] opacity-80 drop-shadow-xl object-contain"
                    />
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
                                className={`w-[44px] h-[44px] flex items-center justify-center rounded-xl cursor-pointer group relative transition-all duration-200 ease-out transform-gpu will-change-transform [backface-visibility:hidden] ${item.id === 'collage' ? 'bg-zinc-900 text-white shadow-md p-[3px]' : 'bg-white/40 border border-zinc-900/10 shadow-sm text-zinc-600 hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-md hover:border-zinc-300 hover:text-zinc-900'}`}
                                title={item.label}
                            >
                                <item.icon className="w-[18px] h-[18px] transform-gpu will-change-transform antialiased [backface-visibility:hidden] [transform:translateZ(0)]" />
                            </button>
                        ))}
                    </div>
                </div>
                <section>

                    {images.length === 0 ? (
                        <label className="upload-photo-block border-2 border-dashed border-zinc-200/50 hover:border-zinc-400 hover:bg-zinc-100/50 rounded-2xl h-[110px] flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group">
                            <input type="file" className="hidden" multiple accept="image/*" onChange={handleImageUpload} />
                            <ImagePlus className="w-8 h-8 text-zinc-300 mb-2 group-hover:text-zinc-400 transition-colors" />
                            <span className="text-sm font-medium text-zinc-600">Загрузить фото</span>
                        </label>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={images.map(img => img.id)}
                                strategy={rectSortingStrategy}
                            >
                                <div ref={parent} className={images.length > 7 ? "grid grid-rows-2 grid-flow-col auto-cols-max gap-2 overflow-x-auto pb-2 px-3 snap-x custom-scrollbar" : "grid grid-cols-4 gap-2"}>
                                    {images.map((img, idx) => (
                                        <SortablePhoto
                                            key={img.id}
                                            id={img.id}
                                            url={img.url}
                                            index={idx + 1}
                                            onRemove={() => handleRemoveImage(img.id)}
                                            className={images.length > 7 ? "w-20 shrink-0 snap-start" : ""}
                                        />
                                    ))}
                                    <label className={`aspect-square flex items-center justify-center border border-zinc-200 bg-white hover:bg-zinc-50 rounded-[10px] cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md transform-gpu group ${images.length > 7 ? "w-20 shrink-0 snap-start" : ""}`}>
                                        <input type="file" className="hidden" multiple accept="image/*" onChange={handleImageUpload} />
                                        <Plus className="w-6 h-6 text-zinc-400 group-hover:text-zinc-600 transition-colors transform-gpu" />
                                    </label>
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                    {images.length > 0 && (
                        <button onClick={handleClearCanvas} className="mt-4 text-[10px] text-zinc-400 font-medium flex items-center gap-1 hover:bg-red-50 hover:text-red-600 rounded-md px-2 py-1 cursor-pointer transition-colors">
                            <Trash2 className="w-3 h-3" /> Очистить всё
                        </button>
                    )}
                </section>

                <section>
                    <div className="relative bg-[#F5F5F7] rounded-[10px] p-1 flex h-[36px] mb-8">
                        {/* Sliding Indicator */}
                        <div
                            className="absolute top-1 bottom-1 w-[calc(25%-4px)] bg-white rounded-[6px] shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                            style={{
                                left: Math.abs(aspectRatio - 1) < 0.01 ? '4px' :
                                    Math.abs(aspectRatio - 0.75) < 0.01 ? 'calc(25% + 2px)' :
                                        Math.abs(aspectRatio - 0.8) < 0.01 ? 'calc(50% + 0px)' :
                                            'calc(75% - 2px)'
                            }}
                        />

                        {[{ label: '1:1', value: 1 }, { label: '3:4', value: 3 / 4 }, { label: '4:5', value: 4 / 5 }, { label: '5:7', value: 5 / 7 }].map((ratio) => (
                            <button
                                key={ratio.label}
                                onClick={() => setAspectRatio(ratio.value)}
                                className={`flex-1 relative z-10 text-[13px] font-medium transition-colors duration-200 ${Math.abs(aspectRatio - ratio.value) < 0.01 ? 'text-black' : 'text-[#8E8E93]'}`}
                            >
                                {ratio.label}
                            </button>
                        ))}
                    </div>

                    {/* Header Row: Input + Lines Control */}
                    <div className="flex gap-2 mb-4">
                        {/* Header Input */}
                        <div className="relative group flex-1">
                            <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" />
                            <input
                                type="text"
                                maxLength={14}
                                value={headerText}
                                onChange={(e) => handleTextChange(setHeaderText, e.target.value)}
                                className="w-full pl-10 pr-3 py-2.5 bg-zinc-100 rounded-xl border-transparent text-sm outline-none shadow-inner transition-all duration-200 placeholder:text-zinc-400 focus:bg-white focus:shadow-md focus:ring-2 focus:ring-zinc-200"
                                placeholder="GIRLFRIEND"
                            />
                        </div>

                        {/* Lines Control */}
                        <div className="relative bg-[#F5F5F7] rounded-[10px] p-1 flex h-[40px] w-[110px] shrink-0">
                            <div
                                className="absolute top-1 bottom-1 w-[calc(33.33%-4px)] bg-white rounded-[6px] shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                                style={{
                                    left: headerLines === 1 ? '4px' : headerLines === 2 ? 'calc(33.33% + 2px)' : 'calc(66.66% + 0px)'
                                }}
                            />
                            {[1, 2, 3].map((val) => (
                                <button
                                    key={val}
                                    onClick={() => setHeaderLines(val)}
                                    className={`flex-1 relative z-10 text-[13px] font-medium transition-colors duration-200 ${headerLines === val ? 'text-black' : 'text-[#8E8E93]'}`}
                                >
                                    {val}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Name & Date Row */}
                    <div className="flex gap-2">
                        <div className="relative group flex-1">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" />
                            <input
                                type="text"
                                value={footerName}
                                onChange={(e) => handleTextChange(setFooterName, e.target.value)}
                                className="w-full pl-10 pr-3 py-2.5 bg-zinc-100 rounded-xl border-transparent text-sm outline-none shadow-inner transition-all duration-200 placeholder:text-zinc-400 focus:bg-white focus:shadow-md focus:ring-2 focus:ring-zinc-200"
                                placeholder="VALERIA"
                            />
                        </div>
                        <div className="relative group flex-1">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" />
                            <input
                                type="text"
                                value={footerDate}
                                onChange={(e) => handleTextChange(setFooterDate, e.target.value)}
                                className="w-full pl-10 pr-3 py-2.5 bg-zinc-100 rounded-xl border-transparent text-sm outline-none shadow-inner transition-all duration-200 placeholder:text-zinc-400 focus:bg-white focus:shadow-md focus:ring-2 focus:ring-zinc-200"
                                placeholder="05.09.2025"
                            />
                        </div>
                    </div>

                    {/* Signature Ghost Button / Field */}
                    <div className="mt-4 mb-8">
                        {!isSignatureEnabled ? (
                            <button
                                onClick={() => setIsSignatureEnabled(true)}
                                className="text-[11px] text-zinc-400 hover:text-zinc-600 font-medium px-1 py-0.5 transition-colors cursor-pointer"
                            >
                                + подпись
                            </button>
                        ) : (
                            <div className="flex gap-2 mt-2 h-[72px]">
                                <textarea
                                    value={signatureText}
                                    onChange={(e) => handleTextChange(setSignatureText, e.target.value)}
                                    className="flex-1 px-3 py-2.5 bg-zinc-100 rounded-xl border-transparent text-sm outline-none shadow-inner transition-all duration-200 placeholder:text-zinc-400 focus:bg-white focus:shadow-md focus:ring-2 focus:ring-zinc-200 resize-none h-full"
                                    placeholder="WANNA BE YOURS"
                                />
                                <div className="w-8 flex items-center justify-center relative">
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="2.0"
                                        step="0.1"
                                        value={signatureScale}
                                        onChange={(e) => setSignatureScale(parseFloat(e.target.value))}
                                        className="absolute w-[72px] h-2 -rotate-90 origin-center cursor-pointer appearance-none bg-zinc-200 rounded-lg [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-200 transition-all hover:[&::-webkit-slider-thumb]:scale-110"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Settings Row: Since + Translit */}
                    {/* Settings Row: Color + Since + Translit */}
                    <div className="flex flex-wrap items-center justify-between gap-y-2 mb-3 px-1 h-8">
                        {/* Color Group */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setTextColor('#000000');
                                            // Auto-disable border when switching to black text (since border is black only)
                                            setIsBorderEnabled(false);
                                            setVisualBorderEnabled(false);
                                        }}
                                        className={`w-6 h-6 rounded-full border border-zinc-300 bg-black cursor-pointer transition-all ${textColor === '#000000' ? 'ring-2 ring-zinc-900 ring-offset-2' : 'hover:scale-110'}`}
                                    />
                                    <button
                                        onClick={() => setTextColor('#FFFFFF')}
                                        className={`w-6 h-6 rounded-full border border-zinc-300 bg-white cursor-pointer transition-all ${textColor === '#FFFFFF' ? 'ring-2 ring-zinc-900 ring-offset-2' : 'hover:scale-110'}`}
                                    />
                                </div>

                                {/* Border Text Chip (Clearer UX) */}
                                {images.length > 0 && textColor === '#FFFFFF' && (
                                    <button
                                        onClick={() => {
                                            const newValue = !visualBorderEnabled;
                                            setVisualBorderEnabled(newValue);

                                            // Deferred Canvas Update
                                            setTimeout(() => {
                                                setIsBorderEnabled(newValue);
                                            }, 350);
                                        }}
                                        className={`ml-3 px-3 py-1 rounded-full text-[11px] font-medium transition-all border ${visualBorderEnabled
                                            ? 'bg-black text-white border-black'
                                            : 'bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200'
                                            }`}
                                    >
                                        обводка
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Since + Translit Group */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-zinc-400 tracking-wide">Since</span>
                                <button
                                    onClick={() => {
                                        const newValue = !isSinceEnabled;
                                        setIsSinceEnabled(newValue);
                                        if (!newValue) {
                                            if (footerDate) lastDateRef.current = footerDate;
                                            setFooterDate('');
                                        } else {
                                            setFooterDate(lastDateRef.current || '05.09.2025');
                                        }
                                    }}
                                    className={`w-8 h-5 rounded-full relative transition-colors cursor-pointer ${isSinceEnabled ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                                >
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${isSinceEnabled ? 'left-[14px]' : 'left-0.5'}`} />
                                </button>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-zinc-400 tracking-wide">Транслит</span>
                                <button
                                    onClick={() => setIsTranslitEnabled(!isTranslitEnabled)}
                                    className={`w-8 h-5 rounded-full relative transition-colors cursor-pointer ${isTranslitEnabled ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                                >
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${isTranslitEnabled ? 'left-[14px]' : 'left-0.5'}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="flex items-center justify-between mb-2 px-1">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-zinc-500 tracking-wide flex items-center gap-1">
                                    <Sun className="w-3 h-3" /> Яркость
                                </span>
                                <span className="text-[10px] font-medium text-zinc-400">{(brightness * 100).toFixed(0)}%</span>
                            </div>

                            {/* B/W Toggle (Moved here) */}
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-zinc-400 tracking-wide">Ч/Б</span>
                                <button
                                    onClick={() => setIsBWEnabled(!isBWEnabled)}
                                    className={`w-8 h-5 rounded-full relative transition-colors cursor-pointer ${isBWEnabled ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                                >
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${isBWEnabled ? 'left-[14px]' : 'left-0.5'}`} />
                                </button>
                            </div>
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

                    {/* Primary Action Button (Section Style / Large) */}
                    <div className="flex justify-center mt-4 p-4">
                        <button
                            className="w-16 h-16 flex items-center justify-center rounded-2xl bg-white/40 border border-zinc-900/10 shadow-sm text-zinc-600 cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-md hover:border-zinc-300 hover:text-zinc-900 active:scale-95 group relative transform-gpu will-change-transform [backface-visibility:hidden]"
                            title="На макет"
                        >
                            <Shirt className="w-7 h-7 transform-gpu will-change-transform" strokeWidth={2} />
                        </button>
                    </div>
                </section>
            </aside >
            <main className="flex-1 flex overflow-hidden relative">
                <div className="fixed top-6 right-6 flex gap-3 items-center z-[100]">
                    <button onClick={onOpenMockup} className="flex items-center gap-2 bg-white/80 backdrop-blur-md border border-zinc-200 text-zinc-700 rounded-full py-2.5 px-6 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 font-medium text-sm cursor-pointer transform-gpu will-change-transform [backface-visibility:hidden]">
                        <Shirt className="w-3.5 h-3.5" /> Макет
                    </button>
                    <button onClick={() => canvas && exportHighRes(canvas)} className="flex items-center gap-2 bg-zinc-900 text-white rounded-full py-2.5 px-6 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all active:scale-95 font-medium text-sm cursor-pointer transform-gpu will-change-transform [backface-visibility:hidden]">
                        <ArrowDownToLine className="w-4 h-4" /> Файл
                    </button>
                </div>
                <div className={`flex-1 relative overflow-hidden transition-opacity duration-700 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
                    <CanvasEditor onCanvasReady={handleCanvasReady} logicalHeight={logicalCanvasHeight} autoZoomOnResize={shouldAutoZoom}>
                        {images.length === 0 && (
                            <div
                                onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                                className="absolute cursor-pointer group flex flex-col items-center justify-center border-4 border-solid border-zinc-200 bg-white/50 backdrop-blur-xl rounded-3xl shadow-xl transition-all duration-500 ease-out hover:shadow-2xl hover:scale-[1.015] hover:bg-white/80 hover:border-zinc-300"
                                style={{
                                    width: '2160px', // CONTENT_WIDTH
                                    height: '2160px', // Square
                                    left: '300px', // PADDING_SIDE (120) + CANVAS_PADDING (180)
                                    top: `${660 + (headerLines - 1) * 255}px`
                                }}
                            >
                                <ImagePlus className="w-48 h-48 text-zinc-300 mb-8 group-hover:text-zinc-500 transition-colors duration-500" />
                                <span className="text-6xl font-medium text-zinc-400 tracking-wide mb-4 transition-colors duration-500 group-hover:text-zinc-600">
                                    Загрузить фото
                                </span>

                            </div>
                        )}
                    </CanvasEditor>
                </div>
            </main>
        </div >
    );
};
