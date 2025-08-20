import { useState } from "react";
import { ChevronDown, ChevronUp, Users, Clock, Calendar, Globe, Star, MessageSquare, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PanelSelection } from "./PanelSelection";
import { InterviewDetailsForm } from "./InterviewDetailsForm";
import { AvailabilityCalendar } from "./AvailabilityCalendar";
import { CandidateNotification } from "./CandidateNotification";
import { ApiCandidate } from "@/api";

export interface PanelMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

export interface InterviewDetails {
  title: string;
  description: string;
  duration: number;
  date: Date | null;
  location: string;
  meetingType: 'in-person' | 'virtual';
  timezone: string;
}

export interface TimeSlot {
  id: string;
  start: string;
  end: string;
  date: string;
  available: boolean;
  availableMembers: string[];
}

export interface RoundFeedback {
  panelMemberId: string;
  rating: number;
  comments: string;
  recommendation: 'proceed' | 'reject' | 'needs_review';
  submittedAt?: Date;
}

export interface InterviewRoundData {
  id: string;
  roundNumber: number;
  status: 'draft' | 'scheduled' | 'completed' | 'feedback_pending' | 'feedback_complete';
  panel: PanelMember[];
  details: InterviewDetails | null;
  selectedTimeSlot: TimeSlot | null;
  feedback: RoundFeedback[];
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

  // Debug: Log candidateInfo and round data
  console.log("InterviewRound: candidateInfo received:", candidateInfo);
  console.log("InterviewRound: Round data:", round);
  console.log("InterviewRound: Scheduling method:", schedulingMethod);
  console.log("InterviewRound: Candidate options:", candidateOptions);

  const handlePanelSave = (panel: PanelMember[]) => {
    console.log("InterviewRound: Saving panel:", panel);
    onUpdateRound(round.id, { panel, status: 'draft' });
    setPanelCollapsed(true);
  };

  const handleDetailsSave = (details: InterviewDetails) => {
    console.log("InterviewRound: Saving interview details:", details);
    onUpdateRound(round.id, { details, status: 'draft' });
    setDetailsCollapsed(true);
  };

  const handleFeedbackSubmit = (panelMemberId: string, feedback: Omit<RoundFeedback, 'panelMemberId'>) => {
    console.log("InterviewRound: Submitting feedback for panel member:", panelMemberId, feedback);
    const newFeedback = [...round.feedback];
    const existingIndex = newFeedback.findIndex(f => f.panelMemberId === panelMemberId);
    
    if (existingIndex >= 0) {
      newFeedback[existingIndex] = { ...feedback, panelMemberId, submittedAt: new Date() };
    } else {
      newFeedback.push({ ...feedback, panelMemberId, submittedAt: new Date() });
    }
    
    const allFeedbackComplete = round.panel.every(member => 
      newFeedback.some(f => f.panelMemberId === member.id)
    );
    
    onUpdateRound(round.id, { 
      feedback: newFeedback,
      status: allFeedbackComplete ? 'feedback_complete' : 'feedback_pending'
    });
  };

  const getStatusBadge = () => {
    switch (round.status) {
      case 'draft':
        return <Badge variant="secondary" className="bg-muted"><AlertCircle className="w-3 h-3 mr-1" />Draft</Badge>;
      case 'scheduled':
        return <Badge className="bg-primary"><Calendar className="w-3 h-3 mr-1" />Scheduled</Badge>;
      case 'completed':
        return <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'feedback_pending':
        return <Badge className="bg-yellow-600"><MessageSquare className="w-3 h-3 mr-1" />Feedback Pending</Badge>;
      case 'feedback_complete':
        return <Badge className="bg-green-600"><Star className="w-3 h-3 mr-1" />Feedback Complete</Badge>;
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

      {isActive && (
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
                    <Badge variant="outline" className="bg-background">
                      {member.name} ({member.role})
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
                    <div className="flex items-center"><Globe className="w-3 h-3 mr-1" /><strong>Timezone:</strong> {round.details.timezone}</div>
                  </div>
                </div>
              )}
              
              <CollapsibleContent className="mt-4">
                <InterviewDetailsForm onSave={handleDetailsSave} initialDetails={round.details} />
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Availability & Scheduling */}
          {hasCompleteDetails && (
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
                  preferredTimezone={round.details?.timezone || 'UTC'}
                  candidate={candidateInfo}
                  interviewDetails={round.details}
                />
              </div>
            </div>
          )}

          {/* Candidate Notification */}
          {(candidateOptions.length > 0 || round.selectedTimeSlot) && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center">
                <MessageSquare className="w-5 h-5 mr-2 text-primary" />
                Candidate Notification
              </h3>
              <CandidateNotification 
                candidate={candidateInfo}
                timeSlots={candidateOptions.length > 0 ? candidateOptions : round.selectedTimeSlot ? [round.selectedTimeSlot] : []}
                interviewDetails={round.details}
                mode={schedulingMethod}
                onNotificationSent={() => {
                  console.log("InterviewRound: Notification sent, updating round status to completed");
                  onUpdateRound(round.id, { status: 'completed' });
                  setCandidateOptions([]);
                }}
              />
            </div>
          )}

