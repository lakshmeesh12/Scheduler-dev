import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search, Plus, Filter, SortDesc, Calendar, MapPin, Briefcase, X, User, Building, Clock, CheckCircle, AlertCircle, Upload, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { fetchAllClients, createCampaign, fetchAllCampaigns, Client, HiringCampaign, CampaignCreate, fetchManagerCampaignById, ManagerCampaign, createBulkCampaigns } from "@/api";
import QChat from "@/components/QChat";


interface TalentAcquisitionTeamMember {
  id: string;
  name: string;
  email: string;
  role: "Recruiter" | "Hiring Manager" | "Coordinator";
  isHiringManager: boolean;
}

interface JobStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  onHoldJobs: number;
}

interface CampaignCreate {
  client_id: string;
  campaign_id: string;
  jobTitle: string;
  description: string;
  minExperience: number;
  maxExperience: number;
  positions: number;
  location: string | null;
  department: string;
  jobType: "Full-time" | "Part-time" | "Contract";
  startDate: string;
  created_by: string;
  talentAcquisitionTeam: TalentAcquisitionTeamMember[];
}

const CampaignManager = () => {
  const { clientId, campaignId } = useParams<{ clientId: string; campaignId: string }>();
  const navigate = useNavigate();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<ManagerCampaign | null>(null);
  const [campaigns, setCampaigns] = useState<HiringCampaign[]>([]);
  const [jobStats, setJobStats] = useState<JobStats>({
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    onHoldJobs: 0,
  });
  const [isCreateJobModalOpen, setIsCreateJobModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"manual" | "bulk">("manual");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"jobTitle" | "startDate" | "candidatesApplied">("startDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isLoading, setIsLoading] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [jdFiles, setJdFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newCampaign, setNewCampaign] = useState<CampaignCreate>({
    client_id: clientId || "",
    campaign_id: campaignId || "",
    jobTitle: "",
    description: "",
    minExperience: 0,
    maxExperience: 2,
    positions: 1,
    location: null,
    department: "Engineering",
    jobType: "Full-time",
    startDate: new Date().toISOString().split("T")[0],
    created_by: "",
    talentAcquisitionTeam: [],
  });
  const [newTeamMember, setNewTeamMember] = useState<TalentAcquisitionTeamMember>({
    id: "",
    name: "",
    email: "",
    role: "Recruiter",
    isHiringManager: false,
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    if (!clientId || clientId.trim() === '' || !campaignId || campaignId.trim() === '') {
      console.error('CampaignManager: Invalid or missing clientId or campaignId', { clientId, campaignId });
      setError('Invalid client or campaign ID');
      setIsLoading(false);
      return;
    }
    loadClient();
    loadCampaignDetails();
    loadCampaigns();
  }, [clientId, campaignId]);

  useEffect(() => {
    if (campaigns.length > 0) {
      const stats: JobStats = {
        totalJobs: campaigns.length,
        activeJobs: campaigns.filter(c => c.status === 'Active').length,
        completedJobs: campaigns.filter(c => c.status === 'Completed').length,
        onHoldJobs: campaigns.filter(c => c.status === 'On Hold').length,
      };
      setJobStats(stats);
    }
  }, [campaigns]);

  const loadClient = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allClients = await fetchAllClients();
      const client = allClients.find((c) => c.id === clientId);
      if (client) {
        setSelectedClient(client);
      } else {
        setError("Client not found");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load client");
    } finally {
      setIsLoading(false);
    }
  };

  const loadCampaignDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const campaign = await fetchManagerCampaignById(campaignId!);
      setSelectedCampaign(campaign);
    } catch (err) {
      console.error('loadCampaignDetails: Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load campaign details';
      setError(errorMessage);
      if (errorMessage.includes('Campaign not found')) {
        setError('The specified campaign does not exist. Please check the campaign ID or contact support.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadCampaigns = async () => {
    setIsLoading(true);
    setError(null);
    setCampaigns([]);
    try {
      console.log('loadCampaigns: Calling fetchAllCampaigns with', { clientId, campaignId });
      const data = await fetchAllCampaigns(clientId!, campaignId!);
      console.log('loadCampaigns: Campaigns loaded:', data);
      setCampaigns(data);
      if (data.length === 0) {
        setError('No jobs found for this campaign. Create a new job to get started.');
      }
    } catch (err) {
      console.error('loadCampaigns: Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load jobs';
      setError(errorMessage);
      if (errorMessage.includes('Campaign not found')) {
        setError('The specified campaign does not exist. Please check the campaign ID or contact support.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log("newCampaign state updated:", newCampaign);
  }, [newCampaign]);

  const handleAddTeamMember = () => {
    console.log("Adding team member:", newTeamMember);
    if (!newTeamMember.name.trim() || !newTeamMember.email.trim()) {
      setError("Name and email are required for team members");
      console.error("Validation failed: Name or email is empty");
      return;
    }
    if (!newTeamMember.email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
      setError("Invalid email format for team member");
      console.error("Validation failed: Invalid email format", newTeamMember.email);
      return;
    }
    const memberWithId = { ...newTeamMember, id: Date.now().toString() };
    console.log("New team member with ID:", memberWithId);
    const updatedTeam = [...(newCampaign.talentAcquisitionTeam || []), memberWithId];
    setNewCampaign({ ...newCampaign, talentAcquisitionTeam: updatedTeam });
    console.log("Updated newCampaign.talentAcquisitionTeam:", updatedTeam);
    setNewTeamMember({ id: "", name: "", email: "", role: "Recruiter", isHiringManager: false });
  };

  const handleCreateJob = async () => {
    const errors: { [key: string]: string } = {};
    if (!newCampaign.jobTitle.trim()) errors.jobTitle = "Job Title is required";
    if (!newCampaign.description.trim()) errors.description = "Description is required";
    if (newCampaign.positions < 1) errors.positions = "At least one position is required";
    if (newCampaign.minExperience > newCampaign.maxExperience) {
      errors.experience = "Minimum experience cannot be greater than maximum experience";
    }
    newCampaign.talentAcquisitionTeam.forEach((member, index) => {
      if (!member.email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
        errors[`teamMemberEmail${index}`] = `Invalid email for team member: ${member.name}`;
      }
    });
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      console.error("Form validation errors:", errors);
      return;
    }
    setIsLoading(true);
    try {
      console.log("Creating job with payload:", newCampaign);
      const campaignData = { ...newCampaign, client_id: clientId!, campaign_id: campaignId! };
      console.log("Sending job data to API:", campaignData);
      const createdCampaign = await createCampaign(campaignData);
      console.log("Job created successfully:", createdCampaign);
      setCampaigns([...campaigns, createdCampaign]);
      setNewCampaign({
        client_id: clientId || "",
        campaign_id: campaignId || "",
        jobTitle: "",
        description: "",
        minExperience: 0,
        maxExperience: 2,
        positions: 1,
        location: null,
        department: "Engineering",
        jobType: "Full-time",
        startDate: new Date().toISOString().split("T")[0],
        created_by: "",
        talentAcquisitionTeam: [],
      });
      setNewTeamMember({ id: "", name: "", email: "", role: "Recruiter", isHiringManager: false });
      setFormErrors({});
      setIsCreateJobModalOpen(false);
      setCurrentStep(1);
    } catch (err) {
      console.error("Error creating job:", err);
      setError(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveTeamMember = (memberId: string) => {
    setNewCampaign({
      ...newCampaign,
      talentAcquisitionTeam: newCampaign.talentAcquisitionTeam?.filter((m) => m.id !== memberId) || [],
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.every(file => validateFile(file))) {
      setJdFiles(files);
      setFormErrors({});
      console.log("Selected files:", files.map(file => file.name));
    } else {
      setJdFiles([]);
      setFormErrors({ file: "Invalid file format. Please upload .pdf or .docx files" });
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (files.every(file => validateFile(file))) {
      setJdFiles(files);
      setFormErrors({});
      console.log("Dropped files:", files.map(file => file.name));
    } else {
      setJdFiles([]);
      setFormErrors({ file: "Invalid file format. Please upload .pdf or .docx files" });
    }
  };

  

  const validateFile = (file: File) => {
    const validExtensions = ['.pdf', '.docx'];
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    return validExtensions.includes(extension);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleImportJD = async () => {
    if (!jdFiles.length) {
      setFormErrors({ file: "Please select at least one file to upload" });
      return;
    }
    if (!clientId || !campaignId) {
      setError("Client ID or Campaign ID is missing");
      console.error("Missing clientId or campaignId", { clientId, campaignId });
      return;
    }
    setIsCreateJobModalOpen(false); // Close dialog immediately
    setIsBulkUploading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      console.log("Uploading JD files:", jdFiles.map(file => file.name), "with clientId:", clientId, "campaignId:", campaignId);
      const newCampaigns = await createBulkCampaigns(jdFiles, clientId, campaignId);
      console.log("Successfully imported campaigns:", newCampaigns);
      setCampaigns([...campaigns, ...newCampaigns]);
      setSuccessMessage(`Successfully imported ${newCampaigns.length} job(s) from ${jdFiles.length} file(s)`);
      setJdFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setFormErrors({});
    } catch (err) {
      console.error("Error importing JD:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to import job descriptions";
      setError(errorMessage.includes("No valid jobs") ? "No valid job descriptions found in the file(s). Ensure they include job titles and descriptions." : errorMessage);
    } finally {
      setIsBulkUploading(false);
    }
  };

  const getStatusColor = (status: HiringCampaign["status"]) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800";
      case "Completed":
        return "bg-blue-100 text-blue-800";
      case "On Hold":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredAndSortedCampaigns = useMemo(() => {
    let result = campaigns.filter((campaign) => {
      const matchesSearch =
        campaign.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
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

  const departments = [...new Set(campaigns.map((c) => c.department))];

  const validateStep = (step: number) => {
    const errors: { [key: string]: string } = {};
    if (step === 1) {
      if (!newCampaign.jobTitle.trim()) errors.jobTitle = "Job Title is required";
    } else if (step === 2) {
      if (newCampaign.positions < 1) errors.positions = "At least one position is required";
      if (newCampaign.minExperience > newCampaign.maxExperience) {
        errors.experience = "Minimum experience cannot be greater than maximum experience";
      }
    } else if (step === 3) {
      if (!newCampaign.description.trim()) errors.description = "Description is required";
      newCampaign.talentAcquisitionTeam.forEach((member, index) => {
        if (!member.email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
          errors[`teamMemberEmail${index}`] = `Invalid email for team member: ${member.name}`;
        }
      });
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBackStep = () => {
    setCurrentStep(currentStep - 1);
    setFormErrors({});
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 text-sm font-sans">
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <SidebarTrigger className="p-2" />
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">
                  {selectedClient && selectedCampaign ? `${selectedClient.companyName} - ${selectedCampaign.title} Jobs` : "Jobs Dashboard"}
                </h1>
                <p className="text-xs text-gray-600">Enterprise Hiring Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => {
                  setIsCreateJobModalOpen(true);
                  setActiveTab("manual");
                  setCurrentStep(1);
                  setJdFiles([]);
                  setFormErrors({});
                }}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-sm"
                disabled={isLoading || isBulkUploading}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Job
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-4">
        {isLoading && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-t-4 border-blue-600 border-opacity-30 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="mt-4 text-white font-medium text-sm">Processing...</p>
            </div>
          </div>
        )}
        {isBulkUploading && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="relative bg-white/95 dark:bg-gray-800/95 rounded-2xl p-8 shadow-2xl w-full max-w-md">
              <div className="relative flex flex-col items-center gap-4">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 border-4 border-blue-200 rounded-full animate-spin-slow"></div>
                  <div className="absolute inset-1 border-4 border-t-blue-600 rounded-full animate-spin"></div>
                  <Upload className="absolute inset-0 m-auto w-6 h-6 text-blue-600 animate-pulse" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">Importing Job Descriptions</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Please wait while we process your files...</p>
                </div>
              </div>
            </div>
          </div>
        )}
        {error && <p className="text-center text-red-500 text-sm">{error}</p>}
        {successMessage && <p className="text-center text-green-500 text-sm">{successMessage}</p>}
        <div className="space-y-4">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Job Statistics</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="flex items-center space-x-2 p-2 bg-white/10 rounded-lg">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-base font-bold">{jobStats.totalJobs}</p>
                    <p className="text-xs text-gray-500">Total Jobs</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 p-2 bg-white/10 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-base font-bold">{jobStats.activeJobs}</p>
                    <p className="text-xs text-gray-500">Active Jobs</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 p-2 bg-white/10 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-base font-bold">{jobStats.completedJobs}</p>
                    <p className="text-xs text-gray-500">Completed</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 p-2 bg-white/10 rounded-lg">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  <div>
                    <p className="text-base font-bold">{jobStats.onHoldJobs}</p>
                    <p className="text-xs text-gray-500">On Hold</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4"
                    />
                    <Input
                      placeholder="Search jobs by title or department..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 text-sm"
                      disabled={isLoading || isBulkUploading}
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter} disabled={isLoading || isBulkUploading}>
                  <SelectTrigger className="w-40 text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-sm">All Status</SelectItem>
                    <SelectItem value="Active" className="text-sm">Active</SelectItem>
                    <SelectItem value="Completed" className="text-sm">Completed</SelectItem>
                    <SelectItem value="On Hold" className="text-sm">On Hold</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter} disabled={isLoading || isBulkUploading}>
                  <SelectTrigger className="w-40 text-sm">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-sm">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept} value={dept} className="text-sm">
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)} disabled={isLoading || isBulkUploading}>
                  <SelectTrigger className="w-40 text-sm">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="startDate" className="text-sm">Start Date</SelectItem>
                    <SelectItem value="jobTitle" className="text-sm">Job Title</SelectItem>
                    <SelectItem value="candidatesApplied" className="text-sm">Candidates</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                  disabled={isLoading || isBulkUploading}
                >
                  <SortDesc className={`w-4 h-4 transition-transform ${sortDirection === "asc" ? "rotate-180" : ""}`} />
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardContent className="p-0">
              <div className="divide-y divide-gray-200">
                {filteredAndSortedCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer transition-colors duration-200 my-2"
                    onClick={() => navigate(`/candidate-search/${campaign.id}`)}
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">{campaign.jobTitle}</h3>
                        <Badge className={`${getStatusColor(campaign.status)} text-xs`}>{campaign.status}</Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-gray-600">
                        <div className="flex items-center space-x-1">
                          <Building className="w-4 h-4" />
                          <span>{campaign.department}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-4 h-4" />
                          <span>{campaign.location || "Not specified"}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Briefcase className="w-4 h-4" />
                          <span>{campaign.jobType}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>Started {new Date(campaign.startDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-gray-600">
                        <span>Experience: {campaign.minExperience}-{campaign.maxExperience} years</span>
                        <span>Positions: {campaign.positions}</span>
                        <div className="flex items-center space-x-1">
                          <User className="w-4 h-4" />
                          <span>{campaign.created_by_name} (Hiring Manager)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Dialog open={isCreateJobModalOpen} onOpenChange={(open) => {
            setIsCreateJobModalOpen(open);
            if (!open) {
              setCurrentStep(1);
              setActiveTab("manual");
              setJdFiles([]);
              setFormErrors({});
              setNewCampaign({
                client_id: clientId || "",
                campaign_id: campaignId || "",
                jobTitle: "",
                description: "",
                minExperience: 0,
                maxExperience: 2,
                positions: 1,
                location: null,
                department: "Engineering",
                jobType: "Full-time",
                startDate: new Date().toISOString().split("T")[0],
                created_by: "",
                talentAcquisitionTeam: [],
              });
            }
          }}>
            <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-base">Create Job</DialogTitle>
                <DialogDescription className="text-xs">
                  Create a job manually by entering details or upload one or more files to create multiple jobs.
                </DialogDescription>
              </DialogHeader>
              <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual" className="text-sm">Manual</TabsTrigger>
                  <TabsTrigger value="bulk" className="text-sm">Bulk</TabsTrigger>
                </TabsList>
                <TabsContent value="manual">
                  <div className="space-y-6">
                    <div className="flex justify-between mb-4">
                      <div className={`flex-1 text-center ${currentStep >= 1 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                        <span className={`inline-block w-8 h-8 rounded-full ${currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'} text-sm`}>1</span>
                        <p className="text-xs mt-1">Job Details</p>
                      </div>
                      <div className={`flex-1 text-center ${currentStep >= 2 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                        <span className={`inline-block w-8 h-8 rounded-full ${currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'} text-sm`}>2</span>
                        <p className="text-xs mt-1">Experience & Positions</p>
                      </div>
                      <div className={`flex-1 text-center ${currentStep >= 3 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                        <span className={`inline-block w-8 h-8 rounded-full ${currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'} text-sm`}>3</span>
                        <p className="text-xs mt-1">Description & Team</p>
                      </div>
                    </div>
                    {currentStep === 1 && (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="jobTitle" className="text-sm">Job Title</Label>
                          <Input
                            id="jobTitle"
                            value={newCampaign.jobTitle}
                            onChange={(e) => setNewCampaign({ ...newCampaign, jobTitle: e.target.value })}
                            placeholder="Enter job title"
                            className="text-sm"
                            disabled={isLoading || isBulkUploading}
                          />
                          {formErrors.jobTitle && <p className="text-red-500 text-xs">{formErrors.jobTitle}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="location" className="text-sm">Location (optional)</Label>
                          <Input
                            id="location"
                            value={newCampaign.location || ""}
                            onChange={(e) => setNewCampaign({ ...newCampaign, location: e.target.value || null })}
                            placeholder="Enter location"
                            className="text-sm"
                            disabled={isLoading || isBulkUploading}
                          />
                          {formErrors.location && <p className="text-red-500 text-xs">{formErrors.location}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="department" className="text-sm">Department</Label>
                          <Select
                            value={newCampaign.department}
                            onValueChange={(value) => setNewCampaign({ ...newCampaign, department: value })}
                            disabled={isLoading || isBulkUploading}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Engineering" className="text-sm">Engineering</SelectItem>
                              <SelectItem value="Product" className="text-sm">Product</SelectItem>
                              <SelectItem value="Design" className="text-sm">Design</SelectItem>
                              <SelectItem value="Marketing" className="text-sm">Marketing</SelectItem>
                              <SelectItem value="Sales" className="text-sm">Sales</SelectItem>
                              <SelectItem value="Operations" className="text-sm">Operations</SelectItem>
                              <SelectItem value="Finance" className="text-sm">Finance</SelectItem>
                              <SelectItem value="HR" className="text-sm">HR</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="jobType" className="text-sm">Job Type</Label>
                          <Select
                            value={newCampaign.jobType}
                            onValueChange={(value: "Full-time" | "Part-time" | "Contract") =>
                              setNewCampaign({ ...newCampaign, jobType: value })
                            }
                            disabled={isLoading || isBulkUploading}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue placeholder="Select job type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Full-time" className="text-sm">Full-time</SelectItem>
                              <SelectItem value="Part-time" className="text-sm">Part-time</SelectItem>
                              <SelectItem value="Contract" className="text-sm">Contract</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    {currentStep === 2 && (
                      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="minExperience" className="text-sm">Minimum Experience (years)</Label>
                          <Input
                            id="minExperience"
                            type="number"
                            value={newCampaign.minExperience}
                            onChange={(e) => setNewCampaign({ ...newCampaign, minExperience: parseInt(e.target.value) || 0 })}
                            min="0"
                            className="text-sm"
                            disabled={isLoading || isBulkUploading}
                          />
                          {formErrors.experience && <p className="text-red-500 text-xs">{formErrors.experience}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="maxExperience" className="text-sm">Maximum Experience (years)</Label>
                          <Input
                            id="maxExperience"
                            type="number"
                            value={newCampaign.maxExperience}
                            onChange={(e) => setNewCampaign({ ...newCampaign, maxExperience: parseInt(e.target.value) || 2 })}
                            min="0"
                            className="text-sm"
                            disabled={isLoading || isBulkUploading}
                          />
                          {formErrors.experience && <p className="text-red-500 text-xs">{formErrors.experience}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="positions" className="text-sm">Open Positions</Label>
                          <Input
                            id="positions"
                            type="number"
                            value={newCampaign.positions}
                            onChange={(e) => setNewCampaign({ ...newCampaign, positions: parseInt(e.target.value) || 1 })}
                            min="1"
                            className="text-sm"
                            disabled={isLoading || isBulkUploading}
                          />
                          {formErrors.positions && <p className="text-red-500 text-xs">{formErrors.positions}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="startDate" className="text-sm">Start Date</Label>
                          <Input
                            id="startDate"
                            type="date"
                            value={newCampaign.startDate}
                            onChange={(e) => setNewCampaign({ ...newCampaign, startDate: e.target.value })}
                            className="text-sm"
                            disabled={isLoading || isBulkUploading}
                          />
                        </div>
                      </div>
                    )}
                    {currentStep === 3 && (
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <Label htmlFor="description" className="text-sm">Job Description</Label>
                          <Textarea
                            id="description"
                            value={newCampaign.description}
                            onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                            placeholder="Enter detailed job description"
                            rows={4}
                            className="text-sm"
                            disabled={isLoading || isBulkUploading}
                          />
                          {formErrors.description && <p className="text-red-500 text-xs">{formErrors.description}</p>}
                        </div>
                        <div className="space-y-4">
                          <Label className="text-base font-semibold">Talent Acquisition Team</Label>
                          <div className="grid grid-cols-4 gap-2 p-4 border rounded-lg">
                            <Input
                              placeholder="Name"
                              value={newTeamMember.name}
                              onChange={(e) => setNewTeamMember({ ...newTeamMember, name: e.target.value })}
                              className="text-sm"
                              disabled={isLoading || isBulkUploading}
                            />
                            <Input
                              placeholder="Email"
                              type="email"
                              value={newTeamMember.email}
                              onChange={(e) => setNewTeamMember({ ...newTeamMember, email: e.target.value })}
                              className="text-sm"
                              disabled={isLoading || isBulkUploading}
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
                              disabled={isLoading || isBulkUploading}
                            >
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Recruiter" className="text-sm">Recruiter</SelectItem>
                                <SelectItem value="Hiring Manager" className="text-sm">Hiring Manager</SelectItem>
                                <SelectItem value="Coordinator" className="text-sm">Coordinator</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button onClick={handleAddTeamMember} size="sm" disabled={isLoading || isBulkUploading} className="text-sm">
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                          {newCampaign.talentAcquisitionTeam && newCampaign.talentAcquisitionTeam.length > 0 && (
                            <div className="space-y-2">
                              {newCampaign.talentAcquisitionTeam.map((member, index) => (
                                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                                  <div className="flex items-center space-x-3">
                                    <div>
                                      <p className="font-medium text-sm">{member.name}</p>
                                      <p className="text-xs text-gray-500">{member.email}</p>
                                    </div>
                                    <Badge variant={member.isHiringManager ? "default" : "secondary"} className="text-xs">
                                      {member.role}
                                    </Badge>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRemoveTeamMember(member.id)}
                                    disabled={isLoading || isBulkUploading}
                                    className="text-sm"
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
                    )}
                    <DialogFooter>
                      <div className="flex justify-between w-full">
                        <div>
                          {currentStep > 1 && (
                            <Button
                              variant="outline"
                              onClick={handleBackStep}
                              disabled={isLoading || isBulkUploading}
                              className="text-sm"
                            >
                              Back
                            </Button>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsCreateJobModalOpen(false);
                              setCurrentStep(1);
                              setFormErrors({});
                            }}
                            disabled={isLoading || isBulkUploading}
                            className="text-sm"
                          >
                            Cancel
                          </Button>
                          {currentStep < 3 && (
                            <Button
                              onClick={handleNextStep}
                              disabled={isLoading || isBulkUploading}
                              className="text-sm"
                            >
                              Next
                            </Button>
                          )}
                          {currentStep === 3 && (
                            <Button onClick={handleCreateJob} disabled={isLoading || isBulkUploading} className="text-sm">
                              {isLoading ? "Creating..." : "Create Job"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </DialogFooter>
                  </div>
                </TabsContent>
                <TabsContent value="bulk">
                  <div className="space-y-4">
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                        isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <div className="flex flex-col items-center space-y-2">
                        <File className="w-10 h-10 text-gray-400" />
                        <p className="text-xs text-gray-600">
                          {isDragging
                            ? 'Drop your files here'
                            : 'Drag and drop your .pdf or .docx files here or click to select multiple files'}
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isLoading || isBulkUploading}
                          className="text-sm"
                        >
                          Select Files
                        </Button>
                        <Input
                          id="jdFile"
                          type="file"
                          accept=".pdf,.docx"
                          multiple
                          onChange={handleFileChange}
                          className="hidden"
                          ref={fileInputRef}
                          disabled={isLoading || isBulkUploading}
                        />
                      </div>
                      {jdFiles.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {jdFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-center space-x-2">
                              <File className="w-5 h-5 text-blue-600" />
                              <p className="text-xs text-gray-600">{file.name}</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setJdFiles(jdFiles.filter((_, i) => i !== index))}
                                disabled={isLoading || isBulkUploading}
                                className="text-sm"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      {formErrors.file && <p className="text-red-500 text-xs mt-2">{formErrors.file}</p>}
                    </div>
                    <div className="text-xs text-gray-500">
                      <p>Supported formats: .pdf, .docx</p>
                      <p>Ensure each file contains job descriptions with: Job Title, Description (mandatory), and optional fields: Location, Min Experience, Max Experience, Positions</p>
                    </div>
                    <DialogFooter>
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsCreateJobModalOpen(false)}
                          disabled={isLoading || isBulkUploading}
                          className="text-sm"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleImportJD}
                          disabled={isLoading || isBulkUploading || jdFiles.length === 0}
                          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-sm"
                        >
                          Import
                        </Button>
                      </div>
                    </DialogFooter>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
          {filteredAndSortedCampaigns.length === 0 && !isLoading && !error && (
            <div className="text-center py-12">
              <Briefcase className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-base font-medium text-gray-600 mb-2">No Jobs Found</p>
              <p className="text-xs text-gray-500">Create your first job to get started.</p>
            </div>
          )}
        </div>
      </main>
      <QChat />
    </div>
  );
};

export default CampaignManager;