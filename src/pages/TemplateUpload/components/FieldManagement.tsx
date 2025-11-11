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
      {/*<div className="bg-white rounded-lg shadow p-4">*/}
      {/*  <h3 className="text-lg font-semibold mb-4">기본 폰트 설정</h3>*/}
      {/*  <div className="space-y-3">*/}
      {/*    <div>*/}
      {/*      <label className="block text-sm font-medium text-gray-700 mb-1">*/}
      {/*        폰트 패밀리*/}
      {/*      </label>*/}
      {/*      <select*/}
      {/*        value={defaultFontFamily}*/}
      {/*        onChange={(e) => onFontFamilyChange(e.target.value)}*/}
      {/*        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"*/}
      {/*      >*/}
      {/*        {availableFonts.map((font) => (*/}
      {/*          <option key={font} value={font} style={{ fontFamily: font }}>*/}
      {/*            {font}*/}
      {/*          </option>*/}
      {/*        ))}*/}
      {/*      </select>*/}
      {/*    </div>*/}
      {/*    <div>*/}
      {/*      <label className="block text-sm font-medium text-gray-700 mb-1">*/}
      {/*        폰트 크기 (px)*/}
      {/*      </label>*/}
      {/*      <input*/}
      {/*        type="number"*/}
      {/*        min="8"*/}
      {/*        max="72"*/}
      {/*        value={defaultFontSize}*/}
      {/*        onChange={(e) => onFontSizeChange(parseInt(e.target.value) || 16)}*/}
      {/*        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"*/}
      {/*      />*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*</div>*/}

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">필드 목록</h3>
          <p className="text-sm text-gray-500 mt-1">
            총 {fields.length}개 필드
          </p>
        </div>

        {/* 서명자 서명 필드 검증 경고 */}
        {(() => {
          const signerSignatureFields = fields.filter(field => 
            field.type === 'signer_signature' || field.type === 'reviewer_signature'
          );
          
          if (signerSignatureFields.length === 0) {
            return (
              <div className="p-4 bg-red-50 border-b border-red-200">
                <div className="flex items-start space-x-2">
                  <span className="text-red-600 text-lg mt-0.5">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-800">
                      서명자 서명 필드가 필요합니다
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      템플릿을 저장하려면 최소 1개 이상의 서명자 서명 필드를 추가해주세요.
                    </p>
                    <p className="text-xs text-red-600 mt-2 font-medium">
                      💡 PDF 영역을 드래그 → "서명자 서명"을 "필수 필드"로 선택
                    </p>
                  </div>
                </div>
              </div>
            );
          } else {
            return (
              <div className="p-3 bg-green-50 border-b border-green-200">
                <div className="flex items-center space-x-2">
                  <span className="text-green-600 text-base">✓</span>
                  <p className="text-xs text-green-800 font-medium">
                    서명자 서명 필드: {signerSignatureFields.length}개
                  </p>
                </div>
              </div>
            );
          }
        })()}

        <div className="max-h-96 overflow-y-auto">
          {fields.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p>아직 필드가 없습니다.</p>
              <p className="text-sm mt-1">PDF 위에서 클릭하여 필드를 추가하세요.</p>
            </div>
          ) : (() => {
            // 페이지별로 필드 그룹화
            const fieldsByPage: Record<number, TemplateField[]> = {};
            fields.forEach(field => {
              const page = field.page || 1;
              if (!fieldsByPage[page]) {
                fieldsByPage[page] = [];
              }
              fieldsByPage[page].push(field);
            });

            // 페이지 번호 순서대로 정렬
            const sortedPages = Object.keys(fieldsByPage)
              .map(Number)
              .sort((a, b) => a - b);

            return (
              <div>
                {sortedPages.map((pageNum) => (
                  <div key={pageNum} className="border-b last:border-b-0">
                    {/* 페이지 헤더 */}
                    <div className="bg-gray-50 px-3 py-2 sticky top-0 z-10">
                      <h4 className="text-sm font-semibold text-gray-700">
                        페이지 {pageNum} ({fieldsByPage[pageNum].length}개 필드)
                      </h4>
                    </div>

                    {/* 해당 페이지의 필드들 */}
                    <div className="divide-y">
                      {fieldsByPage[pageNum]
                        .sort((a, b) => {
                          // 필수값을 상단으로 정렬
                          if (a.required && !b.required) return -1;
                          if (!a.required && b.required) return 1;
                          return 0;
                        })
                        .map((field) => (
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
                                  field.type === 'table' ? 'bg-purple-500' :
                                  field.type === 'editor_signature' ? 'bg-blue-500' :
                                  field.type === 'reviewer_signature' ? 'bg-green-500' :
                                  field.type === 'signer_signature' ? 'bg-orange-500' : 'bg-gray-500'
                                }`}></span>
                                <p className="font-medium text-gray-800 truncate">
                                  {field.label}
                                </p>
                                {field.required && (
                                  <span className="text-red-500 text-xs font-semibold px-1.5 py-0.5 bg-red-50 rounded">필수</span>
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
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">사용 방법</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>1. PDF 위에서 클릭하여 필드 추가</li>
          <li>2. 필드를 드래그하여 위치 이동</li>
          <li>3. 필드 모서리를 드래그하여 크기 조절</li>
          <li>• 테이블 필드는 셀을 클릭하여 내용 편집</li>
        </ul>
      </div>
    </div>
  );
};

export default FieldManagement;