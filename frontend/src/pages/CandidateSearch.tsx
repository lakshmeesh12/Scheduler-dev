import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search, Plus, Users, Calendar, TrendingUp, UserCheck, Clock, Eye, FileText, MessageSquare, Loader2, User, Building, MapPin, Target, Briefcase, Edit2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { fetchCampaignById, fetchMatchingResumes, updateCampaignTeam, updateCampaignDetails, HiringCampaign, AggregatedScore, Interview, InterviewRound, retrieveExcel, ExcelRecord } from "@/api";
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
import { HiringFlowModal, CommentsModal, CandidateDetailModal, Comment, Candidate, HiringRound } from "./CandidateModals";
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
  const [isSearchingCandidates, setIsSearchingCandidates] = useState(false);
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
  const [preScreeningCandidates, setPreScreeningCandidates] = useState<ExcelRecord[]>([]);
  const [isLoadingPreScreening, setIsLoadingPreScreening] = useState(false);
  const [activeTab, setActiveTab] = useState<"candidatePool" | "interviewStage" | "onboarded">("candidatePool");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    experience: "",
    location: "",
    skills: "",
    salary: "",
    availability: "",
  });
  const [showFullJD, setShowFullJD] = useState(false);

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

      // Fetch pre-screening data
      setIsLoadingPreScreening(true);
      const excelData = await retrieveExcel(campaignId!);
      setPreScreeningCandidates(excelData.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign or pre-screening data');
    } finally {
      setIsLoading(false);
      setIsLoadingPreScreening(false);
    }
  };

  const handleCandidateSearch = async () => {
  if (!selectedCampaign) return;
  setIsSearchingCandidates(true);
  setError("");
  try {
    const formData = new FormData();
    formData.append("job_description", selectedCampaign.description);
    formData.append("job_title", selectedCampaign.jobTitle);
    
    // Add custom search query if provided
    if (searchQuery.trim()) {
      formData.append("additional_query", searchQuery);
    }
    
    // Add filters if provided
    Object.entries(searchFilters).forEach(([key, value]) => {
      if (value.trim()) {
        formData.append(`filter_${key}`, value);
      }
    });
    
    const result = await fetchMatchingResumes(formData);
    navigate(`/candidate-search/${campaignId}/results`, {
      state: {
        searchResults: result.matching_results.map(candidate => ({ ...candidate, campaignId: selectedCampaign.id })),
        jobTitle: selectedCampaign.jobTitle,
        campaignId: selectedCampaign.id,
        clientId: selectedCampaign.client_id,
        searchQuery,
        filters: searchFilters,
      },
    });
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to search candidates');
  } finally {
    setIsSearchingCandidates(false);
  }
};

