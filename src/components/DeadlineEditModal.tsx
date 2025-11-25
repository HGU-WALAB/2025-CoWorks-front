import React, { useState, useEffect } from 'react';

interface DeadlineEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (deadline: string | null) => Promise<void>;
  loading: boolean;
  currentDeadline?: string;
  documentTitle: string;
}

const DeadlineEditModal: React.FC<DeadlineEditModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  loading,
  currentDeadline,
  documentTitle
}) => {
  const [deadline, setDeadline] = useState('');
  const [hasDeadline, setHasDeadline] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (currentDeadline) {
        // ISO 문자열을 datetime-local 형식으로 변환
        const date = new Date(currentDeadline);
        const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setDeadline(localDateTime);
        setHasDeadline(true);
      } else {
        setDeadline('');
        setHasDeadline(false);
      }
    }
  }, [isOpen, currentDeadline]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (hasDeadline && !deadline.trim()) {
      alert('만료일을 입력해주세요.');
      return;
    }

    try {
      // deadline이 있고 hasDeadline이 true면 ISO 문자열로 변환, 아니면 null
      const deadlineValue = hasDeadline && deadline ? new Date(deadline).toISOString() : null;
      await onSubmit(deadlineValue);
      onClose();
    } catch (error) {
      console.error('만료일 수정 오류:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">만료일 수정</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
            disabled={loading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-3">
              <span className="font-medium">문서:</span> {documentTitle}
            </p>

            <div className="flex items-center mb-3">
              <input
                type="checkbox"
                id="hasDeadline"
                checked={hasDeadline}
                onChange={(e) => setHasDeadline(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                disabled={loading}
              />
              <label htmlFor="hasDeadline" className="ml-2 text-sm text-gray-700">
                만료일 설정
              </label>
            </div>

            {hasDeadline && (
              <div>
                <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-1">
                  만료일 *
                </label>
                <input
                  type="datetime-local"
                  id="deadline"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading}
                  required={hasDeadline}
                />
              </div>
            )}

            {!hasDeadline && (
              <p className="text-sm text-gray-500 italic">
                만료일을 설정하지 않으면 기한이 없는 문서가 됩니다.
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                loading
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  수정 중...
                </span>
              ) : (
                '수정'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeadlineEditModal;
