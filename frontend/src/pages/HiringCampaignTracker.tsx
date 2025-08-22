import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Plus, Users, Filter, SortDesc, MoreHorizontal,
  Calendar, TrendingUp, UserCheck, UserX, Clock, Eye,
  Download, FileText, Star, ChevronRight, ChevronDown,
  Building, MapPin, Target, Briefcase, ArrowLeft, Loader2, X, User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  fetchAllClients, createClient, fetchAllCampaigns, createCampaign,
  fetchCampaignById, fetchMatchingResumes, Client, HiringCampaign, CampaignCreate,
  ClientCreate, MatchingResponse, AggregatedScore, Interview
} from "@/api";

interface Candidate {
  id: string;
  name: string;
  email: string;
  status: string;
  currentRound: string;
  rating: number;
  applicationDate: string;
  panelMembers: string[];
  feedback: string;
}

interface TalentAcquisitionTeamMember {
  id: string;
  name: string;
  email: string;
  role: "Recruiter" | "Hiring Manager" | "Coordinator";
  isHiringManager: boolean;
}

const HiringCampaignTracker = () => {
  const navigate = useNavigate();

  // State for client management
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isCreateClientModalOpen, setIsCreateClientModalOpen] = useState(false);

  // State for campaign management
  const [campaigns, setCampaigns] = useState<HiringCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<HiringCampaign | null>(null);
  const [isCreateCampaignModalOpen, setIsCreateCampaignModalOpen] = useState(false);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"jobTitle" | "startDate" | "candidatesApplied">("startDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Candidate search states
  const [candidateSearchResults, setCandidateSearchResults] = useState<AggregatedScore[]>([]);
  const [isSearchingCandidates, setIsSearchingCandidates] = useState(false);
  const [candidateSearchResponse, setCandidateSearchResponse] = useState("");
  const [selectedSearchCandidate, setSelectedSearchCandidate] = useState<AggregatedScore | null>(null);
  // Candidate modal state
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  // Form states
  const [newClient, setNewClient] = useState<ClientCreate>({
    companyName: "",
    description: "",
    location: "",
    industry: ""
  });

  const [newCampaign, setNewCampaign] = useState<CampaignCreate>({
    client_id: "",
    jobTitle: "",
    description: "",
    experienceLevel: "Junior",
    positions: 1,
    location: "",
    department: "Engineering",
    jobType: "Full-time",
    startDate: new Date().toISOString().split("T")[0],
    created_by: "", // Added to match CampaignCreate interface
    talentAcquisitionTeam: []
    });

  const [newTeamMember, setNewTeamMember] = useState<TalentAcquisitionTeamMember>({
    id: "",
    name: "",
    email: "",
    role: "Recruiter",
    isHiringManager: false
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Load clients on component mount
  useEffect(() => {
    const loadClients = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchAllClients();
        setClients(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load clients');
      } finally {
        setIsLoading(false);
      }
    };
    loadClients();
  }, []);

  // Load campaigns when client is selected
  useEffect(() => {
    if (selectedClient) {
      const loadCampaigns = async () => {
        setIsLoading(true);
        setError(null);
        setCampaigns([]);
        try {
          const data = await fetchAllCampaigns(selectedClient.id);
          setCampaigns(data);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load campaigns');
        } finally {
          setIsLoading(false);
        }
      };
      loadCampaigns();
    }
  }, [selectedClient]);

  // Handle client creation
  const handleCreateClient = async () => {
    const errors: { [key: string]: string } = {};
    if (!newClient.companyName.trim()) errors.companyName = "Company name is required";
    if (!newClient.description.trim()) errors.description = "Description is required";
    if (!newClient.location.trim()) errors.location = "Location is required";
    if (!newClient.industry.trim()) errors.industry = "Industry is required";
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setIsLoading(true);
    try {
      const createdClient = await createClient(newClient);
      setClients([...clients, createdClient]);
      setNewClient({ companyName: "", description: "", location: "", industry: "" });
      setFormErrors({});
      setIsCreateClientModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setIsLoading(false);
    }
  };

  // Add log to monitor newCampaign state changes
useEffect(() => {
  console.log('newCampaign state updated:', newCampaign);
}, [newCampaign]);

// Handle adding team member
const handleAddTeamMember = () => {
  console.log('Adding team member:', newTeamMember);
  if (!newTeamMember.name.trim() || !newTeamMember.email.trim()) {
    setError("Name and email are required for team members");
    console.error('Validation failed: Name or email is empty');
    return;
  }
  if (!newTeamMember.email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
    setError("Invalid email format for team member");
    console.error('Validation failed: Invalid email format', newTeamMember.email);
    return;
  }

  const memberWithId = {
    ...newTeamMember,
    id: Date.now().toString()
  };

  console.log('New team member with ID:', memberWithId);
  const updatedTeam = [...(newCampaign.talentAcquisitionTeam || []), memberWithId];
  setNewCampaign({
    ...newCampaign,
    talentAcquisitionTeam: updatedTeam
  });
  console.log('Updated newCampaign.talentAcquisitionTeam:', updatedTeam);

  setNewTeamMember({
    id: "",
    name: "",
    email: "",
    role: "Recruiter",
    isHiringManager: false
  });
};

// Handle campaign creation
const handleCreateCampaign = async () => {
  if (!selectedClient) {
    console.error('No client selected');
    return;
  }
  const errors: { [key: string]: string } = {};
  if (!newCampaign.jobTitle.trim()) errors.jobTitle = "Job Title is required";
  if (!newCampaign.description.trim()) errors.description = "Description is required";
  if (!newCampaign.location.trim()) errors.location = "Location is required";
  if (newCampaign.positions < 1) errors.positions = "At least one position is required";
  newCampaign.talentAcquisitionTeam.forEach((member, index) => {
    if (!member.email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
      errors[`teamMemberEmail${index}`] = `Invalid email for team member: ${member.name}`;
    }
  });
  if (Object.keys(errors).length > 0) {
    setFormErrors(errors);
    console.error('Form validation errors:', errors);
    return;
  }
  setIsLoading(true);
  try {
    console.log('Creating campaign with payload:', newCampaign);
    const campaignData = {
      ...newCampaign,
      client_id: selectedClient.id
    };
    console.log('Sending campaign data to API:', campaignData);
    const createdCampaign = await createCampaign(campaignData);
    console.log('Campaign created successfully:', createdCampaign);
    setCampaigns([...campaigns, createdCampaign]);
    setNewCampaign({
      client_id: "",
      jobTitle: "",
      description: "",
      experienceLevel: "Junior",
      positions: 1,
      location: "",
      department: "Engineering",
      jobType: "Full-time",
      startDate: new Date().toISOString().split("T")[0],
      created_by: "", // Added to match CampaignCreate interface
      talentAcquisitionTeam: []
    });
    setNewTeamMember({
      id: "",
      name: "",
      email: "",
      role: "Recruiter",
      isHiringManager: false
    });
    setFormErrors({});
    setIsCreateCampaignModalOpen(false);
  } catch (err) {
    console.error('Error creating campaign:', err);
    setError(err instanceof Error ? err.message : 'Failed to create campaign');
  } finally {
    setIsLoading(false);
  }
};

  // Handle removing team member
  const handleRemoveTeamMember = (memberId: string) => {
    setNewCampaign({
      ...newCampaign,
      talentAcquisitionTeam: newCampaign.talentAcquisitionTeam?.filter(m => m.id !== memberId) || []
    });
  };

  // Handle candidate search using fetchMatchingResumes
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
      setCandidateSearchResults(result.matching_results.map(candidate => ({
        ...candidate,
        campaignId: selectedCampaign.id
      })));
      setCandidateSearchResponse(`Found ${result.matching_results.length} matching candidates for ${selectedCampaign.jobTitle}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search candidates');
    } finally {
      setIsSearchingCandidates(false);
    }
  };

  // Handle candidate profile view
  const handleViewProfile = (candidate: AggregatedScore) => {
    localStorage.setItem('selectedCandidate', JSON.stringify({
      ...candidate,
      campaignId: selectedCampaign?.id,
      campaignTitle: selectedCampaign?.jobTitle
    }));
    navigate(`/candidate-details/${candidate.resume_id}`);
  };

  // Handle schedule interview
  const handleScheduleInterview = (candidate: AggregatedScore | Candidate) => {
    if (selectedCampaign?.id) {
      sessionStorage.setItem('campaignId', selectedCampaign.id);
    }
    navigate(`/schedule-interview/${'resume_id' in candidate ? candidate.resume_id : candidate.id}`, {
      state: {
        candidate: {
          profile_id: 'resume_id' in candidate ? candidate.resume_id : candidate.id,
          name: candidate.name,
        },
        campaign: {
          campaignId: selectedCampaign?.id,
          campaignTitle: selectedCampaign?.jobTitle,
        },
      },
    });
  };

  // Get status colors
  const getStatusColor = (status: HiringCampaign["status"]) => {
    switch (status) {
      case "Active": return "bg-green-100 text-green-800";
      case "Completed": return "bg-blue-100 text-blue-800";
      case "On Hold": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Get candidate status colors
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

  // Filter and sort campaigns
  const filteredAndSortedCampaigns = useMemo(() => {
    let result = campaigns.filter(campaign => {
      const matchesSearch = campaign.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           campaign.department.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
      const matchesDepartment = departmentFilter === "all" || campaign.department === departmentFilter;
      return matchesSearch && matchesStatus && matchesDepartment;
    });
    result.sort((a, b) => {
      let valueA: any, valueB: any;
      if (sortBy === "jobTitle") {
        valueA = a.jobTitle;
        valueB = b.jobTitle;
      } else if (sortBy === "startDate") {
        valueA = new Date(a.startDate);
        valueB = new Date(b.startDate);
      } else {
        valueA = a.candidatesApplied;
        valueB = b.candidatesApplied;
      }
      if (typeof valueA === "string") {
        return sortDirection === "asc" ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
      }
      return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
    });
    return result;
  }, [campaigns, searchQuery, statusFilter, departmentFilter, sortBy, sortDirection]);

  const departments = [...new Set(campaigns.map(c => c.department))];

  // Candidate Detail Modal for Search Results
  const SearchCandidateDetailModal = ({ candidate, onClose }: { candidate: AggregatedScore; onClose: () => void }) => (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {candidate.resume_name}
            <Badge className="bg-blue-100 text-blue-800">
              Match: {Math.round(candidate.aggregated_score * 100)}%
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Campaign: {selectedCampaign?.jobTitle}
          </DialogDescription>
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
                {candidate.primary_vs_primary.total_matched}/{candidate.primary_vs_primary.total_required}
                ({Math.round(candidate.primary_vs_primary.match_percentage * 100)}%)
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
              <Eye className="w-4 h-4 mr-2" />
              View Full Profile
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => handleScheduleInterview(candidate)}>
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Interview
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  // Candidate Detail Modal for Interview Candidates
  const CandidateDetailModal = ({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) => (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {candidate.name}
            <Badge className={getCandidateStatusColor(candidate.status)}>
              {candidate.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Email</Label>
              <p className="text-sm text-muted-foreground">{candidate.email}</p>
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
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i < candidate.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                  />
                ))}
                <span className="text-sm text-muted-foreground ml-2">{candidate.rating}/5</span>
              </div>
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
          <div className="flex space-x-2">
            <Button variant="outline" className="flex-1">
              <FileText className="w-4 h-4 mr-2" />
              View Resume
            </Button>
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => handleScheduleInterview(candidate)}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Schedule Interview
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <SidebarTrigger className="p-2" />
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold gradient-text">
                  {selectedClient ? (selectedCampaign ? `${selectedCampaign.jobTitle}` : `${selectedClient.companyName} Campaigns`) : "Client Dashboard"}
                </h1>
                <p className="text-sm text-gray-600">Enterprise Hiring Management</p>
              </div>
            </div>
            {!selectedClient ? (
              <Button
                onClick={() => setIsCreateClientModalOpen(true)}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                disabled={isLoading}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Client
              </Button>
            ) : !selectedCampaign ? (
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedClient(null)}
                  disabled={isLoading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Clients
                </Button>
                <Button
                  onClick={() => setIsCreateCampaignModalOpen(true)}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  disabled={isLoading}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Campaign
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedCampaign(null)}
                  disabled={isLoading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Campaigns
                </Button>
                <Button
                  onClick={handleCandidateSearch}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  disabled={isSearchingCandidates}
                >
                  <Search className="w-4 h-4 mr-2" />
                  Search Candidates
                </Button>
              </div>
            )}
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
        {!selectedClient ? (
          // Client List View
          <div className="space-y-6">
            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Select a Client</h2>
                  <div className="text-sm text-muted-foreground">
                    {clients.length} clients available
                  </div>
                </div>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </CardContent>
            </Card>
            {/* Client Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clients
                .filter(client => client.companyName.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((client) => (
                  <Card
                    key={client.id}
                    className="glass hover:shadow-lg transition-all duration-300 cursor-pointer hover:scale-105"
                    onClick={() => setSelectedClient(client)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center space-x-3">
                        <img
                          src={client.logoPath}
                          alt={`${client.companyName} logo`}
                          className="w-12 h-12 object-contain rounded-lg"
                        />
                        <div className="flex-1">
                          <CardTitle className="text-lg">{client.companyName}</CardTitle>
                          <div className="flex items-center space-x-2 mt-1">
                            <Building className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600">{client.industry}</span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-gray-600 line-clamp-2">{client.description}</p>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-600">{client.location}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
            {/* New Client Modal */}
            <Dialog open={isCreateClientModalOpen} onOpenChange={setIsCreateClientModalOpen}>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Add New Client</DialogTitle>
                  <DialogDescription>
                    Create a new client to manage hiring campaigns
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={newClient.companyName}
                      onChange={(e) => setNewClient({ ...newClient, companyName: e.target.value })}
                      placeholder="Enter company name"
                      disabled={isLoading}
                    />
                    {formErrors.companyName && <p className="text-red-500 text-xs">{formErrors.companyName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      value={newClient.industry}
                      onChange={(e) => setNewClient({ ...newClient, industry: e.target.value })}
                      placeholder="Enter industry"
                      disabled={isLoading}
                    />
                    {formErrors.industry && <p className="text-red-500 text-xs">{formErrors.industry}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={newClient.location}
                      onChange={(e) => setNewClient({ ...newClient, location: e.target.value })}
                      placeholder="Enter location"
                      disabled={isLoading}
                    />
                    {formErrors.location && <p className="text-red-500 text-xs">{formErrors.location}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newClient.description}
                      onChange={(e) => setNewClient({ ...newClient, description: e.target.value })}
                      placeholder="Enter company description"
                      disabled={isLoading}
                    />
                    {formErrors.description && <p className="text-red-500 text-xs">{formErrors.description}</p>}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateClientModalOpen(false)} disabled={isLoading}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateClient} disabled={isLoading}>
                    {isLoading ? "Creating..." : "Create Client"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : !selectedCampaign ? (
          // Campaign List View for Selected Client
          <div className="space-y-6">
            {/* Client Info Header */}
            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <img
                    src={selectedClient.logoPath}
                    alt={`${selectedClient.companyName} logo`}
                    className="w-16 h-16 object-contain rounded-lg"
                  />
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold">{selectedClient.companyName}</h2>
                    <p className="text-gray-600">{selectedClient.description}</p>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Building className="w-4 h-4" />
                        <span>{selectedClient.industry}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-4 h-4" />
                        <span>{selectedClient.location}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">{campaigns.length}</p>
                    <p className="text-sm text-gray-500">Total Campaigns</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Search and Filters */}
            <Card className="glass">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search campaigns by job title or department..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="On Hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter} disabled={isLoading}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)} disabled={isLoading}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="startDate">Start Date</SelectItem>
                      <SelectItem value="jobTitle">Job Title</SelectItem>
                      <SelectItem value="candidatesApplied">Candidates</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                    disabled={isLoading}
                  >
                    <SortDesc className={`w-4 h-4 transition-transform ${sortDirection === "asc" ? "rotate-180" : ""}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>
            {/* Campaign Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedCampaigns.map((campaign) => (
                <Card
                  key={campaign.id}
                  className="glass hover:shadow-lg transition-all duration-300 cursor-pointer hover:scale-105"
                  onClick={() => setSelectedCampaign(campaign)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{campaign.jobTitle}</CardTitle>
                        <div className="flex items-center space-x-2 mt-1">
                          <Building className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600">{campaign.department}</span>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600">Created by: {campaign.created_by_name}</span>
                        </div>
                      </div>
                      <Badge className={getStatusColor(campaign.status)}>
                        {campaign.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">{campaign.location}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Target className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">{campaign.positions} positions</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Experience Level</p>
                        <p className="font-semibold text-gray-600">{campaign.experienceLevel}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Job Type</p>
                        <p className="font-semibold text-gray-600">{campaign.jobType}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Applied</p>
                        <p className="font-semibold text-blue-600">{campaign.candidatesApplied}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Hired</p>
                        <p className="font-semibold text-green-600">{campaign.candidatesHired}</p>
                      </div>
                    </div>
                    <div className="text-sm">
                      <p className="text-gray-500">Team Members</p>
                      <p className="font-medium">{campaign.talentAcquisitionTeam?.length || 0} members</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-gray-500">
                        Started {new Date(campaign.startDate).toLocaleDateString()}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {/* New Campaign Modal */}
            <Dialog open={isCreateCampaignModalOpen} onOpenChange={setIsCreateCampaignModalOpen}>
              <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Campaign</DialogTitle>
                  <DialogDescription>
                    Create a new hiring campaign for {selectedClient?.companyName}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="jobTitle">Job Title</Label>
                      <Input
                        id="jobTitle"
                        value={newCampaign.jobTitle}
                        onChange={(e) => setNewCampaign({ ...newCampaign, jobTitle: e.target.value })}
                        placeholder="Enter job title"
                        disabled={isLoading}
                      />
                      {formErrors.jobTitle && <p className="text-red-500 text-xs">{formErrors.jobTitle}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={newCampaign.location}
                        onChange={(e) => setNewCampaign({ ...newCampaign, location: e.target.value })}
                        placeholder="Enter location"
                        disabled={isLoading}
                      />
                      {formErrors.location && <p className="text-red-500 text-xs">{formErrors.location}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department">Department</Label>
                      <Select
                        value={newCampaign.department}
                        onValueChange={(value) => setNewCampaign({ ...newCampaign, department: value })}
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Engineering">Engineering</SelectItem>
                          <SelectItem value="Product">Product</SelectItem>
                          <SelectItem value="Design">Design</SelectItem>
                          <SelectItem value="Marketing">Marketing</SelectItem>
                          <SelectItem value="Sales">Sales</SelectItem>
                          <SelectItem value="Operations">Operations</SelectItem>
                          <SelectItem value="Finance">Finance</SelectItem>
                          <SelectItem value="HR">HR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jobType">Job Type</Label>
                      <Select
                        value={newCampaign.jobType}
                        onValueChange={(value: "Full-time" | "Part-time" | "Contract") => setNewCampaign({ ...newCampaign, jobType: value })}
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select job type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Full-time">Full-time</SelectItem>
                          <SelectItem value="Part-time">Part-time</SelectItem>
                          <SelectItem value="Contract">Contract</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="experienceLevel">Experience Level</Label>
                      <Select
                        value={newCampaign.experienceLevel}
                        onValueChange={(value: "Junior" | "Mid-level" | "Senior") => setNewCampaign({ ...newCampaign, experienceLevel: value })}
                        disabled={isLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select experience level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Junior">Junior</SelectItem>
                          <SelectItem value="Mid-level">Mid-level</SelectItem>
                          <SelectItem value="Senior">Senior</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="positions">Open Positions</Label>
                      <Input
                        id="positions"
                        type="number"
                        value={newCampaign.positions}
                        onChange={(e) => setNewCampaign({ ...newCampaign, positions: parseInt(e.target.value) || 1 })}
                        min="1"
                        disabled={isLoading}
                      />
                      {formErrors.positions && <p className="text-red-500 text-xs">{formErrors.positions}</p>}
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="description">Job Description</Label>
                      <Textarea
                        id="description"
                        value={newCampaign.description}
                        onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                        placeholder="Enter detailed job description"
                        rows={4}
                        disabled={isLoading}
                      />
                      {formErrors.description && <p className="text-red-500 text-xs">{formErrors.description}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={newCampaign.startDate}
                        onChange={(e) => setNewCampaign({ ...newCampaign, startDate: e.target.value })}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  {/* Talent Acquisition Team */}
                  <div className="space-y-4">
                    <Label className="text-lg font-semibold">Talent Acquisition Team</Label>
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
                            isHiringManager: value === "Hiring Manager"
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
                    {newCampaign.talentAcquisitionTeam && newCampaign.talentAcquisitionTeam.length > 0 && (
                      <div className="space-y-2">
                        {newCampaign.talentAcquisitionTeam.map((member, index) => (
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
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateCampaignModalOpen(false)} disabled={isLoading}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateCampaign} disabled={isLoading}>
                    {isLoading ? "Creating..." : "Create Campaign"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {filteredAndSortedCampaigns.length === 0 && !isLoading && !error && (
              <div className="text-center py-12">
                <Briefcase className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-xl font-medium text-gray-600 mb-2">No Campaigns Found</p>
                <p className="text-gray-500">Create your first campaign to get started.</p>
              </div>
            )}
          </div>
        ) : (
          // Campaign Detail View with Candidate List
          <div className="space-y-6">
            {/* Campaign Header */}
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
            {/* Talent Acquisition Team */}
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
            {/* Campaign Metrics */}
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
            {/* Candidate Search Modal */}
            <Dialog open={!!candidateSearchResponse} onOpenChange={() => {
              setCandidateSearchResults([]);
              setCandidateSearchResponse("");
            }}>
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
                        <Card
                          key={candidate.resume_id}
                          className="hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => setSelectedSearchCandidate(candidate)}
                        >
                          <CardContent className="p-4">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h3 className="font-medium text-gray-900">{candidate.resume_name}</h3>
                                  <p className="text-sm text-gray-500">ID: {candidate.resume_id}</p>
                                </div>
                                <Badge className="bg-blue-100 text-blue-800">
                                  #{candidate.rank}
                                </Badge>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600">Overall Match</span>
                                  <span className="text-sm font-medium text-blue-600">
                                    {Math.round(candidate.aggregated_score * 100)}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${candidate.aggregated_score * 100}%` }}
                                  />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-gray-600">Skills Match</span>
                                  <span className="font-medium">
                                    {candidate.primary_vs_primary.total_matched}/{candidate.primary_vs_primary.total_required}
                                  </span>
                                </div>
                                {candidate.primary_vs_primary.matched_skills.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {candidate.primary_vs_primary.matched_skills.slice(0, 3).map((skill, index) => (
                                      <Badge key={index} variant="secondary" className="text-xs bg-green-100 text-green-800">
                                        {skill}
                                      </Badge>
                                    ))}
                                    {candidate.primary_vs_primary.matched_skills.length > 3 && (
                                      <Badge variant="secondary" className="text-xs">
                                        +{candidate.primary_vs_primary.matched_skills.length - 3}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex space-x-2 pt-2">
                                <Button
                                  size="sm"
                                  className="flex-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewProfile(candidate);
                                  }}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => handleScheduleInterview(candidate)}
                                >
                                  <Calendar className="w-3 h-3 mr-1" />
                                  Schedule
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
            {/* Candidate List */}
            <Card className="glass">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Candidates ({selectedCampaign.Interview?.length || 0})</CardTitle>
                  <Button
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    disabled={isLoading}
                    onClick={() => {
                      if (selectedCampaign?.id) {
                        sessionStorage.setItem('campaignId', selectedCampaign.id);
                      }
                      navigate(`/add-candidate/${selectedCampaign.id}`, {
                        state: {
                          campaign: {
                            campaignId: selectedCampaign?.id,
                            campaignTitle: selectedCampaign?.jobTitle,
                          },
                        },
                      });
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Candidate
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
                          <th scope="col" className="px-6 py-3">Applied Date</th>
                          <th scope="col" className="px-6 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedCampaign.Interview.map((interview) => {
                          const candidate: Candidate = {
                            id: interview._id,
                            name: interview.interview_details.title,
                            email: interview.scheduled_event.candidate_email,
                            status: selectedCampaign.currentRound,
                            currentRound: selectedCampaign.currentRound,
                            rating: 4.5,
                            applicationDate: new Date(interview.created_at).toLocaleDateString(),
                            panelMembers: interview.scheduled_event.panel_emails,
                            feedback: interview.interview_details.description
                          };
                          return (
                            <tr key={candidate.id} className="bg-white border-b hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <div className="font-medium text-gray-900">{candidate.name}</div>
                                <div className="text-xs text-gray-500">{candidate.email}</div>
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
                                    <Star
                                      key={i}
                                      className={`w-4 h-4 ${i < Math.floor(candidate.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                                    />
                                  ))}
                                </div>
                              </td>
                              <td className="px-6 py-4">{candidate.applicationDate}</td>
                              <td className="px-6 py-4">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedCandidate(candidate)}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  View
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
          <CandidateDetailModal
            candidate={selectedCandidate}
            onClose={() => setSelectedCandidate(null)}
          />
        )}
        {selectedSearchCandidate && (
          <SearchCandidateDetailModal
            candidate={selectedSearchCandidate}
            onClose={() => setSelectedSearchCandidate(null)}
          />
        )}
      </main>
    </div>
  );
};

export default HiringCampaignTracker;