import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X } from 'lucide-react';

interface SortablePhotoProps {
    id: string;
    url: string;
    index: number;
    onRemove: () => void;
}

export const SortablePhoto: React.FC<SortablePhotoProps> = ({ id, url, index, onRemove }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 'auto',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="relative aspect-square rounded-xl overflow-hidden cursor-move group hover:ring-2 ring-blue-500 touch-none"
        >
            <img src={url} className="w-full h-full object-cover pointer-events-none" alt="" />
            <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                {index}
            </div>
            <button
                onPointerDown={(e) => e.stopPropagation()} // Prevent drag start on button click
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
                className="absolute top-1 right-1 bg-black/50 hover:bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
};