          {/* Feedback Section */}
          {(round.status === 'completed' || round.status === 'feedback_pending' || round.status === 'feedback_complete') && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center">
                <Star className="w-5 h-5 mr-2 text-primary" />
                Panel Feedback
              </h3>
              
              <div className="grid gap-4">
                {round.panel.map((member) => {
                  const existingFeedback = round.feedback.find(f => f.panelMemberId === member.id);
                  
                  return (
                    <Card key={member.id} className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium flex items-center">
                          {member.name} 
                          {existingFeedback && <CheckCircle2 className="w-4 h-4 ml-2 text-green-600" />}
                        </h4>
                        <Badge variant="outline">{member.role}</Badge>
                      </div>
                      
                      {existingFeedback ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Rating:</span>
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star 
                                  key={star} 
                                  className={`w-4 h-4 ${star <= existingFeedback.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} 
                                />
                              ))}
                            </div>
                          </div>
                          <div>
                            <span className="text-sm font-medium">Recommendation:</span>
                            <Badge 
                              className={`ml-2 ${
                                existingFeedback.recommendation === 'proceed' ? 'bg-green-600' :
                                existingFeedback.recommendation === 'reject' ? 'bg-destructive' :
                                'bg-yellow-600'
                              }`}
                            >
                              {existingFeedback.recommendation.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-sm font-medium">Comments:</span>
                            <p className="text-sm text-muted-foreground mt-1">{existingFeedback.comments}</p>
                          </div>
                        </div>
                      ) : (
                        <FeedbackForm 
                          onSubmit={(feedback) => handleFeedbackSubmit(member.id, feedback)}
                        />
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

interface FeedbackFormProps {
  onSubmit: (feedback: Omit<RoundFeedback, 'panelMemberId'>) => void;
}

const FeedbackForm = ({ onSubmit }: FeedbackFormProps) => {
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState("");
  const [recommendation, setRecommendation] = useState<'proceed' | 'reject' | 'needs_review'>('proceed');

  const handleSubmit = () => {
    if (rating === 0 || !comments.trim()) return;
    
    console.log("InterviewRound: FeedbackForm submitting feedback:", { rating, comments, recommendation });
    onSubmit({
      rating,
      comments: comments.trim(),
      recommendation
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Rating</Label>
        <div className="flex gap-1 mt-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="transition-colors"
            >
              <Star 
                className={`w-6 h-6 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground hover:text-yellow-400'}`} 
              />
            </button>
          ))}
        </div>
      </div>
      
      <div>
        <Label htmlFor="comments" className="text-sm font-medium">Comments</Label>
        <Textarea
          id="comments"
          placeholder="Share your feedback about the candidate..."
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          className="mt-1"
          rows={3}
        />
      </div>
      
      <div>
        <Label className="text-sm font-medium">Recommendation</Label>
        <RadioGroup value={recommendation} onValueChange={(value: any) => setRecommendation(value)} className="mt-2">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="proceed" id="proceed" />
            <Label htmlFor="proceed" className="text-sm">Proceed to next round</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="needs_review" id="needs_review" />
            <Label htmlFor="needs_review" className="text-sm">Needs further review</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="reject" id="reject" />
            <Label htmlFor="reject" className="text-sm">Reject candidate</Label>
          </div>
        </RadioGroup>
      </div>
      
      <Button 
        onClick={handleSubmit} 
        disabled={rating === 0 || !comments.trim()}
        className="w-full"
      >
        Submit Feedback
      </Button>
    </div>
  );
};