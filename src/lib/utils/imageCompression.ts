/**
 * Client-side image compression utility.
 * Converts images to WebP at specified quality and max dimensions.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0 to 1
  format?: 'image/webp' | 'image/jpeg';
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 1.0, // As requested by user (100% Quality)
  format: 'image/webp'
};

/**
 * Compresses an image file or blob and returns a new Blob.
 */
export async function compressImage(
  file: File | Blob, 
  options: CompressionOptions = {}
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Only compress images
  if (file instanceof File && !file.type.startsWith('image/')) {
    return file;
  }
  if (!(file instanceof File) && !file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize logic
        if (opts.maxWidth && width > opts.maxWidth) {
          height = (opts.maxWidth / width) * height;
          width = opts.maxWidth;
        }
        if (opts.maxHeight && height > opts.maxHeight) {
          width = (opts.maxHeight / height) * width;
          height = opts.maxHeight;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas toBlob failed'));
            }
          },
          opts.format,
          opts.quality
        );
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}
