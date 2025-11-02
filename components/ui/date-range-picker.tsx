'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { format, subDays } from 'date-fns';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type DateRangePreset = {
  label: string;
  value: string;
  getDays: () => number | null;
};

const presets: DateRangePreset[] = [
  { label: 'Last 7 days', value: '7', getDays: () => 7 },
  { label: 'Last 30 days', value: '30', getDays: () => 30 },
  { label: 'Last 90 days', value: '90', getDays: () => 90 },
  { label: 'This year', value: '365', getDays: () => 365 },
  { label: 'All time', value: 'all', getDays: () => null },
  { label: 'Custom range', value: 'custom', getDays: () => null },
];

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [selectedPreset, setSelectedPreset] = React.useState<string>('all');
  const [isOpen, setIsOpen] = React.useState(false);

  const handlePresetChange = (presetValue: string) => {
    setSelectedPreset(presetValue);

    if (presetValue === 'custom') {
      // Open calendar for custom selection
      setIsOpen(true);
      return;
    }

    const preset = presets.find((p) => p.value === presetValue);
    if (!preset) return;

    const days = preset.getDays();
    if (days === null) {
      // "All time" - clear date range
      onChange?.(undefined);
    } else {
      // Calculate date range based on preset
      const now = new Date();
      now.setHours(23, 59, 59, 999); // End of today
      const from = subDays(now, days);
      from.setHours(0, 0, 0, 0); // Start of that day
      onChange?.({ from, to: now });
    }
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    onChange?.(range);
    if (range?.from && range?.to) {
      setSelectedPreset('custom');
      setIsOpen(false);
    }
  };

  // Determine display text
  const getDisplayText = () => {
    if (selectedPreset === 'custom' && value?.from) {
      if (value.to) {
        return `${format(value.from, 'MMM dd')} - ${format(value.to, 'MMM dd, yyyy')}`;
      }
      return format(value.from, 'MMM dd, yyyy');
    }
    const preset = presets.find((p) => p.value === selectedPreset);
    return preset?.label || 'Select date range';
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Select value={selectedPreset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-full lg:w-48">
          <CalendarIcon className="mr-2 h-4 w-4" />
          <SelectValue placeholder="Date range" />
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedPreset === 'custom' && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'justify-start text-left font-normal',
                !value && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value?.from ? (
                value.to ? (
                  <>
                    {format(value.from, 'LLL dd, y')} - {format(value.to, 'LLL dd, y')}
                  </>
                ) : (
                  format(value.from, 'LLL dd, y')
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={value?.from}
              selected={value}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
