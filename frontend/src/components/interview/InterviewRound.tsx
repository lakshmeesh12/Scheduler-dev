import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown, ChevronUp, Users, Clock, Calendar, Globe, MessageSquare, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PanelSelection } from "./PanelSelection";
import { InterviewDetailsForm } from "./InterviewDetailsForm";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import { CandidateNotification } from "./CandidateNotification";
import { saveInterviewRound, ApiCandidate } from "@/api";

export interface PanelMember {
  user_id: string;
  display_name: string;
  email: string;
  role?: string; // Made role optional
  avatar?: string;
}

export interface InterviewDetails {
  title: string;
  description: string;
  duration: number;
  date: Date | null;
  location: string;
  meetingType: 'in-person' | 'virtual';
  preferred_timezone: string;
}

export interface TimeSlot {
  id: string;
  start: string;
  end: string;
  date: string;
  available: boolean;
  availableMembers: string[];
}

export interface InterviewRoundData {
  id: string;
  roundNumber: number;
  status: 'draft' | 'scheduled' | 'completed';
  panel: PanelMember[];
  details: InterviewDetails | null;
  selectedTimeSlot: TimeSlot | null;
  schedulingOption: 'direct' | 'candidate_choice' | null;
}

interface InterviewRoundProps {
  round: InterviewRoundData;
  onUpdateRound: (roundId: string, updates: Partial<InterviewRoundData>) => void;
  onDeleteRound: (roundId: string) => void;
  candidateInfo: ApiCandidate;
  isActive: boolean;
  onSetActive: () => void;
}

