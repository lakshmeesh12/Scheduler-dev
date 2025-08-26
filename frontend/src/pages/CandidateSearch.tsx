import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search, Plus, Users, Calendar, TrendingUp, UserCheck, Clock, Eye, FileText, Star, ArrowLeft, Loader2, X, User, Building, MapPin, Target, Briefcase, MessageSquare, Save, Edit3, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { fetchCampaignById, fetchMatchingResumes, HiringCampaign, AggregatedScore, Interview } from "@/api";
import QChat from "@/components/QChat";

interface Candidate {
  id: string;
  profile_id: string;
  name: string;
  email: string;
  recent_designation: string;
  status: string;
  currentRound: string;
  rating: number;
  applicationDate: string;
  panelMembers: string[];
  feedback: string;
  comments?: string;
}

interface HiringRound {
  round: string;
  interviewer: string;
  date: string;
  panelMembers: string[];
  feedback: string;
  additionalComments: string;
}

interface Comment {
  id: string;
  author: string;
  jobTitle: string;
  timestamp: string;
  text: string;
  replies: Comment[];
}

// Dummy hiring flow data
const dummyHiringFlow: HiringRound[] = [
  {
    round: "Screening",
    interviewer: "Alice Johnson",
    date: "2025-07-10",
    panelMembers: ["Alice Johnson", "Bob Smith"],
    feedback: "Candidate showed strong communication skills and a good understanding of the role.",
    additionalComments: "Very enthusiastic and prepared with relevant questions."
  },
  {
    round: "Technical",
    interviewer: "Charlie Brown",
    date: "2025-07-15",
    panelMembers: ["Charlie Brown", "Dana White"],
    feedback: "Demonstrated proficiency in React and TypeScript; solved 2/3 coding problems efficiently.",
    additionalComments: "Needs to improve on system design concepts."
  },
  {
    round: "Final",
    interviewer: "Emma Davis",
    date: "2025-07-20",
    panelMembers: ["Emma Davis", "Frank Miller", "Grace Lee"],
    feedback: "Excellent cultural fit and leadership potential; confident in high-pressure scenarios.",
    additionalComments: "Recommended for hire with potential for team lead role."
  }
];

// Dummy comments data with job titles
const dummyComments: Comment[] = [
  {
    id: "1",
    author: "Alice Johnson",
    jobTitle: "Hiring Manager",
    timestamp: "2025-07-10 10:30",
    text: "During screening, candidate expressed strong interest in company culture but had questions about remote work policy.",
    replies: [
      {
        id: "1.1",
        author: "Bob Smith",
        jobTitle: "Senior Recruiter",
        timestamp: "2025-07-10 11:15",
        text: "Clarified remote policy; candidate seemed satisfied. No issues.",
        replies: []
      }
    ]
  },
  {
    id: "2",
    author: "Charlie Brown",
    jobTitle: "Technical Lead",
    timestamp: "2025-07-15 15:00",
    text: "Post-technical round: Candidate excelled in coding but struggled with optimization. Suggest follow-up session.",
    replies: [
      {
        id: "2.1",
        author: "Dana White",
        jobTitle: "Product Manager",
        timestamp: "2025-07-16 09:45",
        text: "Agreed. Also, noted minor issue with version control knowledge.",
        replies: [
          {
            id: "2.1.1",
            author: "Charlie Brown",
            jobTitle: "Technical Lead",
            timestamp: "2025-07-16 10:30",
            text: "Will address in next round if proceeded.",
            replies: []
          }
        ]
      }
    ]
  },
  {
    id: "3",
    author: "Emma Davis",
    jobTitle: "HR Manager",
    timestamp: "2025-07-20 16:00",
    text: "Final round complete. Candidate is a strong fit, but we need to discuss salary expectations.",
    replies: []
  },
  {
    id: "4",
    author: "Frank Miller",
    jobTitle: "Team Lead",
    timestamp: "2025-07-22 14:00",
    text: "Offer extended. Candidate requested 2 weeks to decide due to another offer.",
    replies: [
      {
        id: "4.1",
        author: "Grace Lee",
        jobTitle: "HR Specialist",
        timestamp: "2025-07-23 10:00",
        text: "Followed up; candidate has concerns about joining date. Suggested flexibility.",
        replies: []
      }
    ]
  },
  {
    id: "5",
    author: "HR Team",
    jobTitle: "HR",
    timestamp: "2025-07-25 12:00",
    text: "Background check initiated. No red flags so far.",
    replies: []
  }
];

