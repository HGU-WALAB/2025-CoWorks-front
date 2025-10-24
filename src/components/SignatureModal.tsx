import React, { useRef, useState, useEffect } from 'react';
import { SignatureProcessor } from '../utils/signatureProcessor';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (signatureData: string) => void;
  reviewerName: string;
}

interface SavedSignature {
  id: string;
  name: string;
  data: string;
  createdAt: string;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  onSave,
  reviewerName
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastX, setLastX] = useState(0);
  const [lastY, setLastY] = useState(0);
  const [activeTab, setActiveTab] = useState<'draw' | 'camera' | 'saved'>('draw');
  const [savedSignatures, setSavedSignatures] = useState<SavedSignature[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedSignature, setCapturedSignature] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSavedSignatures();
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // 캔버스 크기를 실제 표시 크기와 동일하게 설정
          const rect = canvas.getBoundingClientRect();
          canvas.width = rect.width;
          canvas.height = rect.height;

          // 캔버스 배경을 투명하게 설정
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
      }
    } else {
      // 모달이 닫힐 때 카메라 스트림 정리
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
        setShowCamera(false);
      }
      setCapturedSignature(false);
      setCameraLoading(false);
    }
  }, [isOpen, cameraStream]);

  const loadSavedSignatures = () => {
    try {
      const saved = localStorage.getItem('savedSignatures');
      if (saved) {
        setSavedSignatures(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load saved signatures:', error);
    }
  };

  const saveSignatureToLocal = (signatureData: string, name: string) => {
    try {
      const newSignature: SavedSignature = {
        id: Date.now().toString(),
        name,
        data: signatureData,
        createdAt: new Date().toISOString()
      };

      const updated = [...savedSignatures, newSignature];
      setSavedSignatures(updated);
      localStorage.setItem('savedSignatures', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save signature:', error);
    }
  };

  const deleteSavedSignature = (id: string) => {
    try {
      const updated = savedSignatures.filter(sig => sig.id !== id);
      setSavedSignatures(updated);
      localStorage.setItem('savedSignatures', JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to delete signature:', error);
    }
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    
    if ('touches' in e && e.touches.length > 0) {
      // 터치 이벤트
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // 마우스 이벤트
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const coords = getCanvasCoordinates(e);
    setLastX(coords.x);
    setLastY(coords.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const coords = getCanvasCoordinates(e);
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    
    setLastX(coords.x);
    setLastY(coords.y);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // 캔버스를 투명 배경으로 지우기
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setCapturedSignature(false);
    setCameraLoading(false);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const signatureData = canvas.toDataURL('image/png');

    // 로컬 저장 옵션 제공
    const shouldSaveLocally = confirm('이 서명을 로컬에 저장하여 나중에 재사용하시겠습니까?');
    if (shouldSaveLocally) {
      const name = prompt('서명 이름을 입력하세요:', `${reviewerName}의 서명`) || `${reviewerName}의 서명`;
      saveSignatureToLocal(signatureData, name);
    }

    onSave(signatureData);
  };


  const startCamera = async () => {
    setCameraLoading(true);
    try {
      console.log('Starting camera...');

      // 브라우저 지원 확인
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('카메라가 지원되지 않는 브라우저입니다.');
      }

      // 카메라 권한 요청 (후면 카메라 우선, 실패시 전면 카메라)
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });
      } catch (envError) {
        console.log('Environment camera failed, trying user camera:', envError);
        // 후면 카메라 실패시 전면 카메라 시도
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        });
      }

      console.log('Camera stream obtained:', stream);

      setCameraStream(stream);
      setShowCamera(true);
      setCameraLoading(false);

      // 비디오 요소에 스트림 연결
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log('Video element connected to stream');

        // 비디오 로드 대기
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded');
        };
      }
    } catch (error) {
      console.error('Camera access failed:', error);

      let errorMessage = '카메라 접근에 실패했습니다.';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = '카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = '카메라를 찾을 수 없습니다.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = '카메라가 지원되지 않습니다.';
        }
      }

      alert(errorMessage);
      setShowCamera(false);
      setCameraLoading(false);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 비디오에서 현재 프레임을 캔버스에 그리기
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    // 카메라 스트림 종료
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setShowCamera(false);
    }

    // 자동으로 펜 서명 추출 처리
    try {
      await SignatureProcessor.extractPenSignature(canvas);
      console.log('Pen signature extracted successfully');
    } catch (error) {
      console.error('Failed to extract pen signature:', error);
      alert('서명 추출에 실패했습니다. 다시 촬영해주세요.');
    }

    // 카메라 탭에 그대로 머물면서 결과 보여주기 (탭 전환 없음)
    setCapturedSignature(true);
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setShowCamera(false);
    }
  };

  const useSavedSignature = (signatureData: string) => {
    onSave(signatureData);
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-800">전자서명</h2>
          <p className="text-sm text-gray-600 mt-1">
            {reviewerName}님의 서명을 아래 영역에 그려주세요
          </p>
        </div>

        <div className="p-6">
          {/* 탭 네비게이션 */}
          <div className="flex border-b border-gray-200 mb-4">
            <button
              onClick={() => setActiveTab('draw')}
              className={`px-4 py-2 font-medium ${activeTab === 'draw'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              ✍️ 그리기
            </button>
            {/*<button*/}
            {/*  onClick={() => setActiveTab('camera')}*/}
            {/*  className={`px-4 py-2 font-medium ${activeTab === 'camera'*/}
            {/*    ? 'text-blue-600 border-b-2 border-blue-600'*/}
            {/*    : 'text-gray-600 hover:text-gray-800'*/}
            {/*  }`}*/}
            {/*>*/}
            {/*  📷 촬영*/}
            {/*</button>*/}
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-4 py-2 font-medium ${activeTab === 'saved'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              💾 저장된 서명
            </button>
          </div>

          {/* 그리기 탭 */}
          {activeTab === 'draw' && (
            <>
              <div className="border-2 border-gray-300 rounded-lg mb-4">
                <canvas
                  ref={canvasRef}
                  className="w-full h-48 cursor-crosshair block"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>


              <div className="flex justify-between">
                <button
                  onClick={clearSignature}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  지우기
                </button>

                <div className="space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={saveSignature}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    서명 저장
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 촬영 탭 */}
          {activeTab === 'camera' && (
            <>
              {!showCamera && !capturedSignature && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-4 text-center">
                  <div className="space-y-4">
                    <div className="text-gray-600">
                      <p className="text-lg">📷 카메라로 서명을 촬영하세요</p>
                      <p className="text-sm mt-2">촬영 후 자동으로 배경이 제거되고 검은색 서명만 추출됩니다</p>
                    </div>

                    <button
                      onClick={startCamera}
                      disabled={cameraLoading}
                      className={`px-8 py-4 text-white rounded-lg transition-colors text-lg ${
                        cameraLoading
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {cameraLoading ? '📱 카메라 시작 중...' : '📸 카메라로 촬영하기'}
                    </button>
                  </div>
                </div>
              )}

              {/* 카메라 뷰 */}
              {/*{showCamera && (*/}
              {/*  <div className="border-2 border-gray-300 rounded-lg mb-4 overflow-hidden">*/}
              {/*    <video*/}
              {/*      ref={videoRef}*/}
              {/*      autoPlay*/}
              {/*      playsInline*/}
              {/*      muted*/}
              {/*      className="w-full h-48 object-cover"*/}
              {/*      onLoadedMetadata={() => console.log('Video loaded and ready')}*/}
              {/*      onError={(e) => console.error('Video error:', e)}*/}
              {/*    />*/}
              {/*    <div className="p-3 bg-gray-50 flex justify-center space-x-3">*/}
              {/*      <button*/}
              {/*        onClick={capturePhoto}*/}
              {/*        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"*/}
              {/*      >*/}
              {/*        📸 촬영*/}
              {/*      </button>*/}
              {/*      <button*/}
              {/*        onClick={stopCamera}*/}
              {/*        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"*/}
              {/*      >*/}
              {/*        취소*/}
              {/*      </button>*/}
              {/*    </div>*/}
              {/*  </div>*/}
              {/*)}*/}

              {/*/!* 촬영된 서명 결과 표시 *!/*/}
              {/*{!showCamera && capturedSignature && (*/}
              {/*  <>*/}
              {/*    <div className="border-2 border-gray-300 rounded-lg mb-4">*/}
              {/*      <canvas*/}
              {/*        ref={canvasRef}*/}
              {/*        className="w-full h-48 block bg-white"*/}
              {/*      />*/}
              {/*    </div>*/}

              {/*    /!* 자동 처리 안내 *!/*/}
              {/*    <div className="text-center mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">*/}
              {/*      <p className="text-sm text-green-700">*/}
              {/*        ✨ 촬영 완료! 자동으로 배경이 제거되고 검은색 서명만 추출되었습니다.*/}
              {/*      </p>*/}
              {/*    </div>*/}

              {/*    /!* 다시 촬영 버튼 추가 *!/*/}
              {/*    <div className="text-center mb-4">*/}
              {/*      <button*/}
              {/*        onClick={() => {*/}
              {/*          setCapturedSignature(false);*/}
              {/*          clearSignature();*/}
              {/*        }}*/}
              {/*        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"*/}
              {/*      >*/}
              {/*        🔄 다시 촬영하기*/}
              {/*      </button>*/}
              {/*    </div>*/}
              {/*  </>*/}
              {/*)}*/}

              {/*{capturedSignature && (*/}
              {/*  <div className="flex justify-between">*/}
              {/*    <button*/}
              {/*      onClick={clearSignature}*/}
              {/*      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"*/}
              {/*    >*/}
              {/*      지우기*/}
              {/*    </button>*/}

              {/*    <div className="space-x-3">*/}
              {/*      <button*/}
              {/*        onClick={onClose}*/}
              {/*        className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"*/}
              {/*      >*/}
              {/*        취소*/}
              {/*      </button>*/}
              {/*      <button*/}
              {/*        onClick={saveSignature}*/}
              {/*        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"*/}
              {/*      >*/}
              {/*        서명 저장*/}
              {/*      </button>*/}
              {/*    </div>*/}
              {/*  </div>*/}
              {/*)}*/}

              {!capturedSignature && !showCamera && (
                <div className="flex justify-end">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                </div>
              )}
            </>
          )}

          {/* 저장된 서명 탭 */}
          {activeTab === 'saved' && (
            <>
              <div className="mb-4">
                {savedSignatures.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>💾 저장된 서명이 없습니다</p>
                    <p className="text-sm mt-1">서명을 그리거나 업로드한 후 저장해보세요</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 max-h-64 overflow-y-auto">
                    {savedSignatures.map((signature) => (
                      <div key={signature.id} className="border border-gray-200 rounded-lg p-3">
                        <img
                          src={signature.data}
                          alt={signature.name}
                          className="w-full h-16 object-contain bg-gray-50 rounded mb-2"
                        />
                        <p className="text-sm font-medium truncate" title={signature.name}>
                          {signature.name}
                        </p>
                        <p className="text-xs text-gray-500 mb-2">
                          {new Date(signature.createdAt).toLocaleDateString()}
                        </p>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => useSavedSignature(signature.data)}
                            className="flex-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                          >
                            사용
                          </button>
                          <button
                            onClick={() => deleteSavedSignature(signature.id)}
                            className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                          >
                            버리기
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}; 