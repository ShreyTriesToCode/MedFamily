import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE_MB } from '@/lib/constants';

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePassword(password: string): string | null {
  if (password.length < 6) return 'Password must be at least 6 characters';
  return null;
}

export function validatePhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/\s|-/g, '');
  return /^(\+91)?[6-9]\d{9}$/.test(cleaned);
}

export function formatPhoneForSupabase(phone: string): string {
  const cleaned = phone.replace(/\s|-/g, '');
  return cleaned.startsWith('+91') ? cleaned : `+91${cleaned}`;
}

export function validateOTP(otp: string): boolean {
  return /^\d{6}$/.test(otp);
}

export function validateFileType(file: File, allowedTypes: string[] = ALLOWED_FILE_TYPES): boolean {
  return allowedTypes.includes(file.type);
}

export function validateFileSize(file: File, maxMB: number = MAX_FILE_SIZE_MB): boolean {
  return file.size <= maxMB * 1024 * 1024;
}

export function validateDate(dateString: string): boolean {
  const d = new Date(dateString);
  return !isNaN(d.getTime());
}

export function validateMedicineName(name: string): boolean {
  return name.trim().length >= 2 && name.trim().length <= 100;
}

export function validateDosage(dosage: string): boolean {
  return dosage.trim().length >= 1 && dosage.trim().length <= 50;
}
