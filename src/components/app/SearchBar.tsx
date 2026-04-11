import { Search, X } from 'lucide-react';
import Input from '@/components/ui/Input';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search by patient, medicine, record, or ID',
}: SearchBarProps) {
  return (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      icon={<Search className="h-4 w-4" />}
      suffix={
        value ? (
          <button
            type="button"
            className="theme-chip inline-flex h-7 w-7 items-center justify-center rounded-full text-text-secondary transition hover:text-text-primary"
            onClick={() => onChange('')}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null
      }
    />
  );
}
