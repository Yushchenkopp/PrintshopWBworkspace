import * as fabric from 'fabric';

// --- НАСТРОЙКИ ГЕОМЕТРИИ (Синхронизировано с CanvasEditor: 2400px) ---
export const SCALE_FACTOR = 3; // 3x Resolution for sharpness
export const FULL_WIDTH = 800 * SCALE_FACTOR;
export const PADDING_SIDE = 40 * SCALE_FACTOR;
export const CONTENT_WIDTH = FULL_WIDTH - (PADDING_SIDE * 2);

export type TemplateType = 'collage' | 'polaroid' | 'papa' | 'baby' | 'jersey' | 'constructor';

// --- ЗАГРУЗЧИК (Promise<any>) ---
const loadImage = async (url: string): Promise<any> => {
    try {
        const img = await fabric.FabricImage.fromURL(url, {
            crossOrigin: 'anonymous'
        });
        return img;
    } catch (e) {
        console.warn('Failed to load image:', url, e);
        return null;
    }
};

// --- Helper для текста ---
const createText = (text: string, fontSize: number, fontWeight: string = 'bold') => {
    return new fabric.IText(text, {
        fontFamily: 'Inter, Arial, sans-serif',
        fontWeight: fontWeight,
        fontSize: fontSize,
        fill: '#FFFFFF',
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false
    });
};

// --- Helper для штрих-кода ---
const createBarcode = (width: number, height: number, color: string = '#000000') => {
    const rects = [];
    const numLines = 40;
    let currentX = 0;

    const avgSlotWidth = width / numLines;

    // Constraints (relative to average slot width)
    // Min: 0.2, Max: 0.7
    const minLineWidth = avgSlotWidth * 0.2;
    const maxLineWidth = avgSlotWidth * 0.7;

    // Gaps: ~20% to ~60%
    const minGap = avgSlotWidth * 0.2;
    const maxGap = avgSlotWidth * 0.6;

    // Generate random lines with constraints
    for (let i = 0; i < numLines; i++) {
        const lineWidth = minLineWidth + Math.random() * (maxLineWidth - minLineWidth);
        const gap = minGap + Math.random() * (maxGap - minGap);

        rects.push(new fabric.Rect({
            left: currentX,
            top: 0,
            width: lineWidth,
            height: height,
            fill: color
        }));

        currentX += lineWidth + gap;
    }

    // Add text numbers below? No, just lines for now as per request.

    const group = new fabric.Group(rects, {
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
        name: 'footer-barcode' // Tag for updates
    } as any);

    // Scale group to exact requested width
    const scaleX = width / group.width!;
    group.set({ scaleX: scaleX });

    return group;
};

