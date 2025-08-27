/**
 * 좌표 변환 유틸리티
 * 템플릿 생성과 편집 단계에서 일관된 좌표 시스템을 제공합니다.
 */

// A4 PDF 기준 크기 (150 DPI)
export const PDF_CONFIG = {
  WIDTH: 1240,  // A4 150 DPI 너비 (8.27 * 150)
  HEIGHT: 1754, // A4 150 DPI 높이 (11.69 * 150)
} as const;

/**
 * 픽셀 좌표를 비율 좌표로 변환 (0-1 범위)
 */
export const pixelToRatio = (pixelValue: number, maxValue: number): number => {
  return Math.max(0, Math.min(1, pixelValue / maxValue));
};

/**
 * 비율 좌표를 픽셀 좌표로 변환
 */
export const ratioToPixel = (ratio: number, maxValue: number): number => {
  return Math.round(ratio * maxValue);
};

/**
 * 픽셀 좌표를 비율 좌표로 변환 (X, Y, Width, Height)
 */
export const convertPixelToRatio = (
  x: number, 
  y: number, 
  width: number, 
  height: number
) => {
  return {
    x: pixelToRatio(x, PDF_CONFIG.WIDTH),
    y: pixelToRatio(y, PDF_CONFIG.HEIGHT),
    width: pixelToRatio(width, PDF_CONFIG.WIDTH),
    height: pixelToRatio(height, PDF_CONFIG.HEIGHT),
  };
};

/**
 * 비율 좌표를 픽셀 좌표로 변환 (X, Y, Width, Height)
 */
export const convertRatioToPixel = (
  xRatio: number, 
  yRatio: number, 
  widthRatio: number, 
  heightRatio: number
) => {
  return {
    x: ratioToPixel(xRatio, PDF_CONFIG.WIDTH),
    y: ratioToPixel(yRatio, PDF_CONFIG.HEIGHT),
    width: ratioToPixel(widthRatio, PDF_CONFIG.WIDTH),
    height: ratioToPixel(heightRatio, PDF_CONFIG.HEIGHT),
  };
};

/**
 * 필드 좌표 검증 (비율 기준 0-1 범위)
 */
export const validateRatioCoordinates = (
  x: number, 
  y: number, 
  width: number, 
  height: number
): boolean => {
  return (
    x >= 0 && x <= 1 &&
    y >= 0 && y <= 1 &&
    width > 0 && width <= 1 &&
    height > 0 && height <= 1 &&
    (x + width) <= 1 &&
    (y + height) <= 1
  );
};

/**
 * 필드 좌표 검증 (픽셀 기준)
 */
export const validatePixelCoordinates = (
  x: number, 
  y: number, 
  width: number, 
  height: number
): boolean => {
  return (
    x >= 0 && x <= PDF_CONFIG.WIDTH &&
    y >= 0 && y <= PDF_CONFIG.HEIGHT &&
    width > 0 && width <= PDF_CONFIG.WIDTH &&
    height > 0 && height <= PDF_CONFIG.HEIGHT &&
    (x + width) <= PDF_CONFIG.WIDTH &&
    (y + height) <= PDF_CONFIG.HEIGHT
  );
};

/**
 * 템플릿 필드 데이터 타입
 */
export interface TemplateFieldCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 좌표 변환 로그
 */
export const logCoordinateConversion = (
  operation: string,
  input: TemplateFieldCoordinates,
  output: TemplateFieldCoordinates,
  fieldLabel?: string
) => {
  console.log(`🔄 좌표 변환 [${operation}]${fieldLabel ? ` - ${fieldLabel}` : ''}:`, {
    input,
    output,
    timestamp: new Date().toISOString()
  });
};
