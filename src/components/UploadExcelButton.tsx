import React, { useState } from 'react';
import UploadExcelModal from './UploadExcelModal';

interface UploadExcelButtonProps {
  templateId: string;
  onUploadComplete?: () => void;
}

const UploadExcelButton: React.FC<UploadExcelButtonProps> = ({ 
  templateId, 
  onUploadComplete 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = () => {
    if (!templateId) {
      alert('먼저 템플릿을 선택해주세요.');
      return;
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleUploadComplete = () => {
    setIsModalOpen(false);
    if (onUploadComplete) {
      onUploadComplete();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpenModal}
        disabled={!templateId}
        className={`
          inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg
          transition-colors duration-200
          ${templateId
            ? 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        <svg 
          className="w-4 h-4 mr-2" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" 
          />
        </svg>
        엑셀 업로드
      </button>

      {isModalOpen && (
        <UploadExcelModal
          templateId={templateId}
          onClose={handleCloseModal}
          onUploadComplete={handleUploadComplete}
        />
      )}
    </>
  );
};

export default UploadExcelButton;
