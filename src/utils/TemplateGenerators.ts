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
    brightness: number = 0
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
    const line2Top = headerTop + line1Height + headerGap;

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

    // --- GRID CALCULATION ---
    const line2Height = headerText2.height! * headerText2.scaleY!;
    const gridTop = line2Top + line2Height;

    // 3. Calculate Grid Height
    // If a column has `maxPhotosInCol` photos, each photo should have height = colWidth / aspectRatio.

    // 2. Calculate column width
    const numCols = colLayout.length;
    const colWidth = numCols > 0 ? CONTENT_WIDTH / numCols : 0; // Avoid division by zero

    let gridHeight = 0;
    if (count === 0) {
        gridHeight = CONTENT_WIDTH; // Default Square Placeholder Height
    } else {
        // 1. Find max photos in a column
        const maxPhotosInCol = colLayout.length > 0 ? Math.max(...colLayout) : 0;
        gridHeight = maxPhotosInCol * (colWidth / aspectRatio);
    }

    // --- RENDER IMAGES ---
    let imageIndex = 0;
    for (let col = 0; col < numCols; col++) {
        const photosInCol = colLayout[col];
        const photoHeight = gridHeight / photosInCol;
        const colLeft = PADDING_SIDE + (col * colWidth);

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
                const top = gridTop + (row * photoHeight) + (photoHeight / 2);

                // FIX: Add small overlap to prevent 1px gaps
                const OVERLAP = 2;

                const scaleX = (colWidth + OVERLAP) / img.width!;
                const scaleY = (photoHeight + OVERLAP) / img.height!;
                const scale = Math.max(scaleX, scaleY);

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
                        width: colWidth + OVERLAP,
                        height: photoHeight + OVERLAP,
                        originX: 'center',
                        originY: 'center',
                        absolutePositioned: true
                    }),
                    strokeWidth: 0,
                    cornerColor: 'white',
                    borderColor: '#000',
                    transparentCorners: false,
                    perPixelTargetFind: true,
                    selectable: true // Ensure images are selectable
                });

                img.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
                canvas.add(img);
            }
            imageIndex++;
        }
    }

    // --- FOOTER ---
    const footerMarginTop = 15 * SCALE_FACTOR;
    const footerTop = gridTop + gridHeight + footerMarginTop;

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
    const maxNameWidth = CONTENT_WIDTH * 0.55;
    if (nameText.width! > maxNameWidth) {
        const scale = maxNameWidth / nameText.width!;
        nameText.set({ scaleX: scale, scaleY: scale });
    }
    canvas.add(nameText);

    // Date
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
    // Use a fixed height for the date area to prevent layout jumps when toggling 'since'
    // The date text scales, but we reserve a constant space for it.
    const FIXED_DATE_HEIGHT = 30 * SCALE_FACTOR;
    const totalHeight = dateTop + FIXED_DATE_HEIGHT + (40 * SCALE_FACTOR);

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
    textColor: string
) => {
    if (!canvas) return;

    // Use global constants
    // const CONTENT_WIDTH = FULL_WIDTH - (PADDING_SIDE * 2); 

    // 1. UPDATE HEADER
    const header1 = canvas.getObjects().find((obj: any) => obj.name === 'header-1');
    const header2 = canvas.getObjects().find((obj: any) => obj.name === 'header-2');

    // Always update color
    if (header1) header1.set({ fill: textColor });
    if (header2) header2.set({ stroke: textColor });

    if (header1 && header2 && header1.text !== headerTextValue) {
        header1.set({ text: headerTextValue });
        header2.set({ text: headerTextValue });

        // Recalculate Header Scale using the object itself
        // Reset scale to 1 to get natural dimensions
        header1.set({ scaleX: 1, scaleY: 1 });

        const currentWidth = header1.width!;
        const currentHeight = header1.height!;

        const TARGET_HEADER_HEIGHT = 100 * SCALE_FACTOR;

        const scaleX = CONTENT_WIDTH / currentWidth;
        const scaleY = TARGET_HEADER_HEIGHT / currentHeight;

        header1.set({ scaleX, scaleY });
        header2.set({ scaleX, scaleY });
    }

    // 2. UPDATE FOOTER NAME
    const footerName = canvas.getObjects().find((obj: any) => obj.name === 'footer-name');
    if (footerName) {
        footerName.set({ text: footerTextValue, fill: textColor });

        // Reset scale to 1 before checking width
        footerName.set({ scaleX: 1, scaleY: 1 });

        // Auto-scale Name (max 55% width)
        const maxNameWidth = CONTENT_WIDTH * 0.55;
        if (footerName.width! > maxNameWidth) {
            const scale = maxNameWidth / footerName.width!;
            footerName.set({ scaleX: scale, scaleY: scale });
        }
    }

    // 3. UPDATE FOOTER DATE
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

    // 4. UPDATE BARCODE COLOR
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