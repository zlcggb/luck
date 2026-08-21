import { supabase } from './supabaseCheckin';

export const PRIZE_BUCKET = 'luck-prizes';
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB (Supabase 桶限制)
export const TARGET_COMPRESS_SIZE_BYTES = 2 * 1024 * 1024; // 2MB (目标压缩上限)
export const MAX_DIMENSION = 1920; // 最大分辨率限制 (宽/高)
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export interface UploadResult {
  url?: string;
  error?: string;
}

export interface CompressOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  quality?: number;
}

/**
 * 校验待上传图片的基础格式
 */
export const validateImageFormat = (file: File): { valid: boolean; error?: string } => {
  if (!file) {
    return { valid: false, error: '请选择要上传的文件' };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: '仅支持 JPG、PNG、WebP、GIF 格式的图片' };
  }
  return { valid: true };
};

/**
 * 前端图片自适应压缩算法
 * - 保持纵横比，超大分辨率（宽/高 > 1920px）自动等比缩放
 * - 自适应降低文件体积至目标大小 (≤2MB)
 * - 针对 GIF 保留动图（若在体积限制内）
 */
export const compressImage = async (
  file: File,
  options: CompressOptions = {}
): Promise<File> => {
  const {
    maxSizeMB = 2,
    maxWidthOrHeight = MAX_DIMENSION,
    quality = 0.85,
  } = options;

  const targetBytes = maxSizeMB * 1024 * 1024;

  // Node/测试环境或不支持完整 Canvas 导出环境优雅回退
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    typeof FileReader === 'undefined' ||
    typeof HTMLCanvasElement === 'undefined' ||
    typeof (HTMLCanvasElement.prototype as any)?.toBlob !== 'function'
  ) {
    return file;
  }

  // GIF 动图如果小于限制直接保留动图帧
  if (file.type === 'image/gif' && file.size <= MAX_IMAGE_SIZE_BYTES) {
    return file;
  }

  return new Promise((resolve) => {
    let isSettled = false;
    const safeResolve = (res: File) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeoutTimer);
      resolve(res);
    };

    // 1000ms 超时兜底，防止极端情况下图片无法加载挂起
    const timeoutTimer = setTimeout(() => {
      safeResolve(file);
    }, 1000);

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // 如果文件体积已经小于目标体积，且尺寸在限制内，直接使用原图
        if (
          file.size <= targetBytes &&
          width <= maxWidthOrHeight &&
          height <= maxWidthOrHeight
        ) {
          safeResolve(file);
          return;
        }

        // 计算等比缩放后的尺寸
        if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
          if (width > height) {
            height = Math.round((height * maxWidthOrHeight) / width);
            width = maxWidthOrHeight;
          } else {
            width = Math.round((width * maxWidthOrHeight) / height);
            height = maxWidthOrHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          safeResolve(file);
          return;
        }

        // 填充背景并绘制
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const outputMime = file.type === 'image/png' ? 'image/png' : (file.type === 'image/webp' ? 'image/webp' : 'image/jpeg');

        const tryExport = (currQuality: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                safeResolve(file);
                return;
              }

              // 如果仍大于目标体积且质量还可以进一步压缩
              if (blob.size > targetBytes && currQuality > 0.45 && outputMime !== 'image/png') {
                tryExport(currQuality - 0.15);
                return;
              }

              const ext = outputMime === 'image/png' ? 'png' : (outputMime === 'image/webp' ? 'webp' : 'jpg');
              const baseName = file.name.replace(/\.[^/.]+$/, '');
              const compressedFile = new File([blob], `${baseName}_compressed.${ext}`, {
                type: outputMime,
                lastModified: Date.now(),
              });

              safeResolve(compressedFile);
            },
            outputMime,
            currQuality
          );
        };

        tryExport(quality);
      };

      img.onerror = () => safeResolve(file);
    };

    reader.onerror = () => safeResolve(file);
  });
};

/**
 * 校验上传文件（保留兼容）
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  return validateImageFormat(file);
};

/**
 * 生成安全的存储文件名（防路径穿越、字符注入）
 */
export const generateSecureStoragePath = (file: File, eventId?: string): string => {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  const ext = mimeToExt[file.type] || 'jpg';
  const cleanEventId = (eventId || 'general').replace(/[^a-zA-Z0-9_-]/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now();
  return `${cleanEventId}/${timestamp}_${randomSuffix}.${ext}`;
};

/**
 * 上传奖品图片到 Supabase Storage 并返回公开访问 URL
 * 自动对大图进行自适应压缩，确保符合云端存储限制
 */
export const uploadPrizeImage = async (
  file: File,
  eventId?: string
): Promise<UploadResult> => {
  const formatValidation = validateImageFormat(file);
  if (!formatValidation.valid) {
    return { error: formatValidation.error };
  }

  try {
    // 自动压缩大图
    const processedFile = await compressImage(file);

    if (processedFile.size > MAX_IMAGE_SIZE_BYTES) {
      return { error: '图片压缩后仍超过 5MB 限制，请选择较小的图片' };
    }

    const filePath = generateSecureStoragePath(processedFile, eventId);
    const { data, error } = await supabase.storage
      .from(PRIZE_BUCKET)
      .upload(filePath, processedFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: processedFile.type,
      });

    if (error) {
      console.error('上传图片到 Supabase Storage 失败:', error);
      return { error: error.message || '图片上传失败，请重试' };
    }

    const { data: urlData } = supabase.storage
      .from(PRIZE_BUCKET)
      .getPublicUrl(data.path);

    if (!urlData?.publicUrl) {
      return { error: '获取图片公开链接失败' };
    }

    return { url: urlData.publicUrl };
  } catch (err: any) {
    console.error('上传图片发生异常:', err);
    return { error: err?.message || '上传图片发生异常' };
  }
};
