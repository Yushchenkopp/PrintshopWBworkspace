import * as fabric from 'fabric';

// --- НАСТРОЙКИ ГЕОМЕТРИИ (Синхронизировано с CanvasEditor: 2400px) ---
const SCALE_FACTOR = 3; // 3x Resolution for sharpness
const FULL_WIDTH = 800 * SCALE_FACTOR;
const PADDING_SIDE = 40 * SCALE_FACTOR;
const CONTENT_WIDTH = FULL_WIDTH - (PADDING_SIDE * 2);

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

    canvas.clear();
    canvas.backgroundColor = 'transparent';

    const count = images.length;
    if (count === 0) {
        canvas.requestRenderAll();
        return 800;
    }

    // 1. КАРТА КОЛОНОК (Column Layout)
    // Массив задает количество фото в каждом столбце
    let colLayout: number[] = [];

    switch (count) {
        case 1: colLayout = [1]; break;
        case 2: colLayout = [1, 1]; break; // 2 столбца по 1 фото
        case 3: colLayout = [1, 1, 1]; break; // 3 столбца по 1 фото
        case 4: colLayout = [2, 2]; break; // 2 столбца по 2 фото
        case 5: colLayout = [2, 1, 2]; break; // 2-1-2
        case 6: colLayout = [2, 2, 2]; break; // 3 столбца по 2 фото
        case 7: colLayout = [2, 3, 2]; break; // 2-3-2
        case 8: colLayout = [3, 2, 3]; break; // 3-2-3
        case 9: colLayout = [3, 3, 3]; break; // 3-3-3
        default:
            // Если > 9, делим на 3 столбца равномерно
            colLayout = [Math.ceil(count / 3), Math.round(count / 3), Math.floor(count / 3)];
            // Корректировка суммы (простой вариант, можно улучшить)
            let sum = colLayout.reduce((a, b) => a + b, 0);
            while (sum < count) { colLayout[0]++; sum++; }
            while (sum > count) { colLayout[0]--; sum--; }
            break;
    }

    // 2. ЗАГОЛОВОК (Dual Layer: Fill + Outline)
    const headerTop = 60 * SCALE_FACTOR;
    const headerGap = -15 * SCALE_FACTOR; // Even tighter spacing

    // Common styles for header
    const headerStyle = {
        fontFamily: 'Arial Black, Arial, sans-serif', // Arial Black requested
        fontWeight: '900',
        fill: textColor,
        originX: 'center' as const,
        originY: 'top' as const,
        selectable: false,
        evented: false,
        textAlign: 'center'
    };

    // Line 1: Filled
    const headerText1 = new fabric.IText(headerTextValue, {
        ...headerStyle,
        top: headerTop,
        name: 'header-1' // Tag for updates
    });

    // FIXED HEIGHT LOGIC
    // We want the header to always be a specific height, regardless of text length.
    // We also want it to fill the width.
    const TARGET_HEADER_HEIGHT = 100 * SCALE_FACTOR; // Fixed height in pixels

    const scaleX = CONTENT_WIDTH / headerText1.width!;
    const scaleY = TARGET_HEADER_HEIGHT / headerText1.height!;

    headerText1.set({
        scaleX: scaleX,
        scaleY: scaleY,
        left: FULL_WIDTH / 2
    });

    canvas.add(headerText1);

    // Calculate height of first line to position second line
    const line1Height = headerText1.height! * headerText1.scaleY!;
    const line2Top = headerTop + line1Height + headerGap;

    // Line 2: Outlined
    const headerText2 = new fabric.IText(headerTextValue, {
        ...headerStyle,
        top: line2Top,
        fill: 'transparent',
        stroke: textColor,
        strokeWidth: 1.5, // Reverted to 1.5 (scaling handled by object scale)
        name: 'header-2' // Tag for updates
    });

    // Apply same scaling
    headerText2.set({
        scaleX: scaleX,
        scaleY: scaleY,
        left: FULL_WIDTH / 2
    });

    canvas.add(headerText2);

    // 3. РАСЧЕТ СЕТКИ
    const line2Height = headerText2.height! * headerText2.scaleY!;
    const gridTop = line2Top + line2Height + (5 * SCALE_FACTOR); // Minimal gap to collage
    const gap = 0; // GAPLESS (без отступов)

    // Calculate Footer Top (Pre-calculation to find available grid height)
    // We need to know how much space the footer takes.
    // GRID HEIGHT based on Cell Aspect Ratio
    // The user wants the CELLS to match the aspect ratio (e.g. 1:1 square cells).
    // Exception: Columns with fewer photos stretch to fill the grid height.

    // 1. Find max photos in a column
    const maxPhotosInCol = Math.max(...colLayout);

    // 2. Calculate column width
    const numCols = colLayout.length;
    const colWidth = CONTENT_WIDTH / numCols;

    // 3. Calculate Grid Height
    // If a column has `maxPhotosInCol` photos, each photo should have height = colWidth / aspectRatio.
    // So total grid height = maxPhotosInCol * (colWidth / aspectRatio).
    const gridHeight = maxPhotosInCol * (colWidth / aspectRatio);

    let imageIndex = 0;

    // 4. ОТРИСОВКА ПО КОЛОНКАМ
    for (let col = 0; col < numCols; col++) {
        const photosInCol = colLayout[col];
        const photoHeight = gridHeight / photosInCol; // Высота фото в этой колонке

        const colLeft = PADDING_SIDE + (col * colWidth);

        for (let row = 0; row < photosInCol; row++) {
            if (imageIndex >= images.length) break;

            const imgData = images[imageIndex];
            const imgUrl = (typeof imgData === 'object' && imgData.url) ? imgData.url : imgData;

            if (imgUrl) {
                const img = await loadImage(imgUrl);

                if (img) {
                    // Apply Filters
                    const filters = [];
                    if (isBW) {
                        filters.push(new fabric.filters.Grayscale());
                    }
                    if (brightness !== 0) {
                        filters.push(new fabric.filters.Brightness({ brightness: brightness }));
                    }

                    img.filters = filters;
                    img.applyFilters();

                    // Центр ячейки
                    const left = colLeft + (colWidth / 2);
                    const top = gridTop + (row * photoHeight) + (photoHeight / 2);

                    // Масштабирование (Object-Fit: Cover)
                    const scaleX = colWidth / img.width!;
                    const scaleY = photoHeight / img.height!;
                    const scale = Math.max(scaleX, scaleY);

                    img.set({
                        left: left,
                        top: top,
                        originX: 'center',
                        originY: 'center',
                        scaleX: scale,
                        scaleY: scale,
                        // Clip Path (Absolute Positioning)
                        clipPath: new fabric.Rect({
                            left: left, // Absolute center X of cell
                            top: top,   // Absolute center Y of cell
                            width: colWidth,
                            height: photoHeight,
                            originX: 'center',
                            originY: 'center',
                            absolutePositioned: true
                        }),
                        strokeWidth: 0,
                        cornerColor: 'white',
                        borderColor: '#000',
                        transparentCorners: false,
                        perPixelTargetFind: true, // Only select if clicking on visible pixels (respects clipPath)
                    });

                    // Отключаем лишние контролы
                    img.setControlsVisibility({
                        mt: false, mb: false, ml: false, mr: false
                    });

                    canvas.add(img);
                }
            }
            imageIndex++;
        }
    }

    // 5. ФУТЕР
    const footerMarginTop = 15 * SCALE_FACTOR; // Decreased slightly (25 -> 15)
    const footerTop = gridTop + gridHeight + footerMarginTop;

    // 5.1 Barcode (Left, 35% width)
    const barcodeWidth = CONTENT_WIDTH * 0.35;
    const barcodeHeight = 70 * SCALE_FACTOR; // Adjusted height (80 -> 70)
    const barcode = createBarcode(barcodeWidth, barcodeHeight, textColor);

    // Offset barcode down to align with visual top of text (Cap Height)
    const barcodeOffsetY = 10 * SCALE_FACTOR;

    barcode.set({
        left: PADDING_SIDE,
        top: footerTop + barcodeOffsetY
    });
    canvas.add(barcode);

    // 5.2 Name (Right, max 55% width)
    const nameText = createText(footerTextValue, 60 * SCALE_FACTOR, 'normal'); // Increased font size (50 -> 60)

    // Offset Name slightly down relative to Barcode
    const nameOffsetY = 0; // Moved up by 4px (was 4 * SCALE_FACTOR)

    nameText.set({
        name: 'footer-name', // Add tag for updates
        fontFamily: 'Arial Black', // Requested font
        fill: textColor, // Black color
        originX: 'right',
        originY: 'top', // Align top with barcode
        left: FULL_WIDTH - PADDING_SIDE,
        top: footerTop + nameOffsetY
    });

    // Auto-scale Name
    const maxNameWidth = CONTENT_WIDTH * 0.55;
    if (nameText.width! > maxNameWidth) {
        const scale = maxNameWidth / nameText.width!;
        nameText.set({ scaleX: scale, scaleY: scale });
    }

    canvas.add(nameText);

    // 5.3 Date (Below Barcode, max 70% of barcode width)
    const dateString = isSince ? `since ${footerDateValue}` : footerDateValue;
    const dateText = createText(dateString, 24 * SCALE_FACTOR, 'bold'); // Smaller font for date

    const dateTop = footerTop + barcodeOffsetY + barcodeHeight + (5 * SCALE_FACTOR); // 5px gap below barcode

    dateText.set({
        name: 'footer-date', // Add tag for updates
        fill: textColor,
        originX: 'left',
        originY: 'top',
        left: PADDING_SIDE,
        top: dateTop
    });

    // Force width to ALWAYS be 70% of barcode width
    const targetDateWidth = barcodeWidth * 0.7;
    if (dateText.width) {
        const scale = targetDateWidth / dateText.width;
        dateText.set({ scaleX: scale, scaleY: scale });
    }

    canvas.add(dateText);

    // 6. ИТОГОВАЯ ВЫСОТА
    // Need to include date height
    const dateHeight = dateText.height! * (dateText.scaleY || 1);
    const totalHeight = dateTop + dateHeight + (40 * SCALE_FACTOR); // Add some bottom padding
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