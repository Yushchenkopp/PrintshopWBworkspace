import UPNG from 'upng-js';
import * as fabric from 'fabric';

// Helper to set DPI in PNG Blob
export const setDpi = (blob: Blob, dpi: number): Promise<Blob> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(blob);
        reader.onload = () => {
            const buffer = reader.result as ArrayBuffer;
            // const view = new DataView(buffer);

            // PNG Signature: 89 50 4E 47 0D 0A 1A 0A (8 bytes)
            // IHDR Chunk: Length (4), Type (4), Data (13), CRC (4) = 25 bytes
            // We want to insert pHYs chunk after IHDR

            // Calculate Pixels Per Meter
            // 1 inch = 0.0254 meters
            // ppm = dpi / 0.0254
            const ppm = Math.round(dpi / 0.0254);

            // pHYs Chunk Data:
            // 4 bytes: pixels per unit, X axis
            // 4 bytes: pixels per unit, Y axis
            // 1 byte: unit specifier (1 = meter)

            const physChunkLength = 9;
            const physChunkType = [112, 72, 89, 115]; // "pHYs" in ASCII
            const physData = new Uint8Array(physChunkLength);
            const dataView = new DataView(physData.buffer);

            dataView.setUint32(0, ppm, false); // X axis
            dataView.setUint32(4, ppm, false); // Y axis
            dataView.setUint8(8, 1); // Unit: meter

            // Calculate CRC for pHYs
            // CRC includes Type + Data
            const crcBuffer = new Uint8Array(4 + physChunkLength);
            crcBuffer.set(physChunkType, 0);
            crcBuffer.set(physData, 4);
            const crc = crc32(crcBuffer);

            // Construct new blob
            // Header (8) + IHDR (25) = 33 bytes
            // Insert pHYs (4 len + 4 type + 9 data + 4 crc = 21 bytes)

            const header = new Uint8Array(buffer.slice(0, 33));
            const rest = new Uint8Array(buffer.slice(33));

            const physChunk = new Uint8Array(21);
            const physView = new DataView(physChunk.buffer);

            physView.setUint32(0, physChunkLength, false); // Length
            physChunk.set(physChunkType, 4); // Type
            physChunk.set(physData, 8); // Data
            physView.setUint32(17, crc, false); // CRC

            const newBlob = new Blob([header, physChunk, rest], { type: 'image/png' });
            resolve(newBlob);
        };
    });
};

// CRC32 Implementation
const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
        if (c & 1) {
            c = 0xedb88320 ^ (c >>> 1);
        } else {
            c = c >>> 1;
        }
    }
    crcTable[n] = c;
}

const crc32 = (buf: Uint8Array): number => {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
};


// Helper to load DataURL to Canvas
const loadDataURLToCanvas = (dataURL: string): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.width;
            c.height = img.height;
            c.getContext('2d')?.drawImage(img, 0, 0);
            resolve(c);
        };
        img.onerror = reject;
        img.src = dataURL;
    });
};

// Helper to trim transparent pixels
const trimTransparency = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const w = canvas.width;
    const h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const alpha = data[(y * w + x) * 4 + 3];
            if (alpha > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                found = true;
            }
        }
    }

    if (!found) return canvas; // Empty

    const trimWidth = maxX - minX + 1;
    const trimHeight = maxY - minY + 1;

    // Safety: don't crop if already tight or error
    if (trimWidth <= 0 || trimHeight <= 0) return canvas;

    const trimmed = document.createElement('canvas');
    trimmed.width = trimWidth;
    trimmed.height = trimHeight;
    const tCtx = trimmed.getContext('2d');
    tCtx?.drawImage(canvas, minX, minY, trimWidth, trimHeight, 0, 0, trimWidth, trimHeight);

    return trimmed;
};

