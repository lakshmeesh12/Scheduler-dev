import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar, Plus, Bell, BarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InterviewRound } from "@/components/interview/InterviewRound";
import { ReminderSettings, ReminderConfig } from "@/components/interview/ReminderSettings";
import { InterviewStatusProgress, InterviewStatus } from "@/components/interview/InterviewStatusProgress";
import { fetchProfileById, fetchInterviewRounds, ApiCandidate, InterviewRoundData } from "@/api";

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
}

const ScheduleInterview = () => {
  const { id } = useParams<{ id: string }>();
  const [rounds, setRounds] = useState<InterviewRoundData[]>([]);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
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
    const savedActiveRoundId = localStorage.getItem(`active_round_id_${id}_${storedCampaignId}_${storedClientId}`);
    const savedCandidateStatus = localStorage.getItem(`candidate_status_${id}_${storedCampaignId}_${storedClientId}`);
    const savedReminderConfig = localStorage.getItem(`reminder_config_${id}_${storedCampaignId}_${storedClientId}`);
    const savedResponseStatus = localStorage.getItem(`response_status_${id}_${storedCampaignId}_${storedClientId}`);

    if (savedRounds) {
      setRounds(JSON.parse(savedRounds));
    }
    if (savedActiveRoundId) {
      setActiveRoundId(savedActiveRoundId);
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
          setRounds(backendRounds);
          setActiveRoundId(backendRounds[0].id);
          localStorage.setItem(`interview_rounds_${id}_${storedCampaignId}_${storedClientId}`, JSON.stringify(backendRounds));
          localStorage.setItem(`active_round_id_${id}_${storedCampaignId}_${storedClientId}`, backendRounds[0].id);
        } else {
          // Initialize first round if no backend data
          const firstRound: InterviewRoundData = {
            id: 'round-1',
            roundNumber: 1,
            status: 'draft',
            panel: [],
            details: null,
            selectedTimeSlot: null,
            schedulingOption: null,
            candidateId: id,
            campaignId: storedCampaignId,
            clientId: storedClientId,
            sessionId: storedSessionId,
            createdAt: new Date().toISOString(),
          };
          setRounds([firstRound]);
          setActiveRoundId(firstRound.id);
          localStorage.setItem(`interview_rounds_${id}_${storedCampaignId}_${storedClientId}`, JSON.stringify([firstRound]));
          localStorage.setItem(`active_round_id_${id}_${storedCampaignId}_${storedClientId}`, firstRound.id);
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

  const addNewRound = () => {
    const storedCampaignId = sessionStorage.getItem("campaignId");
    const storedClientId = sessionStorage.getItem("clientId");
    const newRound: InterviewRoundData = {
      id: `round-${rounds.length + 1}`,
      roundNumber: rounds.length + 1,
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
    setRounds([...rounds, newRound]);
    setActiveRoundId(newRound.id);
  };

  const updateRound = (roundId: string, updates: Partial<InterviewRoundData>) => {
    setRounds(rounds.map(round => round.id === roundId ? { ...round, ...updates } : round));
  };

  const deleteRound = (roundId: string) => {
    if (rounds.length > 1) {
      const filteredRounds = rounds.filter(round => round.id !== roundId);
      const renumberedRounds = filteredRounds.map((round, index) => ({
        ...round,
        roundNumber: index + 1,
        id: `round-${index + 1}`,
      }));
      setRounds(renumberedRounds);
      if (activeRoundId === roundId) setActiveRoundId(renumberedRounds[0]?.id || null);
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
          <Button onClick={addNewRound} className="bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 mr-2" />
            Add Another Round
          </Button>
        </div>
        <div className="space-y-6">
          {rounds.map((round) => (
            <InterviewRound
              key={round.id}
              round={round}
              onUpdateRound={updateRound}
              onDeleteRound={deleteRound}
              candidateInfo={candidate}
              isActive={activeRoundId === round.id}
              onSetActive={() => setActiveRoundId(round.id)}
            />
          ))}
        </div>
      </main>
    </div>
  );
};

export default ScheduleInterview;