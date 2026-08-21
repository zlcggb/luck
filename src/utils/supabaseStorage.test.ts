import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  validateImageFormat,
  generateSecureStoragePath,
  uploadPrizeImage,
  compressImage,
  PRIZE_BUCKET,
} from './supabaseStorage';
import { supabase } from './supabaseCheckin';

describe('supabaseStorage - validation and security', () => {
  it('validates image MIME types correctly', () => {
    const validJpg = new File(['dummy content'], 'photo.jpg', { type: 'image/jpeg' });
    const validPng = new File(['dummy content'], 'photo.png', { type: 'image/png' });
    const validWebp = new File(['dummy content'], 'photo.webp', { type: 'image/webp' });
    const invalidPdf = new File(['dummy content'], 'doc.pdf', { type: 'application/pdf' });
    const invalidExe = new File(['dummy content'], 'app.exe', { type: 'application/x-msdownload' });

    expect(validateImageFormat(validJpg).valid).toBe(true);
    expect(validateImageFormat(validPng).valid).toBe(true);
    expect(validateImageFormat(validWebp).valid).toBe(true);

    const pdfRes = validateImageFormat(invalidPdf);
    expect(pdfRes.valid).toBe(false);
    expect(pdfRes.error).toContain('仅支持 JPG、PNG、WebP、GIF 格式');

    const exeRes = validateImageFormat(invalidExe);
    expect(exeRes.valid).toBe(false);
  });

  it('allows large image files into the pipeline for automatic compression', () => {
    const largeFile = new File(['x'.repeat(8 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
    const formatCheck = validateImageFormat(largeFile);
    expect(formatCheck.valid).toBe(true);
  });

  it('sanitizes eventId against path traversal attacks', () => {
    const dummyFile = new File(['dummy'], 'test.png', { type: 'image/png' });
    const maliciousEventId = '../../etc/passwd-test';
    const path = generateSecureStoragePath(dummyFile, maliciousEventId);

    expect(path).not.toContain('..');
    expect(path.startsWith('etcpasswd-test/')).toBe(true);
    expect(path.endsWith('.png')).toBe(true);
    expect(path).toMatch(/^[a-zA-Z0-9_-]+\/\d+_[a-z0-9]+\.png$/);
  });
});

describe('supabaseStorage - compressImage algorithm', () => {
  it('gracefully returns file when canvas/browser is not supported or for valid small files', async () => {
    const file = new File(['small-img'], 'small.jpg', { type: 'image/jpeg' });
    const result = await compressImage(file);
    expect(result).toBeDefined();
  });
});

describe('supabaseStorage - uploadPrizeImage flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns error when file validation fails', async () => {
    const invalidFile = new File(['dummy'], 'test.txt', { type: 'text/plain' });
    const result = await uploadPrizeImage(invalidFile, 'event-123');

    expect(result.url).toBeUndefined();
    expect(result.error).toContain('仅支持 JPG、PNG、WebP、GIF 格式');
  });

  it('uploads file to storage bucket and returns public URL on success', async () => {
    const validFile = new File(['image-bytes'], 'gift.png', { type: 'image/png' });

    const uploadMock = vi.fn().mockResolvedValue({
      data: { path: 'event-123/123456_abc.png' },
      error: null,
    });
    const getPublicUrlMock = vi.fn().mockReturnValue({
      data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/luck-prizes/event-123/123456_abc.png' },
    });

    vi.spyOn(supabase.storage, 'from').mockReturnValue({
      upload: uploadMock,
      getPublicUrl: getPublicUrlMock,
    } as any);

    const result = await uploadPrizeImage(validFile, 'event-123');

    expect(supabase.storage.from).toHaveBeenCalledWith(PRIZE_BUCKET);
    expect(uploadMock).toHaveBeenCalled();
    expect(result.url).toBe('https://test.supabase.co/storage/v1/object/public/luck-prizes/event-123/123456_abc.png');
    expect(result.error).toBeUndefined();
  });

  it('handles storage upload errors gracefully', async () => {
    const validFile = new File(['image-bytes'], 'gift.png', { type: 'image/png' });

    const uploadMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Storage bucket permission denied' },
    });

    vi.spyOn(supabase.storage, 'from').mockReturnValue({
      upload: uploadMock,
    } as any);

    const result = await uploadPrizeImage(validFile, 'event-123');

    expect(result.url).toBeUndefined();
    expect(result.error).toBe('Storage bucket permission denied');
  });
});
