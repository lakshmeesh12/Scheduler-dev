import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar, Plus, Bell, BarChart, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InterviewRound } from "@/components/interview/InterviewRound";
import { ReminderSettings, ReminderConfig } from "@/components/interview/ReminderSettings";
import { InterviewStatusProgress, InterviewStatus } from "@/components/interview/InterviewStatusProgress";
import { fetchProfileById, fetchInterviewRounds, ApiCandidate, InterviewRoundData } from "@/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

export interface InterviewRoundData {
  id: string;
  roundNumber: number;
  status: 'draft' | 'scheduled' | 'completed';
  panel: {
    user_id: string;
    display_name: string;
    email: string;
    role?: string;
    avatar?: string;
  }[];
  details: {
    title: string;
    description: string;
    duration: number;
    date: string | null;
    location: string;
    meetingType: 'in-person' | 'virtual';
    preferred_timezone: string;
  } | null;
  selectedTimeSlot: {
    id: string;
    start: string;
    end: string;
    date: string;
    available: boolean;
    availableMembers: string[];
  } | null;
  schedulingOption: 'direct' | 'candidate_choice' | null;
  candidateId: string;
  campaignId: string;
  clientId: string;
  sessionId: string | null;
  createdAt?: string;
  name: string;
}

const slugify = (text: string) => {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '') || `round-${Math.random().toString(36).substr(2, 9)}`;
};

