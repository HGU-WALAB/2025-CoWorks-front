import React from 'react';
import { TemplateField } from '../../../types/field';

interface FieldManagementProps {
  fields: TemplateField[];
  selectedFieldId: string | null;
  onFieldSelect: (fieldId: string) => void;
  onFieldEdit: (field: TemplateField) => void;
  onFieldDelete: (fieldId: string) => void;
  defaultFontSize: number;
  defaultFontFamily: string;
  availableFonts: string[];
  onFontSizeChange: (size: number) => void;
  onFontFamilyChange: (family: string) => void;
}

const FieldManagement: React.FC<FieldManagementProps> = ({
  fields,
  selectedFieldId,
  onFieldSelect,
  onFieldEdit,
  onFieldDelete,
  defaultFontSize,
  defaultFontFamily,
  availableFonts,
  onFontSizeChange,
  onFontFamilyChange
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">기본 폰트 설정</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              폰트 패밀리
            </label>
            <select
              value={defaultFontFamily}
              onChange={(e) => onFontFamilyChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              {availableFonts.map((font) => (
                <option key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              폰트 크기 (px)
            </label>
            <input
              type="number"
              min="8"
              max="72"
              value={defaultFontSize}
              onChange={(e) => onFontSizeChange(parseInt(e.target.value) || 12)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">필드 목록</h3>
          <p className="text-sm text-gray-500 mt-1">
            총 {fields.length}개 필드
          </p>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {fields.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p>아직 필드가 없습니다.</p>
              <p className="text-sm mt-1">PDF 위에서 클릭하여 필드를 추가하세요.</p>
            </div>
          ) : (
            <div className="divide-y">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className={`p-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                    selectedFieldId === field.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                  onClick={() => onFieldSelect(field.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          field.type === 'table' ? 'bg-purple-500' : 'bg-blue-500'
                        }`}></span>
                        <p className="font-medium text-gray-800 truncate">
                          {field.label}
                        </p>
                        {field.required && (
                          <span className="text-red-500 text-xs">*</span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-1 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onFieldEdit(field);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 text-sm"
                        title="편집"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('이 필드를 삭제하시겠습니까?')) {
                            onFieldDelete(field.id);
                          }
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 text-sm"
                        title="삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">사용 방법</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• PDF 위에서 클릭하여 새 필드 추가</li>
          <li>• 필드를 드래그하여 위치 이동</li>
          <li>• 필드 모서리를 드래그하여 크기 조절</li>
          <li>• 테이블 필드는 셀을 클릭하여 내용 편집</li>
        </ul>
      </div>
    </div>
  );
};

export default FieldManagement;