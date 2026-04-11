import { useState, type ComponentType } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Building2,
  HeartPulse,
  Mail,
  PackageSearch,
  Phone,
  ShieldPlus,
  Stethoscope,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import { APP_ROLES, MESSAGES, ROUTES } from '@/lib/constants';
import type { AppRole, RoleRegistrationFormInputs } from '@/lib/types';
import { showErrorToast, showSuccessToast } from '@/utils/errorHandler';
import { validateEmail, validatePassword, validatePhoneNumber } from '@/utils/validators';

type AuthMode = 'signin' | 'register';

const ROLE_CONFIG: Record<
  AppRole,
  {
    icon: ComponentType<{ className?: string }>;
    supportText: string;
  }
> = {
  patient_admin: {
    icon: HeartPulse,
    supportText: 'Create and manage a secure patient and family health workspace.',
  },
  family_member: {
    icon: HeartPulse,
    supportText: 'Legacy patient-linked role retained only for older demo accounts.',
  },
  caretaker: {
    icon: ShieldPlus,
    supportText: 'Help manage reminders, records, and medicine orders.',
  },
  doctor: {
    icon: Stethoscope,
    supportText: 'Access patient records after secure family approval.',
  },
  hospital: {
    icon: Building2,
    supportText: 'Coordinate hospital access with verified, time-bound permissions.',
  },
  chemist: {
    icon: PackageSearch,
    supportText: 'Receive medicine orders, update status, and reply in chat.',
  },
};

const AUTH_ROLES = APP_ROLES;

function buildOnboardingDefaults(role: AppRole): RoleRegistrationFormInputs {
  return {
    full_name: '',
    primary_role: role,
    phone: '',
    email: '',
    specialization: '',
    clinic_name: '',
    hospital_name: '',
    department: '',
    license_number: '',
    relation: '',
    store_name: '',
    address: '',
  };
}

function isValidIdentifier(identifier: string): boolean {
  return validateEmail(identifier) || validatePhoneNumber(identifier);
}

