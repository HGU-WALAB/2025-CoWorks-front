import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useTemplateFields } from '../../hooks/useTemplateFields';
import { usePdfCanvas } from '../../hooks/usePdfCanvas';
import NewFieldModal from '../../components/modals/NewFieldModal';
import FieldEditModal from '../../components/modals/FieldEditModal';
import TableCellEditModal from '../../components/modals/TableCellEditModal';
import FolderSelector from '../../components/FolderSelector';
import FieldManagement from './components/FieldManagement';
import TemplatePreview from './components/TemplatePreview';
import { TemplateField } from '../../types/field';
import { runCoordinateTests } from '../../utils/coordinateDebugger';

const TemplateUpload: React.FC = () => {
  const navigate = useNavigate();
  const { id: templateId } = useParams<{ id: string }>();
  const isEditMode = !!templateId;
  
  const {
    fields,
    selectedField,
    addField,
    updateField,
    deleteField,
    selectField,
    setFields
  } = useTemplateFields();

  const {
    clearSelection,
    ...canvasProps
  } = usePdfCanvas();

  // Upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonData, setJsonData] = useState('');
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  
  // PDF preview states
  const [pdfImageDataUrl, setPdfImageDataUrl] = useState<string | null>(null);
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNewFieldModalOpen, setIsNewFieldModalOpen] = useState(false);
  const [isTableCellEditOpen, setIsTableCellEditOpen] = useState(false);
  const [newFieldPosition, setNewFieldPosition] = useState({ x: 0, y: 0 });
  const [newFieldSelection, setNewFieldSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  
  // Table editing
  const [editingCell, setEditingCell] = useState<{
    fieldId: string;
    row: number;
    col: number;
  } | null>(null);
  
  // Font settings
  const [defaultFontSize, setDefaultFontSize] = useState(12);
  const [defaultFontFamily, setDefaultFontFamily] = useState('Arial');
  
  const availableFonts = [
    'Arial', 'Times New Roman', 'Helvetica', 'Georgia',
    'Verdana', 'Tahoma', 'Trebuchet MS', 'Courier New',
    'Impact', 'Comic Sans MS'
  ];

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('PDF 파일만 업로드할 수 있습니다.');
      return;
    }
    
    setSelectedFile(file);
    setError(null);
    
    if (!templateName) {
      const nameWithoutExtension = file.name.replace(/\.pdf$/i, '');
      setTemplateName(nameWithoutExtension);
    }

    // PDF 선택 시 자동으로 이미지 변환
    
    setTimeout(() => {
      runCoordinateTests();
    }, 500);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post('/api/pdf/convert-to-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        responseType: 'blob'
      });
      
      // 변환된 이미지를 URL로 생성
      const imageBlob = new Blob([response.data], { type: 'image/png' });
      const imageUrl = URL.createObjectURL(imageBlob);
      setPdfImageDataUrl(imageUrl);
      
      console.log('📐 PDF 이미지 변환 완료:', { imageUrl });
    } catch (error) {
      console.error('PDF 변환 실패:', error);
      // 실패 시에도 에러를 표시하지 않고 조용히 처리
      console.log('PDF 변환에 실패했지만 계속 진행합니다.');
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      setError('템플릿 이름을 입력해주세요.');
      return;
    }

    // 새 템플릿 생성 시에는 PDF 파일이 필수
    if (!selectedFile && !isEditMode) {
      setError('PDF 파일을 선택해주세요.');
      return;
    }

    // 편집 모드에서는 기존 PDF가 있거나 새 파일이 있어야 함
    if (isEditMode && !selectedFile && !pdfImageDataUrl) {
      setError('PDF 파일이 없습니다. 새 PDF 파일을 업로드해주세요.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      let templateData: any = {
        name: templateName,
        description,
        coordinateFields: JSON.stringify(fields),
        defaultFolderId: selectedFolderId
      };

      if (selectedFile) {
        // 새 파일이 선택된 경우 (생성 모드 또는 편집 모드에서 파일 교체)
        const formData = new FormData();
        Object.keys(templateData).forEach(key => {
          formData.append(key, templateData[key]);
        });
        formData.append('file', selectedFile);
        
        if (isEditMode) {
          console.log('🔄 편집 모드: 새 PDF 파일로 업데이트');
          await axios.put(`/api/templates/${templateId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } else {
          console.log('📄 생성 모드: 새 템플릿 생성');
          await axios.post('/api/templates/upload-pdf', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
      } else if (isEditMode) {
        // 편집 모드에서 파일 변경 없이 메타데이터만 업데이트
        console.log('📝 편집 모드: 메타데이터만 업데이트');
        await axios.put(`/api/templates/${templateId}`, templateData, {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      alert(isEditMode ? '템플릿이 수정되었습니다.' : '템플릿이 생성되었습니다.');
      navigate('/templates');
    } catch (error) {
      console.error('템플릿 저장 실패:', error);
      setError('템플릿 저장에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleFieldEdit = (field: TemplateField) => {
    selectField(field.id);
    setIsEditModalOpen(true);
  };

  const handleFieldSave = (updatedField: TemplateField) => {
    updateField(updatedField.id, updatedField);
    setIsEditModalOpen(false);
  };

  const handleFieldDelete = () => {
    if (selectedField) {
      deleteField(selectedField.id);
      setIsEditModalOpen(false);
    }
  };

  const handleNewField = (field: TemplateField) => {
    addField(field);
    clearSelection();
  };

  const openTableCellEdit = (fieldId: string, row: number, col: number) => {
    setEditingCell({ fieldId, row, col });
    setIsTableCellEditOpen(true);
  };

  const handleTableCellSave = (text: string) => {
    if (!editingCell) return;
    
    const field = fields.find(f => f.id === editingCell.fieldId);
    if (!field?.tableData) return;

    const updatedCells = field.tableData.cells.map((row: string[], rIdx: number) =>
      rIdx === editingCell.row 
        ? row.map((cell: string, cIdx: number) => 
            cIdx === editingCell.col ? text : cell
          )
        : row
    );

    updateField(field.id, {
      tableData: { ...field.tableData, cells: updatedCells }
    });
    
    setIsTableCellEditOpen(false);
    setEditingCell(null);
  };

  // 편집 모드일 때 기존 템플릿 데이터 로드
  useEffect(() => {
    const loadTemplateForEdit = async () => {
      if (isEditMode && templateId) {
        setLoadingTemplate(true);
        try {
          console.log('🔧 템플릿 편집 모드 - 기존 데이터 로드 시작:', templateId);
          const response = await axios.get(`/api/templates/${templateId}`);
          const template = response.data;
          
          console.log('📋 로드된 템플릿 데이터:', template);
          
          // 기본 정보 설정
          setTemplateName(template.name || '');
          setDescription(template.description || '');
          setSelectedFolderId(template.defaultFolderId || null);
          
          console.log('📁 기본 폴더 설정:', template.defaultFolderId, template.defaultFolderName);
          
          // PDF 이미지 경로 설정
          if (template.pdfImagePath) {
            const imageFileName = template.pdfImagePath.split('/').pop()?.replace('.pdf', '.png') || '';
            const fullImagePath = `/uploads/pdf-templates/${imageFileName}`;
            setPdfImageDataUrl(fullImagePath);
            console.log('🖼️ PDF 이미지 경로 설정:', fullImagePath);
          }
          
          // 필드 데이터 파싱 및 설정
          if (template.coordinateFields) {
            try {
              const parsedFields = typeof template.coordinateFields === 'string' 
                ? JSON.parse(template.coordinateFields)
                : template.coordinateFields;
              
              console.log('📐 파싱된 필드 데이터:', parsedFields);
              
              if (Array.isArray(parsedFields)) {
                setFields(parsedFields);
                // JSON 데이터도 자동으로 표시
                setJsonData(JSON.stringify(parsedFields, null, 2));
              }
            } catch (fieldParseError) {
              console.error('❌ 필드 데이터 파싱 실패:', fieldParseError);
            }
          }
          
        } catch (error) {
          console.error('❌ 템플릿 로드 실패:', error);
          setError('템플릿을 불러오는데 실패했습니다.');
        } finally {
          setLoadingTemplate(false);
        }
      }
    };

    loadTemplateForEdit();
  }, [isEditMode, templateId, setFields]);

  // PDF Object URL 정리를 위한 useEffect
  useEffect(() => {
    return () => {
      if (pdfImageDataUrl) {
        URL.revokeObjectURL(pdfImageDataUrl);
      }
    };
  }, [pdfImageDataUrl]);

  // JSON 데이터 가져오기 함수
  const handleJsonImport = () => {
    if (!jsonData.trim()) {
      setError('JSON 데이터를 입력해주세요.');
      return;
    }

    try {
      const parsedData = JSON.parse(jsonData);
      if (Array.isArray(parsedData)) {
        // JSON 데이터를 TemplateField 형태로 변환
        const convertedFields = parsedData.map((item, index) => ({
          id: item.id || `field_${Date.now()}_${index}`,
          label: item.label || item.name || `필드 ${index + 1}`,
          type: item.type || 'text',
          x: item.x || 0,
          y: item.y || 0,
          width: item.width || 100,
          height: item.height || 30,
          required: item.required || false,
          fontSize: item.fontSize || 12,
          fontFamily: item.fontFamily || 'Arial',
          // 테이블 데이터가 있으면 포함
          ...(item.tableData && { tableData: item.tableData })
        }));
        
        // 기존 필드를 모두 제거하고 새로운 필드들로 대체
        setFields(convertedFields);
        setJsonData(''); // 성공 후 입력 창 클리어
        setError(null);
        console.log('JSON 데이터 가져오기 성공:', convertedFields);
      } else {
        setError('JSON 데이터는 배열 형태여야 합니다.');
      }
    } catch (error) {
      console.error('JSON 파싱 오류:', error);
      setError('올바른 JSON 형식이 아닙니다.');
    }
  };

  // 현재 필드를 JSON으로 내보내기
  const handleJsonExport = () => {
    const fieldsJson = JSON.stringify(fields, null, 2);
    setJsonData(fieldsJson);
  };

  // 로딩 상태 표시
  if (loadingTemplate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600">템플릿 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 py-6 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            {isEditMode ? '템플릿 편집' : '새 템플릿 생성'}
          </h1>
          <div className="flex space-x-3">
            <button
              onClick={() => navigate('/templates')}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              뒤로
            </button>
            <button
              onClick={handleSaveTemplate}
              disabled={uploading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {uploading ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        {/* PDF 업로드 및 기본 정보 섹션 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">기본 정보</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PDF 업로드 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PDF 파일 *
              </label>
              <div
                className="relative border-2 border-dashed rounded-lg p-6 text-center transition-colors hover:border-gray-400"
                onDragEnter={(e) => e.preventDefault()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-2">
                  <div className="text-2xl">📄</div>
                  {isEditMode && pdfImageDataUrl && !selectedFile ? (
                    // 편집 모드에서 기존 PDF가 있는 경우
                    <div>
                      <p className="text-sm text-green-600 font-medium">
                        ✅ 기존 PDF 파일이 업로드되어 있습니다
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        새 PDF 파일을 선택하면 기존 파일을 교체할 수 있습니다
                      </p>
                    </div>
                  ) : (
                    // 새 파일 업로드 또는 파일 선택된 경우
                    <div>
                      <p className="text-sm text-gray-600">
                        {selectedFile ? selectedFile.name : 'PDF 파일을 선택하거나 드래그하세요'}
                      </p>
                      {selectedFile && (
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 템플릿 정보 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  템플릿 이름 *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: 계약서 템플릿, 신청서 양식 등"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  폴더
                </label>
                <FolderSelector
                  selectedFolderId={selectedFolderId}
                  onFolderSelect={setSelectedFolderId}
                  placeholder="이 템플릿으로 생성한 문서가 담길 폴더를 선택해주세요"
                  allowRoot={true}
                />
                <p className="text-xs text-gray-500 mt-1">
                  이 템플릿으로 문서를 생성할 때 선택한 폴더에 자동으로 저장됩니다.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  설명
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="이 템플릿의 용도나 특징을 간단히 설명해주세요"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-4">
            <TemplatePreview
              pdfImageUrl={pdfImageDataUrl}
              fields={fields}
              selectedFieldId={selectedField?.id || null}
              onFieldClick={handleFieldEdit}
              onFieldMove={updateField}
              onFieldResize={updateField}
              onTableCellClick={openTableCellEdit}
              onCanvasClick={(selection) => {
                setNewFieldPosition({ x: selection.x, y: selection.y });
                setNewFieldSelection(selection);
                setIsNewFieldModalOpen(true);
              }}
              {...canvasProps}
            />
          </div>
          
          <div className="lg:col-span-1">
            <FieldManagement
              fields={fields}
              selectedFieldId={selectedField?.id || null}
              onFieldSelect={(fieldId) => selectField(fieldId)}
              onFieldEdit={handleFieldEdit}
              onFieldDelete={(fieldId) => deleteField(fieldId)}
              defaultFontSize={defaultFontSize}
              defaultFontFamily={defaultFontFamily}
              availableFonts={availableFonts}
              onFontSizeChange={setDefaultFontSize}
              onFontFamilyChange={setDefaultFontFamily}
            />
          </div>
        </div>
      </div>

      <NewFieldModal
        isOpen={isNewFieldModalOpen}
        onClose={() => {
          setIsNewFieldModalOpen(false);
          setNewFieldSelection(null);
        }}
        onSave={handleNewField}
        initialPosition={newFieldPosition}
        selectionBox={newFieldSelection}
        defaultFontSize={defaultFontSize}
        defaultFontFamily={defaultFontFamily}
      />

      <FieldEditModal
        field={selectedField}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleFieldSave}
        onDelete={handleFieldDelete}
        availableFonts={availableFonts}
      />

      {editingCell && (
        <TableCellEditModal
          isOpen={isTableCellEditOpen}
          onClose={() => {
            setIsTableCellEditOpen(false);
            setEditingCell(null);
          }}
          onSave={handleTableCellSave}
          currentText={
            fields.find(f => f.id === editingCell.fieldId)?.tableData?.cells[editingCell.row]?.[editingCell.col] || ''
          }
          cellPosition={{ row: editingCell.row, col: editingCell.col }}
          tableName={fields.find(f => f.id === editingCell.fieldId)?.label || ''}
        />
      )}
    </div>
  );
};

export default TemplateUpload;