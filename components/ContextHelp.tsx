
import React, { useState } from 'react';
import { HelpCircle, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ContextHelpProps {
    title: string;
    description: string;
    linkTarget: string; // e.g., "creating-requests"
    className?: string;
}

const ContextHelp = ({ title, description, linkTarget, className = '' }: ContextHelpProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();

    const handleNavigate = () => {
        // Navigate to help page with hash
        navigate(`/help?section=${linkTarget}`);
    };

    return (
        <div className={`relative inline-block ${className}`}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="text-gray-400 hover:text-[var(--color-brand)] transition-colors p-1"
                aria-label="Get help for this section"
            >
                <HelpCircle size={18} />
            </button>

            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 z-40 cursor-default" 
                        onClick={() => setIsOpen(false)}
                    ></div>
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 w-64 bg-white dark:bg-[#2b2d3b] rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50 animate-fade-in text-left">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-gray-900 dark:text-white text-sm">{title}</h4>
                            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-500">
                                <X size={14} />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
                            {description}
                        </p>
                        <button 
                            onClick={handleNavigate}
                            className="text-xs font-bold text-[var(--color-brand)] flex items-center gap-1 hover:underline hover:gap-2 transition-all"
                        >
                            Read Guide <ArrowRight size={12} />
                        </button>
                        
                        {/* Triangle Arrow */}
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-[#2b2d3b] border-t border-l border-gray-200 dark:border-gray-700 transform rotate-45"></div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ContextHelp;
