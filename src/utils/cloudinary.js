import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

function ensureConfigured() {
  if (!isConfigured()) {
    throw new Error('cloudinary_not_configured');
  }
}

export function isConfigured() {
  return ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].every(k => !!process.env[k]);
}

export async function healthCheck() {
  if (!isConfigured()) return { ok: false, reason: 'not_configured' };
  try {
    // lightweight API call to verify credentials/network
    const res = await cloudinary.api.resources({ max_results: 1 });
    if (res && typeof res.total_count !== 'undefined') 
        return { ok: true };
    return { 
        ok: false, 
        reason: 'unexpected_response', detail: res 
    };
  } catch (err) {
    return { 
        ok: false, reason: err.message || 'api_error', detail: err 
    };
  }
}

export function configure() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
}

export async function uploadFromBuffer(buffer, options = {}) {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    uploadStream.end(buffer);
  });
}

export async function uploadFromStream(readableStream, options = {}) {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    // Pipe the provided readable stream into Cloudinary's upload stream
    readableStream.pipe(uploadStream);
  });
}

export async function uploadFromUrl(url, options = {}) {
  ensureConfigured();
  return cloudinary.uploader.upload(url, options);
}

export async function remove(publicId, options = {}) {
  ensureConfigured();
  return cloudinary.uploader.destroy(publicId, options);
}

export function url(publicId, options = {}) {
  ensureConfigured();
  return cloudinary.url(publicId, options);
}

export default {
  configure,
  uploadFromBuffer,
  uploadFromStream,
  uploadFromUrl,
  remove,
  url
};


