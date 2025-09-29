import { useState, useEffect } from "react";
import { Calendar as LucideCalendar, Clock, Users, Check, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format, parse, addMinutes } from "date-fns";
import { fetchAvailableSlots, fetchAllAvailableSlots, ApiCandidate, fetchPanelEvents, checkCustomSlot, PanelEventsResponse } from "@/api";
import { toast } from "@/components/ui/use-toast";
import { CandidateNotification } from "./CandidateNotification";
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment-timezone';
import 'react-big-calendar/lib/css/react-big-calendar.css';

interface PanelMember {
  user_id: string;
  display_name: string;
  email: string;
  role: string;
}

interface TimeSlot {
  id: string;
  start: string;
  end: string;
  date: string;
  available: boolean;
  availableMembers: string[];
}

interface InterviewDetails {
  title: string;
  description: string;
  duration: number;
  date: Date | string | null;
  location: string;
  meetingType: 'in-person' | 'virtual';
  preferred_timezone: string;
}

interface AvailabilityCalendarProps {
  panelMembers: PanelMember[];
  selectedDate?: Date | null;
  preferredTimezone: string;
  candidate: ApiCandidate;
  interviewDetails: InterviewDetails | null;
  onTimeSlotSelect: (slot: TimeSlot) => void;
  roundStatus?: 'draft' | 'scheduled' | 'completed';
}

interface BigCalEvent {
  title: string;
  start: Date;
  end: Date;
}

const localizer = momentLocalizer(moment);

