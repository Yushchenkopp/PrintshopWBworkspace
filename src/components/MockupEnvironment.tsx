import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, ArrowLeft, ImagePlus, Trash2, Copy } from 'lucide-react';
import { downloadPrintImage, generateCompositeMockup } from '../utils/ExportUtils';


interface MockupEnvironmentProps {
    onClose: () => void;
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

const SIZE_DIMENSIONS: Record<string, { width: number; height: number }> = {
    'XS': { width: 31, height: 44 },
    'S': { width: 33, height: 46 },
    'M': { width: 35, height: 48 },
    'L': { width: 36, height: 50 },
    'XL': { width: 36, height: 52 },
    'XXL': { width: 38, height: 54 },
    '3XL': { width: 41, height: 56 },
};


export const MockupEnvironment: React.FC<MockupEnvironmentProps> = ({ onClose }) => {
    const [shirtColor, setShirtColor] = useState<'white' | 'black'>('white');
    const [selectedSize, setSelectedSize] = useState('M');
    // Coordinates fixed by user request
    const [pos] = useState({ x: 40.15, y: 73.63 });

    // Front Print State
    const [frontPrint, setFrontPrint] = useState<string | null>(null);
    const [frontPrintSize, setFrontPrintSize] = useState(1);
    const [frontPrintY, setFrontPrintY] = useState(2); // Starts at 2cm
    const [imgAspectRatio, setImgAspectRatio] = useState(30 / 42); // Default to full fit

    // Back Print State
    const [backPrint, setBackPrint] = useState<string | null>(null);
    const [backPrintSize, setBackPrintSize] = useState(1);
    const [backPrintY, setBackPrintY] = useState(9); // Starts at 9cm
    const [backImgAspectRatio, setBackImgAspectRatio] = useState(30 / 42);




    // Print Area Calibration State
    // const [isDebug, setIsDebug] = useState(false); // Removed
    const [printArea] = useState({ top: 32, left: 18, width: 13, height: 38 });
    const [backPrintArea] = useState({ top: 31, left: 49, width: 14, height: 39 }); // Default right side position

    // Export Configuration (Hardcoded User Calibration)
    const EXPORT_CROP_CONFIG = { top: 11, left: 6, width: 69, height: 78 };

    // Export Calibration State (Removed as hardcoded)
    // const [isExportCalibration, setIsExportCalibration] = useState(false);
    // const [exportCrop, setExportCrop] = useState(EXPORT_CROP_CONFIG);

    // Drag State

    const [dragOverZone, setDragOverZone] = useState<'front' | 'back' | null>(null);





    // Physical Constants (Based on Selected Size)
    const activeSize = SIZE_DIMENSIONS[selectedSize] || SIZE_DIMENSIONS['XL'];
    const ZONE_HEIGHT_CM = activeSize.height;
    const ZONE_WIDTH_CM = activeSize.width;

    const MIN_OFFSET_CM = 2;
    const MIN_BACK_OFFSET_CM = 9;


    // Calculate dynamic limits based on current size and aspect ratio
    // ZONE_WIDTH_CM is now dynamic above
    const zoneRatio = ZONE_WIDTH_CM / ZONE_HEIGHT_CM;

    // Calculate actual print dimensions in CM
    // If image is wider than zone (aspect > zoneRatio), width limits it.
    // If image is taller (aspect < zoneRatio), height limits it.
    const baseHeight = imgAspectRatio > zoneRatio
        ? ZONE_WIDTH_CM / imgAspectRatio
        : ZONE_HEIGHT_CM;

    const baseWidth = baseHeight * imgAspectRatio;

    const currentPrintHeight = baseHeight * frontPrintSize;
    const currentPrintWidth = baseWidth * frontPrintSize;



    // Subtract 0.1cm buffer to prevent touching/clipping at the bottom border
    const maxOffset = MIN_OFFSET_CM + (ZONE_HEIGHT_CM - currentPrintHeight) - 0.1;


    // Calculate actual Back Print dimensions
    const backBaseHeight = backImgAspectRatio > zoneRatio
        ? ZONE_WIDTH_CM / backImgAspectRatio
        : ZONE_HEIGHT_CM;
    const backBaseWidth = backBaseHeight * backImgAspectRatio;
    const currentBackPrintHeight = backBaseHeight * backPrintSize;
    const currentBackPrintWidth = backBaseWidth * backPrintSize;
    // Subtract 0.1cm buffer
    const maxBackOffset = MIN_BACK_OFFSET_CM + (ZONE_HEIGHT_CM - currentBackPrintHeight) - 0.1;





    const handleFrontPrintUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setFrontPrint(url);
        }
    };

    const removeFrontPrint = () => {
        setFrontPrint(null);
        setFrontPrintSize(1);
        setFrontPrintY(MIN_OFFSET_CM);
    };

    const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSize = parseFloat(e.target.value);
        setFrontPrintSize(newSize);

        // Clamp Y if new size reduces available space
        const newBaseHeight = imgAspectRatio > zoneRatio
            ? ZONE_WIDTH_CM / imgAspectRatio
            : ZONE_HEIGHT_CM;

        const newPrintHeight = newBaseHeight * newSize;
        const newMaxOffset = MIN_OFFSET_CM + (ZONE_HEIGHT_CM - newPrintHeight) - 0.1;

        if (frontPrintY > newMaxOffset) {
            setFrontPrintY(Math.min(frontPrintY, newMaxOffset));
        }
    };

    const handleBackPrintUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            setBackPrint(url);
        }
    };

    const removeBackPrint = () => {
        setBackPrint(null);
        setBackPrintSize(1);
        setBackPrintY(MIN_BACK_OFFSET_CM);
    };

    const handleBackSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newSize = parseFloat(e.target.value);
        setBackPrintSize(newSize);

        const newBaseHeight = backImgAspectRatio > zoneRatio
            ? ZONE_WIDTH_CM / backImgAspectRatio
            : ZONE_HEIGHT_CM;

        const newPrintHeight = newBaseHeight * newSize;
        const newMaxOffset = MIN_BACK_OFFSET_CM + (ZONE_HEIGHT_CM - newPrintHeight) - 0.1;

        if (backPrintY > newMaxOffset) {
            setBackPrintY(newMaxOffset);
        }
    };




    // Drag-and-Drop Handlers
    const handleDragStart = (e: React.DragEvent, zone: 'front' | 'back') => {
        e.dataTransfer.setData('sourceZone', zone);
        e.dataTransfer.effectAllowed = 'move';

        // Custom Drag Image (The Print Itself)
        const imgElement = e.currentTarget.querySelector('img');
        if (imgElement) {
            // Center the click on the image
            const rect = imgElement.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            e.dataTransfer.setDragImage(imgElement, x, y);
        }
    };

    const handleDragOver = (e: React.DragEvent, zone: 'front' | 'back') => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverZone !== zone) setDragOverZone(zone);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        setDragOverZone(null);
    }

    const handleDrop = async (e: React.DragEvent, targetZone: 'front' | 'back') => {
        e.preventDefault();
        setDragOverZone(null);
        const sourceZone = e.dataTransfer.getData('sourceZone') as 'front' | 'back';


        if (!sourceZone || sourceZone === targetZone) return;

        // Perform Swap
        if (targetZone === 'back') {
            // Dragging Front -> Back
            if (!frontPrint) return;

            const tempBack = backPrint;

            // Move Front to Back
            setBackPrint(frontPrint);
            setBackPrintSize(1);
            setBackPrintY(MIN_BACK_OFFSET_CM);
            // We need to fetch/store aspect ratio for the new image if possible, 
            // but we can rely on the onLoad of the img tag to update it correctly.

            if (tempBack) {
                // Determine if we swap or just overwrite/move
                // Plan said "Swap".
                setFrontPrint(tempBack);
                setFrontPrintSize(1);
                setFrontPrintY(MIN_OFFSET_CM);
            } else {
                setFrontPrint(null);
                setFrontPrintSize(1);
                setFrontPrintY(MIN_OFFSET_CM);
            }

        } else {
            // Dragging Back -> Front
            if (!backPrint) return;

            const tempFront = frontPrint;

            setFrontPrint(backPrint);
            setFrontPrintSize(1);
            setFrontPrintY(MIN_OFFSET_CM);

            if (tempFront) {
                setBackPrint(tempFront);
                setBackPrintSize(1);
                setBackPrintY(MIN_BACK_OFFSET_CM);
            } else {
                setBackPrint(null);
                setBackPrintSize(1);
                setBackPrintY(MIN_BACK_OFFSET_CM);
            }
        }
    };

    // Export Functions
    const handleExportMockup = async (mode: 'download' | 'copy') => {
        try {
            const prints = [];
            // Add Front Print
            if (frontPrint) {
                const offsetPercentY = (frontPrintY - MIN_OFFSET_CM) / ZONE_HEIGHT_CM;
                const actualTop = printArea.top + (offsetPercentY * printArea.height);

                const actualWidth = printArea.width * frontPrintSize;
                const actualLeft = printArea.left + ((printArea.width - actualWidth) / 2);

                prints.push({
                    url: frontPrint,
                    xPercent: actualLeft,
                    yPercent: actualTop,
                    widthPercent: actualWidth
                });
            }

            // Add Back Print
            if (backPrint) {
                const offsetPercentY = (backPrintY - MIN_BACK_OFFSET_CM) / ZONE_HEIGHT_CM;
                const actualTop = backPrintArea.top + (offsetPercentY * backPrintArea.height);

                const actualWidth = backPrintArea.width * backPrintSize;
                const actualLeft = backPrintArea.left + ((backPrintArea.width - actualWidth) / 2);

                prints.push({
                    url: backPrint,
                    xPercent: actualLeft,
                    yPercent: actualTop,
                    widthPercent: actualWidth
                });
            }

            const baseImgUrl = `/mockup/mockup-${shirtColor}-full.webp`;
            const EXPORT_CROP_CONFIG = { top: 11, left: 6, width: 69, height: 78 };

            const blob = await generateCompositeMockup(baseImgUrl, prints, EXPORT_CROP_CONFIG);
            if (!blob) throw new Error("Blob generation failed");

            if (mode === 'download') {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `mockup-${shirtColor}-${new Date().getTime()}.jpg`;
                link.href = url;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        [blob.type]: blob
                    })
                ]);
                alert("Copied to clipboard!");
            }

        } catch (e) {
            console.error("Export Error:", e);
            alert("Экспорт не удался.");
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center animate-in fade-in duration-300">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Window */}
            <div className="relative w-[95vw] h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-200">
                {/* SVG Filter Definition for Fabric Texture */}
                <svg className="absolute w-0 h-0 pointer-events-none">
                    <filter id="fabric-texture">
                        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" result="noise" />
                        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.15 0" in="noise" result="coloredNoise" />
                        <feComposite operator="in" in="coloredNoise" in2="SourceAlpha" result="grain" />
                        <feBlend mode="multiply" in="grain" in2="SourceGraphic" />
                    </filter>
                </svg>



                {/* --- FULL BACKGROUND: Image Preview --- */}
                <div
                    className="absolute inset-0 bg-[#e4e4e7]"
                >
                    <AnimatePresence mode="popLayout">
                        <motion.img
                            key={shirtColor}
                            src={`/mockup/mockup-${shirtColor}-full.webp`}
                            alt="T-Shirt Mockup"
                            initial={{ opacity: 0, scale: 1.05 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                        />
                    </AnimatePresence>

                    {/* Front Print Layer (Dynamic Area + Debug Overlay) */}
                    <div
                        className="absolute flex items-start justify-center pointer-events-none z-10 overflow-hidden transition-all duration-200"
                        style={{
                            top: `${printArea.top}%`,
                            left: `${printArea.left}%`,
                            width: `${printArea.width}%`,
                            height: `${printArea.height}%`
                        }}
                    >


                        <AnimatePresence>
                            {frontPrint && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: frontPrintSize }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.3 }}
                                    className="absolute flex items-start justify-center w-full h-full origin-top"
                                    style={{
                                        top: `${((frontPrintY - MIN_OFFSET_CM) / ZONE_HEIGHT_CM) * 100}%`,
                                    }}
                                >
                                    <img
                                        src={frontPrint}
                                        alt="Print"
                                        className={`w-full h-full object-contain object-top transition-all duration-300 ${shirtColor === 'white' ? 'mix-blend-multiply opacity-90' : 'mix-blend-normal opacity-95'}`}
                                        style={{
                                            maxHeight: '100%',
                                            maxWidth: '100%',
                                            filter: 'contrast(1.05) brightness(0.98) sepia(0.05) url(#fabric-texture)',
                                        }}
                                        onLoad={(e) => {

                                            const img = e.currentTarget;
                                            setImgAspectRatio(img.naturalWidth / img.naturalHeight);
                                        }}

                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Back Print Layer (Dynamic Area + Debug Overlay) */}
                    <div
                        className="absolute flex items-start justify-center pointer-events-none z-10 overflow-hidden transition-all duration-200"
                        style={{
                            top: `${backPrintArea.top}%`,
                            left: `${backPrintArea.left}%`,
                            width: `${backPrintArea.width}%`,
                            height: `${backPrintArea.height}%`
                        }}
                    >


                        <AnimatePresence>
                            {backPrint && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: backPrintSize }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.3 }}
                                    className="absolute flex items-start justify-center w-full h-full origin-top"
                                    style={{
                                        top: `${((backPrintY - MIN_BACK_OFFSET_CM) / ZONE_HEIGHT_CM) * 100}%`,
                                    }}
                                >
                                    <img
                                        src={backPrint}
                                        alt="Back Print"
                                        className={`w-full h-full object-contain object-top transition-all duration-300 ${shirtColor === 'white' ? 'mix-blend-multiply opacity-90' : 'mix-blend-normal opacity-95'}`}
                                        style={{
                                            maxHeight: '100%',
                                            maxWidth: '100%',
                                            filter: 'contrast(1.05) brightness(0.98) sepia(0.05) url(#fabric-texture)',
                                        }}
                                        onLoad={(e) => {

                                            const img = e.currentTarget;
                                            setBackImgAspectRatio(img.naturalWidth / img.naturalHeight);
                                        }}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>


                    {/* Back Button (Top-Left) */}
                    <button
                        onClick={onClose}
                        className="absolute top-8 left-8 w-12 h-12 flex items-center justify-center rounded-2xl bg-white/60 backdrop-blur-xl border transition-all duration-300 hover:bg-white hover:scale-105 active:scale-95 group z-50 cursor-pointer shadow-lg hover:shadow-xl"
                        style={{
                            borderColor: 'rgba(255, 255, 255, 0.7) rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.7)',
                            boxShadow: '0 8px 32px -4px rgba(0, 0, 0, 0.1)'
                        }}
                    >
                        <ArrowLeft className="w-5 h-5 text-zinc-600 group-hover:text-zinc-900 transition-colors" strokeWidth={2.5} />
                    </button>

                    {/* Floating Size Indicator (Canvas 2) */}
                    <div
                        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex items-center justify-center w-40 h-40"
                        style={{
                            left: `${pos.x}%`, // Uses fixed state
                            top: `${pos.y}%`
                        }}
                    >
                        <AnimatePresence mode="popLayout">
                            <motion.span
                                key={selectedSize}
                                initial={{ opacity: 0, y: 30, filter: 'blur(12px)', scale: 0.9 }}
                                animate={{ opacity: 0.3, y: 0, filter: 'blur(0px)', scale: 1 }}
                                exit={{ opacity: 0, y: -30, filter: 'blur(12px)', scale: 1.1 }}
                                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                className="absolute text-[6rem] leading-none font-black text-zinc-900 tracking-tighter font-sans antialiased select-none mix-blend-multiply"
                            >
                                {selectedSize}
                            </motion.span>
                        </AnimatePresence>
                    </div>

                    {/* Export Crop Overlay */}
                    {/* Export Crop Overlay (Disabled)
                    {isExportCalibration && (
                        <div
                            className="absolute pointer-events-none z-50 border-2 border-green-500 bg-green-500/10"
                            style={{
                                top: `${exportCrop.top}%`,
                                left: `${exportCrop.left}%`,
                                width: `${exportCrop.width}%`,
                                height: `${exportCrop.height}%`
                            }}
                        >
                            <div className="absolute top-0 left-0 bg-green-500 text-white text-[9px] px-1">
                                Export Zone
                            </div>
                        </div>
                    )} */}
                </div>

                {/* --- RIGHT FLOATING SIDEBAR --- */}
                <aside
                    className="absolute top-6 right-6 bottom-6 w-[400px] flex flex-col z-20 
                    bg-white/60 backdrop-blur-xl border rounded-3xl overflow-hidden
                    transition-all duration-300 ease-in-out"
                    style={{
                        borderColor: 'rgba(255, 255, 255, 0.7) rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.7)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                    }}
                >
                    {/* SCROLLABLE CONTENT (Zones 1-3) */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">


                        {/* HEADER */}
                        <div className="flex justify-between items-center">
                            <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Макет</h2>
                            {/* <button
                                onClick={() => setIsExportCalibration(!isExportCalibration)}
                                className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${isExportCalibration ? 'bg-green-50 text-green-600 border-green-200' : 'bg-transparent text-zinc-300 border-zinc-100'}`}
                            >
                                Calibration
                            </button> */}
                        </div>

                        {/* Calibration Controls */}
                        {/* Calibration Controls (Disabled)
                        {isExportCalibration && (
                            <div className="bg-green-50 p-3 rounded-xl border border-green-200 mt-2 grid grid-cols-2 gap-2">
                                {['top', 'left', 'width', 'height'].map((prop) => (
                                    <div key={prop} className="flex flex-col gap-1">
                                        <label className="text-[9px] font-bold text-green-600 uppercase">{prop} (%)</label>
                                        <input
                                            type="number"
                                            value={exportCrop[prop as keyof typeof exportCrop]}
                                            onChange={(e) => setExportCrop(prev => ({ ...prev, [prop]: Number(e.target.value) }))}
                                            className="w-full rounded border border-green-200 bg-white px-2 py-1 text-xs text-green-900 outline-none"
                                        />
                                    </div>
                                ))}
                            </div>
                        )} */}

                        {/* ZONE 1: PARAMETERS */}
                        <section className="space-y-4">


                            {/* Color Swatches (Premium) */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShirtColor('white')}
                                    className={`w-8 h-8 rounded-full border shadow-sm relative transition-all duration-300 ${shirtColor === 'white' ? 'border-zinc-300 ring-2 ring-zinc-900 ring-offset-2 scale-105' : 'border-zinc-200 hover:scale-110 hover:border-zinc-300'} bg-white`}
                                    title="White"
                                />
                                <button
                                    onClick={() => setShirtColor('black')}
                                    className={`w-8 h-8 rounded-full border shadow-sm relative transition-all duration-300 ${shirtColor === 'black' ? 'border-zinc-600 ring-2 ring-zinc-900 ring-offset-2 scale-105' : 'border-zinc-700 hover:scale-110 hover:border-zinc-600'} bg-zinc-900`}
                                    title="Black"
                                />
                            </div>

                            {/* Size Selector (Sidebar Style) */}
                            <div>
                                <div className="grid grid-cols-4 gap-2">
                                    {SIZES.map(size => (
                                        <button
                                            key={size}
                                            onClick={() => setSelectedSize(size)}
                                            className={`h-10 flex items-center justify-center rounded-xl text-xs font-bold cursor-pointer group relative transition-all duration-200 ease-out transform-gpu will-change-transform [backface-visibility:hidden] ${selectedSize === size
                                                ? 'bg-zinc-900 text-white shadow-md'
                                                : 'bg-white/40 border border-zinc-900/10 shadow-sm text-zinc-600 hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-md hover:border-zinc-300 hover:text-zinc-900'
                                                }`}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </section>

                        <div className="h-px bg-zinc-100" />


                        {/* ZONE 2: FRONT PRINT */}
                        <section className="space-y-4">




                            <div className="flex gap-6">
                                {/* Left Group: Slider + Card */}
                                <div className="flex gap-4 items-center">


                                    {/* Preview Card */}
                                    <div
                                        className={`shrink-0 w-24 h-32 relative group transition-all duration-300 ${dragOverZone === 'front' ? 'scale-105' : ''}`}
                                        onDragOver={(e) => handleDragOver(e, 'front')}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, 'front')}
                                    >
                                        {frontPrint ? (
                                            <div
                                                className={`w-full h-full rounded-2xl border bg-white overflow-hidden relative cursor-grab active:cursor-grabbing transition-all duration-300
                                                    ${dragOverZone === 'front' ? 'border-zinc-900 ring-2 ring-zinc-900/10 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300 hover:shadow-lg hover:-translate-y-0.5'}
                                                `}
                                                draggable="true"
                                                onDragStart={(e) => handleDragStart(e, 'front')}
                                            >
                                                <img src={frontPrint} alt="Front Print" className="w-full h-full object-contain p-2 pointer-events-none" />
                                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={removeFrontPrint}
                                                        className="p-1.5 bg-white/80 backdrop-blur rounded-full text-zinc-400 hover:text-red-500 hover:bg-white shadow-sm transition-all"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>


                                            </div>



                                        ) : (
                                            <label
                                                className={`w-full h-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300 gap-2
                                                    ${dragOverZone === 'front' ? 'border-zinc-900 bg-zinc-50 scale-95 opacity-80' : 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50'}
                                                `}
                                            >

                                                <input type="file" className="hidden" accept="image/*" onChange={handleFrontPrintUpload} />
                                                <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center group-hover:bg-zinc-200 transition-colors">
                                                    <ImagePlus className="w-4 h-4 text-zinc-400 group-hover:text-zinc-600" />
                                                </div>
                                                <span className="text-[10px] font-medium text-zinc-400 group-hover:text-zinc-600 text-center leading-tight px-1">Загрузить<br />принт</span>
                                            </label>
                                        )}
                                    </div>

                                    {/* Vertical Offset Slider (CM) */}
                                    <div className="h-32 w-4 flex items-center justify-center relative">
                                        <input
                                            type="range"
                                            min={MIN_OFFSET_CM}
                                            max={maxOffset}
                                            step="0.5"
                                            value={frontPrintY}
                                            onChange={(e) => setFrontPrintY(Math.min(parseFloat(e.target.value), maxOffset))}
                                            disabled={!frontPrint}

                                            className={`absolute w-32 h-1.5 bg-zinc-200 rounded-lg appearance-none shadow-inner rotate-90 origin-center [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-200 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 ${!frontPrint ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                        />

                                    </div>
                                </div>

                                {/* Right: Info & Controls */}
                                <div className="flex-1 flex flex-col gap-3 justify-center">
                                    {/* Info Grid (CM) */}
                                    <div className="bg-[#F5F5F7] rounded-xl p-2 grid grid-cols-3 gap-1 text-center items-center">


                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-[9px] font-bold text-zinc-400 uppercase">Ширина</span>
                                            <span className="text-[10px] font-medium text-zinc-600">{(currentPrintWidth).toFixed(0)} см</span>
                                        </div>
                                        <div className="flex flex-col items-center gap-1 border-l border-zinc-200/50">
                                            <span className="text-[9px] font-bold text-zinc-400 uppercase">Высота</span>
                                            <span className="text-[10px] font-medium text-zinc-600">{(currentPrintHeight).toFixed(0)} см</span>
                                        </div>
                                        <div className="flex flex-col items-center gap-1 border-l border-zinc-200/50">
                                            <span className="text-[9px] font-bold text-zinc-400 uppercase">Отступ</span>
                                            <span className="text-[10px] font-medium text-zinc-600">{frontPrintY.toFixed(1)} см</span>
                                        </div>
                                    </div>

                                    {/* Horizontal Size Slider */}
                                    <div className="space-y-1">
                                        <input
                                            type="range"
                                            min="0.2"
                                            max="1"
                                            step="0.05"
                                            value={frontPrintSize}
                                            onChange={handleSizeChange}
                                            disabled={!frontPrint}
                                            className={`w-full h-1.5 bg-zinc-200 rounded-lg appearance-none shadow-inner [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-200 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 ${!frontPrint ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                        />
                                    </div>
                                    <button
                                        onClick={() => frontPrint && downloadPrintImage(frontPrint, currentPrintWidth, currentPrintHeight)}
                                        disabled={!frontPrint}
                                        className={`w-full py-2 rounded-lg flex items-center justify-center transition-all ${frontPrint ? 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 shadow-sm' : 'bg-transparent border border-zinc-100 text-zinc-300'}`}
                                        title="Скачать принт"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>


                                </div>
                            </div>
                        </section>

                        <div className="h-px bg-zinc-100" />

                        {/* ZONE 3: BACK PRINT */}
                        <section className="space-y-4">




                            <div className="flex gap-6">
                                {/* Left Group: Slider + Card */}
                                <div className="flex gap-4 items-center">


                                    {/* Preview Card */}
                                    <div
                                        className={`shrink-0 w-24 h-32 relative group transition-all duration-300 ${dragOverZone === 'back' ? 'scale-105' : ''}`}
                                        onDragOver={(e) => handleDragOver(e, 'back')}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, 'back')}
                                    >
                                        {backPrint ? (
                                            <div
                                                className={`w-full h-full rounded-2xl border bg-white overflow-hidden relative cursor-grab active:cursor-grabbing transition-all duration-300
                                                    ${dragOverZone === 'back' ? 'border-zinc-900 ring-2 ring-zinc-900/10 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300 hover:shadow-lg hover:-translate-y-0.5'}
                                                `}
                                                draggable="true"
                                                onDragStart={(e) => handleDragStart(e, 'back')}
                                            >
                                                <img src={backPrint} alt="Back Print" className="w-full h-full object-contain p-2 pointer-events-none" />
                                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={removeBackPrint}
                                                        className="p-1.5 bg-white/80 backdrop-blur rounded-full text-zinc-400 hover:text-red-500 hover:bg-white shadow-sm transition-all"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>


                                            </div>



                                        ) : (
                                            <label
                                                className={`w-full h-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300 gap-2
                                                    ${dragOverZone === 'back' ? 'border-zinc-900 bg-zinc-50 scale-95 opacity-80' : 'border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50'}
                                                `}
                                            >

                                                <input type="file" className="hidden" accept="image/*" onChange={handleBackPrintUpload} />
                                                <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center group-hover:bg-zinc-200 transition-colors">
                                                    <ImagePlus className="w-4 h-4 text-zinc-400 group-hover:text-zinc-600" />
                                                </div>
                                                <span className="text-[10px] font-medium text-zinc-400 group-hover:text-zinc-600 text-center leading-tight px-1">Загрузить<br />принт</span>
                                            </label>
                                        )}
                                    </div>

                                    {/* Vertical Offset Slider (CM) */}
                                    <div className="h-32 w-4 flex items-center justify-center relative">
                                        <input
                                            type="range"
                                            min={MIN_BACK_OFFSET_CM}
                                            max={maxBackOffset}
                                            step="0.5"
                                            value={backPrintY}
                                            onChange={(e) => setBackPrintY(Math.min(parseFloat(e.target.value), maxBackOffset))}
                                            disabled={!backPrint}

                                            className={`absolute w-32 h-1.5 bg-zinc-200 rounded-lg appearance-none shadow-inner rotate-90 origin-center [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-200 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 ${!backPrint ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                        />

                                    </div>
                                </div>


                                {/* Right: Info & Controls */}
                                <div className="flex-1 flex flex-col gap-3 justify-center">
                                    {/* Info Grid (CM) */}
                                    <div className="bg-[#F5F5F7] rounded-xl p-2 grid grid-cols-3 gap-1 text-center items-center">


                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-[9px] font-bold text-zinc-400 uppercase">Ширина</span>
                                            <span className="text-[10px] font-medium text-zinc-600">{(currentBackPrintWidth).toFixed(0)} см</span>
                                        </div>
                                        <div className="flex flex-col items-center gap-1 border-l border-zinc-200/50">
                                            <span className="text-[9px] font-bold text-zinc-400 uppercase">Высота</span>
                                            <span className="text-[10px] font-medium text-zinc-600">{(currentBackPrintHeight).toFixed(0)} см</span>
                                        </div>
                                        <div className="flex flex-col items-center gap-1 border-l border-zinc-200/50">
                                            <span className="text-[9px] font-bold text-zinc-400 uppercase">Отступ</span>
                                            <span className="text-[10px] font-medium text-zinc-600">{backPrintY.toFixed(1)} см</span>
                                        </div>
                                    </div>

                                    {/* Horizontal Size Slider */}
                                    <div className="space-y-1">
                                        <input
                                            type="range"
                                            min="0.2"
                                            max="1"
                                            step="0.05"
                                            value={backPrintSize}
                                            onChange={handleBackSizeChange}
                                            disabled={!backPrint}
                                            className={`w-full h-1.5 bg-zinc-200 rounded-lg appearance-none shadow-inner [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-200 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 ${!backPrint ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                        />
                                    </div>
                                    <button
                                        onClick={() => backPrint && downloadPrintImage(backPrint, currentBackPrintWidth, currentBackPrintHeight)}
                                        disabled={!backPrint}
                                        className={`w-full py-2 rounded-lg flex items-center justify-center transition-all ${backPrint ? 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 shadow-sm' : 'bg-transparent border border-zinc-100 text-zinc-300'}`}
                                        title="Скачать принт"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>


                                </div>
                            </div>
                        </section>
                    </div >

                    {/* ZONE 4: EXPORT (Footer) */}
                    {/* ZONE 4: EXPORT (Footer) */}
                    <div className="p-6 pt-6 border-t border-zinc-200/50 bg-white/30 backdrop-blur-md mt-auto space-y-3">
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Экспорт</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => handleExportMockup('copy')}
                                className="h-12 bg-white border border-zinc-200 hover:border-zinc-300 text-zinc-700 rounded-xl font-bold text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Copy className="w-4 h-4" />
                                Копировать
                            </button>
                            <button
                                onClick={() => handleExportMockup('download')}
                                className="h-12 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-bold text-sm shadow-lg shadow-zinc-900/20 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <Download className="w-4 h-4" />
                                Скачать
                            </button>
                        </div>
                    </div>

                </aside>
            </div >
        </div >,
        document.body
    );
};
