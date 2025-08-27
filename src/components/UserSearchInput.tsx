import React, { useState, useEffect, useRef } from 'react';
import { useUserStore, type UserSearchResult } from '../stores/userStore';

interface UserSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (user: UserSearchResult) => void;
  placeholder?: string;
  className?: string;
}

const UserSearchInput: React.FC<UserSearchInputProps> = ({
  value,
  onChange,
  onSelect,
  placeholder = '이메일 또는 이름을 입력하세요',
  className = 'input'
}) => {
  const { users, loading, searchUsers, clearUsers } = useUserStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 디바운스를 위한 타이머
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 외부 클릭 감지
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setSearchQuery(newValue);

    // 디바운스: 300ms 후 검색
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (newValue.trim().length >= 1) {
      searchTimerRef.current = setTimeout(() => {
        searchUsers(newValue.trim()).then(() => {
          setShowDropdown(true);
        });
      }, 300);
    } else {
      clearUsers();
      setShowDropdown(false);
    }
  };

  const handleInputFocus = () => {
    if (value.trim().length >= 1 && users.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleUserSelect = (user: UserSearchResult) => {
    onChange(user.email);
    setShowDropdown(false);
    if (onSelect) {
      onSelect(user);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />

      {/* 로딩 표시 */}
      {loading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
        </div>
      )}

      {/* 드롭다운 */}
      {showDropdown && users.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {users.map((user, index) => (
            <button
              key={`${user.email}-${index}`}
              onClick={() => handleUserSelect(user)}
              className="w-full px-4 py-3 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none border-b border-gray-100 last:border-b-0"
            >
              <div className="flex flex-col">
                <div className="font-medium text-gray-900">{user.name}</div>
                <div className="text-sm text-gray-600">{user.email}</div>
                {user.position && (
                  <div className="text-xs text-gray-500 mt-1">
                    {user.position}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 검색 결과 없음 */}
      {showDropdown && !loading && users.length === 0 && searchQuery.trim().length >= 1 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg"
        >
          <div className="px-4 py-3 text-gray-500 text-center">
            검색 결과가 없습니다
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSearchInput; 