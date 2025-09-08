import React, { useState } from 'react';
import { ModalProps } from '../../types/common';

interface RejectModalProps extends ModalProps {
  onReject: (reason: string) => void;
}

const RejectModal: React.FC<RejectModalProps> = ({ isOpen, onClose, onReject }) => {
  const [reason, setReason] = useState('');

  const handleReject = () => {
    if (!reason.trim()) {
      alert('반려 사유를 입력해주세요.');
      return;
    }
    onReject(reason);
    setReason('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-800">❌ 문서 반려</h2>
          <p className="text-sm text-gray-600 mt-1">
            반려 사유를 입력해주세요
          </p>
        </div>

        <div className="p-6">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="반려 사유를 상세히 입력해주세요..."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          
          <div className="flex space-x-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleReject}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              반려
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RejectModal;