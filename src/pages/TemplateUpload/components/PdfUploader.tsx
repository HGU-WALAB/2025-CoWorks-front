import React, { useState } from 'react';

interface PdfUploaderProps {
  selectedFile: File | null;
  templateName: string;
  description: string;
  error: string | null;
  onFileSelect: (file: File) => void;
  onTemplateNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onBack: () => void;
}

const PdfUploader: React.FC<PdfUploaderProps> = ({
  selectedFile,
  templateName,
  description,
  error,
  onFileSelect,
  onTemplateNameChange,
  onDescriptionChange,
  onBack
}) => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-6">
          <div
            className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              dragActive
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 text-gray-400">
                📄
              </div>
              <div>
                <p className="text-lg font-medium text-gray-700">
                  PDF 파일을 드래그하거나 클릭하여 선택하세요
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  업로드된 PDF는 템플릿의 배경으로 사용됩니다
                </p>
              </div>
            </div>
          </div>

          {selectedFile && (
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">📄</div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => onFileSelect(null as any)}
                  className="text-red-500 hover:text-red-700 text-sm font-medium"
                >
                  제거
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                템플릿 이름 *
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => onTemplateNameChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: 계약서 템플릿, 신청서 양식 등"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                설명 (선택사항)
              </label>
              <textarea
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="이 템플릿의 용도나 특징을 간단히 설명해주세요"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfUploader;