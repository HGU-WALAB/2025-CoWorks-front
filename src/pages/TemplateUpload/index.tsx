import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useTemplateFields } from '../../hooks/useTemplateFields';
import { usePdfCanvas } from '../../hooks/usePdfCanvas';
import NewFieldModal from '../../components/modals/NewFieldModal';
import FieldEditModal from '../../components/modals/FieldEditModal';
import TableCellEditModal from '../../components/modals/TableCellEditModal';
import PdfUploader from './components/PdfUploader';
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
    selectionBox,
    clearSelection,
    ...canvasProps
  } = usePdfCanvas();

  // Upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'edit'>('upload');
  
  // PDF preview states
  const [pdfImageUrl, setPdfImageUrl] = useState<string | null>(null);
  const [pdfImageDataUrl, setPdfImageDataUrl] = useState<string | null>(null);
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNewFieldModalOpen, setIsNewFieldModalOpen] = useState(false);
  const [isTableCellEditOpen, setIsTableCellEditOpen] = useState(false);
  const [newFieldPosition, setNewFieldPosition] = useState({ x: 0, y: 0 });
  
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

    setStep('edit');
    
    setTimeout(() => {
      runCoordinateTests();
    }, 500);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post('/api/pdf/convert-to-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.success && response.data.imageUrl) {
        setPdfImageDataUrl(response.data.imageUrl);
      }
    } catch (error) {
      console.error('PDF 변환 실패:', error);
      setError('PDF 변환에 실패했습니다.');
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      setError('템플릿 이름을 입력해주세요.');
      return;
    }

    if (!selectedFile && !isEditMode) {
      setError('PDF 파일을 선택해주세요.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      let templateData: any = {
        name: templateName,
        description,
        coordinateFields: JSON.stringify(fields)
      };

      if (selectedFile) {
        const formData = new FormData();
        Object.keys(templateData).forEach(key => {
          formData.append(key, templateData[key]);
        });
        formData.append('file', selectedFile);
        
        if (isEditMode) {
          await axios.put(`/api/templates/${templateId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } else {
          await axios.post('/api/templates', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
      } else if (isEditMode) {
        await axios.put(`/api/templates/${templateId}`, templateData, {
          headers: { 'Content-Type': 'application/json' }
        });
      }

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

  if (step === 'upload') {
    return (
      <PdfUploader
        selectedFile={selectedFile}
        templateName={templateName}
        description={description}
        error={error}
        onFileSelect={handleFileSelect}
        onTemplateNameChange={setTemplateName}
        onDescriptionChange={setDescription}
        onBack={() => navigate('/templates')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            {isEditMode ? '템플릿 편집' : '새 템플릿 생성'}
          </h1>
          <div className="flex space-x-3">
            <button
              onClick={() => setStep('upload')}
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <TemplatePreview
              pdfImageUrl={pdfImageDataUrl}
              fields={fields}
              selectedFieldId={selectedField?.id || null}
              onFieldClick={handleFieldEdit}
              onFieldMove={updateField}
              onFieldResize={updateField}
              onTableCellClick={openTableCellEdit}
              onCanvasClick={(position) => {
                setNewFieldPosition(position);
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
        onClose={() => setIsNewFieldModalOpen(false)}
        onSave={handleNewField}
        initialPosition={newFieldPosition}
        selectionBox={selectionBox}
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