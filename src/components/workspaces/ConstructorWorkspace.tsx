import React from 'react';
import { type TemplateType } from '../../utils/TemplateGenerators';
import { LayoutDashboard, BookHeart, SquareParking, SquareUser, Volleyball, PenTool, Hammer, Construction, Shirt, ArrowDownToLine } from 'lucide-react';

interface ConstructorWorkspaceProps {
    onSwitchTemplate: (template: TemplateType) => void;
    onOpenMockup: () => void;
    mockupPrintCount?: number;
}

export const ConstructorWorkspace: React.FC<ConstructorWorkspaceProps> = ({ onSwitchTemplate, onOpenMockup, mockupPrintCount }) => {
    return (
        <div className="h-screen bg-slate-100 flex flex-col overflow-hidden" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            {/* --- SIDEBAR --- */}
            <aside className="sidebar-panel">
                <div className="flex justify-center">
                    <img src="/logo.png" alt="Logo" className="w-[90px] opacity-80 drop-shadow-xl object-contain" />
                </div>

                {/* Workspace Switcher */}
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
                            className={`w-[44px] h-[44px] flex items-center justify-center rounded-xl cursor-pointer group relative transition-all duration-200 ease-out transform-gpu will-change-transform [backface-visibility:hidden] active:scale-90 active:translate-y-0 ${item.id === 'constructor' ? 'bg-zinc-900 text-white shadow-md' : 'bg-white/40 border border-zinc-900/10 shadow-sm text-zinc-600 hover:-translate-y-0.5 hover:bg-white/80 hover:shadow-md hover:border-zinc-300 hover:text-zinc-900 active:bg-zinc-200 active:border-zinc-200 active:shadow-none'}`}
                            title={item.label}
                        >
                            <item.icon className="w-[18px] h-[18px] transform-gpu will-change-transform antialiased [backface-visibility:hidden] [transform:translateZ(0)]" />
                        </button>
                    ))}
                </div>

                <div className="pt-6 border-t border-zinc-200/50 mt-auto">
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            disabled
                            className="h-12 bg-white/50 border border-zinc-200/50 text-zinc-400 rounded-xl font-bold text-sm shadow-none cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Shirt className="w-4 h-4" />
                            На макет
                        </button>
                        <button
                            disabled
                            className="h-12 bg-zinc-900/50 text-white/50 rounded-xl font-bold text-sm shadow-none cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <ArrowDownToLine className="w-4 h-4" />
                            Скачать
                        </button>
                    </div>
                </div>
            </aside>

            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
                <div className="fixed top-6 right-6 flex gap-3 z-[100] items-center">
                    <button
                        onClick={onOpenMockup}
                        className="relative group w-14 h-14 bg-white/90 backdrop-blur-md border border-zinc-200/50 rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center cursor-pointer overflow-visible"
                        title="Перейти к макету"
                    >
                        <Shirt className="w-6 h-6 text-zinc-700 group-hover:text-zinc-900 transition-colors" opacity={0.8} strokeWidth={1.5} />
                        <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-zinc-900 text-white text-xs font-bold flex items-center justify-center rounded-full shadow-md border-2 border-white transform scale-100 group-hover:scale-110 transition-transform">
                            {mockupPrintCount || 0}
                        </div>
                    </button>
                </div>
                {/* Decorative Background Elements */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
                    <div className="absolute -top-20 -right-20 w-96 h-96 bg-blue-200/50 rounded-full blur-3xl animate-blob"></div>
                    <div className="absolute top-40 left-20 w-72 h-72 bg-purple-200/50 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
                </div>

                <div className="relative z-10 text-center max-w-lg mx-auto bg-white/60 backdrop-blur-xl p-12 rounded-3xl border border-white/50 shadow-2xl">
                    <div className="inline-flex items-center justify-center w-20 h-20 mb-8 bg-zinc-900 text-white rounded-2xl shadow-lg rotate-3 transition-transform hover:rotate-6 hover:scale-105 cursor-default">
                        <Hammer className="w-10 h-10" strokeWidth={1.5} />
                    </div>

                    <h1 className="text-3xl font-bold text-zinc-800 mb-8 tracking-tight">Раздел в разработке</h1>


                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-full text-zinc-500 text-sm font-medium border border-zinc-200">
                        <Construction className="w-4 h-4" />
                        <span>Скоро</span>
                    </div>
                </div>
            </main>
        </div>
    );
};
