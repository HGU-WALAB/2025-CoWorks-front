import React, { useEffect, useRef } from 'react';

export interface ContextMenuOption {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  dangerous?: boolean;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  isVisible: boolean;
  options: ContextMenuOption[];
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  isVisible,
  options,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  // 메뉴가 화면 밖으로 나가지 않도록 조정
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - (options.length * 40 + 16));

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-md shadow-lg border border-gray-200 py-2 min-w-48"
      style={{
        left: adjustedX,
        top: adjustedY,
      }}
    >
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => {
            if (!option.disabled) {
              option.onClick();
              onClose();
            }
          }}
          disabled={option.disabled}
          className={`
            w-full px-4 py-2 text-left text-sm flex items-center space-x-3 transition-colors
            ${option.disabled 
              ? 'text-gray-400 cursor-not-allowed' 
              : option.dangerous
                ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
                : 'text-gray-700 hover:bg-gray-100'
            }
          `}
        >
          <span className="flex-shrink-0">{option.icon}</span>
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
};

export default ContextMenu;