// Функция теперь возвращает Promise<number> (Высоту макета)
// Функция теперь возвращает Promise<number> (Высоту макета)
// Функция теперь возвращает Promise<number> (Высоту макета)
export const generateCollageTemplate = async (
    canvas: any,
    images: any[],
    aspectRatio: number = 1,
    headerTextValue: string = 'HEADER',
    footerTextValue: string = 'VALERIA',
    footerDateValue: string = '05.09.2025',
    isBW: boolean = false,
    isSince: boolean = true,
    textColor: string = '#000000',
    brightness: number = 0,
    headerLines: number = 2,
    signatureTextValue: string = 'WANNA BE YOURS', // New
    isSignatureEnabled: boolean = false, // New
    isBorderEnabled: boolean = false, // New Border logic
    signatureScale: number = 1, // New Scale,
    manualPositions: { left: number, top: number }[] = [] // New: Preserve Dragged Positions
): Promise<number> => {
    if (!canvas) return 800;

    const count = images.length;

    // 1. PREPARE LAYOUT DATA (Synchronous)
    let colLayout: number[] = [];

    if (count === 0) {
        // EMPTY STATE: No columns, just prepare for Header/Footer rendering
        colLayout = [];
    } else {
        switch (count) {
            case 1: colLayout = [1]; break;
            case 2: colLayout = [1, 1]; break;
            case 3: colLayout = [1, 1, 1]; break;
            case 4: colLayout = [2, 2]; break;
            case 5: colLayout = [2, 1, 2]; break;
            case 6: colLayout = [2, 2, 2]; break;
            case 7: colLayout = [2, 3, 2]; break;
            case 8: colLayout = [3, 2, 3]; break;
            case 9: colLayout = [3, 3, 3]; break;
            default: {
                colLayout = [Math.ceil(count / 3), Math.round(count / 3), Math.floor(count / 3)];
                let sum = colLayout.reduce((a, b) => a + b, 0);
                while (sum < count) { colLayout[0]++; sum++; }
                while (sum > count) { colLayout[0]--; sum--; }
                break;
            }
        }
    }

    // 2. PRE-LOAD ALL IMAGES (Asynchronous)
    // We load them into fabric objects but don't add to canvas yet.
    const loadedImagesPromises = images.map(async (imgData) => {
        const imgUrl = (typeof imgData === 'object' && imgData.url) ? imgData.url : imgData;
        if (!imgUrl) return null;
        return await loadImage(imgUrl);
    });

    const loadedImages = await Promise.all(loadedImagesPromises);

    // 3. CRITICAL SECTION: CLEAR AND RENDER (Synchronous as possible)
    // Now that we have all heavy assets, we clear and rebuild instantly.
    canvas.clear();
    canvas.backgroundColor = 'transparent';

    // --- HEADER ---
    const headerTop = 60 * SCALE_FACTOR;
    const headerGap = -15 * SCALE_FACTOR;
    const headerStyle = {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontWeight: '900',
        fill: textColor,
        originX: 'center' as const,
        originY: 'top' as const,
        selectable: false,
        evented: false,
        textAlign: 'center'
    };

    // LINE 1 (Filled)
    const headerText1 = new fabric.IText(headerTextValue, {
        ...headerStyle,
        top: headerTop,
        name: 'header-1'
    });

    const TARGET_HEADER_HEIGHT = 100 * SCALE_FACTOR;
    const headerScaleX = CONTENT_WIDTH / headerText1.width!;
    const headerScaleY = TARGET_HEADER_HEIGHT / headerText1.height!;

    headerText1.set({
        scaleX: headerScaleX,
        scaleY: headerScaleY,
        left: FULL_WIDTH / 2
    });
    canvas.add(headerText1);

    const line1Height = headerText1.height! * headerText1.scaleY!;
    let currentTop = headerTop + line1Height;

    // LINE 2 (Outline)
    if (headerLines >= 2) {
        const line2Top = currentTop + headerGap;
        const headerText2 = new fabric.IText(headerTextValue, {
            ...headerStyle,
            top: line2Top,
            fill: 'transparent',
            stroke: textColor,
            strokeWidth: 1.5,
            name: 'header-2'
        });

        headerText2.set({
            scaleX: headerScaleX,
            scaleY: headerScaleY,
            left: FULL_WIDTH / 2
        });
        canvas.add(headerText2);

        const line2Height = headerText2.height! * headerText2.scaleY!;
        currentTop = line2Top + line2Height;
    }

    // LINE 3 (Outline)
    if (headerLines >= 3) {
        const line3Top = currentTop + headerGap;
        const headerText3 = new fabric.IText(headerTextValue, {
            ...headerStyle,
            top: line3Top,
            fill: 'transparent',
            stroke: textColor,
            strokeWidth: 1.5,
            name: 'header-3'
        });

        headerText3.set({
            scaleX: headerScaleX,
            scaleY: headerScaleY,
            left: FULL_WIDTH / 2
        });
        canvas.add(headerText3);

        const line3Height = headerText3.height! * headerText3.scaleY!;
        currentTop = line3Top + line3Height;
    }

    // --- GRID CALCULATION ---
    const gridTop = currentTop;

    // Border Configuration (Padding Buffer)
    // User wants 2px printed border -> 2 units.
    const BORDER_WIDTH = (isBorderEnabled && textColor === '#FFFFFF') ? 2 : 0;

    // Effective Width for Photos (Box-Sizing: Border-Box simulation)
    const INNER_CONTENT_WIDTH = CONTENT_WIDTH - (BORDER_WIDTH * 2);

    // 2. Calculate column width
    const numCols = colLayout.length;
    const colWidth = numCols > 0 ? INNER_CONTENT_WIDTH / numCols : 0;

    let innerGridHeight = 0;
    if (count === 0) {
        innerGridHeight = CONTENT_WIDTH; // Default
    } else {
        const maxPhotosInCol = colLayout.length > 0 ? Math.max(...colLayout) : 0;
        innerGridHeight = maxPhotosInCol * (colWidth / aspectRatio);
    }

    // --- RENDER BACKGROUND ---
    // Removed legacy 'black fill' logic (lines 262-277) to prevent 1px lines between photos.
    // We now use Composite Border on top.

    // Define isBorderActive at TOP LEVEL (if needed for Overlap logic)
    // But we WANT overlap now to close gaps.
    // So OVERLAP should be 2 regardless of border.
    const OVERLAP = 2; // Always bleed to close gaps

    // --- RENDER IMAGES ---
    let imageIndex = 0;
    for (let col = 0; col < numCols; col++) {
        const photosInCol = colLayout[col];
        const photoHeight = innerGridHeight / photosInCol;

        // Start from Padding + Border
        const colLeft = PADDING_SIDE + BORDER_WIDTH + (col * colWidth);

        for (let row = 0; row < photosInCol; row++) {
            if (imageIndex >= loadedImages.length) break;

            const img = loadedImages[imageIndex];
            if (img) {
                // Apply Filters
                const filters = [];
                if (isBW) filters.push(new fabric.filters.Grayscale());
                if (brightness !== 0) filters.push(new fabric.filters.Brightness({ brightness: brightness }));

                img.filters = filters;
                img.applyFilters();

                const left = colLeft + (colWidth / 2);
                const top = gridTop + BORDER_WIDTH + (row * photoHeight) + (photoHeight / 2);

                // Override Position if Manual Data Exists (Preserve Pan)
                let finalLeft = left;
                let finalTop = top;

                if (manualPositions && manualPositions[imageIndex]) {
                    finalLeft = manualPositions[imageIndex].left;
                    finalTop = manualPositions[imageIndex].top;
                }

                // DUAL LOGIC: Strip Gaps vs Strict Border
                // REVISED: Always use OVERLAP = 2 to close internal gaps.
                // The Composite Border (drawn on top) will mask the outer edges.
                // const OVERLAP = 2; // Defined above

                const scaleX = (colWidth + OVERLAP) / img.width!;
                const scaleY = (photoHeight + OVERLAP) / img.height!;
                const scale = Math.max(scaleX, scaleY);

                // ClipPath Logic
                // If Border Active: Clip Strict to visible cell (colWidth).
                // If Border Inactive: Clip Loosely (colWidth + OVERLAP) to allow bleed.
                const clipW = colWidth + OVERLAP;
                const clipH = photoHeight + OVERLAP;

                img.set({
                    left: finalLeft,
                    top: finalTop,
                    originX: 'center',
                    originY: 'center',
                    scaleX: scale,
                    scaleY: scale,
                    clipPath: new fabric.Rect({
                        left: left,
                        top: top,
                        width: clipW,
                        height: clipH,
                        originX: 'center',
                        originY: 'center',
                        absolutePositioned: true
                    }),
                    strokeWidth: 0,
                    cornerColor: 'white',
                    borderColor: '#000',
                    transparentCorners: false,
                    perPixelTargetFind: true,
                    selectable: true,
                    hasControls: true, // EXPLICIT FORCE
                    cornerSize: 10 * SCALE_FACTOR, // EXPLICIT FORCE (30px)
                    touchCornerSize: 10 * SCALE_FACTOR
                });

                img.setControlsVisibility({
                    mt: false, mb: false, ml: false, mr: false,
                    tl: true, tr: true, bl: true, br: true, // EXPLICITLY ENABLE CORNERS
                    mtr: false
                });
                canvas.add(img);
            }
            imageIndex++;
        }
    }

    // --- FOOTER ---
    const footerMarginTop = 15 * SCALE_FACTOR;
    // Total Grid Height = Inner + 2*Border
    const footerTop = gridTop + innerGridHeight + (BORDER_WIDTH * 2) + footerMarginTop;

    // Barcode
    const barcodeWidth = CONTENT_WIDTH * 0.35;
    const barcodeHeight = 70 * SCALE_FACTOR;
    const barcode = createBarcode(barcodeWidth, barcodeHeight, textColor);
    const barcodeOffsetY = 10 * SCALE_FACTOR;
    barcode.set({ left: PADDING_SIDE, top: footerTop + barcodeOffsetY });
    canvas.add(barcode);

    // Name
    const nameText = createText(footerTextValue, 60 * SCALE_FACTOR, 'normal');
    nameText.set({
        name: 'footer-name',
        fontFamily: 'Arial Black',
        fill: textColor,
        originX: 'right',
        originY: 'top',
        left: FULL_WIDTH - PADDING_SIDE,
        top: footerTop
    });
    // If name is empty string, we hide it (visual only, object could still exist but with empty text)
    if (!footerTextValue) {
        nameText.visible = false;
        // Reset dimensions for calculation purposes
        nameText.height = 0;
    }

    const maxNameWidth = CONTENT_WIDTH * 0.55;
    if (nameText.width! > maxNameWidth) {
        const scale = maxNameWidth / nameText.width!;
        nameText.set({ scaleX: scale, scaleY: scale });
    }
    canvas.add(nameText);

    // Signature Logic
    if (isSignatureEnabled) {
        const signatureFontSize = 28 * SCALE_FACTOR;
        const signatureWidth = CONTENT_WIDTH * 0.5;

        // Position: 
        // If Name is visible: beneath Name
        // If Name is hidden: at Name's position + OFFSET
        let signatureTop = footerTop;
        if (footerTextValue) {
            const nameHeight = nameText.height! * nameText.scaleY!;
            signatureTop += nameHeight + (5 * SCALE_FACTOR); // Small gap
        } else {
            signatureTop += (10 * SCALE_FACTOR); // "A bit higher" (10px) when name is empty
        }

        const signature = new fabric.Textbox(signatureTextValue, {
            width: signatureWidth,
            fontFamily: 'Arial',
            fontWeight: 'bold',
            fontSize: signatureFontSize * signatureScale,
            fill: textColor,
            textAlign: 'right',
            originX: 'right',
            originY: 'top',
            left: FULL_WIDTH - PADDING_SIDE,
            top: signatureTop,
            splitByGrapheme: false, // Word wrap
            selectable: false,
            evented: false,
            name: 'footer-signature'
        });

        canvas.add(signature);
    }

    // Date
    // Date should be aligned with Barcode, but we need to ensure it doesn't overlap signature if signature is very long?
    // User req: Signature is right-aligned. Date is left-aligned (under barcode usually?)
    // Actually current code: Date is under barcode.
    // Barcode is Left. Name is Right.
    // So Signature (Right) shouldn't conflict with Date (Left) unless very long.
    // We kept Max Width 50% for signature, so it should be fine.

    const dateString = isSince ? `since ${footerDateValue}` : footerDateValue;
    const dateText = createText(dateString, 24 * SCALE_FACTOR, 'bold');
    const dateTop = footerTop + barcodeOffsetY + barcodeHeight + (5 * SCALE_FACTOR);
    dateText.set({
        name: 'footer-date',
        fill: textColor,
        originX: 'left',
        originY: 'top',
        left: PADDING_SIDE,
        top: dateTop
    });
    const targetDateWidth = barcodeWidth * 0.7;
    if (dateText.width) {
        const scale = targetDateWidth / dateText.width;
        dateText.set({ scaleX: scale, scaleY: scale });
    }
    canvas.add(dateText);

    // Final Render
    // Calculate total height to include dynamic elements
    let totalHeight = dateTop + (30 * SCALE_FACTOR) + (40 * SCALE_FACTOR);

    // Check if signature extends lower
    if (isSignatureEnabled) {
        const sig = canvas.getObjects().find((o: any) => o.name === 'footer-signature');
        if (sig) {
            const sigBottom = sig.top! + sig.height! + (40 * SCALE_FACTOR);
            if (sigBottom > totalHeight) totalHeight = sigBottom;
        }
    }

    // Border Logic for Footer Version (Height includes grid)
    // 4. Border Logic (Composite 4 Rects) - MOVED HERE FOR Z-INDEX (TOP LAYER)
    const isBorderActive = isBorderEnabled && textColor === '#FFFFFF' && innerGridHeight > 0;

    if (isBorderActive) {
        // Precise Frame Border (Composite 4 Rects)
        const borderThickness = 3;

        // REVISED STRATEGY: 4 Rects framing the Total Area.
        const frameLeft = PADDING_SIDE;
        const frameTop = gridTop;
        const frameW = CONTENT_WIDTH;
        const frameH = innerGridHeight + (BORDER_WIDTH * 2);

        // Helper
        const createBorderPart = (name: string, l: number, t: number, w: number, h: number) => new fabric.Rect({
            fill: '#000000',
            strokeWidth: 0,
            selectable: false,
            evented: false,
            objectCaching: false,
            name: name,
            left: l, top: t, width: w, height: h,
            originX: 'left', originY: 'top'
        });

        // TOP
        canvas.add(createBorderPart('collage-border-top', frameLeft, frameTop, frameW, borderThickness));

        // BOTTOM
        canvas.add(createBorderPart('collage-border-bottom', frameLeft, frameTop + frameH - borderThickness, frameW, borderThickness));

        // LEFT
        canvas.add(createBorderPart('collage-border-left', frameLeft, frameTop, borderThickness, frameH));

        // RIGHT
        canvas.add(createBorderPart('collage-border-right', frameLeft + frameW - borderThickness, frameTop, borderThickness, frameH));
    }

    canvas.requestRenderAll();
    return totalHeight;
};

