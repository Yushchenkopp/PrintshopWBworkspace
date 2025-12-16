import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, ArrowLeft, ImagePlus, Trash2, Copy, Loader2, Maximize, ArrowUpDown, ArrowLeftRight } from 'lucide-react';
import { downloadPrintImage } from '../utils/ExportUtils';
import { toCanvas } from 'html-to-image';
import UPNG from 'upng-js';


interface MockupEnvironmentProps {
    onClose: () => void;
    isOpen: boolean;
    onPrintCountChange: (count: number) => void;
    initialFrontPrint?: string | null;
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


export const MockupEnvironment: React.FC<MockupEnvironmentProps> = ({ onClose, isOpen, onPrintCountChange, initialFrontPrint }) => {
    const [shirtColor, setShirtColor] = useState<'white' | 'black'>('white');
    const [selectedSize, setSelectedSize] = useState('M');
    // Coordinates fixed by user request
    const [pos, setPos] = useState({ x: 40.18, y: 84 });

    // Front Print State
    const [frontPrint, setFrontPrint] = useState<string | null>(null);
    const [frontPrintSize, setFrontPrintSize] = useState(1);
    const [frontPrintY, setFrontPrintY] = useState(2); // Starts at 2cm
    const [frontPrintX, setFrontPrintX] = useState(0); // Starts at center (0cm)
    const [imgAspectRatio, setImgAspectRatio] = useState(30 / 42); // Default to full fit

    // Back Print State
    const [backPrint, setBackPrint] = useState<string | null>(null);
    const [backPrintSize, setBackPrintSize] = useState(1);
    const [backPrintY, setBackPrintY] = useState(9); // Starts at 9cm
    const [backPrintX, setBackPrintX] = useState(0); // Starts at center (0cm)
    const [backImgAspectRatio, setBackImgAspectRatio] = useState(30 / 42);
    // Aspect Ratio of the Mockup Image itself (Container)
    const [mockupAspectRatio, setMockupAspectRatio] = useState<number | null>(null);

    // Report Count
    React.useEffect(() => {
        const count = (frontPrint ? 1 : 0) + (backPrint ? 1 : 0);
        onPrintCountChange(count);
    }, [frontPrint, backPrint, onPrintCountChange]);

    // Sync initialFrontPrint to state when it changes
    React.useEffect(() => {
        if (initialFrontPrint) {
            setFrontPrint(initialFrontPrint);
            // Reset position/scale if needed, or keep previous settings?
            // Usually if a new print comes in, we might want to reset or keep.
            // Let's reset X offset to 0 (center) to be safe, but keep size/Y if reasonable?
            // User requested "load it into the preview card... as if user did it".
            // So treating it like a fresh upload is safest.
            setFrontPrintX(0);
        }
    }, [initialFrontPrint]);


    // Print Area Calibration State
    const [isDebug, setIsDebug] = useState(false);
    const [printArea, setPrintArea] = useState({ top: 32, left: 19.3, width: 13, height: 38 });
    const [backPrintArea, setBackPrintArea] = useState({ top: 31, left: 48.5, width: 14, height: 39 }); // Default right side position

    // Export Calibration State
    const [isExportCalibration, setIsExportCalibration] = useState(false);
    const [exportCrop, setExportCrop] = useState({ top: 11, left: 7, width: 67, height: 78 });

    // Drag State

    const [dragOverZone, setDragOverZone] = useState<'front' | 'back' | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    // Performance Optimization: Removed isAnimating state as CSS filters are now lightweight
    const previewRef = React.useRef<HTMLDivElement>(null);





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
        // const newPrintWidth = newPrintHeight * imgAspectRatio; // Not used for Y clamping

        const newMaxOffset = MIN_OFFSET_CM + (ZONE_HEIGHT_CM - newPrintHeight) - 0.1;

        if (frontPrintY > newMaxOffset) {
            setFrontPrintY(Math.min(frontPrintY, newMaxOffset));
        }
        // No need to clamp X state, as it is now percentage (-100 to 100) relative to available space.
    };

