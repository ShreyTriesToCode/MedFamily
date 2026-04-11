import type {
  AccessScope,
  AppointmentStatus,
  AppointmentType,
  AppRole,
  VitalMetricType,
  FrequencyType,
  NotificationCategory,
  OrderStatus,
  RecordType,
  RelationType,
  SelectOption,
} from './types';

export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  RECORDS: '/records',
  PRESCRIPTIONS: '/prescriptions',
  REMINDERS: '/reminders',
  APPOINTMENTS: '/appointments',
  HEALTH: '/health',
  EMERGENCY: '/emergency',
  ACCESS_CONTROL: '/access-control',
  ORDERS: '/orders',
  NOTIFICATIONS: '/notifications',
} as const;

export const STORAGE_BUCKETS = {
  PATIENT_RECORDS: 'patient-records',
  PRESCRIPTIONS: 'prescriptions',
  ORDER_PRESCRIPTIONS: 'order-prescriptions',
} as const;

export const MAX_FILE_SIZE_MB = 10;
export const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
export const ALLOWED_FILE_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

export const APP_ROLES: { value: AppRole; label: string; description: string }[] = [
  {
    value: 'patient_admin',
    label: 'Patient',
    description: 'Owns the family care workspace, approves access, and manages records and reminders.',
  },
  {
    value: 'doctor',
    label: 'Doctor',
    description: 'Requests secure patient access to review records and prescriptions.',
  },
  {
    value: 'hospital',
    label: 'Hospital',
    description: 'Coordinates institutional access for consultations and care continuity.',
  },
  {
    value: 'caretaker',
    label: 'Caretaker',
    description: 'Helps manage reminders, orders, and daily support for assigned patients.',
  },
  {
    value: 'chemist',
    label: 'Chemist',
    description: 'Receives medicine orders, updates fulfilment, and chats with families.',
  },
] as const;

export const ROLE_THEME: Record<AppRole, { tone: string; accent: string; icon: string }> = {
  patient_admin: { tone: 'bg-primary-50 text-primary-700', accent: 'from-primary-600 to-teal-500', icon: 'heart' },
  family_member: { tone: 'bg-primary-50 text-primary-700', accent: 'from-primary-500 to-primary-700', icon: 'users' },
  caretaker: { tone: 'bg-secondary-50 text-secondary-700', accent: 'from-secondary-600 to-emerald-500', icon: 'shield' },
  doctor: { tone: 'bg-teal-50 text-teal-700', accent: 'from-teal-600 to-primary-500', icon: 'stethoscope' },
  hospital: { tone: 'bg-sky-50 text-sky-700', accent: 'from-sky-600 to-teal-500', icon: 'building' },
  chemist: { tone: 'bg-amber-50 text-amber-700', accent: 'from-amber-500 to-coral-500', icon: 'pill' },
};

export const RELATION_OPTIONS: SelectOption[] = [
  { label: 'Self', value: 'Self' },
  { label: 'Father', value: 'Father' },
  { label: 'Mother', value: 'Mother' },
  { label: 'Spouse', value: 'Spouse' },
  { label: 'Son', value: 'Son' },
  { label: 'Daughter', value: 'Daughter' },
  { label: 'Brother', value: 'Brother' },
  { label: 'Sister', value: 'Sister' },
  { label: 'Grandfather', value: 'Grandfather' },
  { label: 'Grandmother', value: 'Grandmother' },
  { label: 'Other', value: 'Other' },
] satisfies { label: string; value: RelationType }[];

export const RECORD_TYPE_OPTIONS: SelectOption[] = [
  { label: 'Lab Report', value: 'Lab Report' },
  { label: 'X-Ray', value: 'X-Ray' },
  { label: 'MRI', value: 'MRI' },
  { label: 'CT Scan', value: 'CT Scan' },
  { label: 'Prescription', value: 'Prescription' },
  { label: 'Consultation Notes', value: 'Consultation Notes' },
  { label: 'Vaccination', value: 'Vaccination' },
  { label: 'Discharge Summary', value: 'Discharge Summary' },
  { label: 'Invoice', value: 'Invoice' },
  { label: 'Other', value: 'Other' },
] satisfies { label: string; value: RecordType }[];

