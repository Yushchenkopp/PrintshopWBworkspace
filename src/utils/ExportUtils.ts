import * as fabric from 'fabric';

// Helper to set DPI in PNG Blob
const setDpi = (blob: Blob, dpi: number): Promise<Blob> => {
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

        // 8. Convert to Blob
        let blob = await new Promise<Blob | null>(resolve => trimmedCanvas.toBlob(resolve, 'image/png'));

        if (!blob) throw new Error("Blob creation failed");

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
};