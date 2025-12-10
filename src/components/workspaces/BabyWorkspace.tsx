import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CanvasEditor } from '../CanvasEditor';
import { generateBabyTemplate, updateBabyHeader, updateCollageFilters, updateImageGeometry } from '../../utils/TemplateGenerators';
import type { TemplateType } from '../../utils/TemplateGenerators';
import { transliterate } from '../../utils/Transliteration';
import { exportHighRes } from '../../utils/ExportUtils';
import { Upload, Trash2, ImagePlus, ArrowDownToLine, LayoutDashboard, BookHeart, SquareParking, SquareUser, Volleyball, PenTool, Type, User, Calendar, Sun } from 'lucide-react';
import * as fabric from 'fabric';
import heic2any from 'heic2any';

interface BabyWorkspaceProps {
    onSwitchTemplate: (template: TemplateType) => void;
}

export const BabyWorkspace: React.FC<BabyWorkspaceProps> = ({ onSwitchTemplate }) => {
    const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
    const [images, setImages] = useState<{ id: string; url: string }[]>([]);
    const [headerText, setHeaderText] = useState<string>("ГЕННАДИЕВИЧ");
    const [footerName, setFooterName] = useState<string>("ИВАН");
    const [footerDate, setFooterDate] = useState<string>("05.09.2025");
    const [isTranslitEnabled, setIsTranslitEnabled] = useState<boolean>(true);
    const [isBWEnabled, setIsBWEnabled] = useState<boolean>(true);
    const [isSinceEnabled, setIsSinceEnabled] = useState<boolean>(true);
    const [textColor, setTextColor] = useState<string>('#000000');
    const [brightness, setBrightness] = useState<number>(0);
    const [aspectRatio, setAspectRatio] = useState<number>(1);
    const [logicalCanvasHeight, setLogicalCanvasHeight] = useState<number>(800);
    const [headerLines, setHeaderLines] = useState<number>(1);
    const [signatureText, setSignatureText] = useState<string>('A CHILD BORN\nTO SHINE');
    const [isSignatureEnabled, setIsSignatureEnabled] = useState<boolean>(false);
    const [isFooterEnabled, setIsFooterEnabled] = useState<boolean>(false); // Default OFF
    const [isBorderEnabled, setIsBorderEnabled] = useState<boolean>(false); // Canvas State (Delayed)
    const [visualBorderEnabled, setVisualBorderEnabled] = useState<boolean>(false); // UI State (Instant)

    // Debounce signature text
    const [debouncedSignatureText, setDebouncedSignatureText] = useState<string>('A CHILD BORN\nTO SHINE');
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

    const [scaleX, setScaleX] = useState<number>(1);
    const [scaleY, setScaleY] = useState<number>(1);

    // Listen for selection changes to update zoom slider
    useEffect(() => {
        if (!canvas) return;

        const updateZoom = () => {
            const activeObj = canvas.getActiveObject() || (canvas.getObjects().find(obj => obj.type === 'image') as fabric.Object);
            if (activeObj && activeObj.type === 'image' && activeObj.clipPath) {
                // If using clipPath logic, we don't sync from ScaleX/Y of the image,
                // but we might want to sync if manual editing was allowed.
                // We could read clipPath width / original Width ratio provided we knew original width.
                // But sliders are relative 0-1.
            }
        };

        canvas.on('selection:created', updateZoom);
        canvas.on('selection:updated', updateZoom);
        canvas.on('object:scaling', updateZoom);

        return () => {
            canvas.off('selection:created', updateZoom);
            canvas.off('selection:updated', updateZoom);
            canvas.off('object:scaling', updateZoom);
        };
    }, [canvas]);

    // Handle Scale X Change (CROP WIDTH)
    const handleScaleXChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newScale = parseFloat(e.target.value);
        setScaleX(newScale);
        if (canvas) {
            const imgObj = canvas.getActiveObject() as fabric.Object || canvas.getObjects().find(obj => obj.type === 'image');
            if (imgObj && imgObj.type === 'image' && imgObj.clipPath) {
                // We need original width to apply factor. 
                // Since simpler to just re-render via state update which calls generateBabyTemplate, 
                // visual update might be slightly delayed but logic is robust.
                // To make it instant, we would need to store original dims.
                // Let's rely on React render cycle for robustness first.
            }
        }
    };

    // Handle Scale Y Change (CROP HEIGHT)
    const handleScaleYChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newScale = parseFloat(e.target.value);
        setScaleY(newScale);
        // Rely on React state update to trigger generateBabyTemplate
    };
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
                // Only take the first valid image
                newImages.push({ id: crypto.randomUUID(), url: imageUrl });
                break; // Stop after first image
            }

            if (newImages.length > 0) {
                const imgItem = newImages[0];
                // Auto-detect aspect ratio for single image
                const img = new Image();
                img.onload = () => {
                    const ratio = img.width / img.height;
                    setAspectRatio(ratio);
                    setImages([imgItem]);
                };
                img.src = imgItem.url;
            }

            e.target.value = ''; // Reset input
        }
    };

    const handleClearCanvas = () => setImages([]);

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
        isFooterEnabled: false,
        scaleX: 1,
        scaleY: 1
    });

    const lastDateRef = useRef('05.09.2025');

    useEffect(() => {
        if (canvas) {
            const renderTemplate = async () => {
                try {
                    const currentImagesJson = JSON.stringify(images.map(img => img.url));

                    const isStructureChanged =
                        currentImagesJson !== prevPropsRef.current.imagesJson ||
                        aspectRatio !== prevPropsRef.current.aspectRatio ||
                        headerLines !== prevPropsRef.current.headerLines ||
                        isSignatureEnabled !== prevPropsRef.current.isSignatureEnabled ||
                        isBorderEnabled !== prevPropsRef.current.isBorderEnabled ||
                        isFooterEnabled !== prevPropsRef.current.isFooterEnabled;

                    const isGeometryChanged =
                        scaleX !== prevPropsRef.current.scaleX ||
                        scaleY !== prevPropsRef.current.scaleY;

                    const isFilterChanged =
                        isBWEnabled !== prevPropsRef.current.isBWEnabled ||
                        brightness !== prevPropsRef.current.brightness;

                    if (isStructureChanged) {
                        // Full Re-render (Structure changed)
                        if (headerLines === 1) {
                            try {
                                await document.fonts.load('100px Bebasneue');
                            } catch (e) {
                                console.warn('Font loading failed', e);
                            }
                        }

                        const imageUrls = images.map(img => img.url);
                        // Pass initial scale/pan to generate (though often reset on structure change, 
                        // preserving them gives better UX if just toggling footer)
                        const newHeight = await generateBabyTemplate(canvas, imageUrls, aspectRatio, debouncedHeaderText, footerName, footerDate, isBWEnabled, isSinceEnabled, textColor, brightness, headerLines, debouncedSignatureText, isSignatureEnabled, isBorderEnabled, isFooterEnabled, scaleX, scaleY);
                        setLogicalCanvasHeight(newHeight);
                        // Force Geometry Update to sync Border/Clip immediately (Fixes Scenario B Mismatch)
                        updateImageGeometry(canvas, scaleX, scaleY);

                        if (!isReady) {
                            setTimeout(() => setIsReady(true), 150);
                        }

                    } else if (isGeometryChanged) {
                        // Smart Geometry Update (No clear/reload)
                        updateImageGeometry(canvas, scaleX, scaleY);

                    } else if (isFilterChanged) {
                        // Filter Update Only
                        updateCollageFilters(canvas, isBWEnabled, brightness);
                    } else {
                        // Smart Update (Text Only)
                        updateBabyHeader(canvas, debouncedHeaderText, footerName, footerDate, isSinceEnabled, textColor, headerLines, debouncedSignatureText, isSignatureEnabled, scaleX);
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
                        isFooterEnabled,
                        scaleX,
                        scaleY
                    };
                } catch (error) {
                    console.error("Error rendering template:", error);
                }
            };
            renderTemplate();
        }
    }, [canvas, images, aspectRatio, debouncedHeaderText, footerName, footerDate, isBWEnabled, isSinceEnabled, textColor, brightness, headerLines, debouncedSignatureText, isSignatureEnabled, isBorderEnabled, isFooterEnabled, scaleX, scaleY]);

    return (
        <div className="h-screen bg-slate-100 flex flex-col overflow-hidden" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            <aside className="sidebar-panel">

                <div className="flex justify-center">
                    <img
                        src="/logo.png"
                        alt="Logo"
                        className="w-40 opacity-80 drop-shadow-xl object-contain"
                    />
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
                                className={`aspect-square flex items-center justify-center rounded-xl cursor-pointer group relative transition-all duration-200 ease-out transform-gpu will-change-transform [backface-visibility:hidden] ${item.id === 'baby' ? 'bg-zinc-900 text-white shadow-md' : 'bg-white/40 border border-zinc-900/10 shadow-sm text-zinc-600 hover:scale-105 hover:bg-white/80 hover:shadow-md hover:border-zinc-300 hover:text-zinc-900'}`}
                                title={item.label}
                            >
                                <item.icon className="w-5 h-5" />
                            </button>
                        ))}
                    </div>
                </div>


                {images.length > 0 && (
                    <div className="bg-white/50 rounded-xl p-3 mb-4 border border-zinc-100 shadow-sm">
                        {/* Vertical Scale */}
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Высота</span>
                            <span className="text-[10px] font-medium text-zinc-400">{(scaleY * 100).toFixed(0)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.01"
                            value={scaleY}
                            onChange={handleScaleYChange}
                            className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer shadow-inner [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-200 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 mb-3"
                        />

                        {/* Horizontal Scale */}
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Ширина</span>
                            <span className="text-[10px] font-medium text-zinc-400">{(scaleX * 100).toFixed(0)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.01"
                            value={scaleX}
                            onChange={handleScaleXChange}
                            className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer shadow-inner [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-200 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 mb-3"
                        />

                        <div className="flex justify-end">
                            <button
                                onClick={handleClearCanvas}
                                className="text-xs text-red-400 hover:text-red-500 font-medium flex items-center gap-1 transition-colors px-2 py-1 rounded-md hover:bg-red-50"
                            >
                                <Trash2 className="w-3 h-3" /> Удалить фото
                            </button>
                        </div>
                    </div>
                )}

                {/* Hidden File Input for Placeholder Click */}
                <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                />

                <section>
                    {/* Header Row: Input + Lines Control */}

                    {/* Header Row: Input + Lines Control */}
                    <div className="flex gap-2 mb-3">
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


                    {/* Footer Toggle (Baby Only) */}
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">ФУТЕР</span>
                        <button
                            onClick={() => setIsFooterEnabled(!isFooterEnabled)}
                            className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${isFooterEnabled ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                        >
                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${isFooterEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                    </div>

                    {/* Translit Toggle (Always Visible) */}
                    <div className="flex items-center justify-between mb-4 px-1">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">ТРАНСЛИТ</span>
                        <button
                            onClick={() => setIsTranslitEnabled(!isTranslitEnabled)}
                            className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${isTranslitEnabled ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                        >
                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${isTranslitEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                    </div>

                    {isFooterEnabled && (
                        <>
                            {/* Name & Date Row */}
                            <div className="flex gap-2 mb-3">
                                <div className="relative group flex-1">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" />
                                    <input
                                        type="text"
                                        value={footerName}
                                        onChange={(e) => handleTextChange(setFooterName, e.target.value)}
                                        className="w-full pl-10 pr-3 py-2.5 bg-zinc-100 rounded-xl border-transparent text-sm outline-none shadow-inner transition-all duration-200 placeholder:text-zinc-400 focus:bg-white focus:shadow-md focus:ring-2 focus:ring-zinc-200"
                                        placeholder="ИВАН"
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

                            {/* Settings Row: Since + Translit */}
                            <div className="flex items-center gap-4 mb-3 px-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">SINCE</span>
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
                                        className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${isSinceEnabled ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                                    >
                                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${isSinceEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Signature Settings */}
                            <div className="mt-1 mb-3">
                                {!isSignatureEnabled ? (
                                    <button
                                        onClick={() => setIsSignatureEnabled(true)}
                                        className="text-[11px] text-zinc-400 hover:text-zinc-600 font-medium px-1 py-0.5 transition-colors cursor-pointer"
                                    >
                                        + подпись
                                    </button>
                                ) : (
                                    <div className="relative mt-2">
                                        <textarea
                                            value={signatureText}
                                            onChange={(e) => handleTextChange(setSignatureText, e.target.value)}
                                            className="w-full px-3 py-2.5 bg-zinc-100 rounded-xl border-transparent text-sm outline-none shadow-inner transition-all duration-200 placeholder:text-zinc-400 focus:bg-white focus:shadow-md focus:ring-2 focus:ring-zinc-200 resize-none"
                                            placeholder="WANNA BE YOURS"
                                            rows={3}
                                            style={{ minHeight: '60px' }}
                                        />
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    <div className="flex items-center justify-between mb-2 mt-4">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">ЦВЕТ</span>
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


                    </div>

                    <div className="mt-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-1">
                                    <Sun className="w-3 h-3" /> Яркость
                                </span>
                                <span className="text-[10px] font-medium text-zinc-400">{(brightness * 100).toFixed(0)}%</span>
                            </div>

                            {/* B/W Toggle (Moved here) */}
                            <div className="flex items-center gap-2 scale-90 origin-right">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Ч/Б</span>
                                <button
                                    onClick={() => setIsBWEnabled(!isBWEnabled)}
                                    className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${isBWEnabled ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                                >
                                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${isBWEnabled ? 'left-[18px]' : 'left-0.5'}`} />
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
                </section>
            </aside >
            <main className="flex-1 flex overflow-hidden relative">
                <div className="fixed top-6 right-6 flex gap-3 z-[100]">
                    <button onClick={() => canvas && exportHighRes(canvas)} className="flex items-center gap-2 bg-zinc-900 text-white rounded-full py-2.5 px-6 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all active:scale-95 font-medium text-sm cursor-pointer">
                        <ArrowDownToLine className="w-4 h-4" /> Файл
                    </button>
                </div>
                <div className={`flex-1 relative overflow-hidden transition-opacity duration-700 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
                    <CanvasEditor onCanvasReady={handleCanvasReady} logicalHeight={logicalCanvasHeight}>
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
