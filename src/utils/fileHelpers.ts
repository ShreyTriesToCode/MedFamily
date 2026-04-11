import { FileText, Image, File } from 'lucide-react';
import type { ComponentType } from 'react';

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

export function getFileSizeInMB(file: File): number {
  return file.size / (1024 * 1024);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIcon(fileType: string): ComponentType<{ className?: string }> {
  if (fileType.startsWith('image/')) return Image;
  if (fileType === 'application/pdf') return FileText;
  return File;
}

export function isImageFile(fileType: string): boolean {
  return fileType.startsWith('image/');
}