export const InterviewRound = ({
  round,
  onUpdateRound,
  onDeleteRound,
  candidateInfo,
  isActive,
  onSetActive
}: InterviewRoundProps) => {
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);
  const [schedulingMethod, setSchedulingMethod] = useState<'direct' | 'candidate_choice'>(round.schedulingOption || 'direct');
  const [overrideWorkingHours, setOverrideWorkingHours] = useState(false);
  const [candidateOptions, setCandidateOptions] = useState<TimeSlot[]>([]);
  const [error, setError] = useState('');

  // Debug: Log candidateInfo
  useEffect(() => {
    console.log("InterviewRound: Received candidateInfo:", candidateInfo);
  }, [candidateInfo]);

  // Function to save round to backend
  const saveRoundToBackend = async (roundData: InterviewRoundData) => {
    console.log("InterviewRound: Attempting to save round to backend:", {
      ...roundData,
      candidateId: candidateInfo.profile_id,
      sessionId: localStorage.getItem("session_id"),
    });
    try {
      // Validate round data
      if (!candidateInfo.profile_id) {
        throw new Error("Candidate profile_id is missing");
      }
      if (!roundData.panel.every(member => member.user_id && member.display_name)) {
        throw new Error("Invalid panel member data: missing user_id or display_name");
      }
      if (roundData.selectedTimeSlot && !roundData.selectedTimeSlot.availableMembers.every(id => id)) {
        throw new Error("Invalid time slot: availableMembers contains invalid IDs");
      }

      const roundPayload = {
        ...roundData,
        candidateId: candidateInfo.profile_id,
        sessionId: localStorage.getItem("session_id"),
      };
      console.log("InterviewRound: Sending request to URL: /api/interview-rounds/", roundPayload);
      const result = await saveInterviewRound(roundPayload);
      console.log("InterviewRound: Round saved successfully:", result);
      return result;
    } catch (error) {
      console.error("InterviewRound: Error saving round to backend:", error);
      setError(error instanceof Error ? error.message : 'Failed to save interview round');
      throw error;
    }
  };

  const handlePanelSave = (panel: PanelMember[]) => {
    console.log("InterviewRound: Saving panel:", panel);
    // Ensure each panel member has a role
    const updatedPanel = panel.map(member => ({
      ...member,
      role: member.role || "Interviewer", // Default role
    }));
    onUpdateRound(round.id, { panel: updatedPanel, status: 'draft' });
    setPanelCollapsed(true);
  };

  const handleDetailsSave = (details: InterviewDetails) => {
    console.log("InterviewRound: Saving interview details:", details);
    onUpdateRound(round.id, { details, status: 'draft' });
    setDetailsCollapsed(true);
  };

  const getStatusBadge = () => {
    switch (round.status) {
      case 'draft':
        return <Badge variant="secondary" className="bg-muted">Draft</Badge>;
      case 'scheduled':
        return <Badge className="bg-primary">Scheduled</Badge>;
      case 'completed':
        return <Badge className="bg-green-600">Completed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const hasCompleteDetails = round.panel.length > 0 && round.details;

  return (
    <Card className={`glass-card transition-all duration-300 ${isActive ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader className="cursor-pointer" onClick={onSetActive}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <span className="gradient-text">Round {round.roundNumber}</span>
            {getStatusBadge()}
          </CardTitle>
          <div className="flex items-center gap-2">
            {round.roundNumber > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  console.log("InterviewRound: Deleting round:", round.id);
                  onDeleteRound(round.id);
                }}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <XCircle className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {error && (
        <CardContent>
          <div className="text-red-600 p-4">{error}</div>
        </CardContent>
      )}
      {isActive && round.status !== 'completed' && (
        <CardContent className="space-y-6">
          {/* Panel Selection */}
          <Collapsible open={!panelCollapsed || round.panel.length === 0} onOpenChange={(open) => setPanelCollapsed(!open)}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center">
                <Users className="w-5 h-5 mr-2 text-primary" />
                Panel Selection
              </h3>
              {round.panel.length > 0 && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {panelCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>
            {round.panel.length > 0 && panelCollapsed && (
              <div className="mt-2 p-4 bg-muted/50 rounded-lg">
                <div className="flex flex-wrap gap-2">
                  {round.panel.map((member) => (
                    <Badge key={member.user_id} variant="outline" className="bg-background">
                      {member.display_name} ({member.role || "Interviewer"})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <CollapsibleContent className="mt-4">
              <PanelSelection onSave={handlePanelSave} initialPanel={round.panel} />
            </CollapsibleContent>
          </Collapsible>
          {/* Interview Details */}
          {round.panel.length > 0 && (
            <Collapsible open={!detailsCollapsed || !round.details} onOpenChange={(open) => setDetailsCollapsed(!open)}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-primary" />
                  Interview Details
                </h3>
                {round.details && (
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {detailsCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </Button>
                  </CollapsibleTrigger>
                )}
              </div>
              {round.details && detailsCollapsed && (
                <div className="mt-2 p-4 bg-muted/50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><strong>Title:</strong> {round.details.title}</div>
                    <div><strong>Duration:</strong> {round.details.duration} minutes</div>
                    <div><strong>Date:</strong> {round.details.date?.toLocaleDateString() || 'N/A'}</div>
                    <div className="flex items-center"><Globe className="w-3 h-3 mr-1" /><strong>Timezone:</strong> {round.details.preferred_timezone}</div>
                  </div>
                </div>
              )}
              <CollapsibleContent className="mt-4">
                <InterviewDetailsForm onSave={handleDetailsSave} initialDetails={round.details} />
              </CollapsibleContent>
            </Collapsible>
          )}
          {/* Availability & Scheduling */}
          {hasCompleteDetails && round.status !== 'scheduled' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-primary" />
                Schedule Interview
              </h3>
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Scheduling Method</Label>
                    <div className="flex rounded-md border bg-background">
                      <Button
                        type="button"
                        variant={schedulingMethod === 'direct' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => {
                          console.log("InterviewRound: Setting scheduling method to direct");
                          setSchedulingMethod('direct');
                          onUpdateRound(round.id, { schedulingOption: 'direct' });
                        }}
                      >
                        Direct invite
                      </Button>
                      <Button
                        type="button"
                        variant={schedulingMethod === 'candidate_choice' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => {
                          console.log("InterviewRound: Setting scheduling method to candidate_choice");
                          setSchedulingMethod('candidate_choice');
                          onUpdateRound(round.id, { schedulingOption: 'candidate_choice' });
                        }}
                      >
                        Candidate preference
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id={`override-${round.id}`} checked={overrideWorkingHours} onCheckedChange={setOverrideWorkingHours} />
                    <Label htmlFor={`override-${round.id}`} className="text-sm">Override time slots</Label>
                  </div>
                </div>
                <AvailabilityCalendar
                  panelMembers={round.panel}
                  selectedDate={round.details?.date}
                  preferredTimezone={round.details?.preferred_timezone || 'UTC'}
                  candidate={candidateInfo}
                  interviewDetails={round.details}
                  onTimeSlotSelect={(slot) => {
                    console.log("InterviewRound: Time slot selected:", slot);
                    onUpdateRound(round.id, { selectedTimeSlot: slot, status: 'scheduled' });
                    setCandidateOptions([slot]);
                  }}
                  roundStatus={round.status}
                />
              </div>
            </div>
          )}
          {/* Candidate Notification */}
          {round.status === 'scheduled' && (candidateOptions.length > 0 || round.selectedTimeSlot) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center">
                <MessageSquare className="w-5 h-5 mr-2 text-primary" />
                Candidate Notification
              </h3>
              <CandidateNotification
                candidate={candidateInfo}
                timeSlots={candidateOptions.length > 0 ? candidateOptions : round.selectedTimeSlot ? [round.selectedTimeSlot] : []}
                interviewDetails={round.details}
                mode={schedulingMethod === 'direct' ? 'single' : 'multiple'}
                onNotificationSent={() => {
                  console.log("InterviewRound: Notification sent, updating round status to completed");
                  const updatedRound = { ...round, status: 'completed' };
                  onUpdateRound(round.id, { status: 'completed' });
                  setCandidateOptions([]);
                  saveRoundToBackend(updatedRound).catch(err => {
                    console.error("InterviewRound: Failed to save round after notification:", err);
                    setError(err instanceof Error ? err.message : 'Failed to save round to backend');
                  });
                }}
              />
            </div>
          )}
        </CardContent>
      )}
      {isActive && round.status === 'completed' && (
        <CardContent>
          <div className="text-center text-green-600">
            <p>Interview Round {round.roundNumber} Completed</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
};