export const exportHighRes = async (canvas: fabric.Canvas) => {
    if (!canvas) return;

    try {
        // 1. Save current state
        const originalViewport = canvas.viewportTransform;

        // 2. Reset Viewport to Identity
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        canvas.discardActiveObject();

        // 3. Calculate Bounding Box (Loose)
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        const objects = canvas.getObjects();

        if (objects.length === 0) {
            alert("Холст пуст.");
            canvas.setViewportTransform(originalViewport || [1, 0, 0, 1, 0, 0]);
            canvas.requestRenderAll();
            return;
        }

        objects.forEach(obj => {
            // Check if object is visible
            if (!obj.visible) return;

            obj.setCoords();

            // CRITICAL FIX: Use clipPath bounds if available!
            // Images are larger than their cells (object-fit: cover), so their own bounding box
            // extends beyond the visible area. We must use the clipPath (the cell) to determine bounds.
            let bound;
            if (obj.clipPath) {
                // Ensure clipPath coords are updated
                obj.clipPath.setCoords();
                bound = obj.clipPath.getBoundingRect();
            } else {
                bound = obj.getBoundingRect();
            }

            if (bound.left < minX) minX = bound.left;
            if (bound.top < minY) minY = bound.top;
            if (bound.left + bound.width > maxX) maxX = bound.left + bound.width;
            if (bound.top + bound.height > maxY) maxY = bound.top + bound.height;
        });

        // 4. Add Zero Padding (Logic moved to trim)
        const padding = 0;
        minX = Math.floor(minX - padding);
        minY = Math.floor(minY - padding);
        maxX = Math.ceil(maxX + padding);
        maxY = Math.ceil(maxY + padding);

        const cropWidth = maxX - minX;
        const cropHeight = maxY - minY;

        // 5. Calculate Target Dimensions (31cm @ 200 DPI)
        const targetWidthPx = Math.round((31 / 2.54) * 200);
        const multiplier = targetWidthPx / cropWidth;

        // 6. Export to Base64 (Loose Crop)
        const dataURL = canvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: multiplier,
            left: minX,
            top: minY,
            width: cropWidth,
            height: cropHeight
        });

        // Restore Viewport IMMEDIATELY
        if (originalViewport) {
            canvas.setViewportTransform(originalViewport);
        }

        // 7. Process Pixel-Perfect Trim
        const fullCanvas = await loadDataURLToCanvas(dataURL);
        const trimmedCanvas = trimTransparency(fullCanvas);

        // 8. Convert to Blob (Optimized with UPNG)
        const ctx = trimmedCanvas.getContext('2d');
        if (!ctx) throw new Error("Could not get context for trimmed canvas");

        const imgData = ctx.getImageData(0, 0, trimmedCanvas.width, trimmedCanvas.height);
        // Optimize: 256 colors (lossy but high quality)
        const upngBuffer = UPNG.encode([imgData.data.buffer], trimmedCanvas.width, trimmedCanvas.height, 256);

        let blob: Blob | null = new Blob([upngBuffer], { type: 'image/png' });

        // 9. Inject DPI Metadata
        blob = await setDpi(blob, 200);

        // 10. Download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `layout-31cm-200dpi-${timestamp}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Export failed:", error);
        alert("Не удалось сохранить файл. Попробуйте еще раз.");
    }
};

export const exportMockup = async (_canvas: any) => {
    console.log("Mockup export disabled");
};

export const exportSvgElement = async (svgElement: SVGSVGElement, filename: string) => {
    try {
        // 1. Serialize SVG to String
        const serializer = new XMLSerializer();
        let svgString = serializer.serializeToString(svgElement);

        // 2. Encode to Base64
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        // 3. Load into Image
        const img = new Image();
        const svgLoaded = new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
        });
        img.src = url;
        await svgLoaded;

        // 4. Draw to Canvas
        // Use SVG's viewBox or BBox size
        // The viewBox is 0 0 8085.14 2098.41
        // We want High Res.
        // Let's target the same 31cm @ 200DPI logic (approx 2441px width)
        // Or better: Use native resolution of SVG (8085px width) for max quality.
        // 8085px is huge (~68cm @ 300dpi). It's fine.

        const canvas = document.createElement('canvas');
        canvas.width = 8085;
        canvas.height = 2098;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // 5. Trim Transparency (Optional, but good)
        const trimmedCanvas = trimTransparency(canvas);

        // 6. Convert to Blob & Save
        let blob = await new Promise<Blob | null>(resolve => trimmedCanvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error("Blob creation failed");

        blob = await setDpi(blob, 200);

        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${filename}-${new Date().getTime()}.png`;
        link.href = downloadUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("SVG Export failed:", error);
        alert("Ошибка при сохранении SVG. Проверьте консоль.");
    }
}


export const downloadPrintImage = async (imageUrl: string, widthCm: number, heightCm: number) => {
    try {
        // 1. Calculate Target Pixels at 200 DPI
        // 1 inch = 2.54 cm
        const dpi = 200;
        const targetWidthPx = Math.round((widthCm / 2.54) * dpi);
        const targetHeightPx = Math.round((heightCm / 2.54) * dpi);

        // 2. Load Image
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = imageUrl;
        });

        // 3. Draw to Resized Canvas
        const canvas = document.createElement('canvas');
        canvas.width = targetWidthPx;
        canvas.height = targetHeightPx;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas context failed");

        // High quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidthPx, targetHeightPx);

        // 4. Encode to PNG with UPNG (for smaller size if needed, or just standard toBlob)
        // Using UPNG for consistency and compression control (optional here, but good for file size)
        const imgData = ctx.getImageData(0, 0, targetWidthPx, targetHeightPx);
        const upngBuffer = UPNG.encode([imgData.data.buffer], targetWidthPx, targetHeightPx, 256);
        let blob = new Blob([upngBuffer], { type: 'image/png' });

        // 5. Inject DPI
        blob = await setDpi(blob, dpi);

        // 6. Download
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `print_${widthCm.toFixed(0)}x${heightCm.toFixed(0)}cm_${timestamp}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("Print download field:", error);
        alert("Ошибка при скачивании файла.");
    }
};

