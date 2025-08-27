/**
 * 좌표 변환 디버깅 도구
 * 템플릿 생성과 편집 단계에서 좌표 일관성을 확인합니다.
 */

import { 
  convertPixelToRatio, 
  convertRatioToPixel, 
  PDF_CONFIG 
} from './coordinateUtils';

interface DebugCoordinate {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 좌표 변환 정확성 테스트
 */
export const testCoordinateConversion = (label: string, originalPixels: DebugCoordinate) => {
  console.group(`🔬 좌표 변환 테스트: ${label}`);
  
  // 1단계: 픽셀 → 비율 변환
  const ratios = convertPixelToRatio(
    originalPixels.x,
    originalPixels.y,
    originalPixels.width,
    originalPixels.height
  );
  
  // 2단계: 비율 → 픽셀 변환 (복원)
  const restoredPixels = convertRatioToPixel(
    ratios.x,
    ratios.y,
    ratios.width,
    ratios.height
  );
  
  // 3단계: 오차 계산
  const errors = {
    x: Math.abs(originalPixels.x - restoredPixels.x),
    y: Math.abs(originalPixels.y - restoredPixels.y),
    width: Math.abs(originalPixels.width - restoredPixels.width),
    height: Math.abs(originalPixels.height - restoredPixels.height),
  };
  
  const maxError = Math.max(errors.x, errors.y, errors.width, errors.height);
  const isAccurate = maxError <= 1; // 1픽셀 이하 오차 허용
  
  console.log('📐 원본 픽셀:', originalPixels);
  console.log('📊 변환된 비율:', {
    x: ratios.x.toFixed(6),
    y: ratios.y.toFixed(6),
    width: ratios.width.toFixed(6),
    height: ratios.height.toFixed(6)
  });
  console.log('🔄 복원된 픽셀:', restoredPixels);
  console.log('⚠️ 오차:', errors);
  console.log(`${isAccurate ? '✅' : '❌'} 정확도: ${isAccurate ? '양호' : '불량'} (최대 오차: ${maxError.toFixed(2)}px)`);
  
  console.groupEnd();
  
  return {
    original: originalPixels,
    ratios,
    restored: restoredPixels,
    errors,
    maxError,
    isAccurate
  };
};

/**
 * 다양한 위치에서 좌표 변환 테스트
 */
export const runCoordinateTests = () => {
  console.group('🧪 좌표 변환 일관성 테스트');
  console.log(`📏 PDF 크기: ${PDF_CONFIG.WIDTH} x ${PDF_CONFIG.HEIGHT}`);
  
  const testCases = [
    { label: '좌상단 모서리', x: 10, y: 10, width: 100, height: 30 },
    { label: '중앙', x: 620, y: 877, width: 150, height: 40 },
    { label: '우하단 모서리', x: 1130, y: 1714, width: 100, height: 30 },
    { label: '큰 필드', x: 100, y: 100, width: 500, height: 200 },
    { label: '작은 필드', x: 200, y: 200, width: 50, height: 15 },
  ];
  
  const results = testCases.map(testCase => 
    testCoordinateConversion(testCase.label, testCase)
  );
  
  const allAccurate = results.every(result => result.isAccurate);
  const avgError = results.reduce((sum, result) => sum + result.maxError, 0) / results.length;
  
  console.log(`📋 테스트 결과: ${results.length}개 케이스 중 ${results.filter(r => r.isAccurate).length}개 통과`);
  console.log(`📈 평균 오차: ${avgError.toFixed(2)}px`);
  console.log(`${allAccurate ? '✅' : '❌'} 전체 결과: ${allAccurate ? '모든 테스트 통과' : '일부 테스트 실패'}`);
  
  console.groupEnd();
  
  return {
    results,
    allAccurate,
    avgError,
    passedCount: results.filter(r => r.isAccurate).length,
    totalCount: results.length
  };
};

/**
 * 실시간 좌표 비교 (템플릿 생성 vs 편집)
 */
export const compareCoordinates = (
  templateCoords: DebugCoordinate, 
  editorCoords: DebugCoordinate, 
  fieldLabel: string
) => {
  console.group(`🔍 좌표 비교: ${fieldLabel}`);
  
  const differences = {
    x: Math.abs(templateCoords.x - editorCoords.x),
    y: Math.abs(templateCoords.y - editorCoords.y),
    width: Math.abs(templateCoords.width - editorCoords.width),
    height: Math.abs(templateCoords.height - editorCoords.height),
  };
  
  const maxDiff = Math.max(differences.x, differences.y, differences.width, differences.height);
  const isConsistent = maxDiff <= 2; // 2픽셀 이하 차이 허용
  
  console.log('🏗️ 템플릿 생성 시:', templateCoords);
  console.log('✏️ 편집 단계에서:', editorCoords);
  console.log('📏 차이:', differences);
  console.log(`${isConsistent ? '✅' : '⚠️'} 일관성: ${isConsistent ? '양호' : '주의'} (최대 차이: ${maxDiff.toFixed(2)}px)`);
  
  console.groupEnd();
  
  return {
    templateCoords,
    editorCoords,
    differences,
    maxDiff,
    isConsistent
  };
};

/**
 * 템플릿 필드 좌표 디버깅 정보 출력
 */
export const debugTemplateField = (field: any, stage: 'creation' | 'editing') => {
  const stageEmoji = stage === 'creation' ? '🏗️' : '✏️';
  const stageName = stage === 'creation' ? '생성' : '편집';
  
  console.log(`${stageEmoji} 템플릿 필드 ${stageName} - ${field.label}:`, {
    id: field.id,
    label: field.label,
    coordinates: {
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height
    },
    required: field.required,
    stage,
    timestamp: new Date().toISOString()
  });
};
