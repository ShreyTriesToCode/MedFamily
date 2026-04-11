import { useCallback, useRef, useState } from 'react';
import { FileImage, FileText, UploadCloud, X } from 'lucide-react';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE_MB } from '@/lib/constants';
import { formatFileSize, isImageFile } from '@/utils/fileHelpers';
import { validateFileSize, validateFileType } from '@/utils/validators';
import { cn } from '@/utils/cn';

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  acceptedTypes?: string[];
  maxSize?: number;
  multiple?: boolean;
  error?: string;
  label?: string;
}

export default function FileUpload({
  onFileSelect,
  acceptedTypes = ALLOWED_FILE_TYPES,
  maxSize = MAX_FILE_SIZE_MB,
  multiple = false,
  error,
  label,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) {
        return;
      }

      const nextFiles: File[] = [];

      for (const file of Array.from(fileList)) {
        if (!validateFileType(file, acceptedTypes)) {
          setLocalError('Only PDF, JPG, and PNG files are allowed.');
          return;
        }

        if (!validateFileSize(file, maxSize)) {
          setLocalError(`File must be under ${maxSize}MB.`);
          return;
        }

        nextFiles.push(file);
      }

      const merged = multiple ? [...selectedFiles, ...nextFiles] : nextFiles;
      setSelectedFiles(merged);
      setLocalError(null);
      onFileSelect(merged);
    },
    [acceptedTypes, maxSize, multiple, onFileSelect, selectedFiles]
  );

  const removeFile = (index: number) => {
    const nextFiles = selectedFiles.filter((_, currentIndex) => currentIndex !== index);
    setSelectedFiles(nextFiles);
    onFileSelect(nextFiles);
  };

  return (
    <div className="w-full">
      {label ? <p className="mb-2 text-sm font-semibold text-text-primary">{label}</p> : null}
      <div
        className={cn(
          'panel-muted rounded-[28px] border border-dashed p-5 text-center transition-all',
          isDragging ? 'border-primary-400 theme-surface-accent' : 'border-border-strong',
          error || localError ? 'border-danger-400' : ''
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <div className="theme-chip-strong mx-auto flex h-14 w-14 items-center justify-center rounded-full soft-shadow">
          <UploadCloud className="h-6 w-6" />
        </div>
        <p className="mt-4 text-sm font-semibold text-text-primary">Tap to upload or drag files here</p>
        <p className="mt-1 text-xs text-text-secondary">PDF, JPG, PNG up to {maxSize}MB. Private and securely stored.</p>
        <p className="mt-3 text-[11px] font-semibold tracking-[0.14em] text-text-tertiary uppercase">
          Private storage • Preview ready • Choose from device
        </p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple={multiple}
          accept={acceptedTypes.join(',')}
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>
      {error || localError ? (
        <p className="mt-2 text-xs font-medium text-danger-600">{error || localError}</p>
      ) : null}
      {selectedFiles.length ? (
        <div className="mt-3 space-y-2">
          {selectedFiles.map((file, index) => (
            <div key={`${file.name}-${index}`} className="panel flex items-center gap-3 rounded-[24px] px-4 py-3">
              <div className="theme-surface flex h-11 w-11 items-center justify-center rounded-full text-primary-600">
                {isImageFile(file.type) ? <FileImage className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold text-text-primary">{file.name}</p>
                <p className="text-xs text-text-secondary">{formatFileSize(file.size)}</p>
              </div>
              <button
                type="button"
                className="theme-chip rounded-full p-2 text-text-secondary transition hover:text-danger-700"
                onClick={(event) => {
                  event.stopPropagation();
                  removeFile(index);
                }}
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
