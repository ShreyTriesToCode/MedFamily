export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole =
  | 'patient_admin'
  | 'family_member'
  | 'caretaker'
  | 'doctor'
  | 'hospital'
  | 'chemist';

export type AppTheme = 'light' | 'dark';

export type RelationType =
  | 'Self'
  | 'Father'
  | 'Mother'
  | 'Spouse'
  | 'Son'
  | 'Daughter'
  | 'Brother'
  | 'Sister'
  | 'Grandfather'
  | 'Grandmother'
  | 'Other';

export type RecordType =
  | 'Lab Report'
  | 'X-Ray'
  | 'MRI'
  | 'CT Scan'
  | 'Prescription'
  | 'Consultation Notes'
  | 'Vaccination'
  | 'Discharge Summary'
  | 'Invoice'
  | 'Other';

export type FrequencyType =
  | 'Once daily'
  | 'Twice daily'
  | 'Three times daily'
  | 'Four times daily'
  | 'Every 8 hours'
  | 'Every 12 hours'
  | 'As needed';

export type ReminderStatus = 'pending' | 'taken' | 'missed' | 'snoozed' | 'skipped';

export type ReminderTab = 'today' | 'upcoming' | 'missed';

export type AccessRequestRole = Extract<AppRole, 'doctor' | 'hospital' | 'caretaker'>;

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected' | 'revoked' | 'expired';

export type AccessGrantStatus = 'active' | 'revoked' | 'expired';

export type AccessScope =
  | 'summary'
  | 'records'
  | 'prescriptions'
  | 'reminders'
  | 'reminders_management'
  | 'medicine_ordering'
  | 'chat'
  | 'emergency';

export type OrderStatus =
  | 'placed'
  | 'awaiting_chemist_approval'
  | 'accepted'
  | 'preparing'
  | 'packed'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'rejected';

export type NotificationCategory =
  | 'access_request'
  | 'access_update'
  | 'order_update'
  | 'chat_message'
  | 'reminder'
  | 'appointment'
  | 'health_alert'
  | 'system';

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'missed';

export type AppointmentType = 'consultation' | 'follow_up' | 'lab_test' | 'vaccination' | 'procedure' | 'other';

export type VitalMetricType =
  | 'blood_pressure'
  | 'sugar'
  | 'weight'
  | 'oxygen'
  | 'temperature'
  | 'pulse';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  primary_role: AppRole;
  avatar_url: string | null;
  address: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  allergies: string[];
  chronic_conditions: string[];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface DoctorProfile {
  user_id: string;
  specialization: string | null;
  clinic_name: string | null;
  license_number: string | null;
  address: string | null;
  consultation_note: string | null;
  created_at: string;
}

export interface HospitalProfile {
  user_id: string;
  hospital_name: string | null;
  department: string | null;
  registration_number: string | null;
  address: string | null;
  created_at: string;
}

export interface CaretakerProfile {
  user_id: string;
  relation: string | null;
  address: string | null;
  created_at: string;
}

export interface ChemistProfile {
  user_id: string;
  store_name: string | null;
  license_number: string | null;
  address: string | null;
  service_area: string | null;
  created_at: string;
}

