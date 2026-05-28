import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

export interface FileAttachment {
  uri: string;
  name: string;
  type: string;
  size?: number;
  base64?: string;
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg', '.heic', '.heif'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.flv', '.3gp', '.3g2', '.wmv'];

const inferMimeType = (type: string | undefined, fileName: string | undefined, fallback: string) => {
  const lowerType = (type || '').toLowerCase();
  if (lowerType.startsWith('image/')) return lowerType;
  if (lowerType.startsWith('video/')) return lowerType;
  if (lowerType === 'image' || lowerType === 'video') {
    return lowerType === 'image' ? fallback.replace('video/', 'image/') : fallback;
  }

  const lowerName = (fileName || '').toLowerCase();
  if (IMAGE_EXTENSIONS.some(ext => lowerName.endsWith(ext))) {
    if (lowerName.endsWith('.png')) return 'image/png';
    if (lowerName.endsWith('.gif')) return 'image/gif';
    if (lowerName.endsWith('.webp')) return 'image/webp';
    if (lowerName.endsWith('.bmp')) return 'image/bmp';
    if (lowerName.endsWith('.svg')) return 'image/svg+xml';
    if (lowerName.endsWith('.heic')) return 'image/heic';
    if (lowerName.endsWith('.heif')) return 'image/heif';
    return 'image/jpeg';
  }

  if (VIDEO_EXTENSIONS.some(ext => lowerName.endsWith(ext))) {
    if (lowerName.endsWith('.mov')) return 'video/quicktime';
    if (lowerName.endsWith('.avi')) return 'video/x-msvideo';
    if (lowerName.endsWith('.mkv')) return 'video/x-matroska';
    if (lowerName.endsWith('.webm')) return 'video/webm';
    if (lowerName.endsWith('.flv')) return 'video/x-flv';
    if (lowerName.endsWith('.3gp')) return 'video/3gpp';
    if (lowerName.endsWith('.3g2')) return 'video/3gpp2';
    if (lowerName.endsWith('.wmv')) return 'video/x-ms-wmv';
    return 'video/mp4';
  }

  return fallback;
};

// Video formats supported
const SUPPORTED_VIDEO_FORMATS = [
  'video/*',
  'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm', 'video/x-flv', 'video/3gpp', 'video/3gpp2', 'video/x-ms-wmv', 'video/ogg'
];

// Document formats supported
const SUPPORTED_DOCUMENT_FORMATS = [
  'image/*',
  'video/mp4',
  'video/quicktime',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/html',
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'application/json',
  'application/xml'
];

// Convert file to base64
export const fileToBase64 = async (uri: string): Promise<string> => {
  try {
    // For local URIs, read the file content
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Extract just the base64 data part
        const base64Data = base64.split(',')[1] || base64;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting file to base64:', error);
    throw error;
  }
};

// Pick image from camera or gallery
export const pickImage = async (source: 'camera' | 'gallery' = 'gallery'): Promise<FileAttachment | null> => {
  try {
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.9,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.9,
            base64: true,
          });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const base64 = asset.base64 || await fileToBase64(asset.uri);
      return {
        uri: asset.uri,
        name: asset.fileName || `image_${Date.now()}.${(inferMimeType(asset.type, asset.fileName, 'image/jpeg').split('/')[1] || 'jpg')}`,
        type: inferMimeType(asset.type, asset.fileName, 'image/jpeg'),
        size: asset.fileSize,
        base64,
      };
    }
    return null;
  } catch (error) {
    console.error('Error picking image:', error);
    throw error;
  }
};

// Pick GIF from gallery/files
export const pickGif = async (): Promise<FileAttachment | null> => {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 1,
      base64: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const mime = inferMimeType(asset.type, asset.fileName, 'image/gif');
      const isGif = mime === 'image/gif' || (asset.fileName || '').toLowerCase().endsWith('.gif');

      if (!isGif) {
        return null;
      }

      const base64 = asset.base64 || await fileToBase64(asset.uri);
      return {
        uri: asset.uri,
        name: asset.fileName || `gif_${Date.now()}.gif`,
        type: mime,
        size: asset.fileSize,
        base64,
      };
    }
    return null;
  } catch (error) {
    console.error('Error picking gif:', error);
    throw error;
  }
};

// Pick document/file
export const pickDocument = async (): Promise<FileAttachment | null> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: SUPPORTED_DOCUMENT_FORMATS,
      copyToCacheDirectory: true,
    });

    if (result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const base64 = await fileToBase64(asset.uri);
      return {
        uri: asset.uri,
        name: asset.name || `document_${Date.now()}`,
        type: asset.mimeType || 'application/octet-stream',
        size: asset.size,
        base64,
      };
    }
    return null;
  } catch (error) {
    console.error('Error picking document:', error);
    throw error;
  }
};

// Pick video file
export const pickVideo = async (): Promise<FileAttachment | null> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: SUPPORTED_VIDEO_FORMATS,
      copyToCacheDirectory: true,
    });

    if (result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const base64 = await fileToBase64(asset.uri);
      return {
        uri: asset.uri,
        name: asset.name || `video_${Date.now()}`,
        type: inferMimeType(asset.mimeType, asset.name, 'video/mp4'),
        size: asset.size,
        base64,
      };
    }
    return null;
  } catch (error) {
    console.error('Error picking video:', error);
    throw error;
  }
};

// Get file type category
export const getFileTypeCategory = (type: string): 'image' | 'video' | 'document' | 'archive' | 'other' => {
  const lowerType = type.toLowerCase();
  
  // Check image
  if (lowerType.startsWith('image/')) return 'image';
  
  // Check video
  if (lowerType.startsWith('video/')) return 'video';
  
  // Check archive
  if (lowerType.includes('zip') || lowerType.includes('rar') || lowerType.includes('7z') || lowerType.includes('tar') || lowerType.includes('gzip')) return 'archive';
  
  // Check document
  if (
    lowerType.includes('pdf') || 
    lowerType.includes('word') || 
    lowerType.includes('document') || 
    lowerType.includes('sheet') || 
    lowerType.includes('presentation') ||
    lowerType.includes('powerpoint') ||
    lowerType.includes('text') ||
    lowerType.includes('csv') ||
    lowerType.includes('html') ||
    lowerType.includes('json') ||
    lowerType.includes('xml')
  ) return 'document';
  
  return 'other';
};

// Check if file size is within limits (in MB)
export const isFileSizeValid = (sizeInBytes: number | undefined, limitMB: number = 100): boolean => {
  if (!sizeInBytes) return true;
  return sizeInBytes <= limitMB * 1024 * 1024;
};

// Get file size in MB
export const getFileSizeInMB = (sizeInBytes: number | undefined): string => {
  if (!sizeInBytes) return '0 MB';
  const mb = (sizeInBytes / (1024 * 1024)).toFixed(2);
  return `${mb} MB`;
};
