import { useState, useEffect } from "react";
import { Calendar, Clock, Users, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { fetchSchedulerData, SchedulerResponse } from "@/api";
import { useToast } from "@/hooks/use-toast";

interface ScheduledInterview {
  id: string;
  candidateId: string;
  candidateName: string;
  position: string;
  email: string;
  currentRound: number;
  totalRounds: number;
  nextInterviewDate?: string;
  status: "pending" | "scheduled" | "completed" | "cancelled";
  panelMembers: string[];
  lastActivity: string;
}

const Scheduler = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scheduledInterviews, setScheduledInterviews] = useState<ScheduledInterview[]>([]);
  const [statistics, setStatistics] = useState<{
    total: number;
    scheduled: number;
    pending: number;
    completed: number;
  }>({ total: 0, scheduled: 0, pending: 0, completed: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSchedulerData = async () => {
      setIsLoading(true);
      try {
        const data = await fetchSchedulerData();
        const interviews: ScheduledInterview[] = data.interviews.map((interview) => ({
          id: interview.session_id,
          candidateId: interview.candidate.profile_id, // Use profile_id instead of session_id
          candidateName: interview.candidate.name,
          position: interview.candidate.recent_designation,
          email: interview.candidate.email,
          currentRound: 1, // Constant as specified
          totalRounds: 3, // Constant as specified
          nextInterviewDate: interview.event_start_time,
          status: "scheduled", // Default, as most interviews are likely scheduled
          panelMembers: interview.panel_emails,
          lastActivity: new Date().toISOString().split("T")[0], // Current date as fallback
        }));
        setScheduledInterviews(interviews);
        setStatistics(data.statistics);
      } catch (error) {
        toast({
          title: "Error loading scheduler data",
          description: error instanceof Error ? error.message : "Failed to fetch scheduler data.",
          variant: "destructive",
        });
        console.error("Scheduler: Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSchedulerData();
  }, [toast]);

  const filteredInterviews = scheduledInterviews.filter((interview) => {
    const matchesSearch =
      interview.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      interview.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      interview.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || interview.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "scheduled":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getProgressPercentage = (current: number, total: number) => {
    return (current / total) * 100;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Interview Scheduler</h1>
            <p className="text-muted-foreground">Manage all scheduled interviews and candidate progress</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                  <p className="text-2xl font-bold">{isLoading ? "..." : statistics.scheduled}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{isLoading ? "..." : statistics.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{isLoading ? "..." : statistics.completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{isLoading ? "..." : statistics.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by candidate name, position, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="glass"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48 glass">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Interview List */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-xl font-semibold text-gray-600">Loading scheduler data...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInterviews.map((interview) => (
              <Card key={interview.id} className="glass-card hover-lift">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-lg">
                            {interview.candidateName.split(" ").map((n) => n[0]).join("")}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-lg font-semibold">{interview.candidateName}</h3>
                            <Badge className={getStatusColor(interview.status)} variant="secondary">
                              {interview.status}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground">{interview.position}</p>
                          <p className="text-sm text-muted-foreground">{interview.email}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      {/* Progress */}
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Progress</p>
                        <div className="flex items-center space-x-2">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                              style={{ width: `${getProgressPercentage(interview.currentRound, interview.totalRounds)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {interview.currentRound}/{interview.totalRounds}
                          </span>
                        </div>
                      </div>

                      {/* Next Interview */}
                      {interview.nextInterviewDate && (
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Next Interview</p>
                          <p className="text-sm font-medium">{interview.nextInterviewDate}</p>
                        </div>
                      )}

                      {/* Panel Members */}
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Panel</p>
                        <div className="flex -space-x-2">
                          {interview.panelMembers.slice(0, 3).map((member, index) => (
                            <div
                              key={index}
                              className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center border-2 border-white"
                              title={member}
                            >
                              <span className="text-xs text-white font-semibold">
                                {member.split(" ").map((n) => n[0]).join("")}
                              </span>
                            </div>
                          ))}
                          {interview.panelMembers.length > 3 && (
                            <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center border-2 border-white">
                              <span className="text-xs text-white font-semibold">
                                +{interview.panelMembers.length - 3}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action */}
                      <Link to={`/schedule-interview/${interview.candidateId}`}>
                        <Button variant="outline" className="glass">
                          <span className="mr-2">Manage</span>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && filteredInterviews.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600">No Scheduled Interviews Found</h3>
            <p className="text-muted-foreground">
              {searchQuery || statusFilter !== "all"
                ? "No interviews match your current filters."
                : "No interviews have been scheduled yet."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Scheduler;