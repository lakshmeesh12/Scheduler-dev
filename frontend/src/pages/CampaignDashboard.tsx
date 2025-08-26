import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Search, Plus, ArrowLeft, Building, MapPin, ChevronRight, User, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { fetchAllClients, Client, fetchAllManagerCampaigns, ManagerCampaignCreate, ManagerCampaign, createManagerCampaign, fetchAllCampaigns } from "@/api";
import QChat from "@/components/QChat"; // Added import

const CampaignDashboard = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [campaigns, setCampaigns] = useState<ManagerCampaign[]>([]);
  const [isCreateCampaignModalOpen, setIsCreateCampaignModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!clientId) {
      setError("No client ID provided in the URL");
      return;
    }

    loadClient();
    loadCampaigns();
  }, [clientId]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load campaigns");
    } finally {
      setIsLoading(false);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setIsLoading(false);
    }
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
      console.log(`Fetching jobs for clientId: ${clientId}, campaignId: ${campaignId}`);
      setIsLoading(true);
      setError(null);
      
      // Call the API to fetch jobs for this specific campaign
      const jobs = await fetchAllCampaigns(clientId, campaignId);
      console.log('Jobs fetched:', jobs);
      
      // Navigate to the campaign manager page with both IDs
      navigate(`/campaign-manager/${clientId}/${campaignId}`);
    } catch (err) {
      console.error('Error fetching campaign jobs:', err);
      setError(err instanceof Error ? err.message : "Failed to fetch campaign jobs");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <SidebarTrigger className="p-2" />
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <Building className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold gradient-text">
                  {selectedClient ? `${selectedClient.companyName} Campaigns` : "Campaign Dashboard"}
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
                    src={selectedClient.logoPath || "/default-logo.png"}
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
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
            </CardContent>
          </Card>
          {filteredCampaigns.length === 0 && !isLoading && !error && (
            <div className="text-center py-12">
              <Briefcase className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-xl font-medium text-gray-600 mb-2">No Campaigns Found</p>
              <p className="text-gray-500">Create your first campaign to get started.</p>
            </div>
          )}
          {filteredCampaigns.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCampaigns.map((campaign) => (
                <Card
                  key={campaign.id}
                  className="glass hover:shadow-lg transition-all duration-300 cursor-pointer hover:scale-105"
                  onClick={() => handleCampaignClick(campaign.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                        <Briefcase className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg">{campaign.title}</CardTitle>
                        <div className="flex items-center space-x-2 mt-1">
                          <User className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600">{campaign.contactPerson}</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600 line-clamp-2">{campaign.description}</p>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">{campaign.location}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex items-center justify-between text-sm">
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
          <Dialog open={isCreateCampaignModalOpen} onOpenChange={setIsCreateCampaignModalOpen}>
            <DialogContent className="sm:max-w-[800px]">
              <DialogHeader>
                <DialogTitle>Create New Campaign</DialogTitle>
                <DialogDescription>Create a new campaign for {selectedClient?.companyName}</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Campaign Title</Label>
                    <Input
                      id="title"
                      value={newCampaign.title}
                      onChange={(e) => setNewCampaign({ ...newCampaign, title: e.target.value })}
                      placeholder="Enter campaign title"
                      disabled={isLoading}
                    />
                    {formErrors.title && <p className="text-red-500 text-xs">{formErrors.title}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPerson">Contact Person</Label>
                    <Input
                      id="contactPerson"
                      value={newCampaign.contactPerson}
                      onChange={(e) => setNewCampaign({ ...newCampaign, contactPerson: e.target.value })}
                      placeholder="Enter contact person name"
                      disabled={isLoading}
                    />
                    {formErrors.contactPerson && <p className="text-red-500 text-xs">{formErrors.contactPerson}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactNumber">Contact Number</Label>
                    <Input
                      id="contactNumber"
                      value={newCampaign.contactNumber}
                      onChange={(e) => setNewCampaign({ ...newCampaign, contactNumber: e.target.value })}
                      placeholder="Enter contact number"
                      disabled={isLoading}
                    />
                    {formErrors.contactNumber && <p className="text-red-500 text-xs">{formErrors.contactNumber}</p>}
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
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={newCampaign.startDate}
                      onChange={(e) => setNewCampaign({ ...newCampaign, startDate: e.target.value })}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newCampaign.description}
                      onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                      placeholder="Enter campaign description"
                      disabled={isLoading}
                      className="min-h-[80px]"
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
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateCampaign} disabled={isLoading}>
                  {isLoading ? "Creating..." : "Create Campaign"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
      <QChat /> {/* Added QChat component */}
    </div>
  );
};

export default CampaignDashboard;