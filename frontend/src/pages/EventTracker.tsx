import { useState, useEffect } from "react";
import { ArrowLeft, Calendar as CalendarIcon, Clock, Users, CheckCircle2, XCircle, RefreshCw, Mail, Phone } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PanelSelection } from "@/components/interview/PanelSelection";
import { format, parse, isToday, isBefore, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { trackEvent, EventTrackerResponse, updateEvent, fetchAvailableSlots, fetchAllAvailableSlots } from "@/api";

interface EventDetails {
  id: string;
  candidateName: string;
  candidateEmail: string;
  position: string;
  interviewTitle: string;
  scheduledDate: Date;
  duration: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  profileId: string;
  responses: {
    candidate: 'pending' | 'accepted' | 'declined' | 'no_response';
    panel: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      response: 'pending' | 'accepted' | 'declined' | 'no_response';
      responseDate?: Date;
    }>;
  };
  meetingLink?: string;
  location?: string;
}

interface PanelSummary {
  accepted: number;
  declined: number;
  pending: number;
}

interface TimeSlot {
  id: string;
  start: string;
  end: string;
  date: string;
  available: boolean;
  availableMembers: string[];
}

const EventTracker = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [panelSummary, setPanelSummary] = useState<PanelSummary | null>(null);
  const [showAlternatePanel, setShowAlternatePanel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [overrideWorkingHours, setOverrideWorkingHours] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [hasCheckedAvailability, setHasCheckedAvailability] = useState(false);

  const fetchEventDetails = async () => {
    if (!id) {
      setError("Event ID is missing.");
      setLoading(false);
      return;
    }

    setRefreshing(true);
    try {
      const sessionId = localStorage.getItem("session_id") || id;
      const response: EventTrackerResponse = await trackEvent(sessionId);
      console.log("EventTracker: API response:", response);

      if (response.error) {
        throw new Error(response.error);
      }

      if (!response.candidate || !response.scheduled_time) {
        throw new Error("Incomplete event data received.");
      }

      const scheduledDate = parse(
        `${response.scheduled_time.date} ${response.scheduled_time.start_time}`,
        "MMMM d, yyyy hh:mm:ss a",
        new Date()
      );

      const event: EventDetails = {
        id: sessionId,
        candidateName: response.candidate.name,
        candidateEmail: response.candidate.email,
        position: response.position || "N/A",
        interviewTitle: "Interview",
        scheduledDate,
        duration: response.scheduled_time.duration,
        status: (response.status || "scheduled").toLowerCase() as EventDetails['status'],
        profileId: response.candidate.profile_id || "unknown",
        responses: {
          candidate: (response.candidate_response?.response || "no_response").toLowerCase() === "none"
            ? "pending"
            : (response.candidate_response?.response || "pending").toLowerCase() as EventDetails['responses']['candidate'],
          panel: (response.panel_response_status?.responses || []).map((res, index) => ({
            id: `${index}`,
            name: res.name,
            email: res.email,
            role: res.role || "Panel Member",
            response: (res.response || "no_response").toLowerCase() === "none" || res.response.toLowerCase() === "tentative"
              ? "pending"
              : (res.response || "pending").toLowerCase() as EventDetails['responses']['panel'][0]['response'],
            responseDate: res.response_time && res.response_time !== "January 01, 0001, 12:00 AM" 
              ? parse(res.response_time, "MMMM dd, yyyy, hh:mm a", new Date())
              : undefined,
          })),
        },
        meetingLink: response.virtual ? "https://meet.google.com/abc-defg-hij" : undefined,
        location: response.virtual ? "Virtual" : "To be provided",
      };

      setEventDetails(event);
      setProfileId(event.profileId);
      setPanelSummary(response.panel_response_status?.summary || { accepted: 0, declined: 0, pending: 0 });
      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch event details.");
      console.error("EventTracker: Error fetching event:", err);
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEventDetails();
  }, [id]);

  const fetchSlots = async () => {
    if (!eventDetails || !selectedDate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a date to check availability.",
      });
      return;
    }

    setSlotsLoading(true);
    try {
      const sessionId = eventDetails.id;
      const response = overrideWorkingHours
        ? await fetchAllAvailableSlots(sessionId)
        : await fetchAvailableSlots(sessionId);

      console.log("EventTracker: API response for slots:", response);

      const slots = response.slots.map((slot: any, index: number) => ({
        id: `${slot.date}-${slot.start}-${index}`,
        start: slot.start,
        end: slot.end,
        date: slot.date,
        available: true,
        availableMembers: eventDetails.responses.panel.map((member) => member.id),
      }));

      const filteredSlots = slots.filter((slot: TimeSlot) =>
        slot.date === format(selectedDate, "yyyy-MM-dd")
      );

      console.log("EventTracker: Filtered slots:", filteredSlots);
      setTimeSlots(filteredSlots);
      setSelectedSlot(null); // Reset selected slot on new fetch
    } catch (error) {
      console.error('EventTracker: Error fetching availability:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch availability",
      });
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleCheckAvailability = async () => {
    setHasCheckedAvailability(true);
    await fetchSlots();
  };

  useEffect(() => {
    if (hasCheckedAvailability && selectedDate) {
      fetchSlots();
    }
  }, [overrideWorkingHours]);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'accepted':
        return <Badge className="bg-green-600 text-white"><CheckCircle2 className="w-3 h-3 mr-1" />Accepted</Badge>;
      case 'declined':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Declined</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-200 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge className="bg-yellow-200 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const handleAlternatePanelSave = async (newPanel: { email: string }[], memberId: string) => {
    if (!eventDetails) {
      toast({
        title: "Error",
        description: "Event details not available.",
        variant: "destructive",
      });
      return;
    }

    const declinedMember = eventDetails.responses.panel.find((member) => member.id === memberId);
    if (!declinedMember) {
      toast({
        title: "Error",
        description: "Declined panel member not found.",
        variant: "destructive",
      });
      return;
    }

    const removeEmails = [declinedMember.email];
    const addEmails = newPanel.map((panel) => panel.email);

    try {
      const response = await updateEvent(eventDetails.id, removeEmails, addEmails);
      console.log('EventTracker: Update event response:', response);

      if (response.success !== false) {
        toast({
          title: "Success",
          description: "Panel member updated successfully.",
          className: "bg-green-600 text-white",
        });
        setShowAlternatePanel(null);
        await fetchEventDetails();
      } else {
        throw new Error(response.error || "Failed to update panel member.");
      }
    } catch (error) {
      toast({
        title: "Error updating panel member",
        description: error instanceof Error ? error.message : "Failed to update panel member.",
        variant: "destructive",
      });
      console.error("EventTracker: Error updating panel:", error);
    }
  };

  const formatTime = (time: string) => time;

  const formatDate = (dateStr: string) => {
    try {
      const date = parse(dateStr, "yyyy-MM-dd", new Date());
      return format(date, "EEEE, MMM d");
    } catch {
      return dateStr;
    }
  };

  const getAvailableMemberNames = (slot: TimeSlot) => {
    return eventDetails?.responses.panel
      .filter((member) => slot.availableMembers.includes(member.id))
      .map((member) => member.name) || [];
  };

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
  };

  const handleUpdateEvent = () => {
    console.log("EventTracker: Update event with selected slot:", selectedSlot);
    // Dummy function, to be implemented later
    toast({
      title: "Success",
      description: "Event update functionality will be implemented.",
      className: "bg-green-600 text-white",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (!eventDetails || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">{error || "Event not found."}</p>
          <Link to={`/schedule-interview/${profileId || "unknown"}`}>
            <Button className="mt-4 bg-primary hover:bg-primary/90">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Schedule
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-blue-600 rounded-xl flex items-center justify-center animate-glow">
                <CalendarIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold gradient-text">Event Tracker</h1>
                <p className="text-sm text-muted-foreground">
                  {eventDetails.candidateName} - {eventDetails.interviewTitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button 
                onClick={fetchEventDetails} 
                disabled={refreshing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh Status'}
              </Button>
              
              <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="glass border-gray-200 text-gray-700 hover:bg-gray-100"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Reschedule Event
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Reschedule Event: {eventDetails.interviewTitle}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    <Card className="glass border-blue-200">
                      <CardHeader>
                        <CardTitle className="flex items-center text-blue-700">
                          <CalendarIcon className="w-5 h-5 mr-2" />
                          Select New Date
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <CalendarComponent
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          disabled={(date) => isBefore(date, endOfDay(new Date()))}
                          className="rounded-md border border-gray-200"
                        />
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
                        <Button
                          onClick={handleCheckAvailability}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          disabled={!selectedDate}
                        >
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          Check Availability
                        </Button>
                      </CardContent>
                    </Card>

                    {hasCheckedAvailability && (
                      <Card className="glass border-blue-200">
                        <CardHeader>
                          <CardTitle className="flex items-center text-blue-700">
                            <Clock className="w-5 h-5 mr-2" />
                            Available Time Slots
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {slotsLoading ? (
                            <div className="animate-pulse space-y-3">
                              {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-16 bg-gray-200 rounded-lg"></div>
                              ))}
                            </div>
                          ) : timeSlots.length === 0 ? (
                            <div className="text-center py-8">
                              <CalendarIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                              <p className="text-lg font-medium text-gray-600 mb-2">No Common Availability</p>
                              <p className="text-muted-foreground">
                                No overlapping time slots found for the selected date. Try another date or adjust panel members.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <h3 className="font-semibold text-gray-800 flex items-center">
                                <CalendarIcon className="w-4 h-4 mr-2" />
                                {formatDate(timeSlots[0].date)}
                              </h3>
                              <div className="grid gap-3">
                                {timeSlots.map((slot) => {
                                  const availableMembers = getAvailableMemberNames(slot);
                                  const isSelected = selectedSlot?.id === slot.id;
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
                                              {availableMembers.length} of {eventDetails.responses.panel.length} available
                                            </span>
                                          </div>
                                        </div>
                                        {isSelected && (
                                          <CheckCircle2 className="w-5 h-5 text-blue-600" />
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
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {selectedSlot && (
                      <Card className="glass border-green-200">
                        <CardHeader>
                          <CardTitle className="flex items-center text-green-700">
                            <CheckCircle2 className="w-5 h-5 mr-2" />
                            Selected Time Slot
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <p className="text-green-700">
                              <strong>{formatDate(selectedSlot.date)}</strong> at{' '}
                              <strong>
                                {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}
                              </strong>
                            </p>
                          </div>
                          <Button
                            onClick={handleUpdateEvent}
                            className="w-full bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Update Event
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              
              <Link to={`/schedule-interview/${eventDetails.profileId}`}>
                <Button variant="outline" className="glass border-gray-200">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Schedule
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Event Overview */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-primary" />
                  Event Overview
                </span>
                <Badge 
                  className={`${
                    eventDetails.status === 'scheduled' ? 'bg-blue-600' :
                    eventDetails.status === 'in_progress' ? 'bg-yellow-600' :
                    eventDetails.status === 'completed' ? 'bg-green-600' :
                    'bg-gray-600'
                  }`}
                >
                  {eventDetails.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Candidate</p>
                  <p className="text-lg font-semibold">{eventDetails.candidateName}</p>
                  <p className="text-sm text-muted-foreground">{eventDetails.candidateEmail}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Position</p>
                  <p className="text-lg font-semibold">{eventDetails.position}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Scheduled Time</p>
                  <p className="text-lg font-semibold">{format(eventDetails.scheduledDate, 'PPP')}</p>
                  <p className="text-sm text-muted-foreground">{format(eventDetails.scheduledDate, 'pp')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Duration</p>
                  <p className="text-lg font-semibold">{eventDetails.duration} minutes</p>
                  <p className="text-sm text-muted-foreground">{eventDetails.location}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Response Tracking */}
          <Tabs defaultValue="responses" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="responses">Response Status</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="actions">Quick Actions</TabsTrigger>
            </TabsList>

            <TabsContent value="responses" className="space-y-6">
              {/* Candidate Response */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Candidate Response
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium">{eventDetails.candidateName}</p>
                        <p className="text-sm text-muted-foreground">{eventDetails.candidateEmail}</p>
                      </div>
                      {getStatusBadge(eventDetails.responses.candidate)}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Mail className="w-4 h-4 mr-2" />
                        Send Reminder
                      </Button>
                      <Button variant="outline" size="sm">
                        <Phone className="w-4 h-4 mr-2" />
                        Call
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Panel Responses */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      Panel Response Status
                    </span>
                    <div className="flex gap-2">
                      <Badge className="bg-green-600 text-white">{panelSummary?.accepted || 0} Accepted</Badge>
                      <Badge variant="destructive">{panelSummary?.declined || 0} Declined</Badge>
                      <Badge className="bg-yellow-200 text-yellow-800">{panelSummary?.pending || 0} Pending</Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {eventDetails.responses.panel.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-sm text-muted-foreground">{member.role} • {member.email}</p>
                            {member.responseDate && (
                              <p className="text-xs text-muted-foreground">
                                Responded: {format(member.responseDate, 'PPp')}
                              </p>
                            )}
                          </div>
                          {getStatusBadge(member.response)}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Mail className="w-4 h-4 mr-2" />
                            Message
                          </Button>
                          {member.response === 'declined' && (
                            <Dialog open={showAlternatePanel === member.id} onOpenChange={(open) => setShowAlternatePanel(open ? member.id : null)}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="text-orange-600 border-orange-200"
                                >
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Replace
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Replace Panel Member: {member.name}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-6">
                                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                                    <p className="text-orange-800 font-medium">Replacing:</p>
                                    <Badge variant="destructive">
                                      {member.name} ({member.role})
                                    </Badge>
                                  </div>
                                  <PanelSelection 
                                    onSave={(newPanel) => handleAlternatePanelSave(newPanel, member.id)} 
                                    initialPanel={[]}
                                    context="replace"
                                  />
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Event Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="border-l-2 border-primary pl-4 pb-4">
                      <div className="w-2 h-2 bg-primary rounded-full -ml-5 mt-2"></div>
                      <p className="font-medium">Interview Scheduled</p>
                      <p className="text-sm text-muted-foreground">{format(eventDetails.scheduledDate, 'PPp')}</p>
                    </div>
                    {eventDetails.responses.candidate !== 'no_response' && (
                      <div className={`border-l-2 ${eventDetails.responses.candidate === 'accepted' ? 'border-green-500' : 'border-red-500'} pl-4 pb-4`}>
                        <div className={`w-2 h-2 ${eventDetails.responses.candidate === 'accepted' ? 'bg-green-500' : 'bg-red-500'} rounded-full -ml-5 mt-2`}></div>
                        <p className="font-medium">Candidate {eventDetails.responses.candidate.charAt(0).toUpperCase() + eventDetails.responses.candidate.slice(1)}</p>
                        <p className="text-sm text-muted-foreground">{format(eventDetails.scheduledDate, 'PPp')}</p>
                      </div>
                    )}
                    {eventDetails.responses.panel.map(member => member.responseDate && (
                      <div key={member.id} className={`border-l-2 ${member.response === 'accepted' ? 'border-green-500' : 'border-red-500'} pl-4 pb-4`}>
                        <div className={`w-2 h-2 ${member.response === 'accepted' ? 'bg-green-500' : 'bg-red-500'} rounded-full -ml-5 mt-2`}></div>
                        <p className="font-medium">{member.name} {member.response.charAt(0).toUpperCase() + member.response.slice(1)}</p>
                        <p className="text-sm text-muted-foreground">{format(member.responseDate, 'PPp')}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions" className="space-y-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Reschedule Event</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Find new available time slots for all participants
                    </p>
                    <Button 
                      variant="outline" 
                      className="w-full glass border-gray-200 text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowRescheduleDialog(true)}
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Find New Times
                    </Button>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Send Reminders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Send reminder emails to pending participants
                    </p>
                    <Button variant="outline" className="w-full">
                      <Mail className="w-4 h-4 mr-2" />
                      Send Reminders
                    </Button>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="text-lg">Cancel Event</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Cancel this interview and notify all participants
                    </p>
                    <Button variant="destructive" className="w-full">
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancel Interview
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default EventTracker;