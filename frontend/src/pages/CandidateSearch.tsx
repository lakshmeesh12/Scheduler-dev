import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search, Plus, Users, Calendar, TrendingUp, UserCheck, Clock, Eye, FileText, MessageSquare, Loader2, User, Building, MapPin, Target, Briefcase, Edit2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { fetchCampaignById, fetchMatchingResumes, updateCampaignTeam, updateCampaignDetails, HiringCampaign, AggregatedScore, Interview, InterviewRound } from "@/api";
import QChat from "@/components/QChat";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchCandidateDetailModal, HiringFlowModal, CommentsModal, CandidateDetailModal, Comment, Candidate, HiringRound } from "./CandidateModals";
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface TalentAcquisitionTeamMember {
  id: string;
  name: string;
  email: string;
  role: "Recruiter" | "Hiring Manager" | "Coordinator";
  isHiringManager: boolean;
}

interface CampaignDetails {
  jobTitle: string;
  description: string;
  department: string;
  location: string;
  jobType: "Full-time" | "Part-time" | "Contract";
  positions: number;
}

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-red-600">
          <h2>Something went wrong.</h2>
          <p>Please try again or contact support.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const [candidateStatuses, setCandidateStatuses] = useState<{ [candidateId: string]: string }>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditTeamModalOpen, setIsEditTeamModalOpen] = useState(false);
  const [isEditCampaignMode, setIsEditCampaignMode] = useState(false);
  const [isEditPositionsMode, setIsEditPositionsMode] = useState(false);
  const [newTeamMember, setNewTeamMember] = useState<TalentAcquisitionTeamMember>({
    id: "",
    name: "",
    email: "",
    role: "Recruiter",
    isHiringManager: false,
  });
  const [tempTeam, setTempTeam] = useState<TalentAcquisitionTeamMember[]>([]);
  const [tempCampaignDetails, setTempCampaignDetails] = useState<CampaignDetails>({
    jobTitle: "",
    description: "",
    department: "",
    location: "",
    jobType: "Full-time",
    positions: 1,
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (campaignId) {
      loadCampaign();
    }
  }, [campaignId]);

  useEffect(() => {
    if (selectedCampaign?.talentAcquisitionTeam) {
      setTempTeam([...selectedCampaign.talentAcquisitionTeam]);
    }
    if (selectedCampaign) {
      setTempCampaignDetails({
        jobTitle: selectedCampaign.jobTitle,
        description: selectedCampaign.description,
        department: selectedCampaign.department,
        location: selectedCampaign.location,
        jobType: selectedCampaign.jobType,
        positions: selectedCampaign.positions,
      });
    }
  }, [selectedCampaign, isEditTeamModalOpen]);

  const loadCampaign = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const campaign = await fetchCampaignById(campaignId!);
      setSelectedCampaign(campaign);
      if (campaign.Interview) {
        const initialComments: { [candidateId: string]: Comment[] } = {};
        const initialStatuses: { [candidateId: string]: string } = {};
        campaign.Interview.forEach((interview) => {
          initialComments[interview._id] = [...dummyComments];
          const storedStatus = localStorage.getItem(`candidateStatus_${interview._id}`);
          initialStatuses[interview._id] = storedStatus || "Applied";
        });
        setCandidateComments(initialComments);
        setCandidateStatuses(initialStatuses);
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

  const handleStatusChange = (candidateId: string, status: string) => {
    setCandidateStatuses(prev => ({
      ...prev,
      [candidateId]: status,
    }));
    localStorage.setItem(`candidateStatus_${candidateId}`, status);
  };

  const handleAddTeamMember = () => {
    if (!newTeamMember.name.trim() || !newTeamMember.email.trim()) {
      setFormErrors({ teamMember: "Name and email are required for team members" });
      console.error("Validation failed: Name or email is empty");
      return;
    }
    if (!newTeamMember.email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
      setFormErrors({ teamMember: "Invalid email format for team member" });
      console.error("Validation failed: Invalid email format", newTeamMember.email);
      return;
    }
    const memberWithId = { ...newTeamMember, id: Date.now().toString() };
    setTempTeam([...tempTeam, memberWithId]);
    setNewTeamMember({ id: "", name: "", email: "", role: "Recruiter", isHiringManager: false });
    setFormErrors({});
  };

  const handleRemoveTeamMember = (memberId: string) => {
    setTempTeam(tempTeam.filter((m) => m.id !== memberId));
  };

  const handleSaveTeam = async () => {
    const errors: { [key: string]: string } = {};
    tempTeam.forEach((member, index) => {
      if (!member.email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
        errors[`teamMemberEmail${index}`] = `Invalid email for team member: ${member.name}`;
      }
    });
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setIsLoading(true);
    try {
      if (!campaignId) {
        throw new Error("Campaign ID is missing");
      }
      await updateCampaignTeam(campaignId, tempTeam);
      setSelectedCampaign(prev => prev ? { ...prev, talentAcquisitionTeam: tempTeam } : null);
      setIsEditTeamModalOpen(false);
      setNewTeamMember({ id: "", name: "", email: "", role: "Recruiter", isHiringManager: false });
      setFormErrors({});
    } catch (err) {
      console.error("Error updating team:", err);
      setError(err instanceof Error ? err.message : "Failed to update team");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCampaignDetails = async () => {
    const errors: { [key: string]: string } = {};
    if (!tempCampaignDetails.jobTitle.trim()) {
      errors.jobTitle = "Job title is required";
    }
    if (!tempCampaignDetails.description.trim()) {
      errors.description = "Description is required";
    }
    if (!tempCampaignDetails.department.trim()) {
      errors.department = "Department is required";
    }
    if (!tempCampaignDetails.location.trim()) {
      errors.location = "Location is required";
    }
    if (tempCampaignDetails.positions < 1) {
      errors.positions = "At least one position is required";
    }
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setIsLoading(true);
    try {
      if (!campaignId) {
        throw new Error("Campaign ID is missing");
      }
      await updateCampaignDetails(campaignId, tempCampaignDetails);
      setSelectedCampaign(prev => prev ? {
        ...prev,
        jobTitle: tempCampaignDetails.jobTitle,
        description: tempCampaignDetails.description,
        department: tempCampaignDetails.department,
        location: tempCampaignDetails.location,
        jobType: tempCampaignDetails.jobType,
        positions: tempCampaignDetails.positions,
      } : null);
      setIsEditCampaignMode(false);
      setIsEditPositionsMode(false);
      setFormErrors({});
    } catch (err) {
      console.error("Error updating campaign details:", err);
      setError(err instanceof Error ? err.message : "Failed to update campaign details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelEditCampaign = () => {
    setIsEditCampaignMode(false);
    setIsEditPositionsMode(false);
    setFormErrors({});
    setTempCampaignDetails({
      jobTitle: selectedCampaign?.jobTitle || "",
      description: selectedCampaign?.description || "",
      department: selectedCampaign?.department || "",
      location: selectedCampaign?.location || "",
      jobType: selectedCampaign?.jobType || "Full-time",
      positions: selectedCampaign?.positions || 1,
    });
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
      case "In Progress": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getCurrentRoundColor = (round: string) => {
    switch (round) {
      case "Screening": return "bg-blue-100 text-blue-800";
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
      case "Product Manager": return "bg-orange-100 text-blue-800";
      case "HR Manager": return "bg-red-100 text-red-800";
      case "Team Lead": return "bg-indigo-100 text-indigo-800";
      case "HR Specialist": return "bg-pink-100 text-pink-800";
      case "HR": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Group interviews by candidate_id and get latest round
  const getCandidateList = (interviews: Interview[] = [], rounds: InterviewRound[] = []): Candidate[] => {
  // Group interviews by candidate_id
  const candidateMap = new Map<string, { interviews: Interview[]; latestInterview: Interview }>();
  interviews.forEach(interview => {
    const candidateId = interview.scheduled_event?.candidate?.candidate_id || "unknown";
    if (!candidateMap.has(candidateId)) {
      candidateMap.set(candidateId, { interviews: [], latestInterview: interview });
    }
    const current = candidateMap.get(candidateId)!;
    current.interviews.push(interview);
    // Update latestInterview based on created_at
    if (new Date(interview.created_at) > new Date(current.latestInterview.created_at)) {
      current.latestInterview = interview;
    }
  });

  // Map candidates and include all rounds
  return Array.from(candidateMap.entries()).map(([candidateId, { latestInterview }]) => {
    // Get all rounds for this candidate
    const candidateRounds = rounds.filter(round => round.candidateId === candidateId);
    // Sort rounds by createdAt to get the latest for currentRound
    const latestRound = candidateRounds.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    return {
      id: latestInterview._id,
      profile_id: candidateId,
      name: latestInterview.scheduled_event?.candidate?.name || "Unknown",
      email: latestInterview.scheduled_event?.candidate?.email || "Unknown",
      recent_designation: latestInterview.scheduled_event?.candidate?.recent_designation || "Unknown",
      status: candidateStatuses[latestInterview._id] || "Applied",
      currentRound: latestRound?.name || selectedCampaign?.currentRound || "Screening",
      rating: 4.5,
      applicationDate: new Date(latestInterview.created_at).toLocaleDateString(),
      panelMembers: latestInterview.scheduled_event?.panel_emails || [],
      feedback: latestInterview.interview_details?.description || "No feedback provided",
      interviewRounds: candidateRounds, // Include all rounds
    };
  });
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
              <Button onClick={handleCandidateSearch} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" disabled={isSearchingCandidates}>
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
                    {isEditCampaignMode ? (
                      <>
                        <div className="flex items-center space-x-2 mb-2">
                          <Textarea
                            className="text-xl font-semibold resize-none h-8 leading-tight"
                            value={tempCampaignDetails.jobTitle}
                            onChange={(e) => setTempCampaignDetails({ ...tempCampaignDetails, jobTitle: e.target.value })}
                            disabled={isLoading}
                          />
                          {formErrors.jobTitle && <p className="text-red-500 text-xs">{formErrors.jobTitle}</p>}
                        </div>
                        <div className="flex items-center space-x-2 mb-3">
                          <Textarea
                            className="text-sm text-muted-foreground resize-none h-24"
                            value={tempCampaignDetails.description}
                            onChange={(e) => setTempCampaignDetails({ ...tempCampaignDetails, description: e.target.value })}
                            disabled={isLoading}
                          />
                          {formErrors.description && <p className="text-red-500 text-xs">{formErrors.description}</p>}
                        </div>
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
                          <div className="flex items-center space-x-1">
                            <Building className="w-4 h-4" />
                            <Select
                              value={tempCampaignDetails.department}
                              onValueChange={(value) => setTempCampaignDetails({ ...tempCampaignDetails, department: value })}
                              disabled={isLoading}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Select department" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Engineering">Engineering</SelectItem>
                                <SelectItem value="Product">Product</SelectItem>
                                <SelectItem value="HR">HR</SelectItem>
                                <SelectItem value="Marketing">Marketing</SelectItem>
                                <SelectItem value="Sales">Sales</SelectItem>
                              </SelectContent>
                            </Select>
                            {formErrors.department && <p className="text-red-500 text-xs">{formErrors.department}</p>}
                          </div>
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-4 h-4" />
                            <Input
                              className="w-[140px] text-sm"
                              value={tempCampaignDetails.location}
                              onChange={(e) => setTempCampaignDetails({ ...tempCampaignDetails, location: e.target.value })}
                              disabled={isLoading}
                              placeholder="Enter location"
                            />
                            {formErrors.location && <p className="text-red-500 text-xs">{formErrors.location}</p>}
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
                            <Select
                              value={tempCampaignDetails.jobType}
                              onValueChange={(value: "Full-time" | "Part-time" | "Contract") =>
                                setTempCampaignDetails({ ...tempCampaignDetails, jobType: value })
                              }
                              disabled={isLoading}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Select job type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Full-time">Full-time</SelectItem>
                                <SelectItem value="Part-time">Part-time</SelectItem>
                                <SelectItem value="Contract">Contract</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center space-x-1">
                            <User className="w-4 h-4" />
                            <span>Created by: {selectedCampaign.created_by_name}</span>
                          </div>
                        </div>
                        <div className="flex space-x-2 mt-4">
                          <Button
                            variant="outline"
                            onClick={handleCancelEditCampaign}
                            disabled={isLoading}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleSaveCampaignDetails}
                            disabled={isLoading}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                          >
                            {isLoading ? "Saving..." : "Save Details"}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center space-x-2">
                          <CardTitle className="text-2xl">{selectedCampaign.jobTitle}</CardTitle>
                        </div>
                        <div className="mt-1">
                          <p className="text-sm text-muted-foreground">{selectedCampaign.description}</p>
                        </div>
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-3 text-sm text-gray-600">
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
                      </>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditCampaignMode(!isEditCampaignMode)}
                      disabled={isLoading}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Badge className={getStatusColor(selectedCampaign.status)} variant="secondary">
                      {selectedCampaign.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
            </Card>
            <Card className="glass">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Talent Acquisition Team</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditTeamModalOpen(true)}
                    disabled={isLoading}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
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
            <Dialog open={isEditTeamModalOpen} onOpenChange={(open) => {
              setIsEditTeamModalOpen(open);
              if (!open) {
                setNewTeamMember({ id: "", name: "", email: "", role: "Recruiter", isHiringManager: false });
                setFormErrors({});
                setTempTeam(selectedCampaign?.talentAcquisitionTeam || []);
              }
            }}>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Edit Talent Acquisition Team</DialogTitle>
                  <DialogDescription>
                    Add or remove team members for this campaign.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-2 p-4 border rounded-lg">
                    <Input
                      placeholder="Name"
                      value={newTeamMember.name}
                      onChange={(e) => setNewTeamMember({ ...newTeamMember, name: e.target.value })}
                      disabled={isLoading}
                    />
                    <Input
                      placeholder="Email"
                      type="email"
                      value={newTeamMember.email}
                      onChange={(e) => setNewTeamMember({ ...newTeamMember, email: e.target.value })}
                      disabled={isLoading}
                    />
                    <Select
                      value={newTeamMember.role}
                      onValueChange={(value: "Recruiter" | "Hiring Manager" | "Coordinator") =>
                        setNewTeamMember({
                          ...newTeamMember,
                          role: value,
                          isHiringManager: value === "Hiring Manager",
                        })
                      }
                      disabled={isLoading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Recruiter">Recruiter</SelectItem>
                        <SelectItem value="Hiring Manager">Hiring Manager</SelectItem>
                        <SelectItem value="Coordinator">Coordinator</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddTeamMember} size="sm" disabled={isLoading}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {formErrors.teamMember && <p className="text-red-500 text-xs">{formErrors.teamMember}</p>}
                  {tempTeam.length > 0 && (
                    <div className="space-y-2">
                      {tempTeam.map((member, index) => (
                        <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div>
                              <p className="font-medium">{member.name}</p>
                              <p className="text-sm text-gray-500">{member.email}</p>
                            </div>
                            <Badge variant={member.isHiringManager ? "default" : "secondary"}>
                              {member.role}
                            </Badge>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveTeamMember(member.id)}
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          {formErrors[`teamMemberEmail${index}`] && (
                            <p className="text-red-500 text-xs">{formErrors[`teamMemberEmail${index}`]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsEditTeamModalOpen(false)}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveTeam}
                      disabled={isLoading}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    >
                      {isLoading ? "Saving..." : "Save Team"}
                    </Button>
                  </div>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                      {isEditPositionsMode ? (
                        <div className="flex items-center space-x-2">
                          <Input
                            type="number"
                            className="w-20 text-2xl font-bold text-orange-600"
                            value={tempCampaignDetails.positions.toString()}
                            onChange={(e) => setTempCampaignDetails({ ...tempCampaignDetails, positions: parseInt(e.target.value) || 1 })}
                            disabled={isLoading}
                          />
                          {formErrors.positions && <p className="text-red-500 text-xs">{formErrors.positions}</p>}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEditCampaign}
                            disabled={isLoading}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveCampaignDetails}
                            disabled={isLoading}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                          >
                            Save
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <p className="text-2xl font-bold text-orange-600">{selectedCampaign.positions - selectedCampaign.candidatesHired}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditPositionsMode(true)}
                            disabled={isLoading}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
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
                        <Card key={candidate.resume_id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedSearchCandidate(candidate)}>
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
                                <Button size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); handleViewProfile(candidate); }}>
                                  <Eye className="w-3 h-3 mr-1" /> View
                                </Button>
                                <Button size="sm" variant="outline" className="flex-1" onClick={() => handleScheduleInterview(candidate)}>
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
                  <CardTitle>Candidates ({getCandidateList(selectedCampaign?.Interview, selectedCampaign?.Interview_Round).length})</CardTitle>
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
                  }}>
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
                          <th scope="col" className="px-4 py-2">Name</th>
                          <th scope="col" className="px-4 py-2">Status</th>
                          <th scope="col" className="px-4 py-2">Current Round</th>
                          <th scope="col" className="px-4 py-2">Schedule Round</th>
                          <th scope="col" className="px-4 py-2">Comments</th>
                          <th scope="col" className="px-4 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getCandidateList(selectedCampaign.Interview, selectedCampaign.Interview_Round).map((candidate) => {
                          const comments = candidateComments[candidate.id] || [];
                          const latestComment = comments.length > 0 ? comments[comments.length - 1] : null;
                          return (
                            <tr key={candidate.id} className="bg-white border-b hover:bg-gray-50">
                              <td className="px-4 py-2">
                                <div className="flex flex-col space-y-0.5">
                                  <div className="font-medium text-gray-900 text-sm">{candidate.name}</div>
                                  <div className="text-xs text-gray-500">{candidate.email}</div>
                                  <div className="text-xs text-gray-500">{candidate.recent_designation}</div>
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                <Select
                                  value={candidateStatuses[candidate.id] || "Applied"}
                                  onValueChange={(value) => handleStatusChange(candidate.id, value)}
                                >
                                  <SelectTrigger className="w-[110px] bg-gray-50 border-gray-300 text-gray-800 text-xs font-medium rounded-md shadow-sm hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 transition-colors">
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-white border-gray-200 shadow-lg rounded-md">
                                    <SelectItem value="Applied" className="text-gray-800 text-xs hover:bg-blue-50">Applied</SelectItem>
                                    <SelectItem value="In Progress" className="text-gray-800 text-xs hover:bg-purple-50">In Progress</SelectItem>
                                    <SelectItem value="Selected" className="text-gray-800 text-xs hover:bg-green-50">Selected</SelectItem>
                                    <SelectItem value="On Hold" className="text-gray-800 text-xs hover:bg-yellow-50">On Hold</SelectItem>
                                    <SelectItem value="Rejected" className="text-gray-800 text-xs hover:bg-red-50">Rejected</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                              <td className="px-4 py-2">
                                <Badge className={`${getCurrentRoundColor(candidate.currentRound)} font-medium rounded-md px-2 py-0.5 text-xs`}>
                                  {candidate.currentRound}
                                </Badge>
                              </td>
                              <td className="px-4 py-2">
                                <Button
                                  size="sm"
                                  className="bg-white border border-gray-300 text-gray-800 text-xs font-medium rounded-md shadow-sm hover:bg-gray-100 transition-colors py-1 px-2"
                                  onClick={() => handleScheduleInterview(candidate)}
                                >
                                  <Calendar className="w-3 h-3 mr-1" /> Schedule Next Round
                                </Button>
                              </td>
                              <td className="px-4 py-2 min-w-[180px]">
                                <div className="flex items-start space-x-2">
                                  {latestComment ? (
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2">
                                        <p className="text-xs text-gray-500">{latestComment.author}</p>
                                        <Badge className={getJobTitleColor(latestComment.jobTitle)}>{latestComment.jobTitle}</Badge>
                                      </div>
                                      <p className="text-xs text-gray-500">{latestComment.timestamp}</p>
                                      <p className="text-sm text-gray-700 truncate max-w-[140px]">{latestComment.text}</p>
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
                              <td className="px-4 py-2">
                                <Button size="sm" variant="outline" onClick={() => setSelectedCandidate(candidate)}>
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
          <ErrorBoundary>
            <CandidateDetailModal
              candidate={selectedCandidate}
              onClose={() => setSelectedCandidate(null)}
              handleViewComments={handleViewComments}
              handleScheduleInterview={handleScheduleInterview}
              handleViewHiringFlow={handleViewHiringFlow}
              getCandidateStatusColor={getCandidateStatusColor}
            />
          </ErrorBoundary>
        )}
        {selectedSearchCandidate && (
          <ErrorBoundary>
            <SearchCandidateDetailModal
              candidate={selectedSearchCandidate}
              onClose={() => setSelectedSearchCandidate(null)}
              handleViewProfile={handleViewProfile}
              handleScheduleInterview={handleScheduleInterview}
              selectedCampaign={selectedCampaign}
            />
          </ErrorBoundary>
        )}
        {selectedHiringFlowCandidate && (
          <ErrorBoundary>
            <HiringFlowModal
              candidate={selectedHiringFlowCandidate}
              onClose={() => setSelectedHiringFlowCandidate(null)}
            />
          </ErrorBoundary>
        )}
        {selectedCommentsCandidate && (
          <ErrorBoundary>
            <CommentsModal
              candidate={selectedCommentsCandidate}
              onClose={() => setSelectedCommentsCandidate(null)}
              candidateComments={candidateComments}
              setCandidateComments={setCandidateComments}
            />
          </ErrorBoundary>
        )}
      </main>
      <QChat />
    </div>
  );
};

export default CandidateSearch;