interface PrintLayer {
    url: string;
    xPercent: number; // 0-100 relative to full uncropped base
    yPercent: number; // 0-100 relative to full uncropped base
    widthPercent: number; // 0-100 relative to full uncropped base
    heightPercent?: number; // Optional, can act as max-height or we rely on ratio
}

interface ExportConfig {
    top: number; // %
    left: number; // %
    width: number; // %
    height: number; // %
}

export const generateCompositeMockup = async (
    baseImageUrl: string,
    prints: PrintLayer[],
    crop: ExportConfig
): Promise<Blob | null> => {
    try {
        // 1. Load Base Image
        const baseImg = new Image();
        baseImg.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
            baseImg.onload = () => resolve();
            baseImg.onerror = (e) => reject(new Error(`Failed to load base image: ${String(e)}`));
            baseImg.src = baseImageUrl;
        });

        // 2. Determine Dimensions
        const fullW = baseImg.naturalWidth;
        const fullH = baseImg.naturalHeight;

        // 3. Calculate Crop (Pixels)
        const cropX = Math.round((crop.left / 100) * fullW);
        const cropY = Math.round((crop.top / 100) * fullH);
        const cropW = Math.round((crop.width / 100) * fullW);
        const cropH = Math.round((crop.height / 100) * fullH);

        // 4. Create Canvas sized to the CROP
        const canvas = document.createElement('canvas');
        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas context failed");

        // High Quality Settings
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 5. Draw Base Image (Shifted by -cropX, -cropY)
        // We draw the relevant slice of the source image onto the canvas 0,0
        ctx.drawImage(
            baseImg,
            cropX, cropY, cropW, cropH, // Source Crop
            0, 0, cropW, cropH          // Dest Rect
        );

        // 6. Draw Prints
        // Layering order: Front -> Back (controlled by array order)
        for (const print of prints) {
            const printImg = new Image();
            printImg.crossOrigin = "anonymous";
            await new Promise<void>((resolve, reject) => {
                printImg.onload = () => resolve();
                printImg.onerror = () => {
                    console.warn("Failed to load print for export", print.url);
                    resolve(); // Skip but continue
                };
                printImg.src = print.url;
            });

            // Calculate Print Position on FULL Base
            const pX = (print.xPercent / 100) * fullW;
            const pY = (print.yPercent / 100) * fullH;
            const pW = (print.widthPercent / 100) * fullW;

            // Calculate Height maintaining aspect ratio if not explicit
            const ratio = printImg.naturalHeight / printImg.naturalWidth;
            const pH = print.heightPercent
                ? (print.heightPercent / 100) * fullH
                : pW * ratio;

            // Map to Cropped Canvas Coordinates
            // DestX = pX - cropX
            const destX = pX - cropX;
            const destY = pY - cropY;

            // Verify Visibility (Optional optimization, drawImage handles it)
            // Apply Blend Modes if needed (Multiply for realism)
            // We can check brightness of underlying pixels but that is complex.
            // Simple Multiply is standard for mockups on white.
            // But we don't pass 'shirtColor' here easily. 
            // We'll stick to 'Normal' for universal support or add a param later.
            // User requested "Premium", maybe multiply? 
            // Let's assume Normal for safety for now unless print is black on black.
            // Actually, MockupEnvironment uses multiply for white shirts.
            // Let's rely on standard copy for now.

            ctx.drawImage(printImg, destX, destY, pW, pH);
        }

        // 7. Export to Blob
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95)); // JPEG 95% for mockup
        return blob;

    } catch (e) {
        console.error("Composite Mockup Gen Failed:", e);
        return null;
    }
};