const CandidateSearch = () => {
  const { clientId, campaignId, jobId } = useParams<{ clientId: string; campaignId: string; jobId: string }>();
  const navigate = useNavigate();
  const [selectedCampaign, setSelectedCampaign] = useState<HiringCampaign | null>(null);
  const [candidateSearchResults, setCandidateSearchResults] = useState<AggregatedScore[]>([]);
  const [isSearchingCandidates, setIsSearchingCandidates] = useState(false);
  const [candidateSearchResponse, setCandidateSearchResponse] = useState("");
  const [selectedSearchCandidate, setSelectedSearchCandidate] = useState<AggregatedScore | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedHiringFlowCandidate, setSelectedHiringFlowCandidate] = useState<Candidate | null>(null);
  const [selectedCommentsCandidate, setSelectedCommentsCandidate] = useState<Candidate | null>(null);
  const [candidateComments, setCandidateComments] = useState<{ [candidateId: string]: Comment[] }>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (campaignId) {
      loadCampaign();
    }
  }, [campaignId]);

  const loadCampaign = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const campaign = await fetchCampaignById(campaignId!);
      setSelectedCampaign(campaign);
      // Initialize comments for all candidates
      if (campaign.Interview) {
        const initialComments: { [candidateId: string]: Comment[] } = {};
        campaign.Interview.forEach((interview) => {
          initialComments[interview._id] = [...dummyComments];
        });
        setCandidateComments(initialComments);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCandidateSearch = async () => {
    if (!selectedCampaign) return;
    setIsSearchingCandidates(true);
    setError("");
    setCandidateSearchResults([]);
    setCandidateSearchResponse("");
    try {
      const formData = new FormData();
      formData.append("job_description", selectedCampaign.description);
      formData.append("job_title", selectedCampaign.jobTitle);
      const result = await fetchMatchingResumes(formData);
      setCandidateSearchResults(result.matching_results.map(candidate => ({ ...candidate, campaignId: selectedCampaign.id })));
      setCandidateSearchResponse(`Found ${result.matching_results.length} matching candidates for ${selectedCampaign.jobTitle}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search candidates');
    } finally {
      setIsSearchingCandidates(false);
    }
  };

  const handleViewProfile = (candidate: AggregatedScore) => {
    localStorage.setItem('selectedCandidate', JSON.stringify({ ...candidate, campaignId: selectedCampaign?.id, campaignTitle: selectedCampaign?.jobTitle }));
    navigate(`/candidate-details/${candidate.resume_id}`);
  };

  const handleScheduleInterview = (candidate: AggregatedScore | Candidate) => {
    if (!selectedCampaign?.id) {
      console.error("handleScheduleInterview: Missing campaign ID", { candidate, campaignId: selectedCampaign?.id });
      setError("Cannot schedule interview: Missing campaign information");
      return;
    }
    console.log("Scheduling interview for candidate:", { candidate, campaignId: selectedCampaign.id, campaignTitle: selectedCampaign.jobTitle });
    sessionStorage.setItem('campaignId', selectedCampaign.id);
    sessionStorage.setItem('clientId', selectedCampaign.client_id);
    const profileId = 'resume_id' in candidate ? candidate.resume_id : candidate.profile_id;
    navigate(`/schedule-interview/${profileId}`, {
      state: {
        candidate: {
          profile_id: profileId,
          name: candidate.name,
        },
        campaign: {
          campaignId: selectedCampaign.id,
          campaignTitle: selectedCampaign.jobTitle,
        },
      },
    });
  };

  const handleViewHiringFlow = (candidate: Candidate) => {
    setSelectedHiringFlowCandidate(candidate);
  };

  const handleViewComments = (candidate: Candidate) => {
    setSelectedCommentsCandidate(candidate);
  };

  const getStatusColor = (status: HiringCampaign["status"]) => {
    switch (status) {
      case "Active": return "bg-green-100 text-green-800";
      case "Completed": return "bg-blue-100 text-blue-800";
      case "On Hold": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getCandidateStatusColor = (status: string) => {
    switch (status) {
      case "Selected": return "bg-green-100 text-green-800";
      case "Rejected": return "bg-red-100 text-red-800";
      case "On Hold": return "bg-yellow-100 text-yellow-800";
      case "Applied": return "bg-blue-100 text-blue-800";
      case "Screening": return "bg-purple-100 text-purple-800";
      case "Technical": return "bg-indigo-100 text-indigo-800";
      case "Final": return "bg-teal-100 text-teal-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getJobTitleColor = (jobTitle: string) => {
    switch (jobTitle) {
      case "Hiring Manager": return "bg-blue-100 text-blue-800";
      case "Senior Recruiter": return "bg-green-100 text-green-800";
      case "Technical Lead": return "bg-purple-100 text-purple-800";
      case "Product Manager": return "bg-orange-100 text-orange-800";
      case "HR Manager": return "bg-red-100 text-red-800";
      case "Team Lead": return "bg-indigo-100 text-indigo-800";
      case "HR Specialist": return "bg-pink-100 text-pink-800";
      case "HR": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const SearchCandidateDetailModal = ({ candidate, onClose }: { candidate: AggregatedScore; onClose: () => void }) => (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {candidate.resume_name}
            <Badge className="bg-blue-100 text-blue-800"> Match: {Math.round(candidate.aggregated_score * 100)}% </Badge>
          </DialogTitle>
          <DialogDescription> Campaign: {selectedCampaign?.jobTitle} </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Candidate ID</Label>
              <p className="text-sm text-muted-foreground">{candidate.resume_id}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Overall Score</Label>
              <p className="text-sm text-muted-foreground">{Math.round(candidate.aggregated_score * 100)}%</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Skills Match</Label>
              <p className="text-sm text-muted-foreground">
                {candidate.primary_vs_primary.total_matched}/{candidate.primary_vs_primary.total_required} ({Math.round(candidate.primary_vs_primary.match_percentage * 100)}%)
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">Rank</Label>
              <p className="text-sm text-muted-foreground">#{candidate.rank}</p>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Matched Skills</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {candidate.primary_vs_primary.matched_skills.map((skill, index) => (
                <Badge key={index} className="bg-green-100 text-green-800">{skill}</Badge>
              ))}
            </div>
          </div>
          {candidate.primary_vs_primary.missing_skills.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Missing Skills</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {candidate.primary_vs_primary.missing_skills.map((skill, index) => (
                  <Badge key={index} className="bg-red-100 text-red-800">{skill}</Badge>
                ))}
              </div>
            </div>
          )}
          <div className="flex space-x-2">
            <Button className="flex-1" onClick={() => handleViewProfile(candidate)}>
              <Eye className="w-4 h-4 mr-2" /> View Full Profile
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => handleScheduleInterview(candidate)}>
              <Calendar className="w-4 h-4 mr-2" /> Schedule Interview
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const HiringFlowModal = ({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) => (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hiring Flow for {candidate.name}</DialogTitle>
          <DialogDescription> Detailed round-wise hiring flow for candidate </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {dummyHiringFlow.length > 0 ? (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"></div>
              {dummyHiringFlow.map((round, index) => (
                <div key={index} className="relative mb-8 ml-10">
                  <div className="absolute -left-6 top-2 w-4 h-4 bg-blue-600 rounded-full border-2 border-white"></div>
                  <Card className="border shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg">{round.round}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Interviewer</Label>
                        <p className="text-sm text-muted-foreground">{round.interviewer}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Date</Label>
                        <p className="text-sm text-muted-foreground">{round.date}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Panel Members</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {round.panelMembers.map((member, idx) => (
                            <Badge key={idx} variant="secondary">{member}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Feedback</Label>
                        <p className="text-sm text-muted-foreground mt-2 p-3 bg-gray-50 rounded-lg">
                          {round.feedback}
                        </p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Additional Comments</Label>
                        <p className="text-sm text-muted-foreground mt-2 p-3 bg-gray-50 rounded-lg">
                          {round.additionalComments}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <List className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-xl font-medium text-gray-600 mb-2">No Hiring Flow Available</p>
              <p className="text-gray-500">No interview rounds recorded for this candidate.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  const CommentComponent = ({ comment, depth = 0, candidateId, setCandidateComments }: { comment: Comment; depth: number; candidateId: string; setCandidateComments: React.Dispatch<React.SetStateAction<{ [candidateId: string]: Comment[] }>> }) => {
    const [replyText, setReplyText] = useState("");
    const [isReplying, setIsReplying] = useState(false);

    const handleAddReply = () => {
      if (!replyText.trim()) return;
      const newReply: Comment = {
        id: `${comment.id}.${comment.replies.length + 1}`,
        author: "You",
        jobTitle: "Team Member", // Replace with actual user job title
        timestamp: new Date().toLocaleString(),
        text: replyText,
        replies: [],
      };

      setCandidateComments(prev => {
        const comments = [...prev[candidateId]];
        const updateReplies = (cmts: Comment[]): Comment[] => {
          return cmts.map(c => {
            if (c.id === comment.id) {
              return { ...c, replies: [...c.replies, newReply] };
            }
            return { ...c, replies: updateReplies(c.replies) };
          });
        };
        return { ...prev, [candidateId]: updateReplies(comments) };
      });

      setReplyText("");
      setIsReplying(false);
    };

    return (
      <div className={`relative mb-4 ${depth > 0 ? 'ml-8' : ''}`}>
        {depth > 0 && (
          <div className="absolute left-[-16px] top-4 w-4 h-0.5 bg-gray-300"></div>
        )}
        <Card className="border shadow-sm">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <p className="font-medium text-sm">{comment.author}</p>
                <Badge className={getJobTitleColor(comment.jobTitle)}>{comment.jobTitle}</Badge>
              </div>
              <div className="flex items-center space-x-2">
                <p className="text-xs text-gray-500">{comment.timestamp}</p>
                <Button variant="ghost" size="sm" onClick={() => setIsReplying(!isReplying)}>
                  Reply
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-700">{comment.text}</p>
            {isReplying && (
              <div className="space-y-2">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Add a reply..."
                  className="min-h-[60px] text-sm"
                />
                <div className="flex space-x-1">
                  <Button size="sm" onClick={handleAddReply} className="bg-green-600 hover:bg-green-700">
                    <Save className="w-3 h-3 mr-1" /> Post Reply
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsReplying(false)}>
                    <X className="w-3 h-3 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        {comment.replies.length > 0 && (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"></div>
            {comment.replies.map((reply, index) => (
              <CommentComponent key={index} comment={reply} depth={depth + 1} candidateId={candidateId} setCandidateComments={setCandidateComments} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const CommentsModal = ({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) => {
    const comments = candidateComments[candidate.id] || [];
    const [newCommentText, setNewCommentText] = useState("");

    const handleAddNewComment = () => {
      if (!newCommentText.trim()) return;
      const newComment: Comment = {
        id: `${comments.length + 1}`,
        author: "You",
        jobTitle: "Team Member", // Replace with actual user job title
        timestamp: new Date().toLocaleString(),
        text: newCommentText,
        replies: [],
      };

      setCandidateComments(prev => ({
        ...prev,
        [candidate.id]: [...(prev[candidate.id] || []), newComment]
      }));

      setNewCommentText("");
    };

    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comments for {candidate.name}</DialogTitle>
            <DialogDescription>
              Threaded comments from the hiring team, covering all aspects of the hiring flow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {comments.length > 0 ? (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"></div>
                {comments.map((comment, index) => (
                  <CommentComponent key={index} comment={comment} depth={0} candidateId={candidate.id} setCandidateComments={setCandidateComments} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-xl font-medium text-gray-600 mb-2">No Comments Yet</p>
                <p className="text-gray-500">Add a comment to start the discussion.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Add New Comment</Label>
              <Textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Add your comment here... (e.g., post-interview notes, offer details, joining concerns)"
                className="min-h-[100px] text-sm"
              />
              <Button onClick={handleAddNewComment} className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" /> Post Comment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const CandidateDetailModal = ({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) => {
    console.log("CandidateDetailModal: Candidate data", candidate);
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              {candidate.name}
              <Badge className={getCandidateStatusColor(candidate.status)}> {candidate.status} </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Email</Label>
                <p className="text-sm text-muted-foreground">{candidate.email}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Recent Designation</Label>
                <p className="text-sm text-muted-foreground">{candidate.recent_designation}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Application Date</Label>
                <p className="text-sm text-muted-foreground">{candidate.applicationDate}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Current Round</Label>
                <p className="text-sm text-muted-foreground">{candidate.currentRound}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Rating</Label>
                <div className="flex items-center space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < candidate.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                  ))}
                  <span className="text-sm text-muted-foreground ml-2">{candidate.rating}/5</span>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Candidate ID</Label>
                <p className="text-sm text-muted-foreground">{candidate.profile_id}</p>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Panel Members</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {candidate.panelMembers.map((member, index) => (
                  <Badge key={index} variant="secondary">{member}</Badge>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Feedback</Label>
              <p className="text-sm text-muted-foreground mt-2 p-3 bg-gray-50 rounded-lg">
                {candidate.feedback}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">Comments</Label>
              <Button variant="outline" onClick={() => handleViewComments(candidate)} className="mt-2">
                <MessageSquare className="w-4 h-4 mr-2" /> View Comments
              </Button>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" className="flex-1" onClick={() => handleViewHiringFlow(candidate)} >
                <List className="w-4 h-4 mr-2" /> View Hiring Flow
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => handleScheduleInterview(candidate)} >
                <Calendar className="w-4 h-4 mr-2" /> Schedule Interview
              </Button>
              <Select defaultValue={candidate.status}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Update Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Applied">Applied</SelectItem>
                  <SelectItem value="Screening">Screening</SelectItem>
                  <SelectItem value="Technical">L2</SelectItem>
                  <SelectItem value="Final">L3</SelectItem>
                  <SelectItem value="Selected">Selected</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const handleBackToCampaigns = () => {
    if (!selectedCampaign?.client_id || !campaignId) {
      setError("Cannot navigate: Missing client or campaign information");
      console.error("handleBackToCampaigns: Missing client_id or campaignId", { clientId: selectedCampaign?.client_id, campaignId, });
      return;
    }
    navigate(`/campaign-manager/${selectedCampaign.client_id}/${campaignId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <SidebarTrigger className="p-2" />
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold gradient-text">
                  {selectedCampaign ? selectedCampaign.jobTitle : "Candidate Search"}
                </h1>
                <p className="text-sm text-gray-600">Enterprise Hiring Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={handleBackToCampaigns} disabled={isLoading} >
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Campaigns
              </Button>
              <Button onClick={handleCandidateSearch} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" disabled={isSearchingCandidates} >
                <Search className="w-4 h-4 mr-2" /> Search Candidates
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {isLoading && <p className="text-center">Loading...</p>}
        {error && <p className="text-center text-red-500">{error}</p>}
        {isSearchingCandidates && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              <p className="text-lg text-white font-medium">Searching for candidates...</p>
            </div>
          </div>
        )}
        {selectedCampaign && (
          <div className="space-y-6">
            <Card className="glass">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl">{selectedCampaign.jobTitle}</CardTitle>
                    <p className="text-muted-foreground mt-1">{selectedCampaign.description}</p>
                    <div className="flex items-center space-x-4 mt-3 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Building className="w-4 h-4" />
                        <span>{selectedCampaign.department}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-4 h-4" />
                        <span>{selectedCampaign.location}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>Started {new Date(selectedCampaign.startDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4" />
                        <span>{selectedCampaign.talentAcquisitionTeam?.length || 0} team members</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Target className="w-4 h-4" />
                        <span>{selectedCampaign.experienceLevel}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Briefcase className="w-4 h-4" />
                        <span>{selectedCampaign.jobType}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <User className="w-4 h-4" />
                        <span>Created by: {selectedCampaign.created_by_name}</span>
                      </div>
                    </div>
                  </div>
                  <Badge className={getStatusColor(selectedCampaign.status)} variant="secondary">
                    {selectedCampaign.status}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
            <Card className="glass">
              <CardHeader>
                <CardTitle>Talent Acquisition Team</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedCampaign.talentAcquisitionTeam && selectedCampaign.talentAcquisitionTeam.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedCampaign.talentAcquisitionTeam.map((member, index) => (
                      <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-gray-500">{member.email}</p>
                          <Badge variant={member.role === "Hiring Manager" ? "default" : "secondary"}>
                            {member.role}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-xl font-medium text-gray-600 mb-2">No Team Members</p>
                    <p className="text-gray-500">No talent acquisition team members assigned to this campaign.</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Applied</p>
                      <p className="text-2xl font-bold text-blue-600">{selectedCampaign.candidatesApplied}</p>
                    </div>
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Hired</p>
                      <p className="text-2xl font-bold text-green-600">{selectedCampaign.candidatesHired}</p>
                    </div>
                    <UserCheck className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Success Rate</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {selectedCampaign.candidatesApplied > 0 ? Math.round((selectedCampaign.candidatesHired / selectedCampaign.candidatesApplied) * 100) : 0}%
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Positions Left</p>
                      <p className="text-2xl font-bold text-orange-600">{selectedCampaign.positions - selectedCampaign.candidatesHired}</p>
                    </div>
                    <Target className="w-8 h-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
            <Dialog open={!!candidateSearchResponse} onOpenChange={() => { setCandidateSearchResults([]); setCandidateSearchResponse(""); }}>
              <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Candidate Search Results</DialogTitle>
                  <DialogDescription>
                    Found {candidateSearchResults.length} matching candidates for {selectedCampaign?.jobTitle}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {candidateSearchResults.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {candidateSearchResults.map((candidate) => (
                        <Card key={candidate.resume_id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedSearchCandidate(candidate)} >
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h3 className="font-medium text-gray-900">{candidate.resume_name}</h3>
                                  <p className="text-sm text-gray-500">ID: {candidate.resume_id}</p>
                                </div>
                                <Badge className="bg-blue-100 text-blue-800"> #{candidate.rank} </Badge>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600">Overall Match</span>
                                  <span className="text-sm font-medium text-blue-600"> {Math.round(candidate.aggregated_score * 100)}% </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${candidate.aggregated_score * 100}%` }} />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600">Skills Match</span>
                                  <span className="font-medium"> {candidate.primary_vs_primary.total_matched}/{candidate.primary_vs_primary.total_required} </span>
                                </div>
                                {candidate.primary_vs_primary.matched_skills.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {candidate.primary_vs_primary.matched_skills.slice(0, 3).map((skill, index) => (
                                      <Badge key={index} variant="secondary" className="text-xs bg-green-100 text-green-800">
                                        {skill}
                                      </Badge>
                                    ))}
                                    {candidate.primary_vs_primary.matched_skills.length > 3 && (
                                      <Badge variant="secondary" className="text-xs"> +{candidate.primary_vs_primary.matched_skills.length - 3} </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex space-x-2 pt-2">
                                <Button size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); handleViewProfile(candidate); }} >
                                  <Eye className="w-3 h-3 mr-1" /> View
                                </Button>
                                <Button size="sm" variant="outline" className="flex-1" onClick={() => handleScheduleInterview(candidate)} >
                                  <Calendar className="w-3 h-3 mr-1" /> Schedule
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                      <p className="text-xl font-medium text-gray-600 mb-2">No Candidates Found</p>
                      <p className="text-gray-500">No matching candidates found for this campaign.</p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Card className="glass">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Candidates ({selectedCampaign.Interview?.length || 0})</CardTitle>
                  <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" disabled={isLoading} onClick={() => {
                    if (selectedCampaign?.id) {
                      sessionStorage.setItem('campaignId', selectedCampaign.id);
                    }
                    navigate(`/add-candidate`, {
                      state: {
                        campaign: {
                          campaignId: selectedCampaign?.id,
                          campaignTitle: selectedCampaign?.jobTitle,
                        },
                      },
                    });
                  }} >
                    <Plus className="w-4 h-4 mr-2" /> Add Candidate
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {selectedCampaign.Interview && selectedCampaign.Interview.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3">Name</th>
                          <th scope="col" className="px-6 py-3">Status</th>
                          <th scope="col" className="px-6 py-3">Current Round</th>
                          <th scope="col" className="px-6 py-3">Rating</th>
                          <th scope="col" className="px-6 py-3">Comments</th>
                          <th scope="col" className="px-6 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCampaign.Interview.map((interview) => {
                          const candidate: Candidate = {
                            id: interview._id,
                            profile_id: interview.scheduled_event?.candidate?.candidate_id || "unknown",
                            name: interview.scheduled_event?.candidate?.name || "Unknown",
                            email: interview.scheduled_event?.candidate?.email || "Unknown",
                            recent_designation: interview.scheduled_event?.candidate?.recent_designation || "Unknown",
                            status: selectedCampaign.currentRound,
                            currentRound: selectedCampaign.currentRound,
                            rating: 4.5, // Placeholder; update with actual rating if available
                            applicationDate: new Date(interview.created_at).toLocaleDateString(),
                            panelMembers: interview.scheduled_event?.panel_emails || [],
                            feedback: interview.interview_details.description || "No feedback provided",
                          };
                          console.log("Constructed candidate for table:", candidate);
                          const comments = candidateComments[candidate.id] || [];
                          const latestComment = comments.length > 0 ? comments[comments.length - 1] : null;
                          return (
                            <tr key={candidate.id} className="bg-white border-b hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <div className="flex flex-col space-y-1">
                                  <div className="font-medium text-gray-900">{candidate.name}</div>
                                  <div className="text-xs text-gray-500">{candidate.email}</div>
                                  <div className="text-xs text-gray-500">{candidate.recent_designation}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <Badge className={getCandidateStatusColor(candidate.status)}>
                                  {candidate.status}
                                </Badge>
                              </td>
                              <td className="px-6 py-4">{candidate.currentRound}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center">
                                  {[...Array(5)].map((_, i) => (
                                    <Star key={i} className={`w-4 h-4 ${i < Math.floor(candidate.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                                  ))}
                                </div>
                              </td>
                              <td className="px-6 py-4 min-w-[200px]">
                                <div className="flex items-start space-x-2">
                                  {latestComment ? (
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2">
                                        <p className="text-xs text-gray-500">{latestComment.author}</p>
                                        <Badge className={getJobTitleColor(latestComment.jobTitle)}>{latestComment.jobTitle}</Badge>
                                      </div>
                                      <p className="text-xs text-gray-500">{latestComment.timestamp}</p>
                                      <p className="text-sm text-gray-700 truncate max-w-[150px]">{latestComment.text}</p>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-400 italic flex-1">No comments yet</p>
                                  )}
                                  <Button size="sm" variant="ghost" onClick={() => handleViewComments(candidate)}>
                                    <MessageSquare className="w-4 h-4 mr-1" />
                                    {comments.length}
                                  </Button>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <Button size="sm" variant="outline" onClick={() => setSelectedCandidate(candidate)} >
                                  <Eye className="w-3 h-3 mr-1" /> View
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-xl font-medium text-gray-600 mb-2">No Candidates Found</p>
                    <p className="text-gray-500">Add a candidate to get started.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
        {selectedCandidate && (
          <CandidateDetailModal candidate={selectedCandidate} onClose={() => setSelectedCandidate(null)} />
        )}
        {selectedSearchCandidate && (
          <SearchCandidateDetailModal candidate={selectedSearchCandidate} onClose={() => setSelectedSearchCandidate(null)} />
        )}
        {selectedHiringFlowCandidate && (
          <HiringFlowModal candidate={selectedHiringFlowCandidate} onClose={() => setSelectedHiringFlowCandidate(null)} />
        )}
        {selectedCommentsCandidate && (
          <CommentsModal candidate={selectedCommentsCandidate} onClose={() => setSelectedCommentsCandidate(null)} />
        )}
      </main>
      <QChat />
    </div>
  );
};

export default CandidateSearch;