// --- SMART UPDATE (Text Only) ---
export const updateCollageHeader = (
    canvas: any,
    headerTextValue: string,
    footerTextValue: string,
    footerDateValue: string,
    isSince: boolean,
    textColor: string,
    // headerLines (param reserved for compatibility)
    signatureTextValue: string, // New
    isSignatureEnabled: boolean, // New
    signatureScale: number = 1 // New Scale
) => {
    if (!canvas) return;

    // Use global constants
    // const CONTENT_WIDTH = FULL_WIDTH - (PADDING_SIDE * 2); 

    // 1. UPDATE HEADER
    const headers = [
        canvas.getObjects().find((obj: any) => obj.name === 'header-1'),
        canvas.getObjects().find((obj: any) => obj.name === 'header-2'),
        canvas.getObjects().find((obj: any) => obj.name === 'header-3')
    ];

    const TARGET_HEADER_HEIGHT = 100 * SCALE_FACTOR;

    headers.forEach((header, index) => {
        if (!header) return;

        // Ensure visibility based on headerLines? 
        // No, structural changes should trigger generateCollageTemplate.
        // updateCollageHeader is for fast text updates.
        // But we can double check visibility just in case.
        // Actually, if we switch lines, we re-render. 
        // Here we just update text for existing objects.

        // Update Color
        if (index === 0) {
            header.set({ fill: textColor });
        } else {
            header.set({ stroke: textColor });
        }

        // Update Text
        if (header.text !== headerTextValue) {
            header.set({ text: headerTextValue });

            // Recalculate Scale
            header.set({ scaleX: 1, scaleY: 1 }); // Reset

            const currentWidth = header.width!;
            const currentHeight = header.height!;

            const scaleX = CONTENT_WIDTH / currentWidth;
            const scaleY = TARGET_HEADER_HEIGHT / currentHeight;

            header.set({ scaleX, scaleY });
        }
    });

    // 2. UPDATE FOOTER NAME
    const footerName = canvas.getObjects().find((obj: any) => obj.name === 'footer-name');
    if (!footerTextValue) {
        footerName.set({ text: '', visible: false, height: 0 }); // Hide
    } else {
        // If previously hidden, we might need to reset visibility
        footerName.set({ visible: true });

        if (footerName.text !== footerTextValue) { // Only update if changed
            footerName.set({ text: footerTextValue });

            // Reset scale to 1 before checking width
            footerName.set({ scaleX: 1, scaleY: 1 });

            // Auto-scale Name (max 55% width)
            const maxNameWidth = CONTENT_WIDTH * 0.55;
            if (footerName.width! > maxNameWidth) {
                const scale = maxNameWidth / footerName.width!;
                footerName.set({ scaleX: scale, scaleY: scale });
            }
        }
    }


    // 3. UPDATE SIGNATURE
    const signature = canvas.getObjects().find((obj: any) => obj.name === 'footer-signature');

    if (isSignatureEnabled) {
        const baseFontSize = 28 * SCALE_FACTOR;
        const signatureWidth = CONTENT_WIDTH * 0.5;

        // Position: 
        // If Name is visible: beneath Name
        // If Name is hidden: at Name's position + OFFSET

        // Find Footer Name Position
        const footerNameObj = canvas.getObjects().find((obj: any) => obj.name === 'footer-name');

        // Use existing top or fallback if not found
        // If we are in this function, basic layout exists.
        // footerNameObj should exist if template was generated.

        // Fallback calculation if objects missing (safety)
        const gridBottomEstimate = canvas.height - (100 * SCALE_FACTOR);
        const footerTop = footerNameObj ? footerNameObj.top : gridBottomEstimate;

        const nameH = (footerNameObj && footerNameObj.visible) ? (footerNameObj.height! * footerNameObj.scaleY!) : 0;

        let signatureTop = footerTop;
        if (footerTextValue && footerNameObj && footerNameObj.visible) {
            // Add margin below name
            signatureTop += nameH + (5 * SCALE_FACTOR);
        } else {
            // Name hidden -> Signature takes similar vertical spot (slightly offset)
            signatureTop += (10 * SCALE_FACTOR);
        }

        if (signature) {
            // Update Existing
            signature.set({
                text: signatureTextValue,
                fill: textColor,
                visible: true,
                fontSize: baseFontSize * signatureScale,
                top: signatureTop,
                left: FULL_WIDTH - PADDING_SIDE
            });
        } else {
            // Create New
            const newSignature = new fabric.Textbox(signatureTextValue, {
                width: signatureWidth,
                fontFamily: 'Arial',
                fontWeight: 'bold',
                fontSize: baseFontSize * signatureScale,
                fill: textColor,
                textAlign: 'right',
                originX: 'right',
                originY: 'top',
                left: FULL_WIDTH - PADDING_SIDE,
                top: signatureTop,
                splitByGrapheme: false,
                selectable: false,
                evented: false,
                name: 'footer-signature'
            });
            canvas.add(newSignature);
        }
    } else if (!isSignatureEnabled && signature) {
        // Hide if disabled
        signature.set({ visible: false });
    }

    // 4. UPDATE FOOTER DATE
    const footerDate = canvas.getObjects().find((obj: any) => obj.name === 'footer-date');
    let dateTop = 0;

    if (footerDate) {
        const dateString = isSince ? `since ${footerDateValue}` : footerDateValue;
        footerDate.set({ text: dateString, fill: textColor });

        // Force width to ALWAYS be 70% of barcode width
        const barcodeWidth = CONTENT_WIDTH * 0.35;
        const targetDateWidth = barcodeWidth * 0.7;

        if (footerDate.width) {
            const scale = targetDateWidth / footerDate.width;
            footerDate.set({ scaleX: scale, scaleY: scale });
        }
        dateTop = footerDate.top!;
    }

    // 5. UPDATE BARCODE COLOR
    const barcodeGroup = canvas.getObjects().find((obj: any) => obj.name === 'footer-barcode');
    if (barcodeGroup && barcodeGroup.type === 'group') {
        (barcodeGroup as fabric.Group).getObjects().forEach((obj: any) => {
            obj.set({ fill: textColor });
        });
    }

    // 6. RECALCULATE HEIGHT
    // Calculate total height to include dynamic elements
    let totalHeight = dateTop + (30 * SCALE_FACTOR) + (40 * SCALE_FACTOR); // Base height from Date (approx)

    // Better: Find date bottom
    if (footerDate) {
        totalHeight = footerDate.top! + (footerDate.height! * footerDate.scaleY!) + (40 * SCALE_FACTOR);
    }

    // Check if signature extends lower
    if (isSignatureEnabled) {
        const sig = canvas.getObjects().find((o: any) => o.name === 'footer-signature');
        if (sig && sig.visible) {
            const sigBottom = sig.top! + sig.height! + (40 * SCALE_FACTOR);
            if (sigBottom > totalHeight) totalHeight = sigBottom;
        }
    }

    canvas.requestRenderAll();
    return totalHeight;
};

