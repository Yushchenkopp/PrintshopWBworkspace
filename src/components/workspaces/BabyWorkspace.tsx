import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CanvasEditor } from '../CanvasEditor';
import { generateBabyTemplate, updateBabyHeader, updateCollageFilters, updateImageGeometry } from '../../utils/TemplateGenerators';
import type { TemplateType } from '../../utils/TemplateGenerators';
import { transliterate } from '../../utils/Transliteration';
import { exportHighRes, generateHighResBlob } from '../../utils/ExportUtils';
import { Trash2, ImagePlus, ArrowDownToLine, LayoutDashboard, BookHeart, SquareParking, SquareUser, Volleyball, PenTool, Type, User, Calendar, Sun, Shirt, Check, Loader2 } from 'lucide-react';
import * as fabric from 'fabric';
import heic2any from 'heic2any';
import { AnimatePresence, motion } from 'framer-motion';

interface BabyWorkspaceProps {
    onSwitchTemplate: (template: TemplateType) => void;
    onOpenMockup: () => void;
    onTransferToMockup?: (printData: string) => void;
    mockupPrintCount?: number;
}

export const BabyWorkspace: React.FC<BabyWorkspaceProps> = ({ onSwitchTemplate, onOpenMockup, onTransferToMockup, mockupPrintCount }) => {
    const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
    const [images, setImages] = useState<{ id: string; url: string }[]>([]);
    const [headerText, setHeaderText] = useState<string>("GENNADIEVICH");
    const [footerName, setFooterName] = useState<string>("NAME");
    const [footerDate, setFooterDate] = useState<string>("99.99.9999");
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
    const [isNameLeft, setIsNameLeft] = useState<boolean>(true); // Default Left (New)
    const [isBorderEnabled, setIsBorderEnabled] = useState<boolean>(false); // Canvas State (Delayed)
    const [visualBorderEnabled, setVisualBorderEnabled] = useState<boolean>(false); // UI State (Instant)
    const [isTransferring, setIsTransferring] = useState(false);
    const [isTransferSuccess, setIsTransferSuccess] = useState(false);

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
    } | null>({ header: "ГЕННАДИЕВИЧ", name: "ИМЯ", date: "99.99.9999" });

    const [isReady, setIsReady] = useState(false);

    const [scaleX, setScaleX] = useState<number>(1);
    const [scaleY, setScaleY] = useState<number>(1);
    const [signatureScale, setSignatureScale] = useState<number>(1);
    // Ref for detecting drag vs click on placeholder
    const placeholderMouseDownPos = useRef<{ x: number; y: number } | null>(null);

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
            setOriginalValues(prev => prev || { header: headerText, name: footerName, date: footerDate });
            setHeaderText(prev => transliterate(prev).toUpperCase());
            setFooterName(prev => transliterate(prev).toUpperCase());
            setFooterDate(prev => transliterate(prev).toUpperCase());
        } else {
            if (originalValues) {
                setHeaderText(originalValues.header);
                setFooterName(originalValues.name);
                setFooterDate(originalValues.date);
                setOriginalValues(null); // Clears saved
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
        isNameLeft: true,
        scaleX: 1,
        scaleY: 1,
        signatureScale: 1,
        textColor: '#000000'
    });

    const lastDateRef = useRef('99.99.9999');

    // Calculate Structure Change (Render Phase)
    const currentImagesJson = JSON.stringify(images.map(img => img.url));
    const isStructureChanged =
        currentImagesJson !== prevPropsRef.current.imagesJson ||
        aspectRatio !== prevPropsRef.current.aspectRatio ||
        headerLines !== prevPropsRef.current.headerLines ||
        isFooterEnabled !== prevPropsRef.current.isFooterEnabled ||
        isNameLeft !== prevPropsRef.current.isNameLeft ||
        isBorderEnabled !== prevPropsRef.current.isBorderEnabled ||
        textColor !== prevPropsRef.current.textColor; // Force re-render on color change

    const shouldAutoZoom = !isReady || isStructureChanged;

    useEffect(() => {
        if (canvas) {
            const renderTemplate = async () => {
                try {
                    // Access calculated values
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

                        // CAPTURE CURRENT POSITIONS (PRESERVE PAN)
                        // Only capture if Grid/Layout hasn't changed.
                        // If Header Lines, Ratio, or Images change, we must reset positions to fit new layout.
                        const isLayoutChanged =
                            currentImagesJson !== prevPropsRef.current.imagesJson ||
                            aspectRatio !== prevPropsRef.current.aspectRatio ||
                            headerLines !== prevPropsRef.current.headerLines;

                        let manualPositions: { left: number, top: number }[] = [];

                        if (!isLayoutChanged) {
                            const currentObjects = canvas.getObjects().filter(o => o.type === 'image');
                            manualPositions = currentObjects.map(obj => ({
                                left: obj.left || 0,
                                top: obj.top || 0
                            }));
                        }

                        const imageUrls = images.map(img => img.url);
                        // Pass initial scale/pan to generate (though often reset on structure change, 
                        // preserving them gives better UX if just toggling footer)
                        const newHeight = await generateBabyTemplate(canvas, imageUrls, aspectRatio, debouncedHeaderText, footerName, footerDate, isBWEnabled, isSinceEnabled, textColor, brightness, headerLines, debouncedSignatureText, isSignatureEnabled, isBorderEnabled, isFooterEnabled, scaleX, scaleY, signatureScale, manualPositions, isNameLeft);

                        if (newHeight !== logicalCanvasHeight) {
                            setLogicalCanvasHeight(newHeight);
                            // Defer ref update so next render sees structure change and auto-zooms
                            return;
                        }

                        setLogicalCanvasHeight(newHeight);
                        // Force Geometry Update to sync Border/Clip immediately (Fixes Scenario B Mismatch)
                        updateImageGeometry(canvas, scaleX, scaleY, isNameLeft);

                        if (!isReady) {
                            setTimeout(() => setIsReady(true), 150);
                        }

                    } else if (isGeometryChanged) {
                        // Smart Geometry Update (No clear/reload)
                        updateImageGeometry(canvas, scaleX, scaleY, isNameLeft);

                    } else if (isFilterChanged) {
                        // Filter Update Only
                        updateCollageFilters(canvas, isBWEnabled, brightness);

                    } else {
                        // Smart Update (Text Only + Signature)
                        const newHeight = updateBabyHeader(canvas, debouncedHeaderText, footerName, footerDate, isSinceEnabled, textColor, headerLines, debouncedSignatureText, isSignatureEnabled, scaleX, signatureScale, scaleY, isNameLeft);
                        // Update logical height if changed (e.g. signature added/removed or resized)
                        if (newHeight && newHeight !== logicalCanvasHeight) {
                            setLogicalCanvasHeight(newHeight);
                            // Smart updates (like signature resize) should NOT trigger auto-zoom
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
                        isFooterEnabled,
                        isNameLeft,
                        scaleX,
                        scaleY,
                        signatureScale,
                        textColor
                    };
                } catch (error) {
                    console.error("Error rendering template:", error);
                }
            };
            renderTemplate();
        }
    }, [canvas, images, aspectRatio, debouncedHeaderText, footerName, footerDate, isBWEnabled, isSinceEnabled, textColor, brightness, headerLines, debouncedSignatureText, isSignatureEnabled, isBorderEnabled, isFooterEnabled, isNameLeft, scaleX, scaleY, signatureScale, logicalCanvasHeight]); // Added logicalCanvasHeight

    return (
        <div className="h-screen bg-slate-100 flex flex-col overflow-hidden" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            <aside className="sidebar-panel">

                <div className="flex justify-center">
                    <img
                        src="/logo.webp"
                        alt="Logo"
                        className="w-[220px] object-contain"
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
                                className={`w-[44px] h-[44px] flex items-center justify-center rounded-xl cursor-pointer group relative transition-all duration-200 ease-out transform-gpu will-change-transform [backface-visibility:hidden] active:scale-90 active:translate-y-0 ${item.id === 'baby' ? 'bg-zinc-900 text-white shadow-md' : 'bg-white/40 border border-zinc-900/10 shadow-sm text-zinc-600 hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-md hover:border-zinc-300 hover:text-zinc-900 active:bg-zinc-200 active:border-zinc-200 active:shadow-none'}`}
                                title={item.label}
                            >
                                <item.icon className="w-[18px] h-[18px] transform-gpu will-change-transform antialiased [backface-visibility:hidden] [transform:translateZ(0)]" />
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
                    <div className="flex gap-2 mb-4">
                        {/* Header Input */}
                        <div className="relative group flex-1">
                            <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" />
                            <input
                                type="text"
                                maxLength={20}
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

                    {/* Translit Toggle (Moved here) */}
                    <div className="flex items-center gap-2 mb-4 pl-1">
                        <span className="text-[10px] font-bold text-zinc-400 tracking-wide w-[60px]">Транслит</span>
                        <button
                            onClick={() => setIsTranslitEnabled(!isTranslitEnabled)}
                            className={`w-8 h-5 rounded-full relative transition-colors cursor-pointer ${isTranslitEnabled ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${isTranslitEnabled ? 'left-[14px]' : 'left-0.5'}`} />
                        </button>
                    </div>


                    {/* Footer Toggle (Baby Only) */}
                    <div className="flex items-center gap-2 mb-4 pl-1">
                        <span className="text-[10px] font-bold text-zinc-400 tracking-wide w-[60px]">Подвал</span>
                        <button
                            onClick={() => setIsFooterEnabled(!isFooterEnabled)}
                            className={`w-8 h-5 rounded-full relative transition-colors cursor-pointer ${isFooterEnabled ? 'bg-zinc-900' : 'bg-zinc-200'}`}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${isFooterEnabled ? 'left-[14px]' : 'left-0.5'}`} />
                        </button>

                        {/* Name Placement Toggle (Only visible if Footer Enabled) */}
                        {isFooterEnabled && (
                            <button
                                onClick={() => setIsNameLeft(!isNameLeft)}
                                className="ml-auto text-[10px] font-medium text-zinc-400 hover:text-zinc-600 transition-colors bg-zinc-100 px-2 py-1 rounded-md"
                                title={isNameLeft ? "Имя слева (над штрихкодом)" : "Имя справа (под фото)"}
                            >
                                {isNameLeft ? 'Имя: Слева' : 'Имя: Справа'}
                            </button>
                        )}
                    </div>



                    {isFooterEnabled && (
                        <>
                            {/* Name & Date Row */}
                            <div className="flex gap-2 mb-4">
                                <div className="relative group flex-1">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" />
                                    <input
                                        type="text"
                                        value={footerName}
                                        onChange={(e) => handleTextChange(setFooterName, e.target.value)}
                                        className="w-full pl-10 pr-3 py-2.5 bg-zinc-100 rounded-xl border-transparent text-sm outline-none shadow-inner transition-all duration-200 placeholder:text-zinc-400 focus:bg-white focus:shadow-md focus:ring-2 focus:ring-zinc-200"
                                        placeholder="NAME"
                                    />
                                </div>
                                <div className="relative group flex-1">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" />
                                    <input
                                        type="text"
                                        value={footerDate}
                                        onChange={(e) => handleTextChange(setFooterDate, e.target.value)}
                                        className="w-full pl-10 pr-3 py-2.5 bg-zinc-100 rounded-xl border-transparent text-sm outline-none shadow-inner transition-all duration-200 placeholder:text-zinc-400 focus:bg-white focus:shadow-md focus:ring-2 focus:ring-zinc-200"
                                        placeholder="99.99.9999"
                                    />
                                </div>
                            </div>

                            {/* Settings Row: Since + Translit */}
                            <div className="flex items-center gap-4 mb-3 pl-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-zinc-400 tracking-wide w-[60px]">Since</span>
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
                            </div>

                            {/* Signature Settings */}
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
                        </>
                    )}

                    <div className="flex items-center justify-between mb-2 mt-4 pl-1">
                        <div className="flex items-center">
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
                        <div className="flex items-center justify-between mb-2 pl-1">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-zinc-500 tracking-wide flex items-center gap-1">
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
                    <CanvasEditor onCanvasReady={handleCanvasReady} logicalHeight={logicalCanvasHeight} autoZoomOnResize={shouldAutoZoom}>
                        {images.length === 0 && (
                            <div
                                onMouseDown={(e) => {
                                    placeholderMouseDownPos.current = { x: e.clientX, y: e.clientY };
                                }}
                                onMouseUp={(e) => {
                                    if (!placeholderMouseDownPos.current) return;
                                    const distance = Math.sqrt(
                                        Math.pow(e.clientX - placeholderMouseDownPos.current.x, 2) +
                                        Math.pow(e.clientY - placeholderMouseDownPos.current.y, 2)
                                    );
                                    if (distance < 10) {
                                        document.querySelector<HTMLInputElement>('input[type="file"]')?.click();
                                    }
                                    placeholderMouseDownPos.current = null;
                                }}
                                className="absolute cursor-pointer group flex flex-col items-center justify-center border-4 border-solid border-zinc-200 bg-white/50 backdrop-blur-xl rounded-3xl shadow-xl hover:bg-white/60 transition-colors duration-200"
                                style={{
                                    width: '2160px', // CONTENT_WIDTH
                                    height: '2160px', // Square
                                    left: '300px', // PADDING_SIDE (120) + CANVAS_PADDING (180)
                                    top: `${660 + (headerLines - 1) * 255}px`
                                }}
                            >
                                <ImagePlus className="w-48 h-48 text-zinc-300 transition-colors duration-200" />
                            </div>
                        )}
                    </CanvasEditor>
                </div>
            </main>
        </div >
    );
};
