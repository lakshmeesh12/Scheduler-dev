import { useState, useMemo } from "react";
import { 
  Search, Plus, Users, Filter, SortDesc, MoreHorizontal, 
  Calendar, TrendingUp, UserCheck, UserX, Clock, Eye,
  Download, FileText, Star, ChevronRight, ChevronDown,
  Building, MapPin, Target, Briefcase
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface HiringCampaign {
  id: string;
  jobTitle: string;
  department: string;
  positions: number;
  status: "Active" | "Completed" | "On Hold";
  startDate: string;
  endDate?: string;
  location: string;
  candidatesApplied: number;
  candidatesHired: number;
  currentRound: string;
  description: string;
  experienceLevel: "Junior" | "Mid-level" | "Senior";
  jobType: "Full-time" | "Part-time" | "Contract";
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  applicationDate: string;
  status: "Applied" | "Screening" | "L2" | "L3" | "Selected" | "Rejected" | "On Hold";
  currentRound: string;
  panelMembers: string[];
  feedback: string;
  rating: number;
}

interface InterviewRound {
  id: string;
  name: string;
  panelMembers: { name: string; role: string }[];
  scheduledDate?: string;
  feedback?: string;
  status: "Pending" | "Completed" | "Scheduled";
}

const HiringCampaignTracker = () => {
  const [campaigns, setCampaigns] = useState<HiringCampaign[]>([
    {
      id: "1",
      jobTitle: "Senior Software Engineer",
      department: "Engineering",
      positions: 3,
      status: "Active",
      startDate: "2024-01-15",
      location: "San Francisco, CA",
      candidatesApplied: 124,
      candidatesHired: 1,
      currentRound: "Technical Interview",
      description: "Looking for experienced software engineers to join our core platform team.",
      experienceLevel: "Senior",
      jobType: "Full-time"
    },
    {
      id: "2", 
      jobTitle: "Product Manager",
      department: "Product",
      positions: 2,
      status: "Active",
      startDate: "2024-02-01",
      location: "New York, NY",
      candidatesApplied: 89,
      candidatesHired: 0,
      currentRound: "Final Round",
      description: "Seeking strategic product managers to drive our product roadmap.",
      experienceLevel: "Mid-level",
      jobType: "Full-time"
    },
    {
      id: "3",
      jobTitle: "UX Designer",
      department: "Design",
      positions: 1,
      status: "Completed",
      startDate: "2024-01-01",
      endDate: "2024-03-15",
      location: "Remote",
      candidatesApplied: 67,
      candidatesHired: 1,
      currentRound: "Completed",
      description: "Creative UX designer to enhance our user experience.",
      experienceLevel: "Mid-level",
      jobType: "Full-time"
    }
  ]);

  const [selectedCampaign, setSelectedCampaign] = useState<HiringCampaign | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"jobTitle" | "startDate" | "candidatesApplied">("startDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // New campaign form state
  const [newCampaign, setNewCampaign] = useState({
    jobTitle: "",
    description: "",
    experienceLevel: "Junior" as "Junior" | "Mid-level" | "Senior",
    positions: 1,
    location: "",
    department: "Engineering",
    jobType: "Full-time" as "Full-time" | "Part-time" | "Contract",
    startDate: new Date().toISOString().split("T")[0] // Current date
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Mock candidate data for selected campaign
  const candidatesData: Candidate[] = [
    {
      id: "1",
      name: "Sarah Johnson",
      email: "sarah.johnson@email.com",
      applicationDate: "2024-01-20",
      status: "L2",
      currentRound: "Technical Interview",
      panelMembers: ["John Doe - Senior Engineer", "Jane Smith - Tech Lead"],
      feedback: "Strong technical skills, excellent problem-solving approach",
      rating: 4.5
    },
    {
      id: "2",
      name: "Michael Chen",
      email: "michael.chen@email.com", 
      applicationDate: "2024-01-22",
      status: "L3",
      currentRound: "Final Round",
      panelMembers: ["Bob Wilson - Engineering Manager", "Alice Brown - Director"],
      feedback: "Great cultural fit, impressive portfolio of projects",
      rating: 4.8
    },
    {
      id: "3",
      name: "Emily Rodriguez",
      email: "emily.rodriguez@email.com",
      applicationDate: "2024-01-18",
      status: "Selected",
      currentRound: "Completed",
      panelMembers: ["Tom Davis - CTO", "Lisa Green - HR Director"],
      feedback: "Outstanding candidate, strong leadership potential",
      rating: 5.0
    }
  ];

  // Generate a simple UUID for demo purposes
  const generateId = () => {
    return Math.random().toString(36).substr(2, 9);
  };

  // Validate form
  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!newCampaign.jobTitle.trim()) errors.jobTitle = "Job Title is required";
    if (!newCampaign.description.trim()) errors.description = "Description is required";
    if (!newCampaign.location.trim()) errors.location = "Location is required";
    if (newCampaign.positions < 1) errors.positions = "At least one position is required";
    return errors;
  };

  // Handle form submission
  const handleCreateCampaign = () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const newCampaignData: HiringCampaign = {
      id: generateId(),
      jobTitle: newCampaign.jobTitle,
      department: newCampaign.department,
      positions: newCampaign.positions,
      status: "Active",
      startDate: newCampaign.startDate,
      location: newCampaign.location,
      candidatesApplied: 0,
      candidatesHired: 0,
      currentRound: "Screening",
      description: newCampaign.description,
      experienceLevel: newCampaign.experienceLevel,
      jobType: newCampaign.jobType
    };

    setCampaigns([...campaigns, newCampaignData]);
    setNewCampaign({
      jobTitle: "",
      description: "",
      experienceLevel: "Junior",
      positions: 1,
      location: "",
      department: "Engineering",
      jobType: "Full-time",
      startDate: new Date().toISOString().split("T")[0]
    });
    setFormErrors({});
    setIsCreateModalOpen(false);
  };

  const getStatusColor = (status: HiringCampaign["status"]) => {
    switch (status) {
      case "Active": return "bg-green-100 text-green-800";
      case "Completed": return "bg-blue-100 text-blue-800";
      case "On Hold": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getCandidateStatusColor = (status: Candidate["status"]) => {
    switch (status) {
      case "Selected": return "bg-green-100 text-green-800";
      case "Rejected": return "bg-red-100 text-red-800";
      case "On Hold": return "bg-yellow-100 text-yellow-800";
      case "L2": 
      case "L3": 
      case "Screening": return "bg-blue-100 text-blue-800";
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

  const MetricsDashboard = ({ campaign }: { campaign: HiringCampaign }) => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Applied</p>
              <p className="text-2xl font-bold text-blue-600">{campaign.candidatesApplied}</p>
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
              <p className="text-2xl font-bold text-green-600">{campaign.candidatesHired}</p>
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
                {campaign.candidatesApplied > 0 ? Math.round((campaign.candidatesHired / campaign.candidatesApplied) * 100) : 0}%
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
              <p className="text-2xl font-bold text-orange-600">{campaign.positions - campaign.candidatesHired}</p>
            </div>
            <Target className="w-8 h-8 text-orange-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  );

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
            <Button variant="outline" className="flex-1">
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

  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold gradient-text">Hiring Campaign Tracker</h1>
                <p className="text-sm text-gray-600">Enterprise Hiring Management</p>
              </div>
            </div>
            
            <Button 
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!selectedCampaign ? (
          <div className="space-y-6">
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
                      />
                    </div>
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
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

                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
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

                  <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
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
                  >
                    <SortDesc className={`w-4 h-4 transition-transform ${sortDirection === "asc" ? "rotate-180" : ""}`} />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* New Campaign Modal */}
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto bg-white rounded-xl shadow-2xl">
                <DialogHeader className="border-b border-gray-200 pb-4">
                <DialogTitle className="text-2xl font-semibold text-gray-800">Create New Campaign</DialogTitle>
                </DialogHeader>
                <div className="py-6 px-8">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <div className="space-y-2">
                    <Label htmlFor="jobTitle" className="text-sm font-medium text-gray-700">Job Title</Label>
                    <Input
                        id="jobTitle"
                        value={newCampaign.jobTitle}
                        onChange={(e) => setNewCampaign({ ...newCampaign, jobTitle: e.target.value })}
                        className="w-full border-gray-300 focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter job title"
                    />
                    {formErrors.jobTitle && <p className="text-red-500 text-xs">{formErrors.jobTitle}</p>}
                    </div>
                    <div className="space-y-2">
                    <Label htmlFor="location" className="text-sm font-medium text-gray-700">Location</Label>
                    <Input
                        id="location"
                        value={newCampaign.location}
                        onChange={(e) => setNewCampaign({ ...newCampaign, location: e.target.value })}
                        className="w-full border-gray-300 focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter location"
                    />
                    {formErrors.location && <p className="text-red-500 text-xs">{formErrors.location}</p>}
                    </div>
                    <div className="space-y-2">
                    <Label htmlFor="department" className="text-sm font-medium text-gray-700">Department</Label>
                    <Select
                        value={newCampaign.department}
                        onValueChange={(value) => setNewCampaign({ ...newCampaign, department: value })}
                    >
                        <SelectTrigger className="w-full border-gray-300 focus:ring-2 focus:ring-blue-500">
                        <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="Engineering">Engineering</SelectItem>
                        <SelectItem value="Product">Product</SelectItem>
                        <SelectItem value="Design">Design</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                        </SelectContent>
                    </Select>
                    </div>
                    <div className="space-y-2">
                    <Label htmlFor="jobType" className="text-sm font-medium text-gray-700">Job Type</Label>
                    <Select
                        value={newCampaign.jobType}
                        onValueChange={(value: "Full-time" | "Part-time" | "Contract") => setNewCampaign({ ...newCampaign, jobType: value })}
                    >
                        <SelectTrigger className="w-full border-gray-300 focus:ring-2 focus:ring-blue-500">
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
                    <Label htmlFor="experienceLevel" className="text-sm font-medium text-gray-700">Experience Level</Label>
                    <Select
                        value={newCampaign.experienceLevel}
                        onValueChange={(value: "Junior" | "Mid-level" | "Senior") => setNewCampaign({ ...newCampaign, experienceLevel: value })}
                    >
                        <SelectTrigger className="w-full border-gray-300 focus:ring-2 focus:ring-blue-500">
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
                    <Label htmlFor="positions" className="text-sm font-medium text-gray-700">Open Positions</Label>
                    <Input
                        id="positions"
                        type="number"
                        value={newCampaign.positions}
                        onChange={(e) => setNewCampaign({ ...newCampaign, positions: parseInt(e.target.value) || 1 })}
                        className="w-full border-gray-300 focus:ring-2 focus:ring-blue-500"
                        min="1"
                    />
                    {formErrors.positions && <p className="text-red-500 text-xs">{formErrors.positions}</p>}
                    </div>
                    <div className="space-y-2 col-span-2">
                    <Label htmlFor="description" className="text-sm font-medium text-gray-700">Description</Label>
                    <Textarea
                        id="description"
                        value={newCampaign.description}
                        onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                        className="w-full border-gray-300 focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter job description"
                        rows={4}
                    />
                    {formErrors.description && <p className="text-red-500 text-xs">{formErrors.description}</p>}
                    </div>
                    <div className="space-y-2">
                    <Label htmlFor="startDate" className="text-sm font-medium text-gray-700">Start Date</Label>
                    <Input
                        id="startDate"
                        type="date"
                        value={newCampaign.startDate}
                        onChange={(e) => setNewCampaign({ ...newCampaign, startDate: e.target.value })}
                        className="w-full border-gray-300 focus:ring-2 focus:ring-blue-500"
                    />
                    </div>
                </div>
                </div>
                <DialogFooter className="border-t border-gray-200 pt-4 px-8">
                <Button 
                    variant="outline" 
                    onClick={() => setIsCreateModalOpen(false)}
                    className="border-gray-300 hover:bg-gray-100"
                >
                    Cancel
                </Button>
                <Button 
                    onClick={handleCreateCampaign}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                    Save Campaign
                </Button>
                </DialogFooter>
            </DialogContent>
            </Dialog>

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
                      <p className="text-gray-500">Current Round</p>
                      <p className="font-medium">{campaign.currentRound}</p>
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

            {filteredAndSortedCampaigns.length === 0 && (
              <div className="text-center py-12">
                <Briefcase className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-xl font-medium text-gray-600 mb-2">No Campaigns Found</p>
                <p className="text-gray-500">Try adjusting your search filters or create a new campaign.</p>
              </div>
            )}
          </div>
        ) : (
          /* Campaign Detail View */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Button 
                    variant="outline"
                    onClick={() => setSelectedCampaign(null)}
                    className="mb-4"
                >
                    ← Back to Campaigns
                </Button>
                
                <div className="flex items-center space-x-2">
                    <Button 
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                    size="sm"
                    >
                    <Search className="w-4 h-4 mr-2" />
                    Search Candidates
                    </Button>
                    <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export Data
                    </Button>
                    <Button variant="outline" size="sm">
                    <MoreHorizontal className="w-4 h-4" />
                    </Button>
                </div>
                </div>

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
                        <Target className="w-4 h-4" />
                        <span>{selectedCampaign.experienceLevel}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Briefcase className="w-4 h-4" />
                        <span>{selectedCampaign.jobType}</span>
                      </div>
                    </div>
                  </div>
                  <Badge className={getStatusColor(selectedCampaign.status)} variant="secondary">
                    {selectedCampaign.status}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            <MetricsDashboard campaign={selectedCampaign} />

            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Candidates ({candidatesData.length})
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Candidate
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Current Round</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Applied Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidatesData.map((candidate) => (
                      <TableRow key={candidate.id} className="cursor-pointer hover:bg-gray-50">
                        <TableCell>
                          <div>
                            <p className="font-medium">{candidate.name}</p>
                            <p className="text-sm text-muted-foreground">{candidate.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getCandidateStatusColor(candidate.status)}>
                            {candidate.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{candidate.currentRound}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                className={`w-3 h-3 ${i < candidate.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} 
                              />
                            ))}
                            <span className="text-sm text-muted-foreground ml-1">{candidate.rating}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(candidate.applicationDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedCandidate(candidate)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
      </main>
    </div>
  );
};

export default HiringCampaignTracker;