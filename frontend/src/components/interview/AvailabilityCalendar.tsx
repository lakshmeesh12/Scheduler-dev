import { useState, useEffect } from "react";
import { Calendar, Clock, Users, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";
import { fetchAvailableSlots, fetchAllAvailableSlots, ApiCandidate } from "@/api";
import { toast } from "@/components/ui/use-toast";
import { CandidateNotification } from "./CandidateNotification";

interface PanelMember {
  id: string;
  name: string;
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
  date: Date | null;
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
}

export const AvailabilityCalendar = ({
  panelMembers,
  selectedDate,
  preferredTimezone,
  candidate,
  interviewDetails,
}: AvailabilityCalendarProps) => {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrideWorkingHours, setOverrideWorkingHours] = useState(false);
  const [hasCheckedAvailability, setHasCheckedAvailability] = useState(false);
  const [mode, setMode] = useState<'single' | 'multiple'>('single');
  const [showNotification, setShowNotification] = useState(false);

  // Debug: Log candidate prop and relevant states
  useEffect(() => {
    console.log("AvailabilityCalendar: Candidate prop received:", candidate);
    console.log("AvailabilityCalendar: Selected slot:", selectedSlot);
    console.log("AvailabilityCalendar: Selected slots (multiple):", selectedSlots);
    console.log("AvailabilityCalendar: Mode:", mode);
    console.log("AvailabilityCalendar: Show notification:", showNotification);
  }, [candidate, selectedSlot, selectedSlots, mode, showNotification]);

  const handleCheckAvailability = () => {
    console.log("AvailabilityCalendar: Checking availability for panel members:", panelMembers);
    setHasCheckedAvailability(true);
  };

  useEffect(() => {
    if (!hasCheckedAvailability) {
      setLoading(false);
      return;
    }

    const fetchSlots = async () => {
      const sessionId = localStorage.getItem("session_id");
      console.log("AvailabilityCalendar: Fetching slots with session_id:", sessionId);
      if (!sessionId) {
        console.error("AvailabilityCalendar: Session ID not found");
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
        const response = overrideWorkingHours
          ? await fetchAllAvailableSlots(sessionId)
          : await fetchAvailableSlots(sessionId);

        console.log("AvailabilityCalendar: API response for slots:", response);

        const slots = response.slots.map((slot: any, index: number) => ({
          id: `${slot.date}-${slot.start}-${index}`,
          start: slot.start,
          end: slot.end,
          date: slot.date,
          available: true,
          availableMembers: panelMembers.map((member) => member.id),
        }));

        const filteredSlots = selectedDate
          ? slots.filter((slot: TimeSlot) =>
              slot.date === format(selectedDate, "yyyy-MM-dd")
            )
          : slots;

        console.log("AvailabilityCalendar: Filtered slots:", filteredSlots);
        setTimeSlots(filteredSlots);
      } catch (error) {
        console.error('AvailabilityCalendar: Error fetching availability:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to fetch availability",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSlots();
  }, [panelMembers, overrideWorkingHours, selectedDate, hasCheckedAvailability]);

  const formatTime = (time: string) => {
    console.log("AvailabilityCalendar: Formatting time:", time);
    return time;
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
      .filter((member) => slot.availableMembers.includes(member.id))
      .map((member) => member.name);
    console.log(`AvailabilityCalendar: Available members for slot ${slot.id}:`, members);
    return members;
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    console.log("AvailabilityCalendar: Slot selected:", slot);
    if (mode === 'multiple') {
      const exists = selectedSlots.some((s) => s.id === slot.id);
      setSelectedSlots((prev) => (exists ? prev.filter((s) => s.id !== slot.id) : [...prev, slot]));
    } else {
      setSelectedSlot(slot);
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
    console.log("AvailabilityCalendar: Notification sent, resetting state");
    setShowNotification(false);
    setSelectedSlot(null);
    setSelectedSlots([]);
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
      <Card className="glass border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-700">
            <Calendar className="w-5 h-5 mr-2" />
            Check Panel Availability
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Click the button below to check shared availability for selected panel members
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2 mb-4">
            <Switch
              id="override-working-hours"
              checked={overrideWorkingHours}
              onCheckedChange={setOverrideWorkingHours}
            />
            <Label htmlFor="override-working-hours">
              Show all hours (including outside working hours)
            </Label>
          </div>
          <Button 
            onClick={handleCheckAvailability}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Check Availability
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="glass border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-700">
            <Calendar className="w-5 h-5 mr-2" />
            Loading Availability...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="animate-pulse space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <p className="text-center text-muted-foreground">
            Fetching shared availability for panel members...
          </p>
        </CardContent>
      </Card>
    );
  }

  const groupedSlots = groupSlotsByDate(timeSlots);

  return (
    <div className="space-y-6">
      <Card className="glass border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-700">
            <Calendar className="w-5 h-5 mr-2" />
            Shared Availability
          </CardTitle>
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="mode-toggle"
                checked={mode === 'multiple'}
                onCheckedChange={(checked) => setMode(checked ? 'multiple' : 'single')}
              />
              <Label htmlFor="mode-toggle">
                {mode === 'single' ? 'Direct Invite' : 'Candidate Preference'}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="override-working-hours"
                checked={overrideWorkingHours}
                onCheckedChange={setOverrideWorkingHours}
              />
              <Label htmlFor="override-working-hours">
                Show all hours (including outside working hours)
              </Label>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === 'single'
              ? 'Select one time slot to send a direct interview invitation'
              : 'Select multiple time slots to share with the candidate for their preference'}
          </p>
        </CardHeader>
        <CardContent>
          {Object.keys(groupedSlots).length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-600 mb-2">No Common Availability</p>
              <p className="text-muted-foreground">
                No overlapping time slots found for the selected panel members.
                Consider adjusting the panel selection or contacting members individually.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedSlots).map(([date, slots]) => (
                <div key={date}>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    {formatDate(date)}
                  </h3>
                  <div className="grid gap-3">
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
                            "p-4 rounded-lg border cursor-pointer transition-all",
                            isSelected
                              ? "bg-blue-50 border-blue-300 shadow-md"
                              : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                          )}
                          onClick={() => handleSlotSelect(slot)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center text-gray-700">
                                <Clock className="w-4 h-4 mr-2" />
                                <span className="font-medium">
                                  {formatTime(slot.start)} - {formatTime(slot.end)}
                                </span>
                              </div>
                              <div className="flex items-center text-gray-600">
                                <Users className="w-4 h-4 mr-2" />
                                <span className="text-sm">
                                  {availableMembers.length} of {panelMembers.length} available
                                </span>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="flex items-center text-blue-600">
                                <Check className="w-5 h-5" />
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
            </div>
          )}
        </CardContent>
      </Card>

      {(mode === 'single' && selectedSlot) || (mode === 'multiple' && selectedSlots.length > 0) ? (
        <Card className="glass border-green-200 animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center text-green-700">
              <Check className="w-5 h-5 mr-2" />
              {mode === 'single' ? 'Confirm Time Slot' : 'Confirm Selected Slots'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              {mode === 'single' ? (
                <>
                  <h4 className="font-medium text-green-800 mb-2">Selected Time Slot:</h4>
                  <p className="text-green-700">
                    <strong>{formatDate(selectedSlot!.date)}</strong> at{' '}
                    <strong>
                      {formatTime(selectedSlot!.start)} - {formatTime(selectedSlot!.end)}
                    </strong>
                  </p>
                </>
              ) : (
                <>
                  <h4 className="font-medium text-green-800 mb-2">
                    Selected Time Slots ({selectedSlots.length}):
                  </h4>
                  <div className="grid gap-2">
                    {selectedSlots.map((slot) => (
                      <div key={slot.id} className="text-green-700">
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
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <Check className="w-4 h-4 mr-2" />
              {mode === 'single' ? 'Send Invite' : `Share ${selectedSlots.length} Slot${selectedSlots.length > 1 ? 's' : ''}`}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};