    const handleFrontXChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFrontPrintX(parseFloat(e.target.value));
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
        // const newPrintWidth = newPrintHeight * backImgAspectRatio; // Not used for Y clamping

        const newMaxOffset = MIN_BACK_OFFSET_CM + (ZONE_HEIGHT_CM - newPrintHeight) - 0.1;

        if (backPrintY > newMaxOffset) {
            setBackPrintY(newMaxOffset);
        }
        // X state is percentage (-100 to 100), self-adjusts.
    };

    const handleBackXChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setBackPrintX(parseFloat(e.target.value));
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

    const handleExport = async (action: 'copy' | 'download') => {
        if (!previewRef.current) {
            console.error('Preview ref is null');
            return;
        }
        setIsExporting(true);
        console.log('Starting export...', action);

        try {
            // Temporarily hide debug overlays for capture if they are active
            // Simplify: just capture for now to test stability
            // const wasDebug = isDebug;
            // const wasExportCalib = isExportCalibration;
            // if (wasDebug) setIsDebug(false);
            // if (wasExportCalib) setIsExportCalibration(false);

            // Wait for state update/render
            await new Promise(resolve => setTimeout(resolve, 100));

            console.log('Capturing canvas with html-to-image...');
            const canvas = await toCanvas(previewRef.current, {
                cacheBust: false, // Potentially causing 404s on static assets
                pixelRatio: 2, // High DPI
                backgroundColor: '#e4e4e7',
                // Explicitly allow external images if needed
                includeQueryParams: false,
                filter: (node) => {
                    // Exclude the back button and other UI controls from export
                    if (node instanceof HTMLElement) {
                        if (node.tagName === 'BUTTON' && node.querySelector('svg.lucide-arrow-left')) {
                            return false;
                        }
                        // Also exclude the export crop overlay if it happens to be visible
                        if (node.textContent?.includes('Export Zone')) {
                            return false;
                        }
                    }
                    return true;
                }
            });
            console.log('Canvas captured.', canvas.width, canvas.height);

            // Restore debug state
            // if (wasDebug) setIsDebug(true);
            // if (wasExportCalib) setIsExportCalibration(true);

            // Calculate Crop (Round to integers to avoid sub-pixel issues with UPNG)
            const cropX = Math.round((canvas.width * exportCrop.left) / 100);
            const cropY = Math.round((canvas.height * exportCrop.top) / 100);
            const cropWidth = Math.round((canvas.width * exportCrop.width) / 100);
            const cropHeight = Math.round((canvas.height * exportCrop.height) / 100);

            console.log('Cropping (Rounded):', { cropX, cropY, cropWidth, cropHeight });

            // Load Footer Image
            const footerImg = new Image();
            footerImg.crossOrigin = "anonymous";
            footerImg.src = '/mockup/add-mockup.webp';
            await new Promise((resolve, reject) => {
                footerImg.onload = resolve;
                footerImg.onerror = () => {
                    console.warn('Footer image failed to load, proceeding without it.');
                    resolve(null);
                };
            });

            // Calculate Footer Dimensions
            let footerHeight = 0;
            if (footerImg.naturalWidth > 0) {
                footerHeight = Math.round((footerImg.naturalHeight / footerImg.naturalWidth) * cropWidth);
            }

            // Create Final Canvas
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = cropWidth;
            finalCanvas.height = cropHeight + footerHeight; // Add height for footer
            const ctx = finalCanvas.getContext('2d');

            if (ctx) {
                // Draw Standard Mockup
                ctx.drawImage(
                    canvas,
                    cropX, cropY, cropWidth, cropHeight,
                    0, 0, cropWidth, cropHeight
                );

                // Draw Footer if loaded
                if (footerHeight > 0) {
                    ctx.drawImage(footerImg, 0, cropHeight, cropWidth, footerHeight);
                }

                let blob: Blob | null = null;

                try {
                    // Optimization: Use UPNG for smaller file size
                    const imgData = ctx.getImageData(0, 0, cropWidth, cropHeight + footerHeight);
                    // 256 colors for significant reduction
                    const upngBuffer = UPNG.encode([imgData.data.buffer], cropWidth, cropHeight + footerHeight, 256);
                    blob = new Blob([upngBuffer], { type: 'image/png' });
                    console.log('UPNG Compression successful');
                } catch (upngError) {
                    console.error('UPNG Compression failed, falling back to standard PNG:', upngError);
                    // Fallback to standard blob
                    blob = await new Promise(resolve => finalCanvas.toBlob(resolve, 'image/png'));
                }

                if (blob) {
                    if (action === 'download') {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.download = `mockup-export-${selectedSize}-${Date.now()}.png`;
                        link.href = url;
                        link.click();
                        URL.revokeObjectURL(url);
                        console.log('Download triggered');
                    } else {
                        const item = new ClipboardItem({ 'image/png': blob });
                        navigator.clipboard.write([item]);
                        console.log('Clipboard write success');
                        alert('Copied to clipboard!');
                    }
                }
            }

        } catch (error: any) {
            console.error('Export failed (Attempt 1):', error);

            // Log specific error details if available
            if (error.target) {
                console.error('Error target:', error.target);
                if (error.target.src) console.error('Error src:', error.target.src);
            }

            try {
                console.log('Retrying export without filters (Fallback)...');
                const canvas = await toCanvas(previewRef.current, {
                    cacheBust: false,
                    pixelRatio: 2,
                    backgroundColor: '#e4e4e7',
                    skipFonts: true, // Skip fonts in fallback
                    filter: (node) => {
                        // Same filters
                        if (node instanceof HTMLElement) {
                            if (node.tagName === 'BUTTON' && node.querySelector('svg.lucide-arrow-left')) return false;
                            if (node.textContent?.includes('Export Zone')) return false;
                        }
                        return true;
                    },
                    style: {
                        // Force remove filters in fallback
                        filter: 'none'
                    }
                });

                // ... Process canvas (Reuse logic)
                const cropX = Math.round((canvas.width * exportCrop.left) / 100);
                const cropY = Math.round((canvas.height * exportCrop.top) / 100);
                const cropWidth = Math.round((canvas.width * exportCrop.width) / 100);
                const cropHeight = Math.round((canvas.height * exportCrop.height) / 100);

                // Load Footer Image (Duplicate logic for fallback)
                const footerImg = new Image();
                footerImg.crossOrigin = "anonymous";
                footerImg.src = '/mockup/add-mockup.webp';
                await new Promise((resolve) => {
                    footerImg.onload = resolve;
                    footerImg.onerror = () => {
                        console.warn('Fallback: Footer image failed to load');
                        resolve(null);
                    };
                });

                let footerHeight = 0;
                if (footerImg.naturalWidth > 0) {
                    footerHeight = Math.round((footerImg.naturalHeight / footerImg.naturalWidth) * cropWidth);
                }

                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = cropWidth;
                finalCanvas.height = cropHeight + footerHeight;
                const ctx = finalCanvas.getContext('2d');

                if (ctx) {
                    ctx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

                    if (footerHeight > 0) {
                        ctx.drawImage(footerImg, 0, cropHeight, cropWidth, footerHeight);
                    }

                    let blob: Blob | null = null;

                    try {
                        const imgData = ctx.getImageData(0, 0, cropWidth, cropHeight + footerHeight);
                        const upngBuffer = UPNG.encode([imgData.data.buffer], cropWidth, cropHeight + footerHeight, 256);
                        blob = new Blob([upngBuffer], { type: 'image/png' });
                    } catch (e) {
                        console.error('Fallback UPNG failed:', e);
                        blob = await new Promise(resolve => finalCanvas.toBlob(resolve, 'image/png'));
                    }

                    if (blob) {
                        if (action === 'download') {
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.download = `mockup-export-${selectedSize}-${Date.now()}.png`;
                            link.href = url;
                            link.click();
                            URL.revokeObjectURL(url);
                            console.log('Fallback download successful');
                        } else {
                            const item = new ClipboardItem({ 'image/png': blob });
                            navigator.clipboard.write([item]);
                            alert('Copied to clipboard (Fallback mode: Filters disabled)');
                        }
                    }
                }

            } catch (retryError) {
                console.error('Fallback export failed:', retryError);
                alert(`Export failed completely. Check console for 'object Event' details. Try checking network tab for 404s on images/fonts.`);
            }

        } finally {
            setIsExporting(false);
        }
    };



    return createPortal(
        <AnimatePresence mode="wait">
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center">
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/60" // Removed backdrop-blur-sm for performance
                        onClick={onClose}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    />

                    {/* Modal Window */}
                    <motion.div
                        className="relative w-[95vw] h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200 transform-gpu will-change-transform [backface-visibility:hidden]"
                        initial={{
                            opacity: 0,
                            scale: 0.96, // Less dramatic scale
                            y: 20, // Less vertical movement
                        }}
                        // onAnimationComplete removed as we no longer need isAnimating optimization for CSS filters
                        animate={{
                            opacity: 1,
                            scale: 1,
                            y: 0,
                            x: 0,
                            transition: {
                                duration: 0.5,
                                ease: [0.19, 1, 0.22, 1] // Apple-style Expo Out (Premium Snap)
                            }
                        }}
                        exit={{
                            opacity: 0,
                            scale: 0.96,
                            transition: { duration: 0.3, ease: [0.19, 1, 0.22, 1] }
                        }}
                    >
                        {/* Back Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-6 left-6 z-50 w-10 h-10 bg-white/80 backdrop-blur-md border border-zinc-200/50 rounded-full flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:scale-105 hover:bg-white shadow-sm transition-all"
                            title="Назад"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>

                        {/* --- FULL BACKGROUND: Image Preview --- */}
                        <div className="absolute inset-0 bg-[#e4e4e7] flex items-center justify-center overflow-hidden">
                            {/* Ambient Background Layer */}
                            <img
                                src="/mockup/back.webp"
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover opacity-100 z-0"
                            />


                            {/* ASPECT RATIO LOCKED CONTAINER */}
                            <div
                                ref={previewRef}
                                className="relative z-10 overflow-hidden flex items-center justify-center"
                                style={{
                                    height: 'auto',
                                    width: 'auto',
                                    maxHeight: '100%',
                                    maxWidth: '100%',
                                }}
                            >
                                {/* SIZER STUB: Maintains container geometry in normal flow */}
                                <img
                                    src={`/mockup/mockup-${shirtColor}-full.webp`}
                                    alt=""
                                    className="max-w-full max-h-full object-contain opacity-0 pointer-events-none select-none relative z-0"
                                    style={{
                                        maxHeight: '90vh', // Backup constraint matching modal
                                        maxWidth: '95vw'
                                    }}
                                    onLoad={(e) => {
                                        const img = e.currentTarget;
                                        setMockupAspectRatio(img.naturalWidth / img.naturalHeight);
                                    }}
                                />

                                {/* ANIMATED VISIBLE LAYER: Absolutely positioned on top */}
                                <div className="absolute inset-0 z-0">
                                    <AnimatePresence mode="popLayout">
                                        <motion.img
                                            key={shirtColor}
                                            src={`/mockup/mockup-${shirtColor}-full.webp`}
                                            alt="T-Shirt Mockup"
                                            crossOrigin="anonymous"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="w-full h-full object-contain pointer-events-none block will-change-transform"
                                        />
                                    </AnimatePresence>
                                </div>


                                {/* Print Layers - Absolute to the Wrapper, not the Screen */}

                                {/* Front Print Layer (Dynamic Area + Debug Overlay) */}
                                <div
                                    className="absolute flex items-start justify-center pointer-events-none z-10 overflow-hidden transition-all duration-200"
                                    style={{
                                        top: `${printArea.top}%`,
                                        left: `${printArea.left}%`,
                                        width: `${printArea.width}%`,
                                        height: `${printArea.height}%`,
                                        border: isDebug ? '1px dashed rgba(255, 0, 0, 0.5)' : 'none',
                                        backgroundColor: isDebug ? 'rgba(255, 0, 0, 0.05)' : 'transparent',
                                    }}
                                >
                                    <AnimatePresence>
                                        {frontPrint && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{
                                                    opacity: 1,
                                                    scale: frontPrintSize,
                                                    x: `${((frontPrintX / 100) * ((ZONE_WIDTH_CM - currentPrintWidth) / 2) / ZONE_WIDTH_CM) * 100}%`
                                                }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }} // Premium Snap
                                                className="absolute flex items-start justify-center w-full h-full origin-top"
                                                style={{
                                                    top: `${((frontPrintY - MIN_OFFSET_CM) / ZONE_HEIGHT_CM) * 100}%`,
                                                }}
                                            >
                                                {/* Print Image */}
                                                <img
                                                    src={frontPrint}
                                                    alt="Print"
                                                    className={`w-full h-full object-contain object-top transition-all duration-300 ${shirtColor === 'white' ? 'mix-blend-multiply opacity-90' : 'mix-blend-normal opacity-95'}`}
                                                    style={{
                                                        maxHeight: '100%',
                                                        maxWidth: '100%',
                                                        filter: 'contrast(1.05) brightness(0.98) sepia(0.05)', // Removed url(#fabric-texture)
                                                    }}
                                                    onLoad={(e) => {
                                                        const img = e.currentTarget;
                                                        setImgAspectRatio(img.naturalWidth / img.naturalHeight);
                                                        setFrontPrintX(0);
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
                                        height: `${backPrintArea.height}%`,
                                        border: isDebug ? '1px dashed rgba(255, 0, 0, 0.5)' : 'none',
                                        backgroundColor: isDebug ? 'rgba(255, 0, 0, 0.05)' : 'transparent',
                                    }}
                                >
                                    <AnimatePresence>
                                        {backPrint && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{
                                                    opacity: 1,
                                                    scale: backPrintSize,
                                                    x: `${((backPrintX / 100) * ((ZONE_WIDTH_CM - currentBackPrintWidth) / 2) / ZONE_WIDTH_CM) * 100}%`
                                                }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
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
                                                        filter: 'contrast(1.05) brightness(0.98) sepia(0.05)',
                                                    }}
                                                    onLoad={(e) => {
                                                        const img = e.currentTarget;
                                                        setBackImgAspectRatio(img.naturalWidth / img.naturalHeight);
                                                        setBackPrintX(0); // Reset X
                                                    }}
                                                />

                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

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
                                )}
                            </div>
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
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setIsDebug(!isDebug)}
                                            className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${isDebug ? 'bg-red-50 text-red-600 border-red-200' : 'bg-transparent text-zinc-300 border-zinc-100'}`}
                                        >
                                            Limits
                                        </button>
                                        <button
                                            onClick={() => setIsExportCalibration(!isExportCalibration)}
                                            className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${isExportCalibration ? 'bg-green-50 text-green-600 border-green-200' : 'bg-transparent text-zinc-300 border-zinc-100'}`}
                                        >
                                            Export
                                        </button>
                                    </div>
                                </div>


                                {/* Calibration Controls */}
                                {isDebug && (
                                    <div className="bg-red-50 p-3 rounded-xl border border-red-200 mt-2 space-y-3">
                                        <div className="text-[10px] font-bold text-red-600 uppercase mb-1">Front Zone</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['top', 'left', 'width', 'height'] as const).map((prop) => (
                                                <div key={`front-${prop}`} className="flex flex-col gap-1">
                                                    <label className="text-[9px] font-bold text-red-600 uppercase">{prop} (%)</label>
                                                    <input
                                                        type="number"
                                                        value={printArea[prop]}
                                                        onChange={(e) => setPrintArea(prev => ({ ...prev, [prop]: parseFloat(e.target.value) }))}
                                                        className="w-full rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-900 outline-none"
                                                        step="0.1"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="h-px bg-red-200/50" />
                                        <div className="text-[10px] font-bold text-red-600 uppercase mb-1">Back Zone</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['top', 'left', 'width', 'height'] as const).map((prop) => (
                                                <div key={`back-${prop}`} className="flex flex-col gap-1">
                                                    <label className="text-[9px] font-bold text-red-600 uppercase">{prop} (%)</label>
                                                    <input
                                                        type="number"
                                                        value={backPrintArea[prop]}
                                                        onChange={(e) => setBackPrintArea(prev => ({ ...prev, [prop]: parseFloat(e.target.value) }))}
                                                        className="w-full rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-900 outline-none"
                                                        step="0.1"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {isDebug && (
                                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 mt-2 space-y-3">
                                        <div className="text-[10px] font-bold text-blue-600 uppercase mb-1">Size Label</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['x', 'y'] as const).map((prop) => (
                                                <div key={`size-${prop}`} className="flex flex-col gap-1">
                                                    <label className="text-[9px] font-bold text-blue-600 uppercase">{prop} (%)</label>
                                                    <input
                                                        type="number"
                                                        value={pos[prop]}
                                                        onChange={(e) => setPos(prev => ({ ...prev, [prop]: parseFloat(e.target.value) }))}
                                                        className="w-full rounded border border-blue-200 bg-white px-2 py-1 text-xs text-blue-900 outline-none"
                                                        step="0.01"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

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
                                )}

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

                                    <div className="flex gap-4">
                                        {/* Left Group: Card + Download */}
                                        <div className="flex flex-col gap-3 items-center w-24 shrink-0">

                                            {/* Preview Card */}
                                            <div
                                                className={`w-24 h-32 relative group transition-all duration-300 ${dragOverZone === 'front' ? 'scale-105' : ''}`}
                                                onDragOver={(e) => handleDragOver(e, 'front')}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, 'front')}
                                            >
                                                {frontPrint ? (
                                                    <div
                                                        className={`w-full h-full rounded-2xl border overflow-hidden relative cursor-grab active:cursor-grabbing transition-all duration-300 bg-transparent
                                                    ${dragOverZone === 'front' ? 'border-zinc-900 ring-2 ring-zinc-900/10' : 'border-zinc-200 hover:border-zinc-300 hover:shadow-lg hover:-translate-y-0.5'}
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

                                            {/* Download Button (Below Card) */}
                                            <button
                                                onClick={() => frontPrint && downloadPrintImage(frontPrint, currentPrintWidth, currentPrintHeight)}
                                                disabled={!frontPrint}
                                                className={`w-full py-2 rounded-lg flex items-center justify-center transition-all ${frontPrint ? 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 shadow-sm' : 'bg-transparent border border-zinc-100 text-zinc-300'}`}
                                                title="Скачать принт"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>

                                        </div>

                                        {/* Right: Controls */}
                                        <div className="flex-1 flex flex-col gap-4 justify-between">
                                            {/* Info Grid (CM) */}
                                            <div className="bg-[#F5F5F7] rounded-xl p-2 grid grid-cols-3 gap-1 text-center items-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[9px] font-bold text-zinc-400 uppercase">Ширина</span>
                                                    <span className="text-[10px] font-medium text-zinc-600">{(currentPrintWidth).toFixed(1)} см</span>
                                                </div>
                                                <div className="flex flex-col items-center gap-1 border-l border-zinc-200/50">
                                                    <span className="text-[9px] font-bold text-zinc-400 uppercase">Высота</span>
                                                    <span className="text-[10px] font-medium text-zinc-600">{(currentPrintHeight).toFixed(1)} см</span>
                                                </div>
                                                <div className="flex flex-col items-center gap-1 border-l border-zinc-200/50">
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Отступ</span>
                                                    <span className="text-[10px] font-medium text-zinc-600">{frontPrintY.toFixed(1)} см</span>
                                                </div>
                                            </div>

                                            {/* Sliders Stack */}
                                            {/* Sliders Stack */}
                                            <div className="space-y-3">
                                                {/* Size */}
                                                <div className="flex items-center gap-3 h-6">
                                                    <Maximize className="w-3.5 h-3.5 text-zinc-400" />
                                                    <div className="flex-1 flex items-center">
                                                        <input
                                                            type="range"
                                                            min="0.2"
                                                            max="1"
                                                            step="0.01"
                                                            value={frontPrintSize}
                                                            onChange={handleSizeChange}
                                                            disabled={!frontPrint}
                                                            className={`w-full h-1.5 bg-zinc-200 rounded-lg appearance-none shadow-inner [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-200 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 ${!frontPrint ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Y Offset (Отступ) */}
                                                <div className="flex items-center gap-3 h-6">
                                                    <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
                                                    <div className="flex-1 flex items-center">
                                                        <input
                                                            type="range"
                                                            min={MIN_OFFSET_CM}
                                                            max={maxOffset}
                                                            step="0.5"
                                                            value={frontPrintY}
                                                            onChange={(e) => setFrontPrintY(Math.min(parseFloat(e.target.value), maxOffset))}
                                                            disabled={!frontPrint}
                                                            className={`w-full h-1.5 bg-zinc-200 rounded-lg appearance-none shadow-inner [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-200 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 ${!frontPrint ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                        />
                                                    </div>
                                                </div>

                                                {/* X Offset (Смещение) */}
                                                <div className="flex items-center gap-3 h-6">
                                                    <ArrowLeftRight className="w-3.5 h-3.5 text-zinc-400" />
                                                    <div className="flex-1 flex items-center">
                                                        <input
                                                            type="range"
                                                            min="-100"
                                                            max="100"
                                                            step="1"
                                                            value={frontPrintX}
                                                            onChange={handleFrontXChange}
                                                            disabled={!frontPrint}
                                                            className={`w-full h-1.5 bg-zinc-200 rounded-lg appearance-none shadow-inner [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-200 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 ${!frontPrint ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <div className="h-px bg-zinc-100" />

                                {/* ZONE 3: BACK PRINT */}
                                <section className="space-y-4">

                                    <div className="flex gap-4">
                                        {/* Left Group: Card + Download */}
                                        <div className="flex flex-col gap-3 items-center w-24 shrink-0">

                                            {/* Preview Card */}
                                            <div
                                                className={`w-24 h-32 relative group transition-all duration-300 ${dragOverZone === 'back' ? 'scale-105' : ''}`}
                                                onDragOver={(e) => handleDragOver(e, 'back')}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, 'back')}
                                            >
                                                {backPrint ? (
                                                    <div
                                                        className={`w-full h-full rounded-2xl border overflow-hidden relative cursor-grab active:cursor-grabbing transition-all duration-300 bg-transparent
                                                    ${dragOverZone === 'back' ? 'border-zinc-900 ring-2 ring-zinc-900/10' : 'border-zinc-200 hover:border-zinc-300 hover:shadow-lg hover:-translate-y-0.5'}
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

                                            {/* Download Button (Below Card) */}
                                            <button
                                                onClick={() => backPrint && downloadPrintImage(backPrint, currentBackPrintWidth, currentBackPrintHeight)}
                                                disabled={!backPrint}
                                                className={`w-full py-2 rounded-lg flex items-center justify-center transition-all ${backPrint ? 'bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 shadow-sm' : 'bg-transparent border border-zinc-100 text-zinc-300'}`}
                                                title="Скачать принт"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>

                                        </div>

                                        {/* Right: Controls */}
                                        <div className="flex-1 flex flex-col gap-4 justify-between">
                                            {/* Info Grid (CM) */}
                                            <div className="bg-[#F5F5F7] rounded-xl p-2 grid grid-cols-3 gap-1 text-center items-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-[9px] font-bold text-zinc-400 uppercase">Ширина</span>
                                                    <span className="text-[10px] font-medium text-zinc-600">{(currentBackPrintWidth).toFixed(1)} см</span>
                                                </div>
                                                <div className="flex flex-col items-center gap-1 border-l border-zinc-200/50">
                                                    <span className="text-[9px] font-bold text-zinc-400 uppercase">Высота</span>
                                                    <span className="text-[10px] font-medium text-zinc-600">{(currentBackPrintHeight).toFixed(1)} см</span>
                                                </div>
                                                <div className="flex flex-col items-center gap-1 border-l border-zinc-200/50">
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase">Отступ</span>
                                                    <span className="text-[10px] font-medium text-zinc-600">{backPrintY.toFixed(1)} см</span>
                                                </div>
                                            </div>

                                            {/* Sliders Stack */}
                                            {/* Sliders Stack */}
                                            <div className="space-y-3">
                                                {/* Size */}
                                                <div className="flex items-center gap-3 h-6">
                                                    <Maximize className="w-3.5 h-3.5 text-zinc-400" />
                                                    <div className="flex-1 flex items-center">
                                                        <input
                                                            type="range"
                                                            min="0.2"
                                                            max="1"
                                                            step="0.01"
                                                            value={backPrintSize}
                                                            onChange={handleBackSizeChange}
                                                            disabled={!backPrint}
                                                            className={`w-full h-1.5 bg-zinc-200 rounded-lg appearance-none shadow-inner [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-200 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 ${!backPrint ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Y Offset (Отступ) */}
                                                <div className="flex items-center gap-3 h-6">
                                                    <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
                                                    <div className="flex-1 flex items-center">
                                                        <input
                                                            type="range"
                                                            min={MIN_BACK_OFFSET_CM}
                                                            max={maxBackOffset}
                                                            step="0.5"
                                                            value={backPrintY}
                                                            onChange={(e) => setBackPrintY(Math.min(parseFloat(e.target.value), maxBackOffset))}
                                                            disabled={!backPrint}
                                                            className={`w-full h-1.5 bg-zinc-200 rounded-lg appearance-none shadow-inner [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-200 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 ${!backPrint ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                        />
                                                    </div>
                                                </div>

                                                {/* X Offset (Смещение) */}
                                                <div className="flex items-center gap-3 h-6">
                                                    <ArrowLeftRight className="w-3.5 h-3.5 text-zinc-400" />
                                                    <div className="flex-1 flex items-center">
                                                        <input
                                                            type="range"
                                                            min="-100"
                                                            max="100"
                                                            step="1"
                                                            value={backPrintX}
                                                            onChange={handleBackXChange}
                                                            disabled={!backPrint}
                                                            className={`w-full h-1.5 bg-zinc-200 rounded-lg appearance-none shadow-inner [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-zinc-200 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110 ${!backPrint ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            {/* ZONE 4: EXPORT (Footer) */}
                            {/* ZONE 4: EXPORT (Footer) */}
                            <div className="p-6 pt-6 border-t border-zinc-200/50 bg-white/30 backdrop-blur-md mt-auto space-y-3">

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => handleExport('copy')}
                                        disabled={isExporting}
                                        className="h-12 bg-white border border-zinc-200 hover:border-zinc-300 text-zinc-700 rounded-xl font-bold text-sm shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                                    >
                                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                                        {isExporting ? '...' : 'Копировать'}
                                    </button>
                                    <button
                                        onClick={() => handleExport('download')}
                                        disabled={isExporting}
                                        className="h-12 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-bold text-sm shadow-lg shadow-zinc-900/20 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                                    >
                                        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                        {isExporting ? '...' : 'Скачать'}
                                    </button>
                                </div>
                            </div>

                        </aside>
                    </motion.div >
                </div >
            )}
        </AnimatePresence >,
        document.body
    );
};
