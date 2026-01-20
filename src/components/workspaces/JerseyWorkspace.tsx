import React, { useState, useCallback, useEffect } from 'react';
import { CanvasEditor } from '../CanvasEditor';
import { type TemplateType } from '../../utils/TemplateGenerators';
import { ArrowDownToLine, LayoutDashboard, BookHeart, SquareParking, SquareUser, Volleyball, PenTool, Type, Hash, Shirt, Check, Loader2 } from 'lucide-react';
import * as fabric from 'fabric';
import { exportHighRes, generateHighResBlob } from '../../utils/ExportUtils';
import { AnimatePresence, motion } from 'framer-motion';

interface JerseyWorkspaceProps {
    onSwitchTemplate: (template: TemplateType) => void;
    onOpenMockup: () => void;
    onTransferToMockup?: (printData: string) => void;
    mockupPrintCount?: number;
}

export const JerseyWorkspace: React.FC<JerseyWorkspaceProps> = ({ onSwitchTemplate, onOpenMockup, onTransferToMockup, mockupPrintCount }) => {
    const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isTransferring, setIsTransferring] = useState(false);
    const [isTransferSuccess, setIsTransferSuccess] = useState(false);

    const [surname, setSurname] = useState('PETROV');
    const [number, setNumber] = useState('8');
    const [textColor, setTextColor] = useState('#000000'); // Default black

    // New States for Sliders
    const [language, setLanguage] = useState<'ENG' | 'RUS'>('ENG');

    // New States for Sliders
    const [numberSize, setNumberSize] = useState(1200);
    const [horizontalOffset, setHorizontalOffset] = useState(0);
    const [verticalOffset, setVerticalOffset] = useState(0);

    const handleCanvasReady = useCallback((c: fabric.Canvas) => {
        setCanvas(c);
        c.backgroundColor = 'transparent';
        c.renderAll();
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

    const updateTexts = useCallback(() => {
        if (!canvas) return;

        const render = async () => {
            // Ensure fonts are loaded
            await document.fonts.load('100px "Varsity Regular"');
            await document.fonts.load('100px "JackportCollegeNcv"');

            // Canvas Dimensions
            // CanvasEditor fixed width is 2400 (800 * 3)
            const LOGICAL_CANVAS_WIDTH = 2400;
            const LOGICAL_CANVAS_HEIGHT = 2400;

            const centerX = LOGICAL_CANVAS_WIDTH / 2;
            const centerY = LOGICAL_CANVAS_HEIGHT / 2;

            // Apply horizontal offset
            // Surname stays centered
            // Number moves with offset

            // TEXTS
            // Calculate dimensions to center the layout based on DEFAULT sizes.
            // This ensures the layout is centered initially, but the "Joint" (anchor)
            // remains static when changing the number size, so the Surname doesn't jump.

            const gap = -165;
            const DEFAULT_NUMBER_SIZE = 1200;

            // Font Selection based on Language Toggle
            // ENG: Varsity Regular for ALL
            // RUS: JackportCollegeNcv for ALL
            const activeFont = language === 'RUS' ? 'JackportCollegeNcv' : 'Varsity Regular';

            // Layout Logic
            // If RUS, Surname width is 130% (scaleX)
            // scaleY is 1.2 always for Surname
            const surnameScaleX = language === 'RUS' ? 1.3 : 1;

            // RUS Number: Wider horizontally, Narrower vertically (but now stretched +13% from 1.0 -> 1.13)
            // ENG: scaleX: 1, scaleY: 1.2
            // RUS: scaleX: 1.35, scaleY: 1.13
            const numberScaleX = language === 'RUS' ? 1.35 : 1;
            const numberScaleY = language === 'RUS' ? 1.13 : 1.2;

            // Measure heights based on FIXED metrics (Varsity Regular) to prevent layout jumping
            // We use the ENG layout as the "Stable Grid"
            const tempSurname = new fabric.Text(surname.toUpperCase(), {
                fontFamily: 'Varsity Regular', // Always use Varsity for layout calculation
                fontSize: 320,
                charSpacing: 50,
                scaleY: 1.2
            });

            const tempNumberDefault = new fabric.Text(number, {
                fontFamily: 'Varsity Regular', // Always use Varsity for layout calculation
                fontSize: DEFAULT_NUMBER_SIZE,
                scaleY: 1.2
            });

            const surnameHeight = tempSurname.getScaledHeight();
            const defaultNumberHeight = tempNumberDefault.getScaledHeight();

            // Calculate static vertical center (Joint Position)
            const verticalCenter = centerY + (surnameHeight / 2) - (defaultNumberHeight / 2);

            const surnameText = new fabric.Text(surname.toUpperCase(), {
                fontFamily: activeFont,
                fontSize: 320,
                fill: textColor,
                originX: 'center',
                originY: 'bottom',
                left: centerX,
                top: verticalCenter - gap / 2,
                scaleY: 1.2,
                scaleX: surnameScaleX,
                selectable: false,
                evented: false,
                charSpacing: 50,
                objectCaching: false
            });

            // Number
            // Anchor by center to defined point
            // For RUS, we shift it down slightly ("пониже") -> adding offset
            const rusVerticalOffset = language === 'RUS' ? 50 : 0;
            // Total vertical offset: RUS-specific offset + User-defined vertical slider
            const numberCenterY = verticalCenter + gap / 2 + defaultNumberHeight / 2 + rusVerticalOffset + verticalOffset;

            const numberText = new fabric.Text(number, {
                fontFamily: activeFont,
                fontSize: numberSize,
                fill: textColor,
                originX: 'center',
                originY: 'center',
                left: centerX + horizontalOffset,
                top: numberCenterY, // Includes RUS offset + Manual Vertical Offset
                scaleY: numberScaleY, // Dynamic Vertical Scale
                scaleX: numberScaleX, // Dynamic Horizontal Scale
                selectable: false,
                evented: false,
                objectCaching: false
            });

            canvas.clear();
            // No template added
            canvas.add(surnameText);
            canvas.add(numberText);
            canvas.requestRenderAll();

            if (!isReady) setIsReady(true);
        };
        render();

    }, [canvas, surname, number, textColor, numberSize, horizontalOffset, verticalOffset, isReady, language]);

    useEffect(() => {
        updateTexts();
    }, [updateTexts]);

    // Auto-update default text or reset if invalid when switching languages
    useEffect(() => {
        if (language === 'RUS') {
            // If currently PETROV -> ПЕТРОВ
            if (surname === 'PETROV') {
                setSurname('ПЕТРОВ');
            } else {
                // Check if current surname has Latin characters
                // If so, it's invalid for RUS mode, so reset to default to avoid getting stuck
                if (/[a-zA-Z]/.test(surname)) {
                    setSurname('ПЕТРОВ');
                }
            }
        } else {
            // ENG mode
            if (surname === 'ПЕТРОВ') {
                setSurname('PETROV');
            } else {
                // Check if current surname has Cyrillic characters
                // If so, reset to PETROV
                if (/[а-яА-ЯёЁ]/.test(surname)) {
                    setSurname('PETROV');
                }
            }
        }
    }, [language]); // Only when language changes

    // Input Handlers with Validation
    const handleSurnameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;

        if (language === 'ENG') {
            // ENG: Latin, Numbers, Spaces, Punctuation ONLY
            if (/^[a-zA-Z0-9\s\.\-]*$/.test(val)) {
                setSurname(val);
            }
        } else {
            // RUS: Cyrillic, Numbers, Spaces, Punctuation ONLY
            if (/^[а-яА-ЯёЁ0-9\s\.\-]*$/.test(val)) {
                setSurname(val);
            }
        }
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (/^[0-9]*$/.test(val)) {
            setNumber(val);
        }
    };

    return (
        <div className="h-screen bg-slate-100 flex flex-col overflow-hidden" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            {/* SIDEBAR */}
            <aside className="sidebar-panel">
                <div className="flex justify-center">
                    <img src="/logo.webp" alt="Logo" className="w-[220px] object-contain" />
                </div>

                {/* Navigation Grid */}
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
                            className={`w-[44px] h-[44px] flex items-center justify-center rounded-xl cursor-pointer group relative transition-all duration-200 ease-out transform-gpu will-change-transform [backface-visibility:hidden] active:scale-90 active:translate-y-0 ${item.id === 'jersey' ? 'bg-zinc-900 text-white shadow-md' : 'bg-white/40 border border-zinc-900/10 shadow-sm text-zinc-600 hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-md hover:border-zinc-300 hover:text-zinc-900 active:bg-zinc-200 active:border-zinc-200 active:shadow-none'}`}
                            title={item.label}
                        >
                            <item.icon className="w-[18px] h-[18px] transform-gpu will-change-transform antialiased [backface-visibility:hidden] [transform:translateZ(0)]" />
                        </button>
                    ))}
                </div>

                {/* CONTROLS */}
                <section className="flex flex-col gap-4">


                    {/* Language Toggle */}
                    <div className="relative bg-[#F5F5F7] rounded-[10px] p-1 flex h-[36px] mb-2">
                        <div
                            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-[6px] shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${language === 'ENG' ? 'left-1' : 'left-[calc(50%)]'}`}
                        />
                        <button
                            onClick={() => setLanguage('ENG')}
                            className={`flex-1 relative z-10 text-[13px] font-medium transition-colors duration-200 ${language === 'ENG' ? 'text-black' : 'text-[#8E8E93]'}`}
                        >
                            ENG
                        </button>
                        <button
                            onClick={() => setLanguage('RUS')}
                            className={`flex-1 relative z-10 text-[13px] font-medium transition-colors duration-200 ${language === 'RUS' ? 'text-black' : 'text-[#8E8E93]'}`}
                        >
                            RUS
                        </button>
                    </div>

                    <div className="relative group w-full mb-2">
                        <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" />
                        <input
                            type="text"
                            value={surname}
                            onChange={handleSurnameChange}
                            className="w-full pl-10 pr-3 py-2.5 bg-zinc-100 rounded-xl border-transparent text-sm outline-none shadow-inner transition-all duration-200 placeholder:text-zinc-400 focus:bg-white focus:shadow-md focus:ring-2 focus:ring-zinc-200 uppercase"
                            placeholder="NAME"
                        />
                    </div>

                    <div className="relative group w-full mb-2">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" />
                        <input
                            type="text"
                            value={number}
                            onChange={handleNumberChange}
                            className="w-full pl-10 pr-3 py-2.5 bg-zinc-100 rounded-xl border-transparent text-sm outline-none shadow-inner transition-all duration-200 placeholder:text-zinc-400 focus:bg-white focus:shadow-md focus:ring-2 focus:ring-zinc-200"
                            placeholder="10"
                            maxLength={2}
                        />
                    </div>

                    {/* Color Picker */}
                    <div className="flex items-center gap-3 mb-2">

                        <div className="flex gap-2">
                            <button
                                onClick={() => setTextColor('#000000')}
                                className={`w-6 h-6 rounded-full border border-zinc-300 bg-black cursor-pointer transition-all ${textColor === '#000000' ? 'ring-2 ring-zinc-900 ring-offset-2' : 'hover:scale-110'}`}
                            />
                            <button
                                onClick={() => setTextColor('#ffffff')}
                                className={`w-6 h-6 rounded-full border border-zinc-300 bg-white cursor-pointer transition-all ${textColor === '#ffffff' ? 'ring-2 ring-zinc-900 ring-offset-2' : 'hover:scale-110'}`}
                            />
                        </div>
                    </div>

                    {/* Sliders */}
                    <div className="space-y-4 pt-4 border-t border-zinc-100">
                        {/* Number Size Slider */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-zinc-500 tracking-wide">Размер номера</span>
                                <span className="text-[10px] font-medium text-zinc-400">{Math.round((numberSize / 1200) * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="960"
                                max="1440"
                                step="10"
                                value={numberSize}
                                onChange={(e) => setNumberSize(parseInt(e.target.value))}
                                className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer shadow-inner [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-200 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110"
                            />
                        </div>

                        {/* Horizontal Position Slider */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-zinc-500 tracking-wide">Смещение X</span>
                                <span className="text-[10px] font-medium text-zinc-400">{horizontalOffset}</span>
                            </div>
                            <input
                                type="range"
                                min="-300"
                                max="300"
                                step="10"
                                value={horizontalOffset}
                                onChange={(e) => setHorizontalOffset(parseInt(e.target.value))}
                                className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer shadow-inner [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-200 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110"
                            />
                        </div>

                        {/* Vertical Position Slider */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-zinc-500 tracking-wide">Смещение Y</span>
                                <span className="text-[10px] font-medium text-zinc-400">{verticalOffset}</span>
                            </div>
                            <input
                                type="range"
                                min="-100"
                                max="100"
                                step="10"
                                value={verticalOffset}
                                onChange={(e) => setVerticalOffset(parseInt(e.target.value))}
                                className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer shadow-inner [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-200 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110"
                            />
                        </div>
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

            {/* MAIN AREA */}
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
                    {/* Reusing CanvasEditor with standard dimensions? Or we might need to adjust logic if image is huge. 
                        Let's standard 1200 height. */}
                    <CanvasEditor onCanvasReady={handleCanvasReady} logicalHeight={2400} />
                </div>
            </main>
        </div>
    );
};