// Add this helper function to reset search filters:
const handleResetFilters = () => {
  setSearchQuery("");
  setSearchFilters({
    experience: "",
    location: "",
    skills: "",
    salary: "",
    availability: "",
  });
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
    const candidateMap = new Map<string, { interviews: Interview[]; latestInterview: Interview }>();
    interviews.forEach(interview => {
      const candidateId = interview.scheduled_event?.candidate?.candidate_id || "unknown";
      if (!candidateMap.has(candidateId)) {
        candidateMap.set(candidateId, { interviews: [], latestInterview: interview });
      }
      const current = candidateMap.get(candidateId)!;
      current.interviews.push(interview);
      if (new Date(interview.created_at) > new Date(current.latestInterview.created_at)) {
        current.latestInterview = interview;
      }
    });

    return Array.from(candidateMap.entries()).map(([candidateId, { latestInterview }]) => {
      const candidateRounds = rounds.filter(round => round.candidateId === candidateId);
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
        interviewRounds: candidateRounds,
      };
    });
  };

  const dummyOnboarded = [
    { id: "1", name: "Alice Wonderland", email: "alice@example.com", onboardDate: "2025-08-01", status: "Active" },
    { id: "2", name: "Bob Builder", email: "bob@example.com", onboardDate: "2025-08-15", status: "Active" },
    { id: "3", name: "Charlie Chocolate", email: "charlie@example.com", onboardDate: "2025-09-01", status: "Probation" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 w-full overflow-x-hidden">
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <SidebarTrigger className="p-2" />
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold gradient-text">
                  {selectedCampaign ? selectedCampaign.jobTitle : "Candidate Search"}
                </h1>
                <p className="text-xs text-gray-600">Enterprise Hiring Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Enhanced Search Interface */}
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <div className="flex items-center space-x-2 bg-white/90 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2 shadow-lg">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Add custom search criteria..."
                      className="bg-transparent outline-none text-xs placeholder-gray-400 w-52"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button
                      onClick={() => setIsAdvancedSearchOpen(!isAdvancedSearchOpen)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded transition-colors"
                    >
                      {isAdvancedSearchOpen ? "Hide" : "Filters"}
                    </button>
                  </div>
                  
                  {/* Advanced Search Filters */}
                  {isAdvancedSearchOpen && (
                    <div className="absolute top-full left-0 mt-2 w-96 bg-white/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-xl p-4 z-40">
                      <h4 className="font-medium text-sm text-gray-800 mb-2">Search Filters</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 block">Experience Level</label>
                          <Select
                            value={searchFilters.experience}
                            onValueChange={(value) => setSearchFilters({ ...searchFilters, experience: value })}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue placeholder="Any" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any Experience</SelectItem>
                              <SelectItem value="0-2">0-2 years</SelectItem>
                              <SelectItem value="2-5">2-5 years</SelectItem>
                              <SelectItem value="5-10">5-10 years</SelectItem>
                              <SelectItem value="10+">10+ years</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Preferred Location</label>
                          <Input
                            placeholder="e.g., Remote, Bangalore"
                            className="h-8 text-sm"
                            value={searchFilters.location}
                            onChange={(e) => setSearchFilters({ ...searchFilters, location: e.target.value })}
                          />
                        </div>
                        
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Key Skills</label>
                          <Input
                            placeholder="e.g., React, Python"
                            className="h-8 text-sm"
                            value={searchFilters.skills}
                            onChange={(e) => setSearchFilters({ ...searchFilters, skills: e.target.value })}
                          />
                        </div>
                        
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Salary Range</label>
                          <Select
                            value={searchFilters.salary}
                            onValueChange={(value) => setSearchFilters({ ...searchFilters, salary: value })}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Any" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any Salary</SelectItem>
                              <SelectItem value="0-5">0-5 LPA</SelectItem>
                              <SelectItem value="5-10">5-10 LPA</SelectItem>
                              <SelectItem value="10-20">10-20 LPA</SelectItem>
                              <SelectItem value="20+">20+ LPA</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="col-span-2">
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Availability</label>
                          <Select
                            value={searchFilters.availability}
                            onValueChange={(value) => setSearchFilters({ ...searchFilters, availability: value })}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Any" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any Availability</SelectItem>
                              <SelectItem value="immediate">Immediate</SelectItem>
                              <SelectItem value="15-days">Within 15 days</SelectItem>
                              <SelectItem value="30-days">Within 30 days</SelectItem>
                              <SelectItem value="60-days">Within 60 days</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="flex justify-between mt-4 pt-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetFilters}
                          className="text-xs"
                        >
                          Reset Filters
                        </Button>
                        <div className="text-xs text-gray-500">
                          {Object.values(searchFilters).filter(v => v.trim() && v !== "any").length + (searchQuery.trim() ? 1 : 0)} filters active
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <Button 
                onClick={handleCandidateSearch} 
                variant="default"
                size="sm"
                disabled={isSearchingCandidates}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {isSearchingCandidates ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                disabled={isLoading}
                onClick={() => {
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
                }}
              >
                <Plus className="w-4 h-4 mr-2" /> Add Candidate
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-screen-xl mx-auto px-4 py-8">
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
                          <CardTitle className="text-sm font-medium">{selectedCampaign.jobTitle}</CardTitle>
                        </div>
                        <div className="mt-1 flex items-center space-x-2">
                          <p className="text-xs text-muted-foreground line-clamp-1">{selectedCampaign.description}</p>
                         
                          <Button variant="ghost" size="icon" onClick={() => setShowFullJD(true)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-600">
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
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                          <Card className="border-none shadow-sm bg-white/80 backdrop-blur-sm">
                            <CardContent className="p-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-[10px] text-gray-500 uppercase tracking-tight">Total Applied</p>
                                  <p className="text-sm font-medium text-blue-700">{selectedCampaign.candidatesApplied}</p>
                                </div>
                                <Users className="w-4 h-4 text-blue-700" />
                              </div>
                            </CardContent>
                          </Card>
                          <Card className="border-none shadow-sm bg-white/80 backdrop-blur-sm">
                            <CardContent className="p-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-[10px] text-gray-500 uppercase tracking-tight">Hired</p>
                                  <p className="text-sm font-medium text-green-700">{selectedCampaign.candidatesHired}</p>
                                </div>
                                <UserCheck className="w-4 h-4 text-green-700" />
                              </div>
                            </CardContent>
                          </Card>
                          <Card className="border-none shadow-sm bg-white/80 backdrop-blur-sm">
                            <CardContent className="p-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-[10px] text-gray-500 uppercase tracking-tight">Success Rate</p>
                                  <p className="text-sm font-medium text-purple-700">
                                    {selectedCampaign.candidatesApplied > 0 ? Math.round((selectedCampaign.candidatesHired / selectedCampaign.candidatesApplied) * 100) : 0}%
                                  </p>
                                </div>
                                <TrendingUp className="w-4 h-4 text-purple-700" />
                              </div>
                            </CardContent>
                          </Card>
                          <Card className="border-none shadow-sm bg-white/80 backdrop-blur-sm">
                            <CardContent className="p-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-[10px] text-gray-500 uppercase tracking-tight">Positions Left</p>
                                  {isEditPositionsMode ? (
                                    <div className="flex items-center space-x-1">
                                      <Input
                                        type="number"
                                        className="w-12 text-sm font-medium text-orange-700 h-6"
                                        value={tempCampaignDetails.positions.toString()}
                                        onChange={(e) => setTempCampaignDetails({ ...tempCampaignDetails, positions: parseInt(e.target.value) || 1 })}
                                        disabled={isLoading}
                                      />
                                      {formErrors.positions && <p className="text-red-500 text-[10px]">{formErrors.positions}</p>}
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCancelEditCampaign}
                                        disabled={isLoading}
                                        className="h-6 text-[10px] px-1.5"
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={handleSaveCampaignDetails}
                                        disabled={isLoading}
                                        className="h-6 text-[10px] px-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                                      >
                                        Save
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center space-x-1">
                                      <p className="text-sm font-medium text-orange-700">{selectedCampaign.positions - selectedCampaign.candidatesHired}</p>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setIsEditPositionsMode(true)}
                                        disabled={isLoading}
                                        className="h-6 w-6 p-0"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <Target className="w-4 h-4 text-orange-700" />
                              </div>
                            </CardContent>
                          </Card>
            </div>
            <div className="mb-6">
              <div className="flex border-b border-gray-200">
                <button
                  className={`px-4 py-2 text-xs font-semibold ${activeTab === "candidatePool" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600 hover:text-blue-600"}`}
                  onClick={() => setActiveTab("candidatePool")}
                >
                  Candidate Pool ({preScreeningCandidates.length})
                </button>
                <button
                  className={`px-4 py-2 text-xs font-semibold ${activeTab === "interviewStage" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600 hover:text-blue-600"}`}
                  onClick={() => setActiveTab("interviewStage")}
                >
                  Interview Stage ({getCandidateList(selectedCampaign?.Interview, selectedCampaign?.Interview_Round).length})
                </button>
                <button
                  className={`px-4 py-2 text-xs font-semibold ${activeTab === "onboarded" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600 hover:text-blue-600"}`}
                  onClick={() => setActiveTab("onboarded")}
                >
                  On Boarded ({dummyOnboarded.length})
                </button>
              </div>
            </div>
            {activeTab === "candidatePool" && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Candidate Pool ({preScreeningCandidates.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Select>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="selected">Selected</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="on-hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {isLoadingPreScreening ? (
                    <div className="text-center py-12">
                      <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600 mb-4" />
                      <p className="text-gray-600">Loading candidate pool...</p>
                    </div>
                  ) : preScreeningCandidates.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left text-gray-600">
                        <thead className="text-[10px] text-gray-700 uppercase bg-gray-50">
                          <tr>
                            <th scope="col" className="px-2 py-1 text-[10px]">Candidate Name</th>
                            <th scope="col" className="px-2 py-1 text-[10px]">Mobile Number</th>
                            <th scope="col" className="px-2 py-1 text-[10px]">Email ID</th>
                            <th scope="col" className="px-2 py-1 text-[10px]">Total Experience</th>
                            <th scope="col" className="px-2 py-1 text-[10px]">Company</th>
                            <th scope="col" className="px-2 py-1 text-[10px]">CTC</th>
                            <th scope="col" className="px-2 py-1 text-[10px]">ECTC</th>
                            <th scope="col" className="px-2 py-1 text-[10px]">Offer in Hand</th>
                            <th scope="col" className="px-2 py-1 text-[10px]">Notice</th>
                            <th scope="col" className="px-2 py-1 text-[10px]">Current Location</th>
                            <th scope="col" className="px-2 py-1 text-[10px]">Preferred Location</th>
                            <th scope="col" className="px-2 py-1 text-[10px]">Availability for Interview</th>
                            <th scope="col" className="px-2 py-1 text-[10px]">Schedule Interview</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preScreeningCandidates.map((candidate) => (
                            <tr key={candidate.candidate_id} className="bg-white border-b hover:bg-gray-50">
                              <td className="px-2 py-1.5 text-xs">{candidate.candidate_name}</td>
                              <td className="px-2 py-1.5 text-xs">{candidate.mobile_number}</td>
                              <td className="px-2 py-1.5 text-xs">{candidate.email_id}</td>
                              <td className="px-2 py-1.5 text-xs">{candidate.total_experience}</td>
                              <td className="px-2 py-1.5 text-xs">{candidate.company}</td>
                              <td className="px-2 py-1.5 text-xs">{candidate.ctc}</td>
                              <td className="px-2 py-1.5 text-xs">{candidate.ectc}</td>
                              <td className="px-2 py-1.5 text-xs">{candidate.offer_in_hand}</td>
                              <td className="px-2 py-1.5 text-xs">{candidate.notice}</td>
                              <td className="px-2 py-1.5 text-xs">{candidate.current_location}</td>
                              <td className="px-2 py-1.5 text-xs">{candidate.preferred_location}</td>
                              <td className="px-2 py-1.5 text-xs">{candidate.availability_for_interview}</td>
                              <td className="px-2 py-1.5 text-xs">
                                <Button
                                  size="sm"
                                  className="bg-white border border-gray-300 text-gray-800 text-xs font-medium rounded-md shadow-sm hover:bg-gray-100 transition-colors py-1 px-2"
                                  onClick={() => handleScheduleInterview({
                                    ...candidate,
                                    name: candidate.candidate_name,
                                    profile_id: candidate.candidate_id,
                                  })}
                                >
                                  <Calendar className="w-3 h-3 mr-1" /> Schedule
                                </Button>
                              </td>
                            </tr>
                          ))}
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
            )}
            {activeTab === "interviewStage" && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Interview Stage ({getCandidateList(selectedCampaign?.Interview, selectedCampaign?.Interview_Round).length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Select>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="selected">Selected</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="on-hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedCampaign.Interview && selectedCampaign.Interview.length > 0 ? (
                    <div className="overflow-x-hidden">
                      <table className="w-full text-sm text-left text-gray-600 table-fixed">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                          <tr>
                            <th scope="col" className="px-2 py-1 text-[10px]">Name</th>
                            <th scope="col" className="px-2 py-1 text-[10px]">Status</th>
                            <th scope="col" className="px-2 py-1 text-[10px]">Current Round</th>
                            <th scope="col" className="px-2 py-1 text-[10px]">Schedule Round</th>
                            <th scope="col" className="px-2 py-1 text-[10px]">Comments</th>
                            <th scope="col" className="px-2 py-1 text-[10px]">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getCandidateList(selectedCampaign.Interview, selectedCampaign.Interview_Round).map((candidate) => {
                            const comments = candidateComments[candidate.id] || [];
                            const latestComment = comments.length > 0 ? comments[comments.length - 1] : null;
                            return (
                              <tr key={candidate.id} className="bg-white border-b hover:bg-gray-50">
                                <td className="px-2 py-1.5">
                                  <div className="flex flex-col">
                                    <div className="font-medium text-gray-900 text-xs truncate">{candidate.name}</div>
                                  </div>
                                </td>
                                <td className="px-4 py-2">
                                  <Select
                                    value={candidateStatuses[candidate.id] || "Applied"}
                                    onValueChange={(value) => handleStatusChange(candidate.id, value)}
                                  >
                                    <SelectTrigger className="w-full bg-gray-50 border-gray-300 text-gray-800 text-xs font-medium rounded-md shadow-sm hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 transition-colors">
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
                                  <Badge className={`${getCurrentRoundColor(candidate.currentRound)} font-medium rounded-md px-2 py-0.5 text-xs truncate`}>
                                    {candidate.currentRound}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2">
                                  <Button
                                    size="sm"
                                    className="bg-white border border-gray-300 text-gray-800 text-xs font-medium rounded-md shadow-sm hover:bg-gray-100 transition-colors py-0.5 px-1.5"
                                    onClick={() => handleScheduleInterview(candidate)}
                                  >
                                    <Calendar className="w-3 h-3 mr-0.5" /> Schedule
                                  </Button>
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center justify-between">
                                    {latestComment ? (
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-2">
                                          <p className="text-xs text-gray-500 truncate">{latestComment.author}</p>
                                          <Badge className={getJobTitleColor(latestComment.jobTitle)}>{latestComment.jobTitle}</Badge>
                                        </div>
                                        <p className="text-sm text-gray-700 truncate">{latestComment.text}</p>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-400 italic flex-1">No comments yet</p>
                                    )}
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      onClick={() => handleViewComments(candidate)} 
                                      className="flex items-center text-xs"
                                    >
                                      <MessageSquare className="w-3 h-3 mr-1" />
                                      {comments.length}
                                    </Button>
                                  </div>
                                </td>
                                <td className="px-4 py-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    onClick={() => setSelectedCandidate(candidate)} 
                                    className="w-full h-6 text-xs px-2"
                                  >
                                    <Eye className="w-2.5 h-2.5 mr-1" /> View
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
            )}
            {activeTab === "onboarded" && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">On Boarded ({dummyOnboarded.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Select>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="selected">Selected</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="on-hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-600">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3">Name</th>
                          <th scope="col" className="px-6 py-3">Email</th>
                          <th scope="col" className="px-6 py-3">Onboard Date</th>
                          <th scope="col" className="px-6 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dummyOnboarded.map((candidate) => (
                          <tr key={candidate.id} className="bg-white border-b hover:bg-gray-50">
                            <td className="px-6 py-4">{candidate.name}</td>
                            <td className="px-6 py-4">{candidate.email}</td>
                            <td className="px-6 py-4">{candidate.onboardDate}</td>
                            <td className="px-6 py-4">
                              <Badge className={getCandidateStatusColor(candidate.status)}>{candidate.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card className="glass">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Talent Acquisition Team</CardTitle>
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
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {selectedCampaign.talentAcquisitionTeam.map((member, index) => (
                      <div key={index} className="flex items-center space-x-2 p-2 border rounded-lg">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{member.name}</p>
                          <p className="text-xs text-gray-500 truncate">{member.email}</p>
                          <Badge variant={member.role === "Hiring Manager" ? "default" : "secondary"} className="text-xs px-1.5 py-0">
                            {member.role}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-sm font-medium text-gray-600 mb-1">No Team Members</p>
                    <p className="text-xs text-gray-500">No talent acquisition team members assigned to this campaign.</p>
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
                  <DialogTitle className="text-sm font-semibold">Edit Talent Acquisition Team</DialogTitle>
                  <DialogDescription className="text-xs">
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
            <Dialog open={showFullJD} onOpenChange={setShowFullJD}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Job Description</DialogTitle>
                  <DialogDescription>
                    Full job description for {selectedCampaign.jobTitle}.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Textarea
                    value={selectedCampaign.description}
                    readOnly
                    className="col-span-4 h-48"
                  />
                </div>
              </DialogContent>
            </Dialog>
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