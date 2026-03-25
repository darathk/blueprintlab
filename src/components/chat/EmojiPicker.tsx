'use client';

import { useState, useRef, useEffect } from 'react';

const EMOJI_CATEGORIES: { name: string; icon: string; emojis: string[] }[] = [
    {
        name: 'Smileys',
        icon: '😀',
        emojis: [
            '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊',
            '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋',
            '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🫡',
            '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬',
            '🤥', '🫨', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
            '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸',
            '😎', '🤓', '🧐', '😕', '🫤', '😟', '🙁', '😮', '😯', '😲',
            '😳', '🥺', '🥹', '😦', '😧', '😨', '😰', '😥', '😢', '😭',
            '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡',
            '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺',
            '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽',
            '🙀', '😿', '😾', '🫶', '🙈', '🙉', '🙊',
        ]
    },
    {
        name: 'Gestures',
        icon: '👋',
        emojis: [
            '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '🫷',
            '🫸', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙',
            '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊',
            '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏',
            '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻',
            '👃', '👀', '👁️', '👅', '👄', '🫦', '🧠', '🫀', '🫁', '🦷',
            '🦴', '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩',
        ]
    },
    {
        name: 'Hearts',
        icon: '❤️',
        emojis: [
            '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
            '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝',
            '💟', '♥️', '💋', '💌', '💐', '🌹', '🥀', '🌺', '🌸', '💮',
        ]
    },
    {
        name: 'Fitness',
        icon: '💪',
        emojis: [
            '💪', '🏋️', '🏋️‍♂️', '🏋️‍♀️', '🤸', '🤸‍♂️', '🤸‍♀️', '⛹️', '🏃', '🏃‍♂️',
            '🏃‍♀️', '🚴', '🚴‍♂️', '🚴‍♀️', '🧘', '🧘‍♂️', '🧘‍♀️', '🤾', '🏊', '🏊‍♂️',
            '🏊‍♀️', '🤽', '🚣', '🧗', '🧗‍♂️', '🧗‍♀️', '🏇', '⛷️', '🏂', '🪂',
            '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🔥', '💯', '⚡', '🎯',
            '✅', '🙌', '👊', '✊', '🤜', '🤛', '👍', '🫡', '🦾', '🏃‍➡️',
        ]
    },
    {
        name: 'Food',
        icon: '🍕',
        emojis: [
            '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈',
            '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🫛',
            '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🧄', '🧅', '🫘',
            '🥔', '🍠', '🫚', '🥐', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳',
            '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟',
            '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🫕',
            '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🍤', '🍙', '🍚',
            '🍘', '🍥', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁',
            '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰',
        ]
    },
    {
        name: 'Animals',
        icon: '🐶',
        emojis: [
            '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨',
            '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
            '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
            '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞',
            '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍',
            '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠',
            '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍',
            '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬',
        ]
    },
    {
        name: 'Objects',
        icon: '⚽',
        emojis: [
            '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
            '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🪁',
            '🎣', '🤿', '🎽', '🎿', '🛷', '🥌', '🎮', '🕹️', '🎲', '🧩',
            '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺',
            '🪗', '🎸', '🪕', '🎻', '💊', '🩹', '🩺', '🩻', '🧬', '🔬',
            '🔭', '📡', '💻', '🖥️', '🖨️', '📱', '📲', '☎️', '📞', '💡',
        ]
    },
    {
        name: 'Symbols',
        icon: '💯',
        emojis: [
            '💯', '🔥', '⭐', '🌟', '✨', '⚡', '💥', '💫', '🎉', '🎊',
            '🎈', '🎁', '🎀', '🏷️', '💰', '💵', '💸', '✅', '❌', '❓',
            '❗', '‼️', '⁉️', '💤', '💬', '👁️‍🗨️', '🗨️', '💭', '🔔', '🔕',
            '🎵', '🎶', '🔊', '📢', '📣', '🔈', '🔉', '🔇', '⏰', '⏱️',
            '⏲️', '🕐', '♻️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎',
            '☯️', '☮️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍',
            '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🆗', '🆕',
        ]
    },
    {
        name: 'Flags',
        icon: '🏁',
        emojis: [
            '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️',
            '🇺🇸', '🇬🇧', '🇨🇦', '🇦🇺', '🇩🇪', '🇫🇷', '🇮🇹', '🇪🇸',
            '🇧🇷', '🇲🇽', '🇯🇵', '🇰🇷', '🇨🇳', '🇮🇳', '🇷🇺', '🇿🇦',
            '🇳🇬', '🇪🇬', '🇦🇷', '🇨🇴', '🇵🇪', '🇨🇱', '🇻🇪', '🇵🇹',
            '🇳🇱', '🇧🇪', '🇸🇪', '🇳🇴', '🇩🇰', '🇫🇮', '🇮🇪', '🇵🇱',
        ]
    },
];

interface EmojiPickerProps {
    onSelect: (emoji: string) => void;
    onClose: () => void;
    position?: 'above' | 'below';
}

export default function EmojiPicker({ onSelect, onClose, position = 'above' }: EmojiPickerProps) {
    const [activeCategory, setActiveCategory] = useState(0);
    const [search, setSearch] = useState('');
    const pickerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        searchRef.current?.focus();
    }, []);

    useEffect(() => {
        const handle = (e: MouseEvent | TouchEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handle);
        document.addEventListener('touchstart', handle);
        return () => {
            document.removeEventListener('mousedown', handle);
            document.removeEventListener('touchstart', handle);
        };
    }, [onClose]);

    const filteredEmojis = search
        ? EMOJI_CATEGORIES.flatMap(c => c.emojis)
        : EMOJI_CATEGORIES[activeCategory].emojis;

    return (
        <div
            ref={pickerRef}
            onClick={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            style={{
                position: 'absolute',
                [position === 'above' ? 'bottom' : 'top']: '100%',
                left: 0,
                right: 0,
                zIndex: 1000,
                background: '#1a1a24',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                width: 280,
                maxWidth: '90vw',
                animation: 'scaleIn 0.15s ease-out',
                overflow: 'hidden',
            }}
        >
            {/* Search */}
            <div style={{ padding: '8px 8px 4px' }}>
                <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search emoji..."
                    style={{
                        width: '100%',
                        padding: '6px 10px',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8,
                        color: 'var(--foreground)',
                        fontSize: 13,
                        outline: 'none',
                    }}
                />
            </div>

            {/* Category tabs */}
            {!search && (
                <div style={{
                    display: 'flex',
                    overflowX: 'auto',
                    padding: '4px 4px 0',
                    gap: 2,
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                }}>
                    {EMOJI_CATEGORIES.map((cat, i) => (
                        <button
                            key={cat.name}
                            onClick={() => setActiveCategory(i)}
                            style={{
                                fontSize: 16,
                                padding: '4px 6px',
                                background: i === activeCategory ? 'rgba(255,255,255,0.1)' : 'none',
                                border: 'none',
                                borderRadius: 6,
                                cursor: 'pointer',
                                flexShrink: 0,
                                borderBottom: i === activeCategory ? '2px solid var(--primary)' : '2px solid transparent',
                            }}
                            title={cat.name}
                        >
                            {cat.icon}
                        </button>
                    ))}
                </div>
            )}

            {/* Emoji grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 2,
                padding: 6,
                maxHeight: 220,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
            }}>
                {filteredEmojis.map((emoji, i) => (
                    <button
                        key={`${emoji}-${i}`}
                        onClick={() => { onSelect(emoji); onClose(); }}
                        style={{
                            fontSize: 22,
                            padding: 4,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            aspectRatio: '1',
                            transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </div>
    );
}