export const FREQUENCY_OPTIONS: SelectOption[] = [
  { label: 'Once daily', value: 'Once daily' },
  { label: 'Twice daily', value: 'Twice daily' },
  { label: 'Three times daily', value: 'Three times daily' },
  { label: 'Four times daily', value: 'Four times daily' },
  { label: 'Every 8 hours', value: 'Every 8 hours' },
  { label: 'Every 12 hours', value: 'Every 12 hours' },
  { label: 'As needed', value: 'As needed' },
] satisfies { label: string; value: FrequencyType }[];

export const ACCESS_SCOPE_OPTIONS: { value: AccessScope; label: string; description: string }[] = [
  { value: 'summary', label: 'Medical summary', description: 'Allows viewing blood group, allergies, conditions, and emergency details.' },
  { value: 'records', label: 'Records', description: 'Allows reviewing uploaded reports and documents.' },
  { value: 'prescriptions', label: 'Prescriptions', description: 'Allows reviewing prescriptions and digitised medicines.' },
  { value: 'reminders', label: 'Reminder view', description: 'Allows seeing medication schedules and adherence context.' },
  { value: 'reminders_management', label: 'Manage reminders', description: 'Allows marking medicines as given or skipped.' },
  { value: 'medicine_ordering', label: 'Medicine ordering', description: 'Allows placing medicine orders for the patient.' },
  { value: 'chat', label: 'Care chat', description: 'Allows order and clarification chat where applicable.' },
  { value: 'emergency', label: 'Emergency contacts', description: 'Allows viewing emergency contact and support information.' },
];

export const DEFAULT_REQUEST_SCOPES: Record<'doctor' | 'hospital' | 'caretaker', AccessScope[]> = {
  doctor: ['summary', 'records', 'prescriptions'],
  hospital: ['summary', 'records', 'prescriptions'],
  caretaker: ['summary', 'records', 'prescriptions', 'reminders', 'medicine_ordering'],
};

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string; description: string }[] = [
  { value: 'placed', label: 'Placed', description: 'The request was submitted by the family or caretaker.' },
  { value: 'awaiting_chemist_approval', label: 'Awaiting approval', description: 'The order is waiting for a chemist to review it.' },
  { value: 'accepted', label: 'Accepted', description: 'A chemist accepted the order and is preparing fulfilment.' },
  { value: 'preparing', label: 'Preparing', description: 'Medicines are being arranged and verified.' },
  { value: 'packed', label: 'Packed', description: 'The order has been packed and is ready to dispatch.' },
  { value: 'out_for_delivery', label: 'Out for delivery', description: 'The chemist has marked the order as dispatched.' },
  { value: 'delivered', label: 'Delivered', description: 'The medicines were delivered successfully.' },
  { value: 'cancelled', label: 'Cancelled', description: 'The order was cancelled by the family or chemist.' },
  { value: 'rejected', label: 'Rejected', description: 'The order was rejected by the chemist.' },
];

export const NOTIFICATION_CATEGORY_OPTIONS: { value: NotificationCategory; label: string }[] = [
  { value: 'access_request', label: 'Access requests' },
  { value: 'access_update', label: 'Access updates' },
  { value: 'order_update', label: 'Order updates' },
  { value: 'chat_message', label: 'Chat messages' },
  { value: 'reminder', label: 'Reminders' },
  { value: 'appointment', label: 'Appointments' },
  { value: 'health_alert', label: 'Health alerts' },
  { value: 'system', label: 'System' },
];

export const APPOINTMENT_TYPE_OPTIONS: { label: string; value: AppointmentType }[] = [
  { label: 'Consultation', value: 'consultation' },
  { label: 'Follow-up', value: 'follow_up' },
  { label: 'Lab test', value: 'lab_test' },
  { label: 'Vaccination', value: 'vaccination' },
  { label: 'Procedure', value: 'procedure' },
  { label: 'Other', value: 'other' },
];

