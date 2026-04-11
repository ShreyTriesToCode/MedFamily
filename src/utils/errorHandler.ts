import toast from 'react-hot-toast';

interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
}

const ERROR_MAP: Record<string, string> = {
  '23505': 'This record already exists.',
  '23503': 'Referenced record not found.',
  '42501': 'You do not have permission for this action.',
  PGRST301: 'Session expired. Please log in again.',
  'invalid_otp': 'Invalid OTP. Please try again.',
  'otp_expired': 'OTP has expired. Please request a new one.',
};

export function handleSupabaseError(error: SupabaseError): string {
  if (error.code && ERROR_MAP[error.code]) {
    return ERROR_MAP[error.code];
  }
  const message = error.message?.toLowerCase() ?? '';

  if (message.includes('unsupported phone provider') || message.includes('phone provider is not enabled')) {
    return 'Phone login is disabled in Supabase. Enable the Phone provider in Authentication > Providers, or use email and password.';
  }
  if (message.includes('invalid login credentials')) {
    return 'Incorrect email/phone or password. Please try again.';
  }
  if (message.includes('user already registered')) {
    return 'An account already exists with these details.';
  }
  if (message.includes('register_demo_user') || message.includes('login_demo_user') || message.includes('sync_demo_auth_identity')) {
    return 'The demo auth database functions are missing. Run the latest supabase/database.sql script in Supabase SQL Editor.';
  }
  if (message.includes('jwt expired')) {
    return 'Session expired. Please log in again.';
  }
  if (message.includes('network')) {
    return 'Network error. Check your connection.';
  }
  return error.message || 'Something went wrong. Please try again.';
}

export function showErrorToast(message: string): void {
  toast.error(message, { duration: 4000 });
}

export function showSuccessToast(message: string): void {
  toast.success(message, { duration: 3000 });
}

export function logError(error: unknown, context: string): void {
  console.error(`[${context}]`, error);
}