const ScheduleInterview = () => {
  const { id } = useParams<{ id: string }>();
  const [rounds, setRounds] = useState<InterviewRoundData[]>([]);
  const [collapsedRounds, setCollapsedRounds] = useState<{ [key: string]: boolean }>({});
  const [candidateStatus, setCandidateStatus] = useState<'in_progress' | 'completed' | 'selected' | 'rejected' | 'on_hold'>('in_progress');
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig>({
    candidateReminders: { enabled: true, timings: ['24h', '1h'], customMessage: '' },
    panelReminders: { enabled: true, feedbackReminder: { enabled: true, timing: '24h' }, interviewReminder: { enabled: true, timing: '2h' }, customMessage: '' }
  });
  const [responseStatus, setResponseStatus] = useState<'pending' | 'accepted' | 'rejected' | 'no_response'>('pending');
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [candidate, setCandidate] = useState<ApiCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showSchemaEditor, setShowSchemaEditor] = useState(false);
  const [schemaNames, setSchemaNames] = useState<string[]>([]);

  // Load data from backend and localStorage
  useEffect(() => {
    console.log("ScheduleInterview - user_id from localStorage:", localStorage.getItem("user_id"));
    const storedSessionId = localStorage.getItem("session_id");
    setSessionId(storedSessionId);
    console.log("ScheduleInterview - session_id from localStorage:", storedSessionId);
    const storedCampaignId = sessionStorage.getItem("campaignId");
    const storedClientId = sessionStorage.getItem("clientId");

    // Load persisted data from localStorage as fallback
    const savedRounds = localStorage.getItem(`interview_rounds_${id}_${storedCampaignId}_${storedClientId}`);
    const savedCandidateStatus = localStorage.getItem(`candidate_status_${id}_${storedCampaignId}_${storedClientId}`);
    const savedReminderConfig = localStorage.getItem(`reminder_config_${id}_${storedCampaignId}_${storedClientId}`);
    const savedResponseStatus = localStorage.getItem(`response_status_${id}_${storedCampaignId}_${storedClientId}`);
    const savedSchemaNames = localStorage.getItem(`schema_names_${id}_${storedCampaignId}_${storedClientId}`);
    const savedCollapsedRounds = localStorage.getItem(`collapsed_rounds_${id}_${storedCampaignId}_${storedClientId}`);

    if (savedRounds) {
      setRounds(JSON.parse(savedRounds));
    }
    if (savedCandidateStatus) {
      setCandidateStatus(savedCandidateStatus as typeof candidateStatus);
    }
    if (savedReminderConfig) {
      setReminderConfig(JSON.parse(savedReminderConfig));
    }
    if (savedResponseStatus) {
      setResponseStatus(savedResponseStatus as typeof responseStatus);
    }
    if (savedSchemaNames) {
      setSchemaNames(JSON.parse(savedSchemaNames));
    }
    if (savedCollapsedRounds) {
      setCollapsedRounds(JSON.parse(savedCollapsedRounds));
    }

    // Load rounds from backend
    const loadRounds = async () => {
      if (!id || !storedCampaignId || !storedClientId) {
        setError("Missing candidateId, campaignId, or clientId");
        return;
      }
      try {
        const backendRounds = await fetchInterviewRounds(id, storedCampaignId, storedClientId);
        console.log("ScheduleInterview: Loaded rounds from backend:", backendRounds);
        if (backendRounds.length > 0) {
          const mappedRounds = backendRounds.map((r, index) => ({
            ...r,
            name: r.name || `Round ${r.roundNumber || index + 1}`,
            id: r.id || slugify(r.name || `Round ${r.roundNumber || index + 1}`),
          }));
          setRounds(mappedRounds);
          setSchemaNames(mappedRounds.map(r => r.name));
          // Initialize collapsed state: completed rounds are collapsed by default
          const initialCollapsed = mappedRounds.reduce((acc, r) => ({
            ...acc,
            [r.id]: r.status === 'completed'
          }), {});
          setCollapsedRounds(initialCollapsed);
          localStorage.setItem(`interview_rounds_${id}_${storedCampaignId}_${storedClientId}`, JSON.stringify(mappedRounds));
          localStorage.setItem(`collapsed_rounds_${id}_${storedCampaignId}_${storedClientId}`, JSON.stringify(initialCollapsed));
          localStorage.setItem(`schema_names_${id}_${storedCampaignId}_${storedClientId}`, JSON.stringify(mappedRounds.map(r => r.name)));
        } else {
          setShowSchemaEditor(true);
        }
      } catch (error) {
        console.error("ScheduleInterview: Error loading rounds from backend:", error);
        setError(error instanceof Error ? error.message : 'Failed to fetch interview rounds');
      }
    };

    if (id && storedCampaignId && storedClientId) {
      const loadProfile = async () => {
        setLoading(true);
        try {
          const profile = await fetchProfileById(id);
          setCandidate(profile);
          await loadRounds();
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Failed to fetch candidate profile');
        } finally {
          setLoading(false);
        }
      };
      loadProfile();
    } else {
      setError("Missing candidateId, campaignId, or clientId");
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (showSchemaEditor) {
      if (rounds.length > 0) {
        setSchemaNames(rounds.map(r => r.name));
      } else {
        setSchemaNames(['Screening']);
      }
    }
  }, [showSchemaEditor, rounds]);

  const addNewRound = () => {
    const storedCampaignId = sessionStorage.getItem("campaignId");
    const storedClientId = sessionStorage.getItem("clientId");
    const newRoundName = schemaNames[rounds.length] || `Round ${rounds.length + 1}`;
    const newRoundId = slugify(newRoundName);
    const newRound: InterviewRoundData = {
      id: newRoundId,
      roundNumber: rounds.length + 1,
      name: newRoundName,
      status: 'draft',
      panel: [],
      details: null,
      selectedTimeSlot: null,
      schedulingOption: null,
      candidateId: id!,
      campaignId: storedCampaignId!,
      clientId: storedClientId!,
      sessionId,
      createdAt: new Date().toISOString(),
    };
    const updatedRounds = [...rounds, newRound];
    setRounds(updatedRounds);
    setCollapsedRounds(prev => ({ ...prev, [newRound.id]: false }));
    const updatedSchemaNames = [...schemaNames, newRoundName];
    setSchemaNames(updatedSchemaNames);
    localStorage.setItem(`interview_rounds_${id}_${storedCampaignId}_${storedClientId}`, JSON.stringify(updatedRounds));
    localStorage.setItem(`collapsed_rounds_${id}_${storedCampaignId}_${storedClientId}`, JSON.stringify({ ...collapsedRounds, [newRound.id]: false }));
    localStorage.setItem(`schema_names_${id}_${storedCampaignId}_${storedClientId}`, JSON.stringify(updatedSchemaNames));
  };

  const updateRound = (roundId: string, updates: Partial<InterviewRoundData>) => {
    const updatedRounds = rounds.map(round => round.id === roundId ? { ...round, ...updates } : round);
    setRounds(updatedRounds);
    const storedCampaignId = sessionStorage.getItem("campaignId");
    const storedClientId = sessionStorage.getItem("clientId");
    // Update collapsed state if round is completed
    if (updates.status === 'completed') {
      setCollapsedRounds(prev => ({ ...prev, [roundId]: true }));
    }
    localStorage.setItem(`interview_rounds_${id}_${storedCampaignId}_${storedClientId}`, JSON.stringify(updatedRounds));
    localStorage.setItem(`collapsed_rounds_${id}_${storedCampaignId}_${storedClientId}`, JSON.stringify({ ...collapsedRounds, [roundId]: updates.status === 'completed' }));
  };

  const deleteRound = (roundId: string) => {
    if (rounds.length > 1) {
      const filteredRounds = rounds.filter(round => round.id !== roundId);
      const renumberedRounds = filteredRounds.map((round, index) => ({
        ...round,
        roundNumber: index + 1,
        id: slugify(round.name),
      }));
      setRounds(renumberedRounds);
      const updatedSchemaNames = renumberedRounds.map(r => r.name);
      setSchemaNames(updatedSchemaNames);
      const updatedCollapsedRounds = { ...collapsedRounds };
      delete updatedCollapsedRounds[roundId];
      setCollapsedRounds(updatedCollapsedRounds);
      const storedCampaignId = sessionStorage.getItem("campaignId");
      const storedClientId = sessionStorage.getItem("clientId");
      localStorage.setItem(`interview_rounds_${id}_${storedCampaignId}_${storedClientId}`, JSON.stringify(renumberedRounds));
      localStorage.setItem(`collapsed_rounds_${id}_${storedCampaignId}_${storedClientId}`, JSON.stringify(updatedCollapsedRounds));
      localStorage.setItem(`schema_names_${id}_${storedCampaignId}_${storedClientId}`, JSON.stringify(updatedSchemaNames));
    }
  };

  const toggleRoundCollapse = (roundId: string) => {
    setCollapsedRounds(prev => {
      const newCollapsedRounds = { ...prev, [roundId]: !prev[roundId] };
      const storedCampaignId = sessionStorage.getItem("campaignId");
      const storedClientId = sessionStorage.getItem("clientId");
      localStorage.setItem(`collapsed_rounds_${id}_${storedCampaignId}_${storedClientId}`, JSON.stringify(newCollapsedRounds));
      return newCollapsedRounds;
    });
  };

  const getStatusBadge = (status: InterviewRoundData['status']) => {
    switch (status) {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Loading candidate details...</p>
        </div>
      </div>
    );
  }

  if (!candidate || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error || "Candidate not found."}</p>
          <Link to="/dashboard">
            <Button className="mt-4 bg-primary hover:bg-primary/90">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const getOverallStatus = (): InterviewStatus => {
    if (rounds.length === 0) return 'panel_selection';
    
    const firstRound = rounds[0];
    if (!firstRound.panel.length) return 'panel_selection';
    if (!firstRound.details) return 'interview_details';
    if (!firstRound.selectedTimeSlot) return 'availability_selection';
    
    const hasScheduledRounds = rounds.some(r => r.status === 'scheduled');
    const hasCompletedRounds = rounds.some(r => r.status === 'completed');
    
    if (responseStatus === 'rejected') return 'declined';
    if (hasScheduledRounds && responseStatus === 'accepted') return 'interview_scheduled';
    if (hasCompletedRounds) return 'interview_completed';
    
    return 'candidate_notification';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header with Navigation */}
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center animate-glow">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold gradient-text">Schedule Interview</h1>
                <p className="text-sm text-muted-foreground">
                  {candidate.name || "Unknown"} - {candidate.recent_designation || "N/A"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/reminder-settings">
                <Button
                  variant="outline"
                  size="sm"
                  className="glass border-gray-200"
                >
                  <Bell className="w-4 h-4 mr-2" />
                  Reminders
                </Button>
              </Link>
              <Link to={sessionId ? `/event-tracker/${sessionId}` : '#'}>
                <Button
                  variant="outline"
                  size="sm"
                  className="glass border-blue-200 text-blue-700"
                  disabled={!sessionId}
                >
                  <BarChart className="w-4 h-4 mr-2" />
                  Track Event
                </Button>
              </Link>
              <Link to={`/candidate/${id}`}>
                <Button variant="outline" className="glass border-gray-200">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Profile
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>
      {/* Status Progress */}
      <div className="w-full px-6 py-4 bg-white/50">
        <InterviewStatusProgress currentStatus={getOverallStatus()} />
      </div>
      <main className="w-full px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold gradient-text">Interview Rounds</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowSchemaEditor(true)}>
              Edit Schema
            </Button>
            <Button onClick={addNewRound} className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Add Another Round
            </Button>
          </div>
        </div>
        <div className="space-y-6">
          {rounds.map((round) => (
            <Collapsible
              key={round.id}
              open={!collapsedRounds[round.id]}
              onOpenChange={() => toggleRoundCollapse(round.id)}
            >
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-t-lg cursor-pointer hover:bg-muted/70">
                  <div className="flex items-center gap-3">
                    <span className="gradient-text font-semibold">{round.name}</span>
                    {getStatusBadge(round.status)}
                    {round.details?.date && (
                      <span className="text-sm text-gray-500">
                        {new Date(round.details.date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <Button variant="ghost" size="sm">
                    {collapsedRounds[round.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </Button>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <InterviewRound
                  round={round}
                  onUpdateRound={updateRound}
                  onDeleteRound={deleteRound}
                  candidateInfo={candidate}
                />
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </main>
      <Dialog open={showSchemaEditor} onOpenChange={setShowSchemaEditor}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{rounds.length === 0 ? 'Define Interview Schema' : 'Edit Interview Schema'}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {schemaNames.map((name, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Label className="w-24">Round {index + 1}</Label>
                <Input
                  value={name}
                  onChange={(e) => {
                    const newNames = [...schemaNames];
                    newNames[index] = e.target.value;
                    setSchemaNames(newNames);
                  }}
                />
                <Button
                  variant="destructive"
                  onClick={() => {
                    const newNames = schemaNames.filter((_, i) => i !== index);
                    setSchemaNames(newNames);
                  }}
                  disabled={schemaNames.length === 1}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              onClick={() => setSchemaNames([...schemaNames, `Round ${schemaNames.length + 1}`])}
              variant="secondary"
            >
              Add New Round
            </Button>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                const storedCampaignId = sessionStorage.getItem("campaignId")!;
                const storedClientId = sessionStorage.getItem("clientId")!;
                let newRounds: InterviewRoundData[] = [];
                for (let i = 0; i < schemaNames.length; i++) {
                  const newRoundName = schemaNames[i];
                  const newRoundId = slugify(newRoundName);
                  if (i < rounds.length) {
                    newRounds.push({
                      ...rounds[i],
                      name: newRoundName,
                      roundNumber: i + 1,
                      id: newRoundId,
                    });
                  } else {
                    newRounds.push({
                      id: newRoundId,
                      roundNumber: i + 1,
                      name: newRoundName,
                      status: 'draft',
                      panel: [],
                      details: null,
                      selectedTimeSlot: null,
                      schedulingOption: null,
                      candidateId: id!,
                      campaignId: storedCampaignId,
                      clientId: storedClientId,
                      sessionId: sessionId,
                      createdAt: new Date().toISOString(),
                    });
                  }
                }
                setRounds(newRounds);
                setCollapsedRounds(prev => {
                  const newCollapsedRounds = newRounds.reduce((acc, r) => ({
                    ...acc,
                    [r.id]: r.status === 'completed'
                  }), {});
                  localStorage.setItem(
                    `collapsed_rounds_${id}_${storedCampaignId}_${storedClientId}`,
                    JSON.stringify(newCollapsedRounds)
                  );
                  return newCollapsedRounds;
                });
                localStorage.setItem(
                  `interview_rounds_${id}_${storedCampaignId}_${storedClientId}`,
                  JSON.stringify(newRounds)
                );
                localStorage.setItem(
                  `schema_names_${id}_${storedCampaignId}_${storedClientId}`,
                  JSON.stringify(schemaNames)
                );
                setShowSchemaEditor(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScheduleInterview;