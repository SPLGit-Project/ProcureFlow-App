import { useState, useMemo } from 'react';
import { X, RefreshCw, Check } from 'lucide-react';

// Professional DiceBear avatar styles for enterprise use
const AVATAR_STYLES = [
    { id: 'initials', label: 'Initials' },
    { id: 'avataaars', label: 'Portraits' },
    { id: 'notionists', label: 'Minimalist' },
    { id: 'shapes', label: 'Geometric' },
] as const;

// Seed words used to generate unique avatar variations
const SEED_WORDS = [
    'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel',
    'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa',
    'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'Zulu',
    'Amber', 'Blaze', 'Cedar', 'Dawn', 'Elm', 'Fern', 'Glacier', 'Harbor',
    'Iris', 'Jasper', 'Kelp', 'Lark', 'Moss', 'Nova', 'Opal', 'Pine',
];

const buildAvatarUrl = (style: string, seed: string) =>
    `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;

interface AvatarPickerProps {
    currentAvatar: string;
    userName: string;
    onSelect: (url: string) => void;
}

const AvatarPicker = ({ currentAvatar, userName, onSelect }: AvatarPickerProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeStyle, setActiveStyle] = useState('initials');
    const [seedOffset, setSeedOffset] = useState(0);

    const VISIBLE_COUNT = 24;

    // Generate avatar options for the selected style
    const avatarOptions = useMemo(() => {
        // Always put user's name as the first seed
        const userNameSeed = userName || 'User';
        const seeds = [userNameSeed];
        
        // Add offset-adjusted seed words
        for (let i = 0; i < VISIBLE_COUNT - 1; i++) {
            const idx = (i + seedOffset) % SEED_WORDS.length;
            const word = SEED_WORDS[idx];
            if (word !== userNameSeed) seeds.push(word);
        }
        
        return seeds.slice(0, VISIBLE_COUNT).map(seed => ({
            seed,
            url: buildAvatarUrl(activeStyle, seed),
        }));
    }, [activeStyle, seedOffset, userName]);

    const displayAvatar = currentAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'U')}&background=random`;

    const handleShuffle = () => {
        setSeedOffset(prev => (prev + VISIBLE_COUNT) % SEED_WORDS.length);
    };

    return (
        <>
            {/* Current Avatar Display */}
            <div className="relative group">
                <img 
                    src={displayAvatar} 
                    className="w-32 h-32 rounded-3xl object-cover bg-gray-100 dark:bg-white/5 border-2 border-gray-200 dark:border-gray-800 shadow-lg cursor-pointer hover:border-[var(--color-brand)] transition-all"
                    alt="Profile avatar"
                    onClick={() => setIsOpen(true)}
                />
                <button 
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="absolute bottom-2 right-2 p-2 bg-white dark:bg-[#15171e] rounded-xl shadow-md border border-gray-200 dark:border-gray-700 text-secondary dark:text-gray-500 hover:text-[var(--color-brand)] transition-colors"
                    title="Change avatar"
                >
                    <RefreshCw size={14}/>
                </button>
                <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2 font-medium">Click to change</p>
            </div>

            {/* Avatar Picker Modal */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/50 dark:bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-[#1e2029] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-800" onClick={e => e.stopPropagation()}>
                        
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Choose Your Avatar</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Select from the gallery below or shuffle for more options</p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        {/* Style Tabs */}
                        <div className="px-6 pt-4 pb-2">
                            <div className="flex flex-wrap gap-1.5">
                                {AVATAR_STYLES.map(style => (
                                    <button
                                        key={style.id}
                                        type="button"
                                        onClick={() => { setActiveStyle(style.id); setSeedOffset(0); }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            activeStyle === style.id 
                                                ? 'bg-[var(--color-brand)] text-white shadow-md shadow-[var(--color-brand)]/20' 
                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        {style.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Avatar Grid */}
                        <div className="flex-1 overflow-y-auto p-6 pt-3">
                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                                {avatarOptions.map((opt) => {
                                    const isSelected = currentAvatar === opt.url;
                                    return (
                                        <button
                                            key={`${activeStyle}-${opt.seed}`}
                                            type="button"
                                            onClick={() => {
                                                onSelect(opt.url);
                                                setIsOpen(false);
                                            }}
                                            className={`relative rounded-2xl p-1 transition-all hover:scale-110 ${
                                                isSelected 
                                                    ? 'ring-3 ring-[var(--color-brand)] ring-offset-2 dark:ring-offset-[#1e2029] bg-[var(--color-brand)]/10' 
                                                    : 'hover:ring-2 hover:ring-gray-300 dark:hover:ring-gray-600 hover:ring-offset-2 dark:hover:ring-offset-[#1e2029]'
                                            }`}
                                            title={opt.seed}
                                        >
                                            <img 
                                                src={opt.url} 
                                                alt={opt.seed}
                                                className="w-full aspect-square rounded-xl object-cover bg-gray-100 dark:bg-gray-800"
                                                loading="lazy"
                                            />
                                            {isSelected && (
                                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--color-brand)] rounded-full flex items-center justify-center shadow-md">
                                                    <Check size={12} className="text-white" />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 rounded-b-2xl">
                            <button
                                type="button"
                                onClick={handleShuffle}
                                className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-colors flex items-center gap-2"
                            >
                                <RefreshCw size={14} />
                                Shuffle
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="px-5 py-2 text-sm font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AvatarPicker;
