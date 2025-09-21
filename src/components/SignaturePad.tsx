import React, { useRef, useEffect, useState } from 'react';

interface SignaturePadProps {
  onSignatureChange: (signature: string) => void;
  defaultValue?: string;
  width?: number;
  height?: number;
}

const SignaturePad: React.FC<SignaturePadProps> = ({
  onSignatureChange,
  defaultValue = '',
  width = 400,
  height = 200
}) => {
  const [signatureText, setSignatureText] = useState(defaultValue);
  const [signatureMode, setSignatureMode] = useState<'text' | 'draw'>('draw');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [lineWidth, setLineWidth] = useState(3);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 캔버스 초기화
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [width, height, signatureMode, lineWidth]);

  const getCoordinates = (event: MouseEvent | TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    if ('touches' in event) {
      // 터치 이벤트
      const touch = event.touches[0] || event.changedTouches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      // 마우스 이벤트
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }
  };

  const startDrawing = (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    setIsDrawing(true);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const coords = getCoordinates(event.nativeEvent);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // 선 두께 설정 (매번 설정하여 일관성 보장)
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = 'black';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const coords = getCoordinates(event.nativeEvent);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    setHasSignature(true);
  };

  const stopDrawing = (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    if (!isDrawing) return;

    setIsDrawing(false);

    // 서명 데이터를 부모 컴포넌트로 전달
    if (hasSignature) {
      const canvas = canvasRef.current;
      if (canvas) {
        const signatureData = canvas.toDataURL('image/png');
        onSignatureChange(signatureData);
      }
    }
  };

  const clearDrawing = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    setHasSignature(false);
    onSignatureChange('');
  };

  const handleTextChange = (text: string) => {
    setSignatureText(text);

    // 텍스트를 이미지로 변환
    if (text.trim()) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        // 캔버스 초기화
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);

        // 텍스트 스타일 설정
        ctx.fillStyle = 'black';
        ctx.font = '24px cursive';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 텍스트 그리기
        ctx.fillText(text, width / 2, height / 2);

        const signatureData = canvas.toDataURL('image/png');
        onSignatureChange(signatureData);
        setHasSignature(true);
      }
    } else {
      clearDrawing();
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg p-4">
      <div className="flex space-x-4 mb-4">
        <button
          onClick={() => {
            setSignatureMode('text');
            clearDrawing();
          }}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            signatureMode === 'text'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          텍스트 서명
        </button>
        <button
          onClick={() => {
            setSignatureMode('draw');
            clearDrawing();
            setSignatureText('');
          }}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            signatureMode === 'draw'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          그리기 서명
        </button>
      </div>

      {signatureMode === 'text' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            서명 텍스트
          </label>
          <input
            type="text"
            value={signatureText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="서명을 입력하세요"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            그리기 서명
          </label>

          {/* 선 두께 조정 */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              선 두께: {lineWidth}px
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">얇게</span>
              <input
                type="range"
                min="1"
                max="8"
                step="0.5"
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((lineWidth - 1) / 7) * 100}%, #E5E7EB ${((lineWidth - 1) / 7) * 100}%, #E5E7EB 100%)`
                }}
              />
              <span className="text-xs text-gray-500">두껍게</span>
            </div>
            {/* 선 두께 미리보기 */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">미리보기:</span>
              <div
                className="bg-black rounded-full"
                style={{
                  width: `${Math.max(lineWidth * 2, 4)}px`,
                  height: `${lineWidth}px`
                }}
              />
            </div>
          </div>

          <div className="relative">
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              className="border border-gray-300 rounded-lg cursor-crosshair touch-none bg-white"
              style={{ touchAction: 'none' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />

            {/* 안내 텍스트 */}
            {!hasSignature && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-gray-400 text-center">
                  <div className="text-lg mb-1">✍️</div>
                  <div className="text-sm">여기에 서명해주세요</div>
                  <div className="text-xs mt-1">마우스나 터치로 그릴 수 있습니다</div>
                </div>
              </div>
            )}

            {/* 지우기 버튼 */}
            {hasSignature && (
              <button
                onClick={clearDrawing}
                className="absolute top-2 right-2 px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded transition-colors"
              >
                지우기
              </button>
            )}
          </div>
        </div>
      )}

      {/* 서명 미리보기 (텍스트 모드일 때만) */}
      {signatureMode === 'text' && (
        <div className="mt-4">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="border border-gray-200 rounded-lg bg-gray-50"
            style={{ display: signatureText ? 'block' : 'none' }}
          />
        </div>
      )}
    </div>
  );
};

export default SignaturePad; 