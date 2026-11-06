import cloudinary from '../config/cloudinary';
import crypto from 'crypto';
import path from 'path';

export interface UploadResult {
  secure_url: string;
  public_id: string;
}

function createFallbackUpload(buffer: Buffer, filename: string): UploadResult {
  const ext = path.extname(filename).toLowerCase();
  const mime = ext === '.pdf' ? 'application/pdf' : (ext === '.png' ? 'image/png' : 'image/jpeg');
  const base64 = buffer.toString('base64');
  return {
    secure_url: `data:${mime};base64,${base64}`,
    public_id: 'mock_' + crypto.randomBytes(16).toString('hex')
  };
}

export const uploadToCloudinary = (buffer: Buffer, filename: string): Promise<UploadResult> => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
    return Promise.resolve(createFallbackUpload(buffer, filename));
  }

  return new Promise((resolve) => {
    try {
      const options = {
        resource_type: 'auto' as const,
        folder: 'uploads',
        public_id: crypto.randomBytes(16).toString('hex')
      };
      const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error || !result) {
          console.warn('[DevLog] Cloudinary upload failed, using fallback storage:', error?.message || error);
          resolve(createFallbackUpload(buffer, filename));
        } else {
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id
          });
        }
      });
      stream.on('error', (err) => {
        console.warn('[DevLog] Cloudinary stream error, using fallback storage:', err.message || err);
        resolve(createFallbackUpload(buffer, filename));
      });
      stream.end(buffer);
    } catch (err: any) {
      console.warn('[DevLog] Cloudinary exception, using fallback storage:', err.message);
      resolve(createFallbackUpload(buffer, filename));
    }
  });
};