// --- BABY TEMPLATE (Otchestvo) ---
// Cloned and modified for font logic: 1 line -> Bebasneue, >1 lines -> Arial Black
export const generateBabyTemplate = async (
    canvas: any,
    images: any[],
    aspectRatio: number = 1,
    headerTextValue: string = 'ГЕННАДИЕВИЧ',
    footerTextValue: string = 'VALERIA',
    footerDateValue: string = '05.09.2025',
    isBW: boolean = false,
    isSince: boolean = true,
    textColor: string = '#000000',
    brightness: number = 0,
    headerLines: number = 1, // Default 1 for Baby
    signatureTextValue: string = 'WANNA BE YOURS',
    isSignatureEnabled: boolean = false,
    isBorderEnabled: boolean = false,
    isFooterEnabled: boolean = false, // New
    cropScaleX: number = 1,
    cropScaleY: number = 1,
    signatureScale: number = 1, // New Scale,
    manualPositions: { left: number, top: number }[] = [] // New: Preserve Dragged Positions
): Promise<number> => {
    if (!canvas) return 800;

    const count = images.length;

    // 1. PREPARE LAYOUT DATA (Same as Collage)
    let colLayout: number[] = [];
    if (count === 0) {
        colLayout = [];
    } else {
        switch (count) {
            case 1: colLayout = [1]; break;
            case 2: colLayout = [1, 1]; break;
            case 3: colLayout = [1, 1, 1]; break;
            case 4: colLayout = [2, 2]; break;
            case 5: colLayout = [2, 1, 2]; break;
            case 6: colLayout = [2, 2, 2]; break;
            case 7: colLayout = [2, 3, 2]; break;
            case 8: colLayout = [3, 2, 3]; break;
            case 9: colLayout = [3, 3, 3]; break;
            default: {
                colLayout = [Math.ceil(count / 3), Math.round(count / 3), Math.floor(count / 3)];
                let sum = colLayout.reduce((a, b) => a + b, 0);
                while (sum < count) { colLayout[0]++; sum++; }
                while (sum > count) { colLayout[0]--; sum--; }
                break;
            }
        }
    }

    // 2. PRE-LOAD IMAGES (Same as Collage)
    const loadedImagesPromises = images.map(async (imgData) => {
        const imgUrl = (typeof imgData === 'object' && imgData.url) ? imgData.url : imgData;
        if (!imgUrl) return null;
        return await loadImage(imgUrl);
    });
    const loadedImages = await Promise.all(loadedImagesPromises);

    // 3. RENDER
    canvas.clear();
    canvas.backgroundColor = 'transparent';

    // --- HEADER LOGIC CHANGE ---
    const headerTop = 60 * SCALE_FACTOR;
    const headerGap = -15 * SCALE_FACTOR;

    // FONT SELECTION LOGIC
    const isSingleLine = headerLines === 1;
    const fontFamily = isSingleLine ? 'Bebasneue, sans-serif' : 'Arial Black, Arial, sans-serif';
    // Bebas is taller/narrower, might need scale adjustments, but standard auto-fit should handle it.

    const headerStyle = {
        fontFamily: fontFamily,
        fontWeight: isSingleLine ? 'normal' : '900', // Bebas is usually normal weight
        fill: textColor,
        originX: 'center' as const,
        originY: 'top' as const,
        selectable: false,
        evented: false,
        textAlign: 'center'
    };

    // LINE 1 (Filled)
    const headerText1 = new fabric.IText(headerTextValue, {
        ...headerStyle,
        top: headerTop,
        name: 'header-1'
    });

    const TARGET_HEADER_HEIGHT = 100 * SCALE_FACTOR;
    // For Bebas (single line), we might want a slightly different target height or rely on width?
    // Let's keep TARGET_HEADER_HEIGHT consistent for now.

    // Calculate Sizes
    // Important: Bebas might render differently.
    // Use VISIBLE WIDTH for header scaling to match crop
    // visibleW is calculated later, let's hoist it or duplicate logic.
    const baseClipW_H = CONTENT_WIDTH + (isBorderEnabled ? 0 : 2);
    const visibleW_H = baseClipW_H * cropScaleX;

    // Header should fit VISIBLE WIDTH
    const headerScaleX = visibleW_H / headerText1.width!;
    const headerScaleY = TARGET_HEADER_HEIGHT / headerText1.height!;

    headerText1.set({
        scaleX: headerScaleX,
        scaleY: headerScaleY,
        left: FULL_WIDTH / 2
    });
    canvas.add(headerText1);

    const line1Height = headerText1.height! * headerText1.scaleY!;
    let currentTop = headerTop + line1Height;

    // LINE 2 (Outline) - Only if > 1 line (implies Arial Black by logic)
    if (headerLines >= 2) {
        const line2Top = currentTop + headerGap;
        const headerText2 = new fabric.IText(headerTextValue, {
            ...headerStyle,
            top: line2Top,
            fill: 'transparent',
            stroke: textColor,
            strokeWidth: 1.5,
            name: 'header-2'
        });

        headerText2.set({
            scaleX: headerScaleX,
            scaleY: headerScaleY,
            left: FULL_WIDTH / 2
        });
        canvas.add(headerText2);

        const line2Height = headerText2.height! * headerText2.scaleY!;
        currentTop = line2Top + line2Height;
    }

    // LINE 3 (Outline)
    if (headerLines >= 3) {
        const line3Top = currentTop + headerGap;
        const headerText3 = new fabric.IText(headerTextValue, {
            ...headerStyle,
            top: line3Top,
            fill: 'transparent',
            stroke: textColor,
            strokeWidth: 1.5,
            name: 'header-3'
        });

        headerText3.set({
            scaleX: headerScaleX,
            scaleY: headerScaleY,
            left: FULL_WIDTH / 2
        });
        canvas.add(headerText3);

        const line3Height = headerText3.height! * headerText3.scaleY!;
        currentTop = line3Top + line3Height;
    }

    // --- GRID & FOOTER (Identical to Collage) ---
    const gridTop = currentTop;
    const BORDER_WIDTH = (isBorderEnabled && textColor === '#FFFFFF') ? 2 : 0;
    const INNER_CONTENT_WIDTH = CONTENT_WIDTH - (BORDER_WIDTH * 2);
    const numCols = colLayout.length;
    const colWidth = numCols > 0 ? INNER_CONTENT_WIDTH / numCols : 0;

    let innerGridHeight = 0;
    if (count === 0) {
        innerGridHeight = CONTENT_WIDTH;
    } else {
        const maxPhotosInCol = colLayout.length > 0 ? Math.max(...colLayout) : 0;
        innerGridHeight = maxPhotosInCol * (colWidth / aspectRatio);
    }

    // Define isBorderActive at TOP LEVEL so it's available everywhere
    const isBorderActive = isBorderEnabled && innerGridHeight > 0;

    // Border creation moved to end for Z-Index safety (Top Layer)

    // IMAGES
    let imageIndex = 0;
    for (let col = 0; col < numCols; col++) {
        const photosInCol = colLayout[col];
        const photoHeight = innerGridHeight / photosInCol;
        const colLeft = PADDING_SIDE + BORDER_WIDTH + (col * colWidth);

        for (let row = 0; row < photosInCol; row++) {
            if (imageIndex >= loadedImages.length) break;
            const img = loadedImages[imageIndex];
            if (img) {
                const filters = [];
                if (isBW) filters.push(new fabric.filters.Grayscale());
                if (brightness !== 0) filters.push(new fabric.filters.Brightness({ brightness: brightness }));
                img.filters = filters;
                img.applyFilters();

                const left = colLeft + (colWidth / 2);
                const top = gridTop + BORDER_WIDTH + (row * photoHeight) + (photoHeight / 2);
                const OVERLAP = isBorderActive ? 0 : 2;
                const scaleX = (colWidth + OVERLAP) / img.width!;
                const scaleY = (photoHeight + OVERLAP) / img.height!;
                const scale = Math.max(scaleX, scaleY);
                const clipW = colWidth + OVERLAP;
                const clipH = photoHeight + OVERLAP;

                const cellTop = gridTop + BORDER_WIDTH + (row * photoHeight);

                // Store base clip dims & anchor for updateImageGeometry
                (img as any).baseClipWidth = clipW;
                (img as any).baseClipHeight = clipH;
                (img as any).baseClipWidth = clipW;
                (img as any).baseClipHeight = clipH;
                (img as any).baseClipHeight = clipH;
                (img as any).baseCellTop = cellTop; // Fixed top edge anchor
                (img as any).baseLeft = left; // Fixed horizontal center anchor

                // Override Position if Manual Data Exists
                let finalLeft = left;
                let finalTop = top;

                if (manualPositions && manualPositions[imageIndex]) {
                    finalLeft = manualPositions[imageIndex].left;
                    finalTop = manualPositions[imageIndex].top;
                }

                img.set({
                    left: finalLeft,
                    top: finalTop,
                    originX: 'center',
                    originY: 'center',
                    scaleX: scale,
                    scaleY: scale,
                    clipPath: new fabric.Rect({
                        left: left, // Center X
                        top: cellTop + (clipH * cropScaleY) / 2, // Center Y (calculated for Top Anchor)
                        width: clipW * cropScaleX,
                        height: clipH * cropScaleY,
                        originX: 'center',
                        originY: 'center', // Safe origin
                        absolutePositioned: true
                    }),
                    strokeWidth: 0,
                    cornerColor: 'white',
                    borderColor: '#000',
                    transparentCorners: false,
                    perPixelTargetFind: true,
                    selectable: true,
                    lockScalingX: true,
                    lockScalingY: true,
                    lockWebkitsScaling: true, // Legacy?
                    hasControls: false // Disable manual controls to rely on sliders
                });
                img.setControlsVisibility({
                    mt: false, mb: false, ml: false, mr: false,
                    bl: false, br: false, tl: false, tr: false,
                    mtr: false // Disable rotation too if needed
                });
                canvas.add(img);
            }
            imageIndex++;
        }
    }

    // --- CROP AWARE DIMS FOR INITIAL RENDER ---
    // The photo is theoretically "innerGridHeight" tall, but we crop it.
    // Footer should start after the Visible Cropped Height.
    // Footer should start after the Visible Cropped Height.
    const baseClipH = innerGridHeight + (isBorderEnabled ? 0 : 2); // Approximation of clip logic
    const visibleH = baseClipH * cropScaleY;

    // Width Logic:
    const baseClipW = CONTENT_WIDTH + (isBorderEnabled ? 0 : 2);
    const visibleW = baseClipW * cropScaleX;

    // Center alignment base
    // The column center is at PADDING_SIDE + colWidth/2. (Default).
    // Or just FULL_WIDTH/2.
    const centerX = FULL_WIDTH / 2;

    // FOOTER (CONDITIONAL)
    if (!isFooterEnabled) {
        // If footer disabled, we just add padding bottom to grid... 
        // But relative to visible height?
        // User didn't ask for footer disabled state logic change, but for consistency:
        // const totalHeight = gridTop + visibleH + PADDING_SIDE;
        // Let's stick to original behavior for disabled footer unless requested?
        // Actually, if we crop height, the canvas should shrink.
        // So yes.
        const totalHeight = gridTop + visibleH + PADDING_SIDE;

        // Add Border if needed
        // No longer creating a single border here, updateImageGeometry will handle the composite border.
        // This block is effectively removed as the border creation is now at the top of generateBabyTemplate.

        // 4. Border Logic (Composite 4 Rects) - MOVED HERE FOR Z-INDEX (TOP LAYER)
        // isBorderActive is already defined at top of function.

        if (isBorderActive) {
            // Precise Frame Border (Composite 4 Rects)
            const borderThickness = 3;

            // Initial Dimensions
            const initialW = INNER_CONTENT_WIDTH;
            const initialH = innerGridHeight;

            // Center Position
            const centerX = FULL_WIDTH / 2;
            const leftEdge = centerX - (initialW / 2);
            const topEdge = gridTop;

            // Helper
            const createBorderPart = (name: string, l: number, t: number, w: number, h: number) => new fabric.Rect({
                fill: '#000000',
                strokeWidth: 0,
                selectable: false,
                evented: false,
                objectCaching: false,
                name: name,
                left: l, top: t, width: w, height: h,
                originX: 'left', originY: 'top'
            });

            // TOP
            canvas.add(createBorderPart('collage-border-top', leftEdge, topEdge, initialW, borderThickness));

            // BOTTOM
            canvas.add(createBorderPart('collage-border-bottom', leftEdge, topEdge + initialH - borderThickness, initialW, borderThickness));

            // LEFT
            canvas.add(createBorderPart('collage-border-left', leftEdge, topEdge, borderThickness, initialH));

            // RIGHT
            canvas.add(createBorderPart('collage-border-right', leftEdge + initialW - borderThickness, topEdge, borderThickness, initialH));
        }
        canvas.requestRenderAll();
        return totalHeight;
    }

    // FOOTER ENABLED
    // FOOTER ENABLED
    const footerMarginTop = 15 * SCALE_FACTOR;
    // Position relative to Visible Bottom
    // Top of grid + Visible Height + Margin
    const footerTop = gridTop + visibleH + footerMarginTop;

    const barcodeWidth = CONTENT_WIDTH * 0.35;
    const barcodeHeight = 70 * SCALE_FACTOR;
    const barcode = createBarcode(barcodeWidth, barcodeHeight, textColor);
    const barcodeOffsetY = 10 * SCALE_FACTOR;

    // Barcode Left: Center X - (VisibleWidth / 2) + Padding?
    // Original: PADDING_SIDE (Left edge).
    // New: Left edge of Visible Photo.
    // Visible Left = centerX - visibleW/2.
    // So barcode Left = (centerX - visibleW/2). // Assuming aligned to photo left.
    // Actually original was PADDING_SIDE, which matched photo left.
    // So yes, align to visible photo left.
    const visibleLeft = centerX - (visibleW / 2);

    barcode.set({ left: visibleLeft, top: footerTop + barcodeOffsetY, name: 'footer-barcode' });
    canvas.add(barcode);

    const nameText = createText(footerTextValue, 60 * SCALE_FACTOR, 'normal');
    nameText.set({
        name: 'footer-name',
        fontFamily: 'Arial Black',
        fill: textColor,
        originX: 'right',
        originY: 'top',
        // RIGHT ALIGNMENT: visibleLeft + visibleW
        left: visibleLeft + visibleW,
        top: footerTop
    });
    // Visual hide only if text empty (logic below), but here footer is enabled
    if (!footerTextValue) {
        nameText.visible = false;
        nameText.height = 0;
    }
    const maxNameWidth = CONTENT_WIDTH * 0.55;
    if (nameText.width! > maxNameWidth) {
        const scale = maxNameWidth / nameText.width!;
        nameText.set({ scaleX: scale, scaleY: scale });
    }
    canvas.add(nameText);

    if (isSignatureEnabled) {
        const signatureFontSize = 28 * SCALE_FACTOR;
        const signatureWidth = CONTENT_WIDTH * 0.5;
        let signatureTop = footerTop;
        if (footerTextValue) {
            const nameHeight = nameText.height! * nameText.scaleY!;
            signatureTop += nameHeight + (5 * SCALE_FACTOR);
        } else {
            // "A bit higher" logic needs care if we want fixed offsets?
            // Actually keeps inconsistent.
            signatureTop += (10 * SCALE_FACTOR);
        }
        const signature = new fabric.Textbox(signatureTextValue, {
            width: signatureWidth,
            fontFamily: 'Arial',
            fontWeight: 'bold',
            fontSize: signatureFontSize * signatureScale,
            fill: textColor,
            textAlign: 'right',
            originX: 'right',
            originY: 'top',
            // ALIGN RIGHT to visible photo
            left: visibleLeft + visibleW,
            top: signatureTop,
            splitByGrapheme: false,
            selectable: false,
            evented: false,
            name: 'footer-signature'
        });
        canvas.add(signature);
    }

    const dateString = isSince ? `since ${footerDateValue}` : footerDateValue;
    const dateText = createText(dateString, 24 * SCALE_FACTOR, 'bold');
    const dateTop = footerTop + barcodeOffsetY + barcodeHeight + (5 * SCALE_FACTOR);
    dateText.set({
        name: 'footer-date',
        fill: textColor,
        originX: 'left',
        originY: 'top',
        left: visibleLeft, // ALIGN LEFT to visible photo
        top: dateTop
    });
    const targetDateWidth = barcodeWidth * 0.7;
    if (dateText.width) {
        const scale = targetDateWidth / dateText.width;
        dateText.set({ scaleX: scale, scaleY: scale });
    }
    canvas.add(dateText);

    let totalHeight = dateTop + (30 * SCALE_FACTOR) + (40 * SCALE_FACTOR);
    if (isSignatureEnabled) {
        const sig = canvas.getObjects().find((o: any) => o.name === 'footer-signature');
        if (sig) {
            const sigBottom = sig.top! + sig.height! + (40 * SCALE_FACTOR);
            if (sigBottom > totalHeight) totalHeight = sigBottom;
        }
    }

    // Border Logic for Footer Version (Height includes grid)
    // 4. Border Logic (Composite 4 Rects) - MOVED HERE FOR Z-INDEX (TOP LAYER)
    // isBorderActive is defined at top level.

    if (isBorderActive) {
        // Precise Frame Border (Composite 4 Rects)
        const borderThickness = 3;

        // Initial Dimensions (Respect Crop Scale)
        const initialW = INNER_CONTENT_WIDTH * cropScaleX;
        const initialH = innerGridHeight * cropScaleY;

        // Center Position from Grid
        const centerX = FULL_WIDTH / 2;
        const leftEdge = centerX - (initialW / 2);
        // Note: For initial generation, we assume Top Anchor is gridTop.
        // If cropScaleY is < 1, the image shrinks around center?
        // No, updateImageGeometry logic uses top anchor.
        // Let's assume Top Anchor is consistent.
        const topEdge = gridTop;

        // Helper
        const createBorderPart = (name: string, l: number, t: number, w: number, h: number) => new fabric.Rect({
            fill: '#000000',
            strokeWidth: 0,
            selectable: false,
            evented: false,
            objectCaching: false,
            name: name,
            left: l, top: t, width: w, height: h,
            originX: 'left', originY: 'top'
        });

        // TOP
        canvas.add(createBorderPart('collage-border-top', leftEdge, topEdge, initialW, borderThickness));

        // BOTTOM
        canvas.add(createBorderPart('collage-border-bottom', leftEdge, topEdge + initialH - borderThickness, initialW, borderThickness));

        // LEFT
        canvas.add(createBorderPart('collage-border-left', leftEdge, topEdge, borderThickness, initialH));

        // RIGHT
        canvas.add(createBorderPart('collage-border-right', leftEdge + initialW - borderThickness, topEdge, borderThickness, initialH));
    }
    canvas.requestRenderAll();
    return totalHeight;
};

