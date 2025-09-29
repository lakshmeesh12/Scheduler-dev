import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search, Plus, Briefcase, ChevronRight, User, Mail, BarChart2, Users, Clock, Filter, X, Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { fetchAllClients, Client, fetchAllManagerCampaigns, ManagerCampaignCreate, ManagerCampaign, createManagerCampaign, fetchAllCampaigns, fetchEmployees, fetchDrivesByClient } from "@/api";
import QChat from "@/components/QChat";

interface CampaignStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalCandidates: number;
  activeCandidates: number;
  avgCampaignDuration: number;
}

interface Employee {
  id: string;
  name: string;
  title: string;
}

interface Drive {
  id: string;
  client_id: string;
  title: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  to_emails: string[];
  cc_emails: string[];
  event_id: string;
  campaign_id?: string;
  created_at: string;
}

interface SearchFilters {
  title: string;
  location: string;
  skills: string;
  certifications: string;
  department: string;
}

const CampaignDashboard = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [campaigns, setCampaigns] = useState<ManagerCampaign[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [driveSearchQuery, setDriveSearchQuery] = useState("");
  const [stats, setStats] = useState<CampaignStats>({
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalCandidates: 0,
    activeCandidates: 0,
    avgCampaignDuration: 0,
  });
  const [isCreateCampaignModalOpen, setIsCreateCampaignModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [drivesLoading, setDrivesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [drivesError, setDrivesError] = useState<string | null>(null);
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    title: "",
    location: "",
    skills: "",
    certifications: "",
    department: "",
  });
  const [newCampaign, setNewCampaign] = useState<ManagerCampaignCreate>({
    title: "",
    description: "",
    contactPerson: "",
    contactNumber: "",
    location: "",
    startDate: new Date().toISOString().split("T")[0],
    client_id: clientId || "",
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [activeTab, setActiveTab] = useState("campaigns");

  const filteredEmployees = employees
    .map((emp, index) => ({ ...emp, id: emp.id || `${index}` }))
    .filter((employee) =>
      employee.name.toLowerCase().includes(employeeSearchQuery.toLowerCase())
    );

  const filteredDrives = drives.filter((drive) =>
    drive.title.toLowerCase().includes(driveSearchQuery.toLowerCase())
  );

  useEffect(() => {
    if (!clientId) {
      setError("No client ID provided in the URL");
      return;
    }

    loadClient();
    loadCampaigns();
  }, [clientId]);

  useEffect(() => {
    if (activeTab === "employees") {
      loadEmployees();
    } else if (activeTab === "drives") {
      loadDrives();
    }
  }, [activeTab, clientId]);

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

  const loadCampaigns = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedCampaigns = await fetchAllManagerCampaigns(clientId);
      setCampaigns(fetchedCampaigns);
      const today = new Date();
      const activeCampaigns = fetchedCampaigns.filter(campaign => new Date(campaign.startDate) <= today).length;
      const totalCandidates = fetchedCampaigns.reduce((sum, campaign) => sum + (campaign.candidates?.length || 0), 0);
      const activeCandidates = fetchedCampaigns.reduce(
        (sum, campaign) => sum + (campaign.candidates?.filter(c => c.status === 'active').length || 0),
        0
      );
      const avgCampaignDuration = fetchedCampaigns.length > 0 
        ? fetchedCampaigns.reduce((sum, campaign) => {
            const start = new Date(campaign.startDate);
            const end = campaign.endDate ? new Date(campaign.endDate) : today;
            const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
            return sum + duration;
          }, 0) / fetchedCampaigns.length
        : 0;

      setStats({
        totalCampaigns: fetchedCampaigns.length,
        activeCampaigns,
        totalCandidates,
        activeCandidates,
        avgCampaignDuration: Number(avgCampaignDuration.toFixed(1)),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmployees = async () => {
    setEmployeeLoading(true);
    setEmployeeError(null);
    try {
      const fetchedEmployees = await fetchEmployees();
      setEmployees(fetchedEmployees);
    } catch (err) {
      setEmployeeError(err instanceof Error ? err.message : "Failed to load employees");
    } finally {
      setEmployeeLoading(false);
    }
  };

  const loadDrives = async () => {
    if (!clientId) {
      setDrivesError("No client ID provided");
      return;
    }
    setDrivesLoading(true);
    setDrivesError(null);
    try {
      const fetchedDrives = await fetchDrivesByClient(clientId);
      setDrives(fetchedDrives);
    } catch (err) {
      setDrivesError(err instanceof Error ? err.message : "Failed to load drives");
    } finally {
      setDrivesLoading(false);
    }
  };

  const handleCreateCampaign = async () => {
    const errors: { [key: string]: string } = {};
    if (!newCampaign.title.trim()) errors.title = "Campaign title is required";
    if (!newCampaign.description.trim()) errors.description = "Description is required";
    if (!newCampaign.contactPerson.trim()) errors.contactPerson = "Contact person is required";
    if (!newCampaign.contactNumber.trim()) errors.contactNumber = "Contact number is required";
    if (!newCampaign.location.trim()) errors.location = "Location is required";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsLoading(true);
    try {
      const createdCampaign = await createManagerCampaign(newCampaign);
      setCampaigns([...campaigns, createdCampaign]);
      setNewCampaign({
        title: "",
        description: "",
        contactPerson: "",
        contactNumber: "",
        location: "",
        startDate: new Date().toISOString().split("T")[0],
        client_id: clientId || "",
      });
      setFormErrors({});
      setIsCreateCampaignModalOpen(false);
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearchFilters({
      title: "",
      location: "",
      skills: "",
      certifications: "",
      department: "",
    });
    setEmployeeSearchQuery("");
    setIsAdvancedSearchOpen(false);
  };

  const handleSearch = () => {
    console.log("Performing NLP-based search with query:", employeeSearchQuery, "and filters:", searchFilters);
  };

  const filteredCampaigns = campaigns.filter((campaign) =>
    campaign.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCampaignClick = async (campaignId: string) => {
    if (!clientId) {
      setError("Client ID is missing");
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      const jobs = await fetchAllCampaigns(clientId, campaignId);
      navigate(`/campaign-manager/${clientId}/${campaignId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch campaign jobs");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 w-full overflow-x-hidden">
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <SidebarTrigger className="p-1" />
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <Briefcase className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold gradient-text">
                  {selectedClient ? `${selectedClient.companyName} Campaigns` : "Campaign Dashboard"}
                </h1>
                <p className="text-xs text-gray-600">Enterprise Hiring Management</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-sm py-1 px-3 h-8 flex items-center space-x-1"
                    disabled={isLoading}
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="glass min-w-[120px] p-1" align="end">
                  <DropdownMenuItem
                    className="text-sm py-1.5 px-2 cursor-pointer hover:bg-gray-100/50"
                    onClick={() => setIsCreateCampaignModalOpen(true)}
                  >
                    New Campaign
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-sm py-1.5 px-2 cursor-pointer hover:bg-gray-100/50"
                    onClick={() => navigate(`/add-employee/${clientId}`)}
                  >
                    Add Employee
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-sm py-1.5 px-2 cursor-pointer hover:bg-gray-100/50"
                    onClick={() => navigate("/drives")}
                  >
                    Add Drive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-3">
        {isLoading && <p className="text-center text-sm text-gray-600">Loading...</p>}
        {error && <p className="text-center text-sm text-red-500">{error}</p>}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
          <TabsList className="glass">
            <TabsTrigger value="campaigns" className="text-sm px-4 py-1">Campaigns</TabsTrigger>
            <TabsTrigger value="employees" className="text-sm px-4 py-1">Employees</TabsTrigger>
            <TabsTrigger value="drives" className="text-sm px-4 py-1">Drives</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="space-y-3">
            <Card className="glass">
              <CardHeader className="pb-1">
                <CardTitle className="text-base font-semibold">Campaign Statistics</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  <div className="flex items-center space-x-1 p-2 bg-white/10 rounded-lg">
                    <BarChart2 className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="text-base font-semibold">{stats.totalCampaigns}</p>
                      <p className="text-xs text-gray-500">Total Campaigns</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 p-2 bg-white/10 rounded-lg">
                    <Users className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-base font-semibold">{stats.activeCampaigns}</p>
                      <p className="text-xs text-gray-500">Active Campaigns</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 p-2 bg-white/10 rounded-lg">
                    <Users className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="text-base font-semibold">{stats.totalCandidates.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Total Candidates</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 p-2 bg-white/10 rounded-lg">
                    <Users className="w-4 h-4 text-orange-600" />
                    <div>
                      <p className="text-base font-semibold">{stats.activeCandidates.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Active Candidates</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 p-2 bg-white/10 rounded-lg">
                    <Clock className="w-4 h-4 text-red-600" />
                    <div>
                      <p className="text-base font-semibold">{stats.avgCampaignDuration} days</p>
                      <p className="text-xs text-gray-500">Avg. Campaign Duration</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="relative mb-3">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
              <Input
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm glass"
                disabled={isLoading}
              />
            </div>
            
            {filteredCampaigns.length === 0 && !isLoading && !error && (
              <div className="text-center py-8">
                <Briefcase className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-base font-medium text-gray-600 mb-1">No Campaigns Found</p>
                <p className="text-sm text-gray-500">Create your first campaign to get started.</p>
              </div>
            )}
            {filteredCampaigns.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCampaigns.map((campaign) => (
                  <Card
                    key={campaign.id}
                    className="glass hover:shadow-md transition-all duration-300 cursor-pointer hover:scale-102"
                    onClick={() => handleCampaignClick(campaign.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                          <Briefcase className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-base font-semibold">{campaign.title}</CardTitle>
                          <div className="flex items-center space-x-1 mt-1">
                            <User className="w-3 h-3 text-gray-500" />
                            <span className="text-xs text-gray-600">{campaign.contactPerson}</span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-xs text-gray-600 line-clamp-2">{campaign.description}</p>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-1">
                          <Mail className="w-3 h-3 text-gray-500" />
                          <span className="text-gray-600">{campaign.location}</span>
                        </div>
                        <ChevronRight className="w-3 h-3 text-gray-400" />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-1">
                          <span className="text-gray-500">Started</span>
                          <span className="text-gray-600">{new Date(campaign.startDate).toLocaleDateString()}</span>
                        </div>
                        <span className="text-gray-600">{campaign.contactNumber}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="employees" className="space-y-3">
            <div className="flex justify-center">
              <Card className="glass w-full max-w-3xl shadow-xl border border-white/30">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 bg-white/95 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-3 transition-all duration-300 hover:shadow-md">
                    <Search className="w-5 h-5 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search employees by name, skills, or role..."
                      className="bg-transparent outline-none text-sm placeholder-gray-400 w-full max-w-md font-medium border-none focus:ring-0"
                      value={employeeSearchQuery}
                      onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                      disabled={employeeLoading}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsAdvancedSearchOpen(!isAdvancedSearchOpen)}
                      className="p-2 hover:bg-gray-100/50 rounded-full transition-all duration-200"
                      title={isAdvancedSearchOpen ? "Hide Filters" : "Show Filters"}
                    >
                      <Filter className="w-5 h-5 text-gray-500" />
                    </Button>
                    {employeeSearchQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEmployeeSearchQuery("")}
                        className="p-2 hover:bg-gray-100/50 rounded-full transition-all duration-200"
                        title="Clear Search"
                      >
                        <X className="w-5 h-5 text-gray-500" />
                      </Button>
                    )}
                    <Button
                      onClick={handleSearch}
                      variant="ghost"
                      size="icon"
                      className="p-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-full transition-all duration-200"
                      disabled={employeeLoading}
                      title="Search"
                    >
                      <Search className="w-5 h-5" />
                    </Button>
                  </div>
                  
                  {isAdvancedSearchOpen && (
                    <div className="mt-5 p-5 bg-white/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-lg transition-all duration-300">
                      <h4 className="font-semibold text-sm text-gray-800 mb-4">Advanced Search Filters</h4>
                      <div className="grid grid-cols-2 gap-5">
                        <div>
                          <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Title</Label>
                          <Input
                            placeholder="e.g., Data Scientist"
                            className="h-10 text-sm border-gray-200 focus:ring-2 focus:ring-blue-500"
                            value={searchFilters.title}
                            onChange={(e) => setSearchFilters({ ...searchFilters, title: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Location</Label>
                          <Input
                            placeholder="e.g., Bangalore, Remote"
                            className="h-10 text-sm border-gray-200 focus:ring-2 focus:ring-blue-500"
                            value={searchFilters.location}
                            onChange={(e) => setSearchFilters({ ...searchFilters, location: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Skills</Label>
                          <Input
                            placeholder="e.g., Python, React"
                            className="h-10 text-sm border-gray-200 focus:ring-2 focus:ring-blue-500"
                            value={searchFilters.skills}
                            onChange={(e) => setSearchFilters({ ...searchFilters, skills: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Certifications/Courses</Label>
                          <Input
                            placeholder="e.g., AWS, Data Science"
                            className="h-10 text-sm border-gray-200 focus:ring-2 focus:ring-blue-500"
                            value={searchFilters.certifications}
                            onChange={(e) => setSearchFilters({ ...searchFilters, certifications: e.target.value })}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Department</Label>
                          <Select
                            value={searchFilters.department}
                            onValueChange={(value) => setSearchFilters({ ...searchFilters, department: value })}
                          >
                            <SelectTrigger className="h-10 text-sm border-gray-200 focus:ring-2 focus:ring-blue-500">
                              <SelectValue placeholder="Any Department" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="any">Any Department</SelectItem>
                              <SelectItem value="engineering">Engineering</SelectItem>
                              <SelectItem value="data-science">Data Science</SelectItem>
                              <SelectItem value="marketing">Marketing</SelectItem>
                              <SelectItem value="hr">Human Resources</SelectItem>
                              <SelectItem value="finance">Finance</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex justify-between mt-5 pt-4 border-t border-gray-100">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetFilters}
                          className="text-xs font-medium border-gray-200 hover:bg-gray-50"
                        >
                          Reset Filters
                        </Button>
                        <div className="text-xs text-gray-500 font-medium">
                          {Object.values(searchFilters).filter(v => v.trim() && v !== "any").length + (employeeSearchQuery.trim() ? 1 : 0)} filters active
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Employee List</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {employeeLoading && <p className="text-center text-sm text-gray-600">Loading employees...</p>}
                {employeeError && <p className="text-center text-sm text-red-500">{employeeError}</p>}
                
                {!employeeLoading && !employeeError && filteredEmployees.length === 0 && (
                  <div className="text-center py-8">
                    <User className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-base font-medium text-gray-600 mb-1">No Employees Found</p>
                    <p className="text-sm text-gray-500">Try adjusting your search.</p>
                  </div>
                )}
                {!employeeLoading && !employeeError && filteredEmployees.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-semibold">Name</TableHead>
                        <TableHead className="text-xs font-semibold">Title</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((employee) => (
                        <TableRow key={employee.id} className="hover:bg-gray-50/50">
                          <TableCell className="text-xs">{employee.name}</TableCell>
                          <TableCell className="text-xs">{employee.title}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drives" className="space-y-3">
            <Card className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Scheduled Drives</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
                  <Input
                    placeholder="Search drives by title..."
                    value={driveSearchQuery}
                    onChange={(e) => setDriveSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm glass"
                    disabled={drivesLoading}
                  />
                </div>
                {drivesLoading && <p className="text-center text-sm text-gray-600">Loading drives...</p>}
                {drivesError && <p className="text-center text-sm text-red-500">{drivesError}</p>}
                {!drivesLoading && !drivesError && filteredDrives.length === 0 && (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-base font-medium text-gray-600 mb-1">No Drives Found</p>
                    <p className="text-sm text-gray-500">No recruitment drives scheduled for this client.</p>
                  </div>
                )}
                {!drivesLoading && !drivesError && filteredDrives.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDrives.map((drive) => (
                      <Card
                        key={drive.id}
                        className="glass hover:shadow-md transition-all duration-300 cursor-pointer hover:scale-102"
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                              <Calendar className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-sm font-semibold">{drive.title}</CardTitle>
                              <div className="flex items-center space-x-1 mt-1">
                                <Clock className="w-3 h-3 text-gray-500" />
                                <span className="text-xs text-gray-600">
                                  {drive.start_time} - {drive.end_time} ({drive.timezone})
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p className="text-xs text-gray-600 line-clamp-2">{drive.description}</p>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-1">
                              <Mail className="w-3 h-3 text-gray-500" />
                              <span className="text-gray-600">{drive.to_emails.join(", ") || "No recipients"}</span>
                            </div>
                            <ChevronRight className="w-3 h-3 text-gray-400" />
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-1">
                              <span className="text-gray-500">Date</span>
                              <span className="text-gray-600">{new Date(drive.date).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isCreateCampaignModalOpen} onOpenChange={setIsCreateCampaignModalOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Create New Campaign</DialogTitle>
              <DialogDescription className="text-xs">Create a new campaign for {selectedClient?.companyName}</DialogDescription>
            </DialogHeader>
            <div className="py-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="title" className="text-xs">Campaign Title</Label>
                  <Input
                    id="title"
                    value={newCampaign.title}
                    onChange={(e) => setNewCampaign({ ...newCampaign, title: e.target.value })}
                    placeholder="Enter campaign title"
                    disabled={isLoading}
                    className="text-sm h-8"
                  />
                  {formErrors.title && <p className="text-red-500 text-xs">{formErrors.title}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="contactPerson" className="text-xs">Contact Person</Label>
                  <Input
                    id="contactPerson"
                    value={newCampaign.contactPerson}
                    onChange={(e) => setNewCampaign({ ...newCampaign, contactPerson: e.target.value })}
                    placeholder="Enter contact person name"
                    disabled={isLoading}
                    className="text-sm h-8"
                  />
                  {formErrors.contactPerson && <p className="text-red-500 text-xs">{formErrors.contactPerson}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="contactNumber" className="text-xs">Contact Number</Label>
                  <Input
                    id="contactNumber"
                    value={newCampaign.contactNumber}
                    onChange={(e) => setNewCampaign({ ...newCampaign, contactNumber: e.target.value })}
                    placeholder="Enter contact number"
                    disabled={isLoading}
                    className="text-sm h-8"
                  />
                  {formErrors.contactNumber && <p className="text-red-500 text-xs">{formErrors.contactNumber}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="location" className="text-xs">Location</Label>
                  <Input
                    id="location"
                    value={newCampaign.location}
                    onChange={(e) => setNewCampaign({ ...newCampaign, location: e.target.value })}
                    placeholder="Enter location"
                    disabled={isLoading}
                    className="text-sm h-8"
                  />
                  {formErrors.location && <p className="text-red-500 text-xs">{formErrors.location}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="startDate" className="text-xs">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={newCampaign.startDate}
                    onChange={(e) => setNewCampaign({ ...newCampaign, startDate: e.target.value })}
                    disabled={isLoading}
                    className="text-sm h-8"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="description" className="text-xs">Description</Label>
                  <Textarea
                    id="description"
                    value={newCampaign.description}
                    onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                    placeholder="Enter campaign description"
                    disabled={isLoading}
                    className="min-h-[60px] text-sm"
                  />
                  {formErrors.description && <p className="text-red-500 text-xs">{formErrors.description}</p>}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateCampaignModalOpen(false)}
                disabled={isLoading}
                className="text-sm py-1 px-3 h-8"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateCampaign}
                disabled={isLoading}
                className="text-sm py-1 px-3 h-8"
              >
                {isLoading ? "Creating..." : "Create Campaign"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <QChat />
    </div>
  );
};

export default CampaignDashboard;