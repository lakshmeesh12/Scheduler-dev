import { useState, useEffect } from "react";
import { Globe, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

// Common timezones with their display names
const TIMEZONES = [
  // Americas
  { value: 'America/New_York', label: 'Eastern Time (ET)', region: 'Americas', offset: 'UTC-5/-4' },
  { value: 'America/Chicago', label: 'Central Time (CT)', region: 'Americas', offset: 'UTC-6/-5' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', region: 'Americas', offset: 'UTC-7/-6' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', region: 'Americas', offset: 'UTC-8/-7' },
  { value: 'America/Toronto', label: 'Toronto', region: 'Americas', offset: 'UTC-5/-4' },
  { value: 'America/Vancouver', label: 'Vancouver', region: 'Americas', offset: 'UTC-8/-7' },
  { value: 'America/Sao_Paulo', label: 'São Paulo', region: 'Americas', offset: 'UTC-3' },
  { value: 'America/Mexico_City', label: 'Mexico City', region: 'Americas', offset: 'UTC-6/-5' },
  
  // Europe
  { value: 'Europe/London', label: 'London (GMT/BST)', region: 'Europe', offset: 'UTC+0/+1' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)', region: 'Europe', offset: 'UTC+1/+2' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)', region: 'Europe', offset: 'UTC+1/+2' },
  { value: 'Europe/Rome', label: 'Rome (CET/CEST)', region: 'Europe', offset: 'UTC+1/+2' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)', region: 'Europe', offset: 'UTC+1/+2' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)', region: 'Europe', offset: 'UTC+1/+2' },
  { value: 'Europe/Stockholm', label: 'Stockholm (CET/CEST)', region: 'Europe', offset: 'UTC+1/+2' },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)', region: 'Europe', offset: 'UTC+3' },
  
  // Asia Pacific
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', region: 'Asia Pacific', offset: 'UTC+9' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)', region: 'Asia Pacific', offset: 'UTC+8' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)', region: 'Asia Pacific', offset: 'UTC+8' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', region: 'Asia Pacific', offset: 'UTC+8' },
  { value: 'Asia/Seoul', label: 'Seoul (KST)', region: 'Asia Pacific', offset: 'UTC+9' },
  { value: 'Asia/Kolkata', label: 'Mumbai/Delhi (IST)', region: 'Asia Pacific', offset: 'UTC+5:30' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)', region: 'Asia Pacific', offset: 'UTC+4' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)', region: 'Asia Pacific', offset: 'UTC+10/+11' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEDT/AEST)', region: 'Asia Pacific', offset: 'UTC+10/+11' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZDT/NZST)', region: 'Asia Pacific', offset: 'UTC+12/+13' },
  
  // Middle East & Africa
  { value: 'Africa/Cairo', label: 'Cairo (EET)', region: 'Middle East & Africa', offset: 'UTC+2' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)', region: 'Middle East & Africa', offset: 'UTC+2' },
  { value: 'Asia/Jerusalem', label: 'Jerusalem (IST)', region: 'Middle East & Africa', offset: 'UTC+2/+3' },
];

interface TimezoneSelectorProps {
  value: string;
  onChange: (timezone: string) => void;
  label?: string;
  className?: string;
}

export const TimezoneSelector = ({ value, onChange, label = "Timezone", className }: TimezoneSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [userTimezone, setUserTimezone] = useState<string>('');

  useEffect(() => {
    // Detect user's local timezone
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setUserTimezone(detected);
    
    // Set default if no value provided
    if (!value && detected) {
      onChange(detected);
    }
  }, [value, onChange]);

  const selectedTimezone = TIMEZONES.find(tz => tz.value === value);
  const currentTime = new Date().toLocaleTimeString('en-US', { 
    timeZone: value || userTimezone,
    hour12: true,
    hour: '2-digit',
    minute: '2-digit'
  });

  const groupedTimezones = TIMEZONES.reduce((acc, tz) => {
    if (!acc[tz.region]) {
      acc[tz.region] = [];
    }
    acc[tz.region].push(tz);
    return acc;
  }, {} as Record<string, typeof TIMEZONES>);

  return (
    <div className={className}>
      <Label htmlFor="timezone" className="text-sm font-medium mb-2 block">
        {label}
      </Label>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-start text-left font-normal"
          >
            <Globe className="w-4 h-4 mr-2" />
            <div className="flex-1 min-w-0">
              {selectedTimezone ? (
                <div className="flex items-center justify-between">
                  <span className="truncate">{selectedTimezone.label}</span>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {currentTime}
                  </Badge>
                </div>
              ) : (
                <span className="text-muted-foreground">Select timezone...</span>
              )}
            </div>
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search timezones..." />
            <CommandList className="max-h-[300px]">
              <CommandEmpty>No timezone found.</CommandEmpty>
              
              {/* User's Current Timezone */}
              {userTimezone && (
                <CommandGroup heading="Current Location">
                  <CommandItem
                    value={userTimezone}
                    onSelect={() => {
                      onChange(userTimezone);
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center">
                        <Globe className="w-4 h-4 mr-2" />
                        <span>
                          {TIMEZONES.find(tz => tz.value === userTimezone)?.label || 
                           `${userTimezone} (Detected)`}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Current
                      </Badge>
                    </div>
                  </CommandItem>
                </CommandGroup>
              )}
              
              {/* Grouped Timezones */}
              {Object.entries(groupedTimezones).map(([region, timezones]) => (
                <CommandGroup key={region} heading={region}>
                  {timezones.map((timezone) => {
                    const timeInZone = new Date().toLocaleTimeString('en-US', {
                      timeZone: timezone.value,
                      hour12: true,
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    
                    return (
                      <CommandItem
                        key={timezone.value}
                        value={`${timezone.label} ${timezone.value} ${timezone.offset}`}
                        onSelect={() => {
                          onChange(timezone.value);
                          setOpen(false);
                        }}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center">
                              <Globe className="w-4 h-4 mr-2 text-muted-foreground" />
                              <span className="truncate">{timezone.label}</span>
                            </div>
                            <div className="text-xs text-muted-foreground ml-6">
                              {timezone.offset}
                            </div>
                          </div>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {timeInZone}
                          </Badge>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {selectedTimezone && (
        <div className="mt-2 text-xs text-muted-foreground">
          Current time: {currentTime} ({selectedTimezone.offset})
        </div>
      )}
    </div>
  );
};