// --- UPDATE HEADER ONLY (Smart Update) ---
export const updateBabyHeader = (
    canvas: any,
    headerTextValue: string,
    footerTextValue: string,
    footerDateValue: string,
    isSince: boolean,
    textColor: string,
    headerLines: number,
    signatureTextValue: string,
    isSignatureEnabled: boolean,
    cropScaleX: number = 1,
    signatureScale: number = 1 // New Scale
) => {
    if (!canvas) return;

    // Use global constants from module scope if possible, or redefine/import.
    // They are exported from this file, so they are available in scope.

    // Check required font
    const TARGET_HEADER_HEIGHT = 100 * SCALE_FACTOR;
    const isSingleLine = headerLines === 1;
    const targetFontFamily = isSingleLine ? 'Bebasneue, sans-serif' : 'Arial Black, Arial, sans-serif';
    const targetFontWeight = isSingleLine ? 'normal' : '900';

    // 1. UPDATE HEADER
    const isBorderEnabled = !!canvas.getObjects().find((o: any) => o.name === 'collage-border-top');

    // VISIBLE WIDTH LOGIC
    const baseClipW_H = CONTENT_WIDTH + (isBorderEnabled ? 0 : 2);
    const visibleW_H = baseClipW_H * cropScaleX;

    const headersToUpdate = canvas.getObjects().filter((obj: any) => obj.name && obj.name.startsWith('header-'));

    headersToUpdate.forEach((header: any, index: number) => {
        if (!header) return;

        // Visual updates
        if (index === 0) header.set({ fill: textColor });
        else header.set({ stroke: textColor });

        let needsMetricUpdate = false;

        // Check Font Consistency
        if (header.fontFamily !== targetFontFamily) {
            header.set({ fontFamily: targetFontFamily, fontWeight: targetFontWeight });
            needsMetricUpdate = true;
        }

        // Check Text Consistency
        if (header.text !== headerTextValue) {
            header.set({ text: headerTextValue });
            needsMetricUpdate = true;
        }

        if (needsMetricUpdate) {
            // Recalculate Scale
            header.set({ scaleX: 1, scaleY: 1 });
            const currentWidth = header.width!;
            const currentHeight = header.height!;
            const scaleX = visibleW_H / currentWidth;
            const scaleY = TARGET_HEADER_HEIGHT / currentHeight;
            header.set({ scaleX, scaleY });
        }
    });

    // 2. UPDATE FOOTER NAME (Same as Collage)
    const footerName = canvas.getObjects().find((obj: any) => obj.name === 'footer-name');
    if (footerName) {
        footerName.set({ fill: textColor });
        if (!footerTextValue) {
            footerName.set({ text: '', visible: false, height: 0 });
        } else {
            footerName.set({ visible: true });
            if (footerName.text !== footerTextValue) {
                footerName.set({ text: footerTextValue });
                footerName.set({ scaleX: 1, scaleY: 1 });
                const maxNameWidth = CONTENT_WIDTH * 0.55;
                if (footerName.width! > maxNameWidth) {
                    const scale = maxNameWidth / footerName.width!;
                    footerName.set({ scaleX: scale, scaleY: scale });
                }
            }
        }
    }

    // 3. UPDATE SIGNATURE
    const signature = canvas.getObjects().find((obj: any) => obj.name === 'footer-signature');

    if (isSignatureEnabled) {
        const baseFontSize = 28 * SCALE_FACTOR;
        const signatureWidth = CONTENT_WIDTH * 0.5;

        // Position Calculation
        // Position:
        // If Name is visible: beneath Name
        // If Name is hidden: at Name's position + OFFSET
        // Recalculate these based on current state

        // Find Grid Bottom (Estimate based on content?)
        // Better: Find footer-name top - margin
        // Or finding existing barcode/name top.
        const footerNameObj = canvas.getObjects().find((obj: any) => obj.name === 'footer-name');
        const footerTop = footerNameObj ? footerNameObj.top : (canvas.height - 100); // Fallback

        // Name Height
        const nameH = (footerNameObj && footerNameObj.visible) ? (footerNameObj.height! * footerNameObj.scaleY!) : 0;

        let signatureTop = footerTop;
        if (footerTextValue && footerNameObj && footerNameObj.visible) {
            signatureTop += nameH + (5 * SCALE_FACTOR);
        } else {
            signatureTop += (10 * SCALE_FACTOR);
        }

        if (signature) {
            // Update Existing
            signature.set({
                text: signatureTextValue,
                fill: textColor,
                visible: true,
                fontSize: baseFontSize * signatureScale,
                top: signatureTop,
                left: FULL_WIDTH - PADDING_SIDE
            });
        } else {
            // Create New
            const newSignature = new fabric.Textbox(signatureTextValue, {
                width: signatureWidth,
                fontFamily: 'Arial',
                fontWeight: 'bold',
                fontSize: baseFontSize * signatureScale,
                fill: textColor,
                textAlign: 'right',
                originX: 'right',
                originY: 'top',
                left: FULL_WIDTH - PADDING_SIDE,
                top: signatureTop,
                splitByGrapheme: false,
                selectable: false,
                evented: false,
                name: 'footer-signature'
            });
            canvas.add(newSignature);
        }

    } else if (!isSignatureEnabled && signature) {
        signature.set({ visible: false });
    }


    // 4. UPDATE DATE
    const footerDate = canvas.getObjects().find((obj: any) => obj.name === 'footer-date');
    let dateTop = 0;
    if (footerDate) {
        const dateString = isSince ? `since ${footerDateValue}` : footerDateValue;
        footerDate.set({ text: dateString, fill: textColor });
        const barcodeWidth = CONTENT_WIDTH * 0.35;
        const targetDateWidth = barcodeWidth * 0.7;
        if (footerDate.width) {
            const scale = targetDateWidth / footerDate.width;
            footerDate.set({ scaleX: scale, scaleY: scale });
        }
    }

    // 5. UPDATE BARCODE
    const barcodeGroup = canvas.getObjects().find((obj: any) => obj.name === 'footer-barcode');
    if (barcodeGroup && barcodeGroup.type === 'group') {
        (barcodeGroup as fabric.Group).getObjects().forEach((obj: any) => {
            obj.set({ fill: textColor });
        });
    }

    // 6. RECALCULATE HEIGHT
    // Calculate total height to include dynamic elements
    let totalHeight = dateTop + (30 * SCALE_FACTOR) + (40 * SCALE_FACTOR); // Base height from Date (approx)

    // Better: Find date bottom
    if (footerDate) {
        totalHeight = footerDate.top! + (footerDate.height! * footerDate.scaleY!) + (40 * SCALE_FACTOR);
    }

    // Check if signature extends lower
    if (isSignatureEnabled) {
        const sig = canvas.getObjects().find((o: any) => o.name === 'footer-signature');
        if (sig && sig.visible) {
            const sigBottom = sig.top! + sig.height! + (40 * SCALE_FACTOR);
            if (sigBottom > totalHeight) totalHeight = sigBottom;
        }
    }

    canvas.requestRenderAll();
    return totalHeight;
};