export interface FamilyGroup {
  id: string;
  admin_id: string;
  group_name: string;
  share_code: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  group_id: string;
  name: string;
  relation: RelationType;
  date_of_birth: string | null;
  phone: string | null;
  blood_group: string | null;
  allergies: string[];
  chronic_conditions: string[];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface PatientRecord {
  id: string;
  member_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  record_type: RecordType;
  notes: string | null;
  upload_date: string;
  uploaded_by: string;
  member_name?: string;
  group_id?: string;
}

export interface MedicineEntry {
  name: string;
  dosage: string;
  frequency: FrequencyType;
  reminder_times: string[];
  start_date: string;
  end_date: string;
  notes?: string;
}

export interface Prescription {
  id: string;
  member_id: string;
  file_url: string | null;
  doctor_name: string | null;
  prescription_date: string;
  medicines: MedicineEntry[];
  uploaded_by: string;
  created_at: string;
  member_name?: string;
  group_id?: string;
}

export interface MedicineReminder {
  id: string;
  prescription_id: string | null;
  member_id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  reminder_times: string[];
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  member_name?: string;
  group_id?: string;
}

export interface ReminderLog {
  id: string;
  reminder_id: string;
  scheduled_time: string;
  taken_at: string | null;
  status: ReminderStatus;
  notes: string | null;
  created_at: string;
}

export interface AccessRequest {
  id: string;
  requester_id: string;
  requester_name?: string | null;
  requester_phone?: string | null;
  requester_organization?: string | null;
  target_group_id: string;
  requester_role: AccessRequestRole;
  status: AccessRequestStatus;
  reason: string | null;
  requested_scopes: AccessScope[];
  member_ids: string[];
  consent_code: string | null;
  expires_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  requester_profile?: Profile | null;
  target_group?: FamilyGroup | null;
}

export interface AccessGrant {
  id: string;
  request_id: string | null;
  grantee_user_id: string;
  grantee_name?: string | null;
  target_group_id: string;
  granted_by: string;
  grantee_role: AccessRequestRole;
  permission_scopes: AccessScope[];
  member_ids: string[];
  reason: string | null;
  consultation_note: string | null;
  status: AccessGrantStatus;
  starts_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  created_at: string;
  target_group?: FamilyGroup | null;
  grantee_profile?: Profile | null;
}

export interface AccessAuditLog {
  id: string;
  actor_id: string | null;
  target_group_id: string | null;
  member_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Json | null;
  created_at: string;
}

export interface MedicineOrder {
  id: string;
  order_number: string;
  family_group_id: string;
  patient_member_id: string | null;
  placed_by_user_id: string;
  placed_for_name: string;
  placed_for_phone: string | null;
  receiver_name: string;
  receiver_phone: string | null;
  delivery_address: string;
  location_text: string | null;
  map_link: string | null;
  notes: string | null;
  source_prescription_id: string | null;
  uploaded_prescription_url: string | null;
  chemist_id: string | null;
  chemist_name?: string | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  total_items: number;
  patient_member?: FamilyMember | null;
  chemist_profile?: Profile | null;
}

export interface MedicineOrderItem {
  id: string;
  order_id: string;
  medicine_name: string;
  dosage: string | null;
  quantity: string | null;
  instructions: string | null;
  source: 'manual' | 'prescription';
  is_substitute: boolean;
  substitute_for: string | null;
  created_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: OrderStatus;
  note: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface OrderChatMessage {
  id: string;
  order_id: string;
  sender_id: string;
  sender_name?: string | null;
  message: string;
  created_at: string;
  sender_profile?: Profile | null;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  family_group_id: string;
  member_id: string;
  title: string;
  appointment_type: AppointmentType;
  provider_name: string | null;
  provider_contact: string | null;
  provider_role: Extract<AppRole, 'doctor' | 'hospital'> | null;
  scheduled_for: string;
  location: string | null;
  mode: 'clinic' | 'video' | 'home' | null;
  notes: string | null;
  status: AppointmentStatus;
  follow_up_date: string | null;
  diagnosis: string | null;
  visit_summary: string | null;
  advice_summary: string | null;
  booked_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  member_name?: string;
}

export interface VitalEntry {
  id: string;
  family_group_id: string;
  member_id: string;
  metric_type: VitalMetricType;
  value_primary: string;
  value_secondary: string | null;
  unit: string | null;
  symptoms: string[];
  notes: string | null;
  recorded_at: string;
  recorded_by: string | null;
  member_name?: string;
}

export interface CareTask {
  id: string;
  family_group_id: string;
  member_id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  assigned_to_user_id: string | null;
  created_by: string | null;
  status: 'pending' | 'completed';
  completed_at: string | null;
  created_at: string;
  member_name?: string;
}

export interface AccessibleFamily {
  group: FamilyGroup;
  members: FamilyMember[];
  grant?: AccessGrant | null;
}

export interface DashboardMetric {
  label: string;
  value: number;
  description: string;
  trend?: string;
}

export interface LoginFormInputs {
  phone: string;
}

export interface OTPFormInputs {
  otp: string;
}

export interface FamilyMemberFormInputs {
  name: string;
  relation: RelationType;
  date_of_birth?: string;
  phone?: string;
  blood_group?: string;
  allergies?: string[];
  chronic_conditions?: string[];
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
}

export interface RecordUploadFormInputs {
  member_id: string;
  record_type: RecordType;
  notes?: string;
  file: FileList;
}

export interface PrescriptionFormInputs {
  member_id: string;
  doctor_name?: string;
  prescription_date: string;
  medicines: MedicineEntry[];
  file: FileList;
}

export interface ManualReminderFormInputs {
  member_id: string;
  medicine_name: string;
  dosage: string;
  frequency: FrequencyType;
  reminder_times: string[];
  start_date: string;
  end_date: string;
}

export interface AppointmentFormInputs {
  member_id: string;
  title: string;
  appointment_type: AppointmentType;
  provider_name?: string;
  provider_contact?: string;
  provider_role?: Extract<AppRole, 'doctor' | 'hospital'> | '';
  scheduled_for: string;
  location?: string;
  mode?: 'clinic' | 'video' | 'home';
  notes?: string;
  follow_up_date?: string;
}

export interface VitalEntryFormInputs {
  member_id: string;
  metric_type: VitalMetricType;
  value_primary: string;
  value_secondary?: string;
  unit?: string;
  symptoms?: string[];
  notes?: string;
  recorded_at: string;
}

export interface CareTaskFormInputs {
  member_id: string;
  title: string;
  description?: string;
  due_at?: string;
  assigned_to_user_id?: string;
}

export interface RoleRegistrationFormInputs {
  full_name: string;
  email?: string;
  phone?: string;
  password?: string;
  primary_role: AppRole;
  specialization?: string;
  clinic_name?: string;
  hospital_name?: string;
  department?: string;
  license_number?: string;
  relation?: string;
  store_name?: string;
  address?: string;
}

export interface AccessRequestFormInputs {
  share_code: string;
  reason: string;
  requested_scopes: AccessScope[];
  member_ids?: string[];
}

export interface AccessApprovalFormInputs {
  request_id: string;
  consent_code: string;
  permission_scopes: AccessScope[];
  member_ids: string[];
  expires_at?: string;
  consultation_note?: string;
}

export interface MedicineOrderItemInput {
  medicine_name: string;
  dosage?: string;
  quantity?: string;
  instructions?: string;
  source?: 'manual' | 'prescription';
  is_substitute?: boolean;
  substitute_for?: string;
}

export interface MedicineOrderFormInputs {
  family_group_id: string;
  patient_member_id?: string;
  receiver_name: string;
  receiver_phone?: string;
  delivery_address: string;
  location_text?: string;
  map_link?: string;
  notes?: string;
  source_prescription_id?: string;
  uploaded_prescription?: File | null;
  items: MedicineOrderItemInput[];
  placed_for_name: string;
  placed_for_phone?: string;
}

export interface OrderFilters {
  status?: OrderStatus | 'all';
  search?: string;
  family_group_id?: string;
}

export interface OrderMessageFormInputs {
  message: string;
}

export interface NotificationFilters {
  category?: NotificationCategory | 'all';
  unreadOnly?: boolean;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface FilterState {
  member_id?: string;
  record_type?: RecordType;
  search?: string;
  date_from?: string;
  date_to?: string;
}
