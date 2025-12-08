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
    isBorderEnabled: boolean = false // New Border logic
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

    // --- RENDER BACKGROUND (Gap Insurance) ---
    // Strategy: "Triple Protection"
    // 1. Black Background fills any subpixel gaps between photos and border.
    // CONDITION: Border enabled AND Text is White (Border not allowed on Black text)
    const isBorderActive = isBorderEnabled && textColor === '#FFFFFF';

    if (isBorderActive && innerGridHeight > 0) {
        // Total Grid Height includes the border padding
        const totalBgHeight = innerGridHeight + (BORDER_WIDTH * 2);

        const bgRect = new fabric.Rect({
            left: PADDING_SIDE,
            top: gridTop,
            width: CONTENT_WIDTH,
            height: totalBgHeight,
            fill: '#000000', // Black "Seam Filler"
            selectable: false,
            evented: false,
            name: 'collage-bg-fill'
        });
        canvas.add(bgRect);
    }

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

                // DUAL LOGIC: Strip Gaps vs Strict Border
                // 1. Border Active: STRICT Mode. overflow: hidden logic. No overlap. 
                //    We rely on the Black Background to fill gaps if any (but strict math should suffice).
                // 2. Border Inactive: BLEED Mode. 
                //    We need overlap to cover subpixel white lines between photos.

                const OVERLAP = isBorderActive ? 0 : 2;

                const scaleX = (colWidth + OVERLAP) / img.width!;
                const scaleY = (photoHeight + OVERLAP) / img.height!;
                const scale = Math.max(scaleX, scaleY);

                // ClipPath Logic
                // If Border Active: Clip Strict to visible cell (colWidth).
                // If Border Inactive: Clip Loosely (colWidth + OVERLAP) to allow bleed.
                const clipW = colWidth + OVERLAP;
                const clipH = photoHeight + OVERLAP;

                img.set({
                    left: left,
                    top: top,
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
                    selectable: true
                });

                img.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
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
            fontSize: signatureFontSize,
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

    // Border Logic: Hybrid "Padding + Stroke"
    // Geometry: Photos are already shifted by Padding (BORDER_WIDTH = 2).
    // Rendering: We draw a crisp 2px Stroke in that empty space.
    // CONDITION: Border enabled AND Text is White
    if (isBorderEnabled && count > 0 && textColor === '#FFFFFF') {
        const borderStrokeWidth = 2; // Exact 2px
        const halfStroke = borderStrokeWidth / 2;

        // Total Grid area (Inner + Borders)
        const totalGridHeight = innerGridHeight + (BORDER_WIDTH * 2);

        // Outer Bounds (Exact integers)
        const boundsLeft = Math.round(PADDING_SIDE);
        const boundsTop = Math.round(gridTop);
        const boundsWidth = Math.round(CONTENT_WIDTH);
        const boundsHeight = Math.round(totalGridHeight);

        // Inset Stroke Props (`box-shadow: inset 0 0 0 2px`)
        // Path Center = Edge + 1px.
        // Size = Outer - 2px.
        const borderLeft = boundsLeft + halfStroke;
        const borderTop = boundsTop + halfStroke;
        const borderWidth = boundsWidth - borderStrokeWidth;
        const borderHeight = boundsHeight - borderStrokeWidth;

        const border = new fabric.Rect({
            left: borderLeft,
            top: borderTop,
            width: borderWidth,
            height: borderHeight,
            fill: 'transparent', // No fill (paper background shows? actually photos cover inner, this covers gap)
            stroke: '#000000',   // Crisp Stroke
            strokeWidth: borderStrokeWidth,
            selectable: false,
            evented: false,
            objectCaching: false,
            strokeUniform: true,
            name: 'collage-border'
        });
        canvas.add(border);
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
    headerLines: number, // New param for compatibility
    signatureTextValue: string, // New
    isSignatureEnabled: boolean // New
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
    let nameHeight = 0;

    if (footerName) {
        footerName.set({ fill: textColor });

        // Visibility Logic
        if (!footerTextValue) {
            footerName.set({ text: '', visible: false, height: 0 }); // Hide
            nameHeight = 0;
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
            nameHeight = footerName.height! * footerName.scaleY!;
        }
    }

    // 3. UPDATE SIGNATURE
    // Since signature structure might change (add/remove), we need to handle this.
    // If we receive "enabled" and no object exists -> we should probably re-render full template or create it here.
    // For simplicity, if signature state toggles, the Workspace should trigger FULL re-render (generateCollageTemplate).
    // This function assumes objects exist or we just update text/color.

    const signature = canvas.getObjects().find((obj: any) => obj.name === 'footer-signature');

    if (isSignatureEnabled && signature) {
        signature.set({ text: signatureTextValue, fill: textColor, visible: true });

        // Update Position based on Name
        const footerTop = footerName ? footerName.top : 0; // Fallback

        let signatureTop = footerTop;
        if (footerTextValue && footerName && footerName.visible) {
            signatureTop += nameHeight + (5 * SCALE_FACTOR);
        } else {
            signatureTop += (10 * SCALE_FACTOR); // "A bit higher" (10px) when name is empty
        }
        signature.set({ top: signatureTop });

    } else if (!isSignatureEnabled && signature) {
        signature.set({ visible: false });
    }


    // 4. UPDATE FOOTER DATE
    const footerDate = canvas.getObjects().find((obj: any) => obj.name === 'footer-date');
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
    }

    // 5. UPDATE BARCODE COLOR
    const barcodeGroup = canvas.getObjects().find((obj: any) => obj.name === 'footer-barcode');
    if (barcodeGroup && barcodeGroup.type === 'group') {
        (barcodeGroup as fabric.Group).getObjects().forEach((obj: any) => {
            obj.set({ fill: textColor });
        });
    }

    canvas.requestRenderAll();
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