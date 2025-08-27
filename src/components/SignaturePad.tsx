import React, { useState } from 'react';

interface SignaturePadProps {
  onSignatureChange: (signature: string) => void;
  defaultValue?: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSignatureChange, defaultValue = '' }) => {
  const [signatureText, setSignatureText] = useState(defaultValue);
  const [signatureMode, setSignatureMode] = useState<'text' | 'draw'>('text');

  const handleTextChange = (text: string) => {
    setSignatureText(text);
    onSignatureChange(text);
  };

  return (
    <div className="border border-gray-300 rounded-lg p-4">
      <div className="flex space-x-4 mb-4">
        <button
          onClick={() => setSignatureMode('text')}
          className={`btn text-sm ${signatureMode === 'text' ? 'btn-primary' : 'btn-secondary'}`}
        >
          텍스트 서명
        </button>
        <button
          onClick={() => setSignatureMode('draw')}
          className={`btn text-sm ${signatureMode === 'draw' ? 'btn-primary' : 'btn-secondary'}`}
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
            className="input"
          />
          {signatureText && (
            <div className="mt-2 p-3 bg-gray-50 border rounded text-center">
              <span className="text-lg font-script" style={{ fontFamily: 'cursive' }}>
                {signatureText}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            그리기 서명
          </label>
          <div className="w-full h-32 border border-dashed border-gray-400 rounded flex items-center justify-center bg-gray-50">
            <p className="text-gray-500 text-sm">그리기 서명 기능은 추후 구현됩니다</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignaturePad; 