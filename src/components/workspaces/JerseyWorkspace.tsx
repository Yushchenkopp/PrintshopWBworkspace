import React, { useState, useCallback, useEffect } from 'react';
import { CanvasEditor } from '../CanvasEditor';
import { type TemplateType } from '../../utils/TemplateGenerators';
import { ArrowDownToLine, LayoutDashboard, BookHeart, SquareParking, SquareUser, Volleyball, PenTool, Type, Hash, Shirt } from 'lucide-react';
import * as fabric from 'fabric';
import { exportHighRes } from '../../utils/ExportUtils';

interface JerseyWorkspaceProps {
    onSwitchTemplate: (template: TemplateType) => void;
    onOpenMockup: () => void;
}

export const JerseyWorkspace: React.FC<JerseyWorkspaceProps> = ({ onSwitchTemplate, onOpenMockup }) => {
    const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
    const [isReady, setIsReady] = useState(false);

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
    }, []);

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
                    <img src="/logo.png" alt="Logo" className="w-[90px] opacity-80 drop-shadow-xl object-contain" />
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
                            className={`w-[44px] h-[44px] flex items-center justify-center rounded-xl cursor-pointer group relative transition-all duration-200 ease-out transform-gpu will-change-transform [backface-visibility:hidden] ${item.id === 'jersey' ? 'bg-zinc-900 text-white shadow-md' : 'bg-white/40 border border-zinc-900/10 shadow-sm text-zinc-600 hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-md hover:border-zinc-300 hover:text-zinc-900'}`}
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

                    <div className="relative group w-full mb-4">
                        <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" />
                        <input
                            type="text"
                            value={surname}
                            onChange={handleSurnameChange}
                            className="w-full pl-10 pr-3 py-2.5 bg-zinc-100 rounded-xl border-transparent text-sm outline-none shadow-inner transition-all duration-200 placeholder:text-zinc-400 focus:bg-white focus:shadow-md focus:ring-2 focus:ring-zinc-200 uppercase"
                            placeholder="NAME"
                        />
                    </div>

                    <div className="relative group w-full mb-4">
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
                    <div className="flex items-center gap-3 mb-2 pt-2">

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
                <div className="flex justify-center mt-4 p-4">
                    <button
                        className="w-16 h-16 flex items-center justify-center rounded-2xl bg-white/40 border border-zinc-900/10 shadow-sm text-zinc-600 cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-md hover:border-zinc-300 hover:text-zinc-900 active:scale-95 group relative transform-gpu will-change-transform [backface-visibility:hidden]"
                        title="На макет"
                    >
                        <Shirt className="w-7 h-7 transform-gpu will-change-transform" strokeWidth={2} />
                    </button>
                </div>
            </aside>

            {/* MAIN AREA */}
            <main className="flex-1 flex overflow-hidden relative">
                <div className="fixed top-6 right-6 flex gap-3 z-[100] items-center">
                    <button onClick={onOpenMockup} className="flex items-center gap-2 bg-white/80 backdrop-blur-md border border-zinc-200 text-zinc-700 rounded-full py-2.5 px-6 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 font-medium text-sm cursor-pointer transform-gpu will-change-transform [backface-visibility:hidden]">
                        <Shirt className="w-3.5 h-3.5" /> Макет
                    </button>
                    <button onClick={() => canvas && exportHighRes(canvas)} className="flex items-center gap-2 bg-zinc-900 text-white rounded-full py-2.5 px-6 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all active:scale-95 font-medium text-sm cursor-pointer transform-gpu will-change-transform [backface-visibility:hidden]">
                        <ArrowDownToLine className="w-4 h-4" /> Файл
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
