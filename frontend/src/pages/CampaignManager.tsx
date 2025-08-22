//src/pages/CampaignManager.tsx

import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Search, Plus, Filter, SortDesc, Calendar, UserCheck, MapPin, Target, Briefcase, ArrowLeft, X, User, Building
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { fetchAllClients, createCampaign, fetchAllCampaigns, Client, HiringCampaign, CampaignCreate } from "@/api";

interface TalentAcquisitionTeamMember {
  id: string;
  name: string;
  email: string;
  role: "Recruiter" | "Hiring Manager" | "Coordinator";
  isHiringManager: boolean;
}

const CampaignManager = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [campaigns, setCampaigns] = useState<HiringCampaign[]>([]);
  const [isCreateCampaignModalOpen, setIsCreateCampaignModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"jobTitle" | "startDate" | "candidatesApplied">("startDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCampaign, setNewCampaign] = useState<CampaignCreate>({
    client_id: clientId || "",
    jobTitle: "",
    description: "",
    experienceLevel: "Junior",
    positions: 1,
    location: "",
    department: "Engineering",
    jobType: "Full-time",
    startDate: new Date().toISOString().split("T")[0],
    created_by: "",
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

  useEffect(() => {
    if (clientId) {
      loadClient();
      loadCampaigns();
    }
  }, [clientId]);

  const loadClient = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const allClients = await fetchAllClients();
      const client = allClients.find(c => c.id === clientId);
      if (client) {
        setSelectedClient(client);
      } else {
        setError('Client not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load client');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCampaigns = async () => {
    setIsLoading(true);
    setError(null);
    setCampaigns([]);
    try {
      const data = await fetchAllCampaigns(clientId!);
      setCampaigns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('newCampaign state updated:', newCampaign);
  }, [newCampaign]);

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

  const handleCreateCampaign = async () => {
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
        client_id: clientId!
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
        created_by: "",
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

  const handleRemoveTeamMember = (memberId: string) => {
    setNewCampaign({
      ...newCampaign,
      talentAcquisitionTeam: newCampaign.talentAcquisitionTeam?.filter(m => m.id !== memberId) || []
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
                  {selectedClient ? `${selectedClient.companyName} Campaigns` : "Campaign Manager"}
                </h1>
                <p className="text-sm text-gray-600">Enterprise Hiring Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => navigate("/client-dashboard")}
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
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {isLoading && <p className="text-center">Loading...</p>}
        {error && <p className="text-center text-red-500">{error}</p>}
        <div className="space-y-6">
          {selectedClient && (
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
          )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedCampaigns.map((campaign) => (
                <Card
                key={campaign.id}
                className="glass hover:shadow-lg transition-all duration-300 cursor-pointer hover:scale-105 relative"
                onClick={() => navigate(`/candidate-search/${campaign.id}`)}
                >
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <CardTitle className="text-lg pr-2">{campaign.jobTitle}</CardTitle>
                        <div className="flex items-center space-x-2 mt-1">
                        <Building className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">{campaign.department}</span>
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
                    
                    {/* Updated section with Team Members and Hiring Manager side by side */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-gray-500">Team Members</p>
                        <p className="font-medium">{campaign.talentAcquisitionTeam?.length || 0} members</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Hiring Manager</p>
                        <div className="flex items-center bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-full px-2 py-1 shadow-sm mt-1">
                        <User className="w-3 h-3 text-indigo-600 mr-1" />
                        <span className="text-xs font-medium text-indigo-700 truncate max-w-[100px]">
                            {campaign.created_by_name}
                        </span>
                        </div>
                    </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-gray-500">
                        Started {new Date(campaign.startDate).toLocaleDateString()}
                    </span>
                    <Calendar className="w-4 h-4 text-gray-400" />
                    </div>
                </CardContent>
                </Card>
            ))}
            </div>
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
      </main>
    </div>
  );
};

export default CampaignManager;