import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Eye, Star, MessageSquare, Save, X, List, TreePine, ArrowUpDown } from "lucide-react";
import { AggregatedScore, InterviewRound } from "@/api";

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
  interviewRounds?: InterviewRound[];
}

interface HiringRound {
  roundNumber: number;
  name: string;
  interviewDetails: {
    title: string;
    description: string;
    duration: number;
  };
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

interface SearchCandidateDetailModalProps {
  candidate: AggregatedScore;
  onClose: () => void;
  handleViewProfile: (candidate: AggregatedScore) => void;
  handleScheduleInterview: (candidate: AggregatedScore) => void;
  selectedCampaign: { jobTitle: string } | null;
}

interface HiringFlowModalProps {
  candidate: Candidate;
  onClose: () => void;
}

interface CommentComponentProps {
  comment: Comment;
  depth: number;
  candidateId: string;
  setCandidateComments: React.Dispatch<React.SetStateAction<{ [candidateId: string]: Comment[] }>>;
}

interface CommentsModalProps {
  candidate: Candidate;
  onClose: () => void;
  candidateComments: { [candidateId: string]: Comment[] };
  setCandidateComments: React.Dispatch<React.SetStateAction<{ [candidateId: string]: Comment[] }>>;
}

interface CandidateDetailModalProps {
  candidate: Candidate;
  onClose: () => void;
  handleViewComments: (candidate: Candidate) => void;
  handleScheduleInterview: (candidate: Candidate) => void;
  handleViewHiringFlow: (candidate: Candidate) => void;
  getCandidateStatusColor: (status: string) => string;
}

interface FlatComment extends Comment {
  depth: number;
  parentId?: string;
  repliedTo?: string;
  replyToText?: string;
  isLatest?: boolean;
}

export const SearchCandidateDetailModal = ({ candidate, onClose, handleViewProfile, handleScheduleInterview, selectedCampaign }: SearchCandidateDetailModalProps) => (
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

export const HiringFlowModal = ({ candidate, onClose }: HiringFlowModalProps) => {
  const [hiringFlow, setHiringFlow] = useState<HiringRound[]>(
    candidate.interviewRounds?.map((round) => ({
      roundNumber: round.roundNumber,
      name: round.name,
      interviewDetails: {
        title: round.details.title,
        description: round.details.description,
        duration: round.details.duration,
      },
      date: new Date(round.details.date).toLocaleDateString(),
      panelMembers: round.panel.map(member => member.display_name),
      feedback: "",
      additionalComments: ""
    })) || []
  );

  const [editingFeedback, setEditingFeedback] = useState<{ [key: number]: boolean }>({});
  const [editingComments, setEditingComments] = useState<{ [key: number]: boolean }>({});
  const [tempFeedback, setTempFeedback] = useState<{ [key: number]: string }>({});
  const [tempComments, setTempComments] = useState<{ [key: number]: string }>({});

  const latestRoundNumber = Math.max(...hiringFlow.map(round => round.roundNumber), 0);

  const handleEditFeedback = (index: number) => {
    setEditingFeedback(prev => ({ ...prev, [index]: true }));
    setTempFeedback(prev => ({ ...prev, [index]: hiringFlow[index].feedback }));
  };

  const handleEditComments = (index: number) => {
    setEditingComments(prev => ({ ...prev, [index]: true }));
    setTempComments(prev => ({ ...prev, [index]: hiringFlow[index].additionalComments }));
  };

  const handleSaveFeedback = (index: number) => {
    setHiringFlow(prev =>
      prev.map((round, i) =>
        i === index ? { ...round, feedback: tempFeedback[index] || "" } : round
      )
    );
    setEditingFeedback(prev => ({ ...prev, [index]: false }));
    setTempFeedback(prev => ({ ...prev, [index]: "" }));
  };

  const handleSaveComments = (index: number) => {
    setHiringFlow(prev =>
      prev.map((round, i) =>
        i === index ? { ...round, additionalComments: tempComments[index] || "" } : round
      )
    );
    setEditingComments(prev => ({ ...prev, [index]: false }));
    setTempComments(prev => ({ ...prev, [index]: "" }));
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" aria-describedby="hiring-flow-description">
        <DialogHeader>
          <DialogTitle>Hiring Flow for {candidate.name}</DialogTitle>
          <DialogDescription id="hiring-flow-description">
            Detailed round-wise hiring flow for candidate
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {hiringFlow.length > 0 ? (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"></div>
              {hiringFlow.map((round, index) => (
                <div key={index} className="relative mb-8 ml-10">
                  <div className="absolute -left-6 top-2 w-4 h-4 bg-blue-600 rounded-full border-2 border-white"></div>
                  <Card className="border shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {round.name} (Round {round.roundNumber})
                        {round.roundNumber === latestRoundNumber && (
                          <Badge variant="default" className="bg-green-600 text-white">
                            Current Round
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Interview Details</Label>
                        <div className="text-sm text-muted-foreground mt-2 p-3 bg-gray-50 rounded-lg">
                          <p><strong>Title:</strong> {round.interviewDetails.title}</p>
                          <p><strong>Description:</strong> {round.interviewDetails.description}</p>
                          <p><strong>Duration:</strong> {round.interviewDetails.duration} minutes</p>
                        </div>
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
                        {editingFeedback[index] ? (
                          <div className="mt-2 space-y-2">
                            <Textarea
                              value={tempFeedback[index] || ""}
                              onChange={(e) => setTempFeedback(prev => ({ ...prev, [index]: e.target.value }))}
                              placeholder="Add feedback..."
                              className="min-h-[60px] text-sm"
                            />
                            <Button onClick={() => handleSaveFeedback(index)} size="sm">
                              Save
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-2 flex items-start gap-2">
                            <p className="text-sm text-muted-foreground">
                              {round.feedback || "No feedback provided"}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditFeedback(index)}
                            >
                              Edit
                            </Button>
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Additional Comments</Label>
                        {editingComments[index] ? (
                          <div className="mt-2 space-y-2">
                            <Textarea
                              value={tempComments[index] || ""}
                              onChange={(e) => setTempComments(prev => ({ ...prev, [index]: e.target.value }))}
                              placeholder="Add additional comments..."
                              className="min-h-[60px] text-sm"
                            />
                            <Button onClick={() => handleSaveComments(index)} size="sm">
                              Save
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-2 flex items-start gap-2">
                            <p className="text-sm text-muted-foreground">
                              {round.additionalComments || "No additional comments provided"}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditComments(index)}
                            >
                              Edit
                            </Button>
                          </div>
                        )}
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
};

export const CommentComponent = ({ comment, depth = 0, candidateId, setCandidateComments }: CommentComponentProps) => {
  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);

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

  const handleAddReply = () => {
    if (!replyText.trim()) return;
    const newReply: Comment = {
      id: `${comment.id}.${comment.replies.length + 1}`,
      author: "You",
      jobTitle: "Team Member",
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

const ListViewCommentComponent = ({ comment, candidateId, setCandidateComments }: { comment: FlatComment, candidateId: string, setCandidateComments: React.Dispatch<React.SetStateAction<{ [candidateId: string]: Comment[] }>> }) => {
  const [replyText, setReplyText] = useState("");
  const [isReplying, setIsReplying] = useState(false);

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

  const handleAddReply = () => {
    if (!replyText.trim()) return;
    const newReply: Comment = {
      id: `${Date.now()}`,
      author: "You",
      jobTitle: "Team Member",
      timestamp: new Date().toLocaleString(),
      text: replyText,
      replies: [],
    };
    
    setCandidateComments(prev => ({
      ...prev,
      [candidateId]: [...(prev[candidateId] || []), newReply]
    }));
    setReplyText("");
    setIsReplying(false);
  };

  return (
    <div className="mb-4">
      <Card className="border shadow-sm">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2 flex-wrap">
              <p className="font-medium text-sm">{comment.author}</p>
              <Badge className={getJobTitleColor(comment.jobTitle)}>{comment.jobTitle}</Badge>
              {comment.depth > 0 && (
                <Badge variant="outline" className="text-xs">
                  Reply to {comment.repliedTo}
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {comment.isLatest && (
                <Badge 
                  className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm hover:bg-green-600 transition-colors"
                >
                  Latest
                </Badge>
              )}
              <p className="text-xs text-gray-500">{comment.timestamp}</p>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsReplying(!isReplying)}
                className="hover:bg-gray-100"
              >
                Reply
              </Button>
            </div>
          </div>
          
          {comment.depth > 0 && comment.replyToText && (
            <div className="bg-gray-50 border-l-4 border-gray-300 pl-3 py-2 mb-2 rounded-r-md">
              <p className="text-xs text-gray-600 font-medium">Replying to:</p>
              <p className="text-xs text-gray-700 italic">
                {comment.replyToText.length > 100 ? comment.replyToText.substring(0, 100) + '...' : comment.replyToText}
              </p>
            </div>
          )}
          
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
                <Button 
                  size="sm" 
                  onClick={handleAddReply} 
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-3 h-3 mr-1" /> Post Reply
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setIsReplying(false)}
                  className="hover:bg-gray-100"
                >
                  <X className="w-3 h-3 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export const CommentsModal = ({ candidate, onClose, candidateComments, setCandidateComments }: CommentsModalProps) => {
  const comments = candidateComments[candidate.id] || [];
  const [newCommentText, setNewCommentText] = useState("");
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');

  const flattenComments = (comments: Comment[]): FlatComment[] => {
    const flattened: FlatComment[] = [];
    
    const flatten = (comment: Comment, depth: number = 0, parentAuthor?: string, parentText?: string) => {
      flattened.push({
        ...comment,
        depth,
        repliedTo: parentAuthor,
        replyToText: parentText
      });
      
      comment.replies.forEach(reply => {
        flatten(reply, depth + 1, comment.author, comment.text);
      });
    };
    
    comments.forEach(comment => flatten(comment));
    return flattened;
  };

  const getFlattenedComments = (): FlatComment[] => {
    const flattened = flattenComments(comments);
    const sorted = flattened.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    if (sorted.length > 0) {
      sorted[0].isLatest = true;
    }
    
    return sorted;
  };

  const handleAddNewComment = () => {
    if (!newCommentText.trim()) return;
    const newComment: Comment = {
      id: `${Date.now()}`,
      author: "You",
      jobTitle: "Team Member",
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

  const flattenedComments = getFlattenedComments();

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Comments for {candidate.name}</span>
            <div className="flex items-center space-x-2">
              <Button
                variant={viewMode === 'tree' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('tree')}
                className="hover:bg-gray-100"
              >
                <TreePine className="w-4 h-4 mr-1" />
                Tree View
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="hover:bg-gray-100"
              >
                <List className="w-4 h-4 mr-1" />
                List View
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>
            {viewMode === 'tree' 
              ? 'Threaded comments from the hiring team, covering all aspects of the hiring flow.'
              : 'Flat comment list with latest comments first and reply context.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {comments.length > 0 ? (
            <div className="relative">
              {viewMode === 'tree' ? (
                <>
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"></div>
                  {comments.map((comment, index) => (
                    <CommentComponent key={index} comment={comment} depth={0} candidateId={candidate.id} setCandidateComments={setCandidateComments} />
                  ))}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-700">
                      Total Comments: {flattenedComments.length}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      Sorted by Latest
                    </Badge>
                  </div>
                  {flattenedComments.map((comment, index) => (
                    <ListViewCommentComponent 
                      key={`${comment.id}-${index}`} 
                      comment={comment} 
                      candidateId={candidate.id} 
                      setCandidateComments={setCandidateComments} 
                    />
                  ))}
                </div>
              )}
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
            <Button 
              onClick={handleAddNewComment} 
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" /> Post Comment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const CandidateDetailModal = ({ candidate, onClose, handleViewComments, handleViewHiringFlow, getCandidateStatusColor }: CandidateDetailModalProps) => {
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

export type { Candidate, HiringRound, Comment };