export const updateCollageFilters = (

    canvas: any,
    isBW: boolean,
    brightness: number
) => {
    if (!canvas) return;

    const objects = canvas.getObjects();

    objects.forEach((obj: any) => {
        if (obj.type === 'image') {
            const img = obj as fabric.FabricImage;

            // Re-build filters array
            const filters = [];

            if (isBW) {
                filters.push(new fabric.filters.Grayscale());
            }

            if (brightness !== 0) {
                filters.push(new fabric.filters.Brightness({ brightness: brightness }));
            }

            img.filters = filters;
            img.applyFilters();
        }
    });

    canvas.requestRenderAll();
};

export const updateImageGeometry = (
    canvas: any,
    cropScaleX: number,
    cropScaleY: number
) => {
    if (!canvas) return;

    // Find the image object
    const img = canvas.getObjects().find((obj: any) => obj.type === 'image');
    if (!img || !img.clipPath) return;

    // Update ClipPath Scale (Crop)
    const clipPath = img.clipPath;
    // We need original dimensions. Since we aren't storing them in baseClipWidth anymore (removed in step 2?),
    // actually, wait, I DO want to store baseClipWidth on the image object itself in step 2.
    // I should keep that storage logic but remove pan logic.
    // Let's re-add baseClipWidth storage in the previous chunk.

    // Check if I can access original width/height from the clipPath's current state relative to scale?
    // No, easier to just store baseClipWidth/Height on the image object    
    if ((img as any).baseClipWidth && (img as any).baseClipHeight && (img as any).baseCellTop !== undefined) {
        // ROUND to integers to prevent anti-aliasing fuzziness at edges
        const newWidth = Math.round((img as any).baseClipWidth * cropScaleX);
        const newHeight = Math.round((img as any).baseClipHeight * cropScaleY);
        // Ensure Top anchor is also integer snapped
        const safeBaseTop = Math.round((img as any).baseCellTop);
        const newTop = Math.round(safeBaseTop + (newHeight / 2));

        const imgCenterLeft = img.left!; // Keep as is? Or round? Img is usually centered. Let's keep strict.

        clipPath.set({
            width: newWidth,
            height: newHeight,
            // Maintain Top Anchor: CenterY 
            top: newTop
        });

        // --- SYNC HEADER & FOOTER & BORDER WIDTH ---

        // 1. Headers (Scale to fit new width)
        // We know headers initially fill CONTENT_WIDTH. 
        // We can just proportionally scale them based on cropScaleX? 
        // Or better: set scaleX based on newWidth / currentWidth * currentScale? 
        // Simplest: Find headers, calculate target width = newWidth.

        // However, headers are text. If we scale X, we stretch/compress text.
        // Usually "Baby" headers are full width. If photo narrows, header should narrow.
        // Let's iterate all headers.
        const headers = canvas.getObjects().filter((o: any) => o.name && o.name.startsWith('header-'));
        headers.forEach((h: any) => {
            // Logic differs for Bebas vs Arial Black?
            // Generally we want them to fit 'newWidth'.
            // Original logic: scaleX = CONTENT_WIDTH / textWidth.
            // New logic: scaleX = newWidth / textWidth.
            // But we don't know textWidth easily without resetting scale. 
            // We can just assume current width is ~CONTENT_WIDTH (or whatever it was).
            // Actually, just multiplying current scale by ratio is safer?
            // No, because consecutive updates drift.
            // Better: reset scale to 1, then calc.
            // But 'text' object width is constant.

            if (h.width) {
                const targetW = newWidth; // Full width of photo
                if (targetW > 0) {
                    // Maintain Aspect Ratio? Or Squash?
                    // User said "header and footer adjust to this width".
                    // Likely they want the layout to remain "Blocky".
                    // Let's just scaleX for now to perfectly match width. 
                    h.set({ scaleX: newWidth / h.width, left: imgCenterLeft });
                }
            }
        });

        // 2. Border (Composite 4 Rects - ABSOLUTE BOUNDING BOX LOGIC)
        const borderTop = canvas.getObjects().find((o: any) => o.name === 'collage-border-top');
        const borderBottom = canvas.getObjects().find((o: any) => o.name === 'collage-border-bottom');
        const borderLeft = canvas.getObjects().find((o: any) => o.name === 'collage-border-left');
        const borderRight = canvas.getObjects().find((o: any) => o.name === 'collage-border-right');

        if (clipPath && (borderTop || borderBottom || borderLeft || borderRight)) {
            // CRITICAL FIX: "Composite Geometry + Snap"
            // Use 4 filled rectangles instead of strokes.
            // Snap everything to integer pixels.

            clipPath.setCoords();
            const rect = clipPath.getBoundingRect(true);

            const absLeft = Math.round(rect.left);
            const absTop = Math.round(rect.top);
            const absWidth = Math.round(rect.width);
            const absHeight = Math.round(rect.height);

            const THICKNESS = 3;

            // Update function for simplicity
            const setRect = (obj: any, l: number, t: number, w: number, h: number) => {
                if (obj) {
                    obj.set({
                        left: l, top: t, width: w, height: h,
                        scaleX: 1, scaleY: 1, angle: 0,
                        originX: 'left', originY: 'top', // Simple top-left origin
                        fill: '#000000', // Ensure color sync if needed
                        objectCaching: false
                    });
                    obj.setCoords();
                }
            };

            // TOP: Full Width, 3px Height. Inside bounding box.
            setRect(borderTop, absLeft, absTop, absWidth, THICKNESS);

            // BOTTOM: Full Width, 3px Height. Inside bounding box (at bottom).
            setRect(borderBottom, absLeft, absTop + absHeight - THICKNESS, absWidth, THICKNESS);

            // LEFT: 3px Width. Height full? Or between Top/Bottom?
            // To match "Inside Stroke" look (corners overlap), let's make vertical bars full height too?
            // Or inset them between top/bottom bars?
            // Standard Stroke draws corners overlapping.
            // Let's draw Full Height Left/Right bars. They will overlap with Top/Bottom at corners. 
            // Since color is solid, this creates a clean corner.
            setRect(borderLeft, absLeft, absTop, THICKNESS, absHeight);

            // RIGHT: 3px Width. Inside right edge.
            setRect(borderRight, absLeft + absWidth - THICKNESS, absTop, THICKNESS, absHeight);

            // CRITICAL FIX: Z-INDEX "Bring To Front"
            // Ensure borders are ALWAYS on top of the image (prevent "hidden under photo").
            canvas.bringObjectToFront(borderTop);
            canvas.bringObjectToFront(borderBottom);
            canvas.bringObjectToFront(borderLeft);
            canvas.bringObjectToFront(borderRight);
        }

        // Removed: 2b. Background (Black Fill) - Replaced by precise border above.

        // 3. Footer Elements
        const PADDING = 20;
        const halfW = newWidth / 2;

        // BORDER_WIDTH (2) + MARGIN (15 * SCALE)
        const BORDER_WIDTH = 2; // Hardcoded or imported? Usually 2.
        const FOOTER_MARGIN = 15 * 3; // 15 * SCALE_FACTOR (3)
        // Correct Footer Top relative to photo bottom
        const newFooterTop = (img as any).baseCellTop + newHeight + BORDER_WIDTH + FOOTER_MARGIN;

        // Calculate Delta Y for shift
        // Use Barcode as anchor (since it's always present if footer enabled)
        const fBarcode = canvas.getObjects().find((o: any) => o.name === 'footer-barcode');

        let deltaY = 0;
        if (fBarcode) {
            // Original expected top for barcode relative to footerTop was +10*SCALE
            // But we can just use the difference between Desired Footer Top and Current Footer Top?
            // Wait, we don't know Current Footer Top easily.
            // But we know barcode should be at newFooterTop + (10 * SCALE).
            // So we can set it absolute!
            // No, because signature has dynamic offset.
            // Better to calculate delta from barcode's CURRENT position vs DESIRED position.
            const barcodeOffsetY = 10 * 3; // 10 * SCALE_FACTOR
            const desiredBarcodeTop = newFooterTop + barcodeOffsetY;
            deltaY = desiredBarcodeTop - fBarcode.top!;

            // Apply delta to ALL footer elements
            fBarcode.top! += deltaY;
            fBarcode.setCoords(); // Updates position

            // Update Left alignment
            fBarcode.set({ left: imgCenterLeft - halfW + PADDING });
        }

        // Name (Right Aligned)
        const fName = canvas.getObjects().find((o: any) => o.name === 'footer-name');
        if (fName) {
            fName.set({ left: imgCenterLeft + halfW - PADDING });
            if (fBarcode) fName.top! += deltaY; // Shift alongside barcode
            fName.setCoords();
        }

        // Signature (Right Aligned)
        const fSig = canvas.getObjects().find((o: any) => o.name === 'footer-signature');
        if (fSig) {
            fSig.set({ left: imgCenterLeft + halfW - PADDING });
            if (fBarcode) fSig.top! += deltaY;
            fSig.setCoords();
        }

        // Date (Left Aligned)
        const fDate = canvas.getObjects().find((o: any) => o.name === 'footer-date');
        if (fDate) {
            fDate.set({ left: imgCenterLeft - halfW + PADDING });
            if (fBarcode) fDate.top! += deltaY;
            fDate.setCoords();
        }

    }

    canvas.requestRenderAll();
};