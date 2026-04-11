import { supabase } from '@/lib/supabase';

export async function uploadFile(
  bucket: string,
  file: File,
  path: string
): Promise<{ path: string; error: string | null }> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    return { path: '', error: error.message };
  }

  return { path, error: null };
}

export function extractStoragePath(fileValue: string, bucket: string): string {
  if (!fileValue.startsWith('http')) {
    return fileValue;
  }

  const marker = `/${bucket}/`;
  const bucketIndex = fileValue.indexOf(marker);
  if (bucketIndex === -1) {
    return fileValue;
  }

  return decodeURIComponent(fileValue.slice(bucketIndex + marker.length));
}

export async function getSignedUrl(
  bucket: string,
  fileValue: string,
  expiresIn = 3600
): Promise<string | null> {
  if (
    fileValue.startsWith('/') ||
    fileValue.startsWith('data:') ||
    fileValue.startsWith('blob:') ||
    (fileValue.startsWith('http') && !fileValue.includes(`/storage/v1/object/`))
  ) {
    return fileValue;
  }

  const path = extractStoragePath(fileValue, bucket);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);

  if (!error) {
    return data.signedUrl;
  }

  const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return publicUrl || null;
}

export async function deleteFile(bucket: string, fileValue: string): Promise<boolean> {
  if (
    fileValue.startsWith('/') ||
    fileValue.startsWith('data:') ||
    fileValue.startsWith('blob:') ||
    (fileValue.startsWith('http') && !fileValue.includes(`/storage/v1/object/`))
  ) {
    return true;
  }

  const path = extractStoragePath(fileValue, bucket);
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return !error;
}

export function generateUniqueFileName(
  userId: string,
  memberId: string,
  originalName: string
): string {
  const timestamp = Date.now();
  const ext = originalName.split('.').pop() ?? 'file';
  const safeName = originalName
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .slice(0, 40);

  return `${userId}/${memberId}/${timestamp}_${safeName}.${ext}`;
}
