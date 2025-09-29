declare const cv: any;

export interface ProcessingOptions {
  removeBackground?: boolean;
  enhanceContrast?: boolean;
  smoothLines?: boolean;
}

export class SignatureProcessor {
  private static isOpenCVReady = false;

  static async loadOpenCV(): Promise<boolean> {
    if (this.isOpenCVReady) return true;

    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(false);
        return;
      }

      if (window.cv && window.cv.Mat) {
        this.isOpenCVReady = true;
        resolve(true);
        return;
      }

      resolve(false);
    });
  }

  static async processSignatureImage(
    canvas: HTMLCanvasElement,
    options: ProcessingOptions = {}
  ): Promise<void> {
    if (!this.isOpenCVReady) {
      const loaded = await this.loadOpenCV();
      if (!loaded) {
        console.warn('OpenCV.js not available, skipping image processing');
        return;
      }
    }

    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const src = cv.matFromImageData(imageData);

      let processed = new cv.Mat();
      src.copyTo(processed);

      if (processed.channels() > 1) {
        const gray = new cv.Mat();
        cv.cvtColor(processed, gray, cv.COLOR_RGBA2GRAY);
        processed.delete();
        processed = gray;
      }

      if (options.removeBackground) {
        const binary = new cv.Mat();
        cv.threshold(processed, binary, 200, 255, cv.THRESH_BINARY);
        processed.delete();
        processed = binary;
      }

      if (options.enhanceContrast) {
        const enhanced = new cv.Mat();
        processed.convertTo(enhanced, -1, 1.5, -50);
        processed.delete();
        processed = enhanced;
      }

      if (options.smoothLines) {
        const smoothed = new cv.Mat();
        const ksize = new cv.Size(3, 3);
        cv.GaussianBlur(processed, smoothed, ksize, 1, 1, cv.BORDER_DEFAULT);
        processed.delete();
        processed = smoothed;
      }

      const result = new cv.Mat();
      if (processed.channels() === 1) {
        cv.cvtColor(processed, result, cv.COLOR_GRAY2RGBA);
      } else {
        processed.copyTo(result);
      }

      const resultImageData = new ImageData(
        new Uint8ClampedArray(result.data),
        result.cols,
        result.rows
      );

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(resultImageData, 0, 0);

      src.delete();
      processed.delete();
      result.delete();

    } catch (error) {
      console.error('Error processing signature image:', error);
    }
  }

  static async extractPenSignature(canvas: HTMLCanvasElement): Promise<void> {
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);

        if (brightness > 130) {
          // 밝은 배경은 흰색으로
          data[i] = 255;     // R
          data[i + 1] = 255; // G
          data[i + 2] = 255; // B
          data[i + 3] = 255; // 불투명
        } else {
          data[i] = 0;       // R
          data[i + 1] = 0;   // G
          data[i + 2] = 0;   // B
          data[i + 3] = 255; // 불투명
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(imageData, 0, 0);

      console.log('Pen signature extracted successfully');

    } catch (error) {
      console.error('Error extracting pen signature:', error);
      throw error;
    }
  }

  static async enhanceSignature(canvas: HTMLCanvasElement): Promise<void> {
    await this.processSignatureImage(canvas, {
      removeBackground: true,
      enhanceContrast: true,
      smoothLines: true
    });
  }

  static async removeBackground(canvas: HTMLCanvasElement): Promise<void> {
    await this.processSignatureImage(canvas, {
      removeBackground: true
    });
  }
}

declare global {
  interface Window {
    cv: any;
  }
}