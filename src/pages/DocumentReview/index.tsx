import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../../stores/documentStore';
import { useAuthStore } from '../../stores/authStore';
import RejectModal from '../../components/modals/RejectModal';
import { SignatureModal } from '../../components/SignatureModal';
import DocumentPreviewModal from '../../components/DocumentPreviewModal';
import ReviewToolbar from './components/ReviewToolbar';
import SignatureFieldManager from './components/SignatureFieldManager';
import DocumentViewer from './components/DocumentViewer';

const DocumentReview: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentDocument, loading, error, getDocument } = useDocumentStore();
  const { user, token, isAuthenticated } = useAuthStore();

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCompleteSignatureSetupModal, setShowCompleteSignatureSetupModal] = useState(false);
  const [selectedReviewer, setSelectedReviewer] = useState('');
  const [isAssigningReviewer, setIsAssigningReviewer] = useState(false);
  const [isCompletingSetup, setIsCompletingSetup] = useState(false);

  const [signatureFields, setSignatureFields] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, fieldX: 0, fieldY: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (id) {
      getDocument(parseInt(id));
    }
  }, [id, isAuthenticated, navigate, getDocument]);

  useEffect(() => {
    if (currentDocument) {
      const existingSignatures = currentDocument.data?.signatureFields || [];
      setSignatureFields(existingSignatures);
    }
  }, [currentDocument]);

  const handleReject = async (reason: string) => {
    if (!currentDocument || !user) return;

    try {
      // API call to reject document
      console.log('Rejecting document with reason:', reason);
      setShowRejectModal(false);
      navigate('/documents');
    } catch (error) {
      console.error('문서 반려 실패:', error);
    }
  };

  const handleApprove = async () => {
    if (!currentDocument || !user) return;

    try {
      // API call to approve document
      console.log('Approving document');
      navigate('/documents');
    } catch (error) {
      console.error('문서 승인 실패:', error);
    }
  };

  const handleSignatureComplete = (signatureData: string) => {
    if (!user?.email || !activeFieldId) return;

    setSignatureFields(prev => prev.map(field => 
      field.id === activeFieldId 
        ? { ...field, signatureData, signedBy: user.email }
        : field
    ));

    setShowSignatureModal(false);
    setActiveFieldId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">문서를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !currentDocument) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">문서를 불러오는 중 오류가 발생했습니다.</p>
          <button
            onClick={() => navigate('/documents')}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            문서 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const canReview = user?.email && currentDocument.tasks?.some(
    task => task.assignedUserEmail === user.email && task.role === 'REVIEWER'
  );

  const hasUserSigned = user?.email && signatureFields.some(
    field => field.signedBy === user.email
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <ReviewToolbar
        document={currentDocument}
        canReview={canReview}
        hasUserSigned={hasUserSigned}
        onReject={() => setShowRejectModal(true)}
        onApprove={handleApprove}
        onBack={() => navigate('/documents')}
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <DocumentViewer
              document={currentDocument}
              signatureFields={signatureFields}
              onSignatureFieldClick={(fieldId) => {
                if (canReview && !hasUserSigned) {
                  setActiveFieldId(fieldId);
                  setShowSignatureModal(true);
                }
              }}
            />
          </div>
          
          <div className="lg:col-span-1">
            <SignatureFieldManager
              signatureFields={signatureFields}
              currentUserEmail={user?.email}
              canReview={canReview}
              onAddSignatureField={(field) => {
                setSignatureFields(prev => [...prev, field]);
              }}
              onRemoveSignatureField={(fieldId) => {
                setSignatureFields(prev => prev.filter(f => f.id !== fieldId));
              }}
            />
          </div>
        </div>
      </div>

      <RejectModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onReject={handleReject}
      />

      <SignatureModal
        isOpen={showSignatureModal}
        onClose={() => {
          setShowSignatureModal(false);
          setActiveFieldId(null);
        }}
        onSave={handleSignatureComplete}
        reviewerName="문서 서명"
      />

      {showCompleteSignatureSetupModal && currentDocument && (
        <DocumentPreviewModal
          isOpen={showCompleteSignatureSetupModal}
          onClose={() => setShowCompleteSignatureSetupModal(false)}
          pdfImageUrl={currentDocument.template?.pdfImagePath || ''}
          coordinateFields={[]}
          documentTitle={currentDocument.template?.name}
        />
      )}
    </div>
  );
};

export default DocumentReview;