export const APPOINTMENT_STATUS_OPTIONS: { label: string; value: AppointmentStatus }[] = [
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Missed', value: 'missed' },
];

export const VITAL_METRIC_OPTIONS: { label: string; value: VitalMetricType; unit: string }[] = [
  { label: 'Blood pressure', value: 'blood_pressure', unit: 'mmHg' },
  { label: 'Sugar level', value: 'sugar', unit: 'mg/dL' },
  { label: 'Weight', value: 'weight', unit: 'kg' },
  { label: 'Oxygen', value: 'oxygen', unit: '%' },
  { label: 'Temperature', value: 'temperature', unit: 'F' },
  { label: 'Pulse', value: 'pulse', unit: 'bpm' },
];

export const ROLE_CONTACT_COPY: Record<AppRole, string> = {
  patient_admin: 'Owns the patient workspace, emergency summary, and consent flow.',
  family_member: 'Legacy patient-linked role retained for older demo data.',
  caretaker: 'Tracks daily care tasks, medicine support, and dependent follow-ups.',
  doctor: 'Reviews records, adds visit summaries, and guides follow-up care.',
  hospital: 'Coordinates institutional care, departments, and continuity support.',
  chemist: 'Handles medicine availability, orders, and delivery follow-through.',
};

export const SNOOZE_OPTIONS = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
] as const;

export const BLOOD_GROUP_OPTIONS: SelectOption[] = [
  { label: 'A+', value: 'A+' },
  { label: 'A-', value: 'A-' },
  { label: 'B+', value: 'B+' },
  { label: 'B-', value: 'B-' },
  { label: 'AB+', value: 'AB+' },
  { label: 'AB-', value: 'AB-' },
  { label: 'O+', value: 'O+' },
  { label: 'O-', value: 'O-' },
];

export const MESSAGES = {
  RECORD_UPLOADED: 'Record uploaded successfully.',
  RECORD_DELETED: 'Record deleted successfully.',
  PRESCRIPTION_UPLOADED: 'Prescription saved and reminders generated.',
  PRESCRIPTION_DELETED: 'Prescription deleted.',
  MEMBER_ADDED: 'Family member added.',
  MEMBER_UPDATED: 'Family member updated.',
  MEMBER_DELETED: 'Family member removed.',
  REMINDER_TAKEN: 'Marked as taken.',
  REMINDER_SNOOZED: 'Reminder snoozed.',
  REMINDER_SKIPPED: 'Reminder skipped.',
  OTP_SENT: 'OTP sent to your phone.',
  ACCESS_REQUEST_SENT: 'Access request sent for patient approval.',
  ACCESS_GRANTED: 'Access granted successfully.',
  ACCESS_REVOKED: 'Access revoked successfully.',
  ORDER_PLACED: 'Medicine order placed successfully.',
  ORDER_UPDATED: 'Order status updated.',
  MESSAGE_SENT: 'Message sent.',
  LOGGED_OUT: 'Logged out successfully.',
  GENERIC_ERROR: 'Something went wrong. Please try again.',
  FILE_TOO_LARGE: `File must be under ${MAX_FILE_SIZE_MB}MB.`,
  INVALID_FILE_TYPE: 'Only PDF, JPG, and PNG files are allowed.',
  INVALID_PHONE: 'Enter a valid 10-digit phone number.',
  INVALID_IDENTIFIER: 'Enter a valid email address or 10-digit phone number.',
  INVALID_OTP: 'Enter a valid 6-digit OTP.',
  AUTH_FAILED: 'Authentication failed. Please try again.',
  NETWORK_ERROR: 'Network error. Check your connection.',
  PERMISSION_DENIED: 'You do not have permission for this action.',
  SESSION_EXPIRED: 'Session expired. Please log in again.',
} as const;
