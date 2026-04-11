import {
    format,
    isToday as _isToday,
    isFuture as _isFuture,
    isPast as _isPast,
    addDays as _addDays,
    differenceInYears,
    parseISO,
} from 'date-fns';

export function formatDate(date: string | Date, fmt = 'dd MMM yyyy'): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, fmt);
}

export function formatDateTime(date: string | Date): string {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, 'dd MMM yyyy, hh:mm a');
}

export function isToday(date: string | Date): boolean {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return _isToday(d);
}

export function isFuture(date: string | Date): boolean {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return _isFuture(d);
}

export function isPast(date: string | Date): boolean {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return _isPast(d);
}

export function addDays(date: string | Date, days: number): Date {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return _addDays(d, days);
}

export function calculateAge(dob: string | null): number | null {
    if (!dob) return null;
    return differenceInYears(new Date(), parseISO(dob));
}

export function formatReminderTime(time: string): string {
    // time is "HH:mm" or "HH:mm:ss"
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export function getReminderTimesForFrequency(frequency: string): string[] {
    switch (frequency) {
        case 'Once daily':
            return ['08:00'];
        case 'Twice daily':
            return ['08:00', '20:00'];
        case 'Three times daily':
            return ['08:00', '14:00', '20:00'];
        case 'Four times daily':
            return ['08:00', '12:00', '16:00', '20:00'];
        case 'Every 8 hours':
            return ['06:00', '14:00', '22:00'];
        case 'Every 12 hours':
            return ['08:00', '20:00'];
        case 'As needed':
            return [];
        default:
            return ['08:00'];
    }
}

export function todayISO(): string {
    return format(new Date(), 'yyyy-MM-dd');
}