export const AvailabilityCalendar = ({
  panelMembers,
  selectedDate,
  preferredTimezone,
  candidate,
  interviewDetails,
  onTimeSlotSelect,
  roundStatus,
}: AvailabilityCalendarProps) => {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrideWorkingHours, setOverrideWorkingHours] = useState(false);
  const [hasCheckedAvailability, setHasCheckedAvailability] = useState(false);
  const [mode, setMode] = useState<'single' | 'multiple'>('single');
  const [showNotification, setShowNotification] = useState(false);
  const [panelEvents, setPanelEvents] = useState<PanelEventsResponse | null>(null);
  const [bigCalEvents, setBigCalEvents] = useState<BigCalEvent[]>([]);
  const [minTime, setMinTime] = useState(new Date());
  const [maxTime, setMaxTime] = useState(new Date());
  const [customStartTime, setCustomStartTime] = useState('');
  const [customEndTime, setCustomEndTime] = useState('');
  const [customAvailability, setCustomAvailability] = useState<{ available: boolean; reason?: string } | null>(null);
  const [customSlot, setCustomSlot] = useState<TimeSlot | null>(null);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  useEffect(() => {
    moment.tz.setDefault(preferredTimezone);
  }, [preferredTimezone]);

  useEffect(() => {
    console.log("AvailabilityCalendar: Candidate prop received:", candidate);
    console.log("AvailabilityCalendar: Panel members:", panelMembers);
    console.log("AvailabilityCalendar: Selected slot:", selectedSlot);
    console.log("AvailabilityCalendar: Selected slots (multiple):", selectedSlots);
    console.log("AvailabilityCalendar: Mode:", mode);
    console.log("AvailabilityCalendar: Show notification:", showNotification);
    console.log("AvailabilityCalendar: Round status:", roundStatus);
  }, [candidate, panelMembers, selectedSlot, selectedSlots, mode, showNotification, roundStatus]);

  const handleCheckAvailability = () => {
    console.log("AvailabilityCalendar: Checking availability for panel members:", panelMembers);
    setHasCheckedAvailability(true);
  };

  useEffect(() => {
    if (!hasCheckedAvailability) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      const sessionId = localStorage.getItem("session_id");
      console.log("AvailabilityCalendar: Fetching slots with session_id:", sessionId);
      if (!sessionId) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Session ID not found. Please complete previous steps.",
        });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const slotsResponse = overrideWorkingHours
          ? await fetchAllAvailableSlots(sessionId)
          : await fetchAvailableSlots(sessionId);

        console.log("AvailabilityCalendar: API response for slots:", slotsResponse);

        const validMemberIds = panelMembers
          .filter(member => {
            if (!member.user_id) {
              console.warn("AvailabilityCalendar: Panel member missing user_id:", member);
              return false;
            }
            return true;
          })
          .map(member => member.user_id);

        const slots = slotsResponse.slots.map((slot: any, index: number) => ({
          id: `${slot.date}-${slot.start}-${index}`,
          start: slot.start,
          end: slot.end,
          date: slot.date,
          available: true,
          availableMembers: validMemberIds,
        }));

        const filteredSlots = selectedDate
          ? slots.filter((slot: TimeSlot) => slot.date === format(selectedDate, "yyyy-MM-dd"))
          : slots;

        console.log("AvailabilityCalendar: Filtered slots:", filteredSlots);
        setTimeSlots(filteredSlots);

        const eventsResponse = await fetchPanelEvents(sessionId);
        console.log("AvailabilityCalendar: Panel events response:", eventsResponse);
        setPanelEvents(eventsResponse);

        const combinedEvents = computeCombinedEvents(eventsResponse.events);
        setBigCalEvents(combinedEvents);

        let minH = 0;
        let maxH = 23;
        if (!overrideWorkingHours && eventsResponse.common_working) {
          minH = parseInt(eventsResponse.common_working.start.split(':')[0]);
          maxH = parseInt(eventsResponse.common_working.end.split(':')[0]);
        }
        let targetDateStr = '';
        if (interviewDetails?.date) {
          if (interviewDetails.date instanceof Date) {
            targetDateStr = interviewDetails.date.toISOString().split('T')[0];
          } else if (typeof interviewDetails.date === 'string') {
            targetDateStr = interviewDetails.date;
          }
        } else if (selectedDate) {
          targetDateStr = selectedDate.toISOString().split('T')[0];
        } else {
          targetDateStr = new Date().toISOString().split('T')[0];
        }
        setMinTime(new Date(`${targetDateStr}T${minH.toString().padStart(2, '0')}:00:00`));
        setMaxTime(new Date(`${targetDateStr}T${maxH.toString().padStart(2, '0')}:59:59`));
      } catch (error) {
        console.error('AvailabilityCalendar: Error fetching data:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to fetch data",
        });
        setBigCalEvents([]); // Fallback to empty events
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [panelMembers, overrideWorkingHours, selectedDate, hasCheckedAvailability, interviewDetails]);

  const computeCombinedEvents = (events: Record<string, { start: string; end: string; subject: string }[]>) => {
    const allEvents: { start: Date; end: Date }[] = [];
    for (const evs of Object.values(events)) {
      evs.forEach(ev => {
        allEvents.push({
          start: new Date(ev.start),
          end: new Date(ev.end),
        });
      });
    }

    allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());

    const merged = [];
    for (const ev of allEvents) {
      if (merged.length === 0 || merged[merged.length - 1].end < ev.start) {
        merged.push({ ...ev, title: 'Busy' });
      } else {
        merged[merged.length - 1].end = new Date(Math.max(merged[merged.length - 1].end.getTime(), ev.end.getTime()));
      }
    }

    return merged;
  };

  const formatTime = (time: string) => {
    console.log("AvailabilityCalendar: Formatting time:", time);
    try {
      const parsedTime = parse(time, "hh:mm a", new Date());
      return format(parsedTime, "h:mm a");
    } catch (error) {
      console.error(`AvailabilityCalendar: Failed to format time: ${time}`, error);
      return time;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = parse(dateStr, "yyyy-MM-dd", new Date());
      const formatted = format(date, "EEEE, MMM d");
      console.log(`AvailabilityCalendar: Formatted date ${dateStr} to:`, formatted);
      return formatted;
    } catch (error) {
      console.error(`AvailabilityCalendar: Failed to format date: ${dateStr}`, error);
      return dateStr;
    }
  };

  const getAvailableMemberNames = (slot: TimeSlot) => {
    const members = panelMembers
      .filter((member) => slot.availableMembers.includes(member.user_id))
      .map((member) => member.display_name);
    console.log(`AvailabilityCalendar: Available members for slot ${slot.id}:`, members);
    return members;
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    console.log("AvailabilityCalendar: Slot selected:", slot);
    if (mode === 'multiple') {
      const exists = selectedSlots.some((s) => s.id === slot.id);
      setSelectedSlots((prev) => exists ? prev.filter((s) => s.id !== slot.id) : [...prev, slot]);
    } else {
      setSelectedSlot(slot);
    }
  };

  const handleCustomStartChange = (value: string) => {
    setCustomStartTime(value);
    setCustomAvailability(null); // Reset availability status
    setCustomSlot(null); // Reset custom slot
    if (interviewDetails?.duration && value) {
      try {
        const startDate = parse(value, "HH:mm", new Date());
        const endDate = addMinutes(startDate, interviewDetails.duration);
        setCustomEndTime(format(endDate, "HH:mm"));
      } catch (error) {
        console.error("Invalid start time format");
        setCustomEndTime('');
      }
    } else {
      setCustomEndTime('');
    }
  };

  const checkCustomAvailability = async () => {
    if (!customStartTime || !customEndTime || !interviewDetails?.date) {
      toast({ variant: "destructive", title: "Error", description: "Please enter a valid start time." });
      return;
    }

    const sessionId = localStorage.getItem("session_id");
    if (!sessionId) {
      toast({ variant: "destructive", title: "Error", description: "Session ID not found." });
      return;
    }

    let dateStr = '';
    if (interviewDetails.date instanceof Date) {
      dateStr = format(interviewDetails.date, "yyyy-MM-dd");
    } else if (typeof interviewDetails.date === 'string') {
      dateStr = interviewDetails.date;
    } else {
      toast({ variant: "destructive", title: "Error", description: "Invalid interview date." });
      return;
    }

    const startStr = `${dateStr}T${customStartTime}:00`;
    const endStr = `${dateStr}T${customEndTime}:00`;

    setIsCheckingAvailability(true);
    try {
      const check = await checkCustomSlot(sessionId, startStr, endStr, overrideWorkingHours);
      setCustomAvailability(check);
      if (check.available) {
        const slot: TimeSlot = {
          id: `custom-${Date.now()}`,
          start: format(parse(customStartTime, "HH:mm", new Date()), "hh:mm a"),
          end: format(parse(customEndTime, "HH:mm", new Date()), "hh:mm a"),
          date: dateStr,
          available: true,
          availableMembers: panelMembers.map(m => m.user_id),
        };
        setCustomSlot(slot);
      } else {
        toast({ variant: "destructive", title: "Slot Not Available", description: check.reason });
      }
    } catch (error) {
      console.error('AvailabilityCalendar: Error checking custom slot:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to check custom slot",
      });
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const handleSaveCustomSlot = () => {
    if (customSlot) {
      handleSlotSelect(customSlot);
    }
  };

  const confirmSelection = () => {
    console.log("AvailabilityCalendar: Confirming selection. Candidate:", candidate, "Mode:", mode, "Selected slot:", selectedSlot, "Selected slots:", selectedSlots);
    if (!candidate || !candidate.profile_id) {
      console.error("AvailabilityCalendar: Candidate information missing or invalid:", candidate);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Candidate information is missing.",
      });
      return;
    }
    if ((mode === 'single' && selectedSlot) || (mode === 'multiple' && selectedSlots.length > 0)) {
      console.log("AvailabilityCalendar: Showing CandidateNotification");
      if (mode === 'multiple') {
        selectedSlots.forEach(slot => onTimeSlotSelect(slot));
      } else {
        onTimeSlotSelect(selectedSlot!);
      }
      setShowNotification(true);
    } else {
      console.error("AvailabilityCalendar: No valid slot selected. Mode:", mode, "Selected slot:", selectedSlot, "Selected slots:", selectedSlots);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select at least one time slot.",
      });
    }
  };

  const handleNotificationSent = () => {
    console.log("AvailabilityCalendar: Notification sent, updating parent state");
    setShowNotification(false);
    if (roundStatus !== 'completed') {
      setSelectedSlot(null);
      setSelectedSlots([]);
      setCustomStartTime('');
      setCustomEndTime('');
      setCustomAvailability(null);
      setCustomSlot(null);
    }
  };

  const groupSlotsByDate = (slots: TimeSlot[]) => {
    const grouped: Record<string, TimeSlot[]> = {};
    slots.forEach((slot) => {
      const dateKey = slot.date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(slot);
    });
    console.log("AvailabilityCalendar: Grouped slots by date:", grouped);
    return grouped;
  };

  if (roundStatus === 'completed') {
    console.log("AvailabilityCalendar: Round is completed, not rendering calendar");
    return null;
  }

  if (showNotification) {
    console.log("AvailabilityCalendar: Rendering CandidateNotification with candidate:", candidate);
    return (
      <CandidateNotification
        candidate={candidate}
        timeSlots={mode === 'single' && selectedSlot ? [selectedSlot] : selectedSlots}
        interviewDetails={interviewDetails}
        mode={mode}
        onNotificationSent={handleNotificationSent}
      />
    );
  }

  if (!hasCheckedAvailability) {
    return (
      <Card className="glass border-blue-200 text-sm">
        <CardHeader className="py-3">
          <CardTitle className="flex items-center text-blue-700 text-base">
            <LucideCalendar className="w-4 h-4 mr-2" />
            Check Panel Availability
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Click the button below to check shared availability for selected panel members
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <Switch
              id="override-working-hours"
              checked={overrideWorkingHours}
              onCheckedChange={setOverrideWorkingHours}
              className="scale-75"
            />
            <Label htmlFor="override-working-hours" className="text-xs">
              Show all hours (including outside working hours)
            </Label>
          </div>
          <Button 
            onClick={handleCheckAvailability}
            className="w-full bg-blue-600 hover:bg-blue-700 text-sm"
            size="sm"
          >
            <LucideCalendar className="w-3 h-3 mr-2" />
            Check Availability
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="glass border-blue-200 text-sm">
        <CardHeader className="py-3">
          <CardTitle className="flex items-center text-blue-700 text-base">
            <LucideCalendar className="w-4 h-4 mr-2" />
            Loading Availability...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="animate-pulse space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <p className="text-center text-muted-foreground text-xs">
            Fetching shared availability for panel members...
          </p>
        </CardContent>
      </Card>
    );
  }

  const groupedSlots = groupSlotsByDate(timeSlots);

  return (
    <div className="space-y-6 text-sm">
      <Card className="glass border-blue-200 text-sm">
        <CardHeader className="py-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center text-blue-700 text-base">
                <LucideCalendar className="w-4 h-4 mr-2" />
                Shared Availability
              </CardTitle>
              <div className="flex items-center space-x-3 mt-2 text-xs">
                <div className="flex items-center space-x-1">
                  <Switch
                    id="mode-toggle"
                    checked={mode === 'multiple'}
                    onCheckedChange={(checked) => setMode(checked ? 'multiple' : 'single')}
                    className="scale-75"
                  />
                  <Label htmlFor="mode-toggle" className="text-xs">
                    {mode === 'single' ? 'Direct Invite' : 'Candidate Preference'}
                  </Label>
                </div>
                <div className="flex items-center space-x-1">
                  <Switch
                    id="override-working-hours"
                    checked={overrideWorkingHours}
                    onCheckedChange={setOverrideWorkingHours}
                    className="scale-75"
                  />
                  <Label htmlFor="override-working-hours" className="text-xs">
                    Show all hours
                  </Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {mode === 'single'
                  ? 'Select one slot or enter custom start time for direct invite'
                  : 'Select multiple slots or enter custom start time to share with candidate'}
              </p>
            </div>
            <div className="space-y-1.5 w-1/2">
              <Label className="text-xs">Custom Slot (24-hour format, e.g., 12:15)</Label>
              <div className="flex space-x-2">
                <Input
                  type="text"
                  placeholder="Start time (HH:mm)"
                  value={customStartTime}
                  onChange={(e) => handleCustomStartChange(e.target.value)}
                  className="text-xs"
                />
                <Input
                  type="text"
                  placeholder="End time (auto-filled)"
                  value={customEndTime}
                  readOnly
                  className="text-xs"
                />
              </div>
              <Button 
                onClick={checkCustomAvailability} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-xs font-medium rounded-md py-1.5 h-8"
                disabled={isCheckingAvailability}
              >
                {isCheckingAvailability ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <LucideCalendar className="w-3 h-3 mr-2" />
                    Check Availability
                  </>
                )}
              </Button>
              {customAvailability && (
                <div className={cn(
                  "flex items-center text-xs mt-1",
                  customAvailability.available ? "text-green-600" : "text-red-600"
                )}>
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {customAvailability.available ? "Slot available" : customAvailability.reason}
                </div>
              )}
              {customAvailability?.available && customSlot && (
                <Button 
                  onClick={handleSaveCustomSlot} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-xs font-medium rounded-md py-1.5 h-8"
                >
                  <Check className="w-3 h-3 mr-2" />
                  Save Custom Slot
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4 overflow-y-auto max-h-[500px]">
              <h3 className="font-semibold text-gray-800 mb-2 flex items-center text-sm">
                <LucideCalendar className="w-3 h-3 mr-1" />
                Recommended Slots
              </h3>
              {Object.entries(groupedSlots).map(([date, slots]) => (
                <div key={date}>
                  <h4 className="font-medium text-gray-700 mb-2 text-xs">
                    {formatDate(date)}
                  </h4>
                  <div className="grid gap-2">
                    {slots.map((slot) => {
                      const availableMembers = getAvailableMemberNames(slot);
                      const isSelected =
                        mode === 'multiple'
                          ? selectedSlots.some((s) => s.id === slot.id)
                          : selectedSlot?.id === slot.id;

                      return (
                        <div
                          key={slot.id}
                          className={cn(
                            "p-3 rounded-lg border cursor-pointer transition-all text-xs",
                            isSelected ? "bg-blue-50 border-blue-300 shadow-md" : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                          )}
                          onClick={() => handleSlotSelect(slot)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center text-gray-700">
                                <Clock className="w-3 h-3 mr-2" />
                                <span className="font-medium">
                                  {formatTime(slot.start)} - {formatTime(slot.end)}
                                </span>
                              </div>
                              <div className="flex items-center text-gray-600">
                                <Users className="w-3 h-3 mr-2" />
                                <span className="text-xs">
                                  {availableMembers.length} of {panelMembers.length} available
                                </span>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="flex items-center text-blue-600">
                                <Check className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {availableMembers.map((name) => (
                              <Badge key={name} variant="secondary" className="text-xs">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {Object.keys(groupedSlots).length === 0 && (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground">
                    No recommended slots available. Use the custom slot input to select a time.
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="overflow-auto max-h-[500px]">
                <BigCalendar
                  localizer={localizer}
                  events={bigCalEvents}
                  defaultView="day"
                  views={["day"]}
                  defaultDate={selectedDate || (interviewDetails?.date instanceof Date ? interviewDetails.date : interviewDetails?.date ? new Date(interviewDetails.date) : new Date())}
                  selectable={false}
                  step={15}
                  timeslots={4}
                  min={minTime}
                  max={maxTime}
                  style={{ height: 500, fontSize: '0.75rem', backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                  eventPropGetter={() => ({
                    style: {
                      backgroundColor: '#f87171', // Red for busy events
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                    },
                  })}
                  slotPropGetter={() => ({
                    style: {
                      backgroundColor: '#f0f9ff', // Light blue for selectable slots
                      borderTop: '1px solid #e5e7eb',
                    },
                  })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {(mode === 'single' && selectedSlot) || (mode === 'multiple' && selectedSlots.length > 0) ? (
        <Card className="glass border-green-200 animate-fade-in text-sm">
          <CardHeader className="py-3">
            <CardTitle className="flex items-center text-green-700 text-base">
              <Check className="w-4 h-4 mr-2" />
              {mode === 'single' ? 'Confirm Time Slot' : 'Confirm Selected Slots'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-3">
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              {mode === 'single' ? (
                <>
                  <h4 className="font-medium text-green-800 mb-2 text-sm">Selected Time Slot:</h4>
                  <p className="text-green-700 text-xs">
                    <strong>{formatDate(selectedSlot!.date)}</strong> at{' '}
                    <strong>
                      {formatTime(selectedSlot!.start)} - {formatTime(selectedSlot!.end)}
                    </strong>
                  </p>
                </>
              ) : (
                <>
                  <h4 className="font-medium text-green-800 mb-2 text-sm">
                    Selected Time Slots ({selectedSlots.length}):
                  </h4>
                  <div className="grid gap-2">
                    {selectedSlots.map((slot) => (
                      <div key={slot.id} className="text-green-700 text-xs">
                        <strong>{formatDate(slot.date)}</strong> at{' '}
                        <strong>
                          {formatTime(slot.start)} - {formatTime(slot.end)}
                        </strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <Button
              onClick={confirmSelection}
              className="w-full bg-green-600 hover:bg-green-700 text-sm"
              size="sm"
            >
              <Check className="w-3 h-3 mr-2" />
              Save {mode === 'single' ? 'Slot' : `Slots (${selectedSlots.length})`}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};