export default function Login() {
  const {
    loading,
    user,
    profile,
    role,
    needsOnboarding,
    signInWithPassword,
    signUpWithPassword,
    resetPassword,
    completeOnboarding,
  } = useAuth();

  const [selectedRole, setSelectedRole] = useState<AppRole>('patient_admin');
  const [mode, setMode] = useState<AuthMode>('signin');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [onboarding, setOnboarding] = useState<RoleRegistrationFormInputs>(() =>
    buildOnboardingDefaults('patient_admin')
  );

  const activeRole = needsOnboarding ? role ?? selectedRole : selectedRole;
  const resolvedActiveRole = activeRole === 'family_member' ? 'patient_admin' : activeRole;
  const roleConfig = ROLE_CONFIG[resolvedActiveRole];
  const RoleIcon = roleConfig.icon;
  const selectedRoleOption = AUTH_ROLES.find((option) => option.value === resolvedActiveRole) ?? AUTH_ROLES[0];

  if (loading) {
    return <LoadingSpinner variant="page" />;
  }

  if (user && !needsOnboarding) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  const handlePasswordAuth = async () => {
    const trimmedIdentifier = identifier.trim();
    const trimmedPassword = password.trim();

    if (!isValidIdentifier(trimmedIdentifier)) {
      showErrorToast(MESSAGES.INVALID_IDENTIFIER);
      return;
    }

    const passwordError = validatePassword(trimmedPassword);
    if (passwordError) {
      showErrorToast(passwordError);
      return;
    }

    if (mode === 'register' && !fullName.trim()) {
      showErrorToast('Enter your full name to create an account.');
      return;
    }

    setBusy(true);
    const result =
      mode === 'signin'
        ? await signInWithPassword({
            identifier: trimmedIdentifier,
            password: trimmedPassword,
          })
        : await signUpWithPassword({
            identifier: trimmedIdentifier,
            password: trimmedPassword,
            primary_role: selectedRole,
            full_name: fullName.trim(),
          });
    setBusy(false);

    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    showSuccessToast(mode === 'signin' ? 'Welcome back to MedFamily.' : 'Account created. Finish your profile to continue.');
  };

  const handleCompleteOnboarding = async () => {
    setBusy(true);
    const result = await completeOnboarding({
      ...onboarding,
      full_name: onboarding.full_name || profile?.full_name || fullName,
      phone: onboarding.phone || profile?.phone || user?.phone || '',
      email: onboarding.email || profile?.email || user?.email || '',
      primary_role: role ?? selectedRole,
    });
    setBusy(false);

    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    showSuccessToast('Profile saved. Your care workspace is ready.');
  };

  const handleResetPassword = async () => {
    if (!isValidIdentifier(recoveryIdentifier.trim())) {
      showErrorToast(MESSAGES.INVALID_IDENTIFIER);
      return;
    }

    const passwordError = validatePassword(recoveryPassword.trim());
    if (passwordError) {
      showErrorToast(passwordError);
      return;
    }

    setBusy(true);
    const result = await resetPassword(recoveryIdentifier.trim(), recoveryPassword.trim());
    setBusy(false);

    if (result.error) {
      showErrorToast(result.error);
      return;
    }

    setShowRecovery(false);
    setRecoveryIdentifier('');
    setRecoveryPassword('');
    showSuccessToast('Password updated. You can log in now.');
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6"
      style={{
        background:
          'radial-gradient(circle at top, color-mix(in srgb, var(--color-primary-300) 22%, transparent), transparent 34%), linear-gradient(180deg, var(--color-background) 0%, var(--color-background-strong) 100%)',
      }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center justify-center">
        <Card className="glass w-full rounded-[32px] p-6 shadow-[0_28px_80px_rgba(15,72,99,0.12)] sm:p-8">
          {needsOnboarding ? (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="theme-icon-badge flex h-12 w-12 items-center justify-center rounded-3xl">
                  <RoleIcon className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-primary-700">Complete profile</p>
                  <h1 className="text-2xl font-bold text-text-primary">Finish setting up your account</h1>
                  <p className="text-sm text-text-secondary">{roleConfig.supportText}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Full name"
                  value={onboarding.full_name}
                  onChange={(event) => setOnboarding((prev) => ({ ...prev, full_name: event.target.value }))}
                />
                <Input
                  label="Phone"
                  value={onboarding.phone}
                  onChange={(event) => setOnboarding((prev) => ({ ...prev, phone: event.target.value }))}
                />
                <Input
                  label="Email"
                  type="email"
                  value={onboarding.email}
                  onChange={(event) => setOnboarding((prev) => ({ ...prev, email: event.target.value }))}
                />
                <Input
                  label="Address"
                  value={onboarding.address}
                  onChange={(event) => setOnboarding((prev) => ({ ...prev, address: event.target.value }))}
                />
                {activeRole === 'doctor' ? (
                  <>
                    <Input
                      label="Specialization"
                      value={onboarding.specialization}
                      onChange={(event) => setOnboarding((prev) => ({ ...prev, specialization: event.target.value }))}
                    />
                    <Input
                      label="Clinic name"
                      value={onboarding.clinic_name}
                      onChange={(event) => setOnboarding((prev) => ({ ...prev, clinic_name: event.target.value }))}
                    />
                  </>
                ) : null}
                {activeRole === 'hospital' ? (
                  <>
                    <Input
                      label="Hospital name"
                      value={onboarding.hospital_name}
                      onChange={(event) => setOnboarding((prev) => ({ ...prev, hospital_name: event.target.value }))}
                    />
                    <Input
                      label="Department"
                      value={onboarding.department}
                      onChange={(event) => setOnboarding((prev) => ({ ...prev, department: event.target.value }))}
                    />
                  </>
                ) : null}
                {activeRole === 'caretaker' ? (
                  <Input
                    label="Relation to patient"
                    value={onboarding.relation}
                    onChange={(event) => setOnboarding((prev) => ({ ...prev, relation: event.target.value }))}
                  />
                ) : null}
                {activeRole === 'chemist' ? (
                  <Input
                    label="Store name"
                    value={onboarding.store_name}
                    onChange={(event) => setOnboarding((prev) => ({ ...prev, store_name: event.target.value }))}
                  />
                ) : null}
                {activeRole !== 'patient_admin' ? (
                  <Input
                    label="License / registration number"
                    value={onboarding.license_number}
                    onChange={(event) => setOnboarding((prev) => ({ ...prev, license_number: event.target.value }))}
                  />
                ) : null}
              </div>

              <Button fullWidth loading={busy} onClick={handleCompleteOnboarding}>
                Enter MedFamily
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="theme-chip-strong inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold">
                  <HeartPulse className="h-4 w-4" />
                  MedFamily
                </div>

                <div className="space-y-2">
                  <h1 className="text-3xl font-bold text-text-primary">
                    {mode === 'signin' ? 'Log in' : 'Create account'}
                  </h1>
                  <p className="text-sm text-text-secondary">
                    Sign in with your email or phone number and password.
                  </p>
                </div>

                <div className="theme-surface-soft inline-flex rounded-full p-1">
                  {(['signin', 'register'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        mode === value ? 'theme-chip-strong text-text-primary soft-shadow' : 'text-text-secondary'
                      }`}
                      onClick={() => setMode(value)}
                    >
                      {value === 'signin' ? 'Log in' : 'Register'}
                    </button>
                  ))}
                </div>
              </div>

              {mode === 'register' ? (
                <div className="space-y-3">
                  <Select
                    label="Register as"
                    options={AUTH_ROLES.map((option) => ({ label: option.label, value: option.value }))}
                    value={selectedRole}
                    onChange={(event) => {
                      const nextRole = event.target.value as AppRole;
                      setSelectedRole(nextRole);
                      setOnboarding(buildOnboardingDefaults(nextRole));
                    }}
                    helperText="Choose the role that should shape your dashboard, permissions, and onboarding fields."
                  />

                  <div className="theme-surface-soft rounded-[24px] p-4">
                    <div className="flex items-start gap-3">
                      <div className="theme-icon-badge flex h-11 w-11 items-center justify-center rounded-[20px]">
                        <RoleIcon className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-text-primary">{selectedRoleOption.label}</p>
                        <p className="text-xs text-text-secondary">{selectedRoleOption.description}</p>
                        <p className="text-xs text-text-tertiary">{roleConfig.supportText}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="space-y-4">
                {mode === 'register' ? (
                  <Input
                    label="Full name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Enter your full name"
                  />
                ) : null}

                <Input
                  label="Email or phone"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="name@example.com or 9876543210"
                  helperText="Use the email address or phone number you registered with."
                  icon={
                    validateEmail(identifier) ? (
                      <Mail className="h-4 w-4" />
                    ) : (
                      <Phone className="h-4 w-4" />
                    )
                  }
                />

                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === 'signin' ? 'Enter your password' : 'Create a password'}
                  helperText="Use at least 6 characters."
                />

                <Button fullWidth loading={busy} onClick={handlePasswordAuth}>
                  {mode === 'signin' ? 'Log in' : 'Create account'}
                </Button>
                {mode === 'signin' ? (
                  <button
                    type="button"
                    className="w-full text-center text-sm font-semibold text-primary-700 transition hover:text-primary-800"
                    onClick={() => {
                      setRecoveryIdentifier(identifier);
                      setShowRecovery(true);
                    }}
                  >
                    Forgot password?
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Modal
        isOpen={showRecovery}
        onClose={() => setShowRecovery(false)}
        title="Reset password"
        description="Demo recovery flow for the current local database-backed auth setup."
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowRecovery(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={handleResetPassword}>
              Update password
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Email or phone"
            value={recoveryIdentifier}
            onChange={(event) => setRecoveryIdentifier(event.target.value)}
            placeholder="name@example.com or 9876543210"
          />
          <Input
            label="New password"
            type="password"
            value={recoveryPassword}
            onChange={(event) => setRecoveryPassword(event.target.value)}
            helperText="Use at least 6 characters for the demo account reset."
          />
        </div>
      </Modal>
    </div>
  );
}
