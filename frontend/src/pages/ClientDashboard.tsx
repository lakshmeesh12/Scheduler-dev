import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Plus, Building, MapPin, ChevronRight, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { fetchAllClients, createClient, Client, ClientCreate } from "@/api";
import QChat from "@/components/QChat"; // Added import

const ClientDashboard = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [isCreateClientModalOpen, setIsCreateClientModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newClient, setNewClient] = useState<ClientCreate>({
    companyName: "",
    description: "",
    location: "",
    industry: "",
    logo: undefined
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    const loadClients = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchAllClients();
        console.log("Fetched clients:", data);
        setClients(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load clients';
        console.error("Error fetching clients:", errorMessage);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };
    loadClients();
  }, []);

  const handleCreateClient = async () => {
    console.log("Starting client creation with data:", newClient);
    const errors: { [key: string]: string } = {};
    if (!newClient.companyName.trim()) errors.companyName = "Company name is required";
    if (!newClient.description.trim()) errors.description = "Description is required";
    if (!newClient.location.trim()) errors.location = "Location is required";
    if (!newClient.industry.trim()) errors.industry = "Industry is required";
    if (newClient.logo && !['image/jpeg', 'image/jpg', 'image/png'].includes(newClient.logo.type)) {
      errors.logo = "Logo must be a JPEG, JPG, or PNG file";
    }
    if (Object.keys(errors).length > 0) {
      console.error("Form validation errors:", errors);
      setFormErrors(errors);
      return;
    }
    setIsLoading(true);
    try {
      const createdClient = await createClient(newClient);
      console.log("Client created successfully:", createdClient);
      setClients([...clients, createdClient]);
      setNewClient({ companyName: "", description: "", location: "", industry: "", logo: undefined });
      setLogoPreview(null);
      setFormErrors({});
      setIsCreateClientModalOpen(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create client';
      console.error("Error creating client:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log("Logo file selected:", file);
    if (file) {
      setNewClient({ ...newClient, logo: file });
      setLogoPreview(URL.createObjectURL(file));
    } else {
      setNewClient({ ...newClient, logo: undefined });
      setLogoPreview(null);
    }
    setFormErrors({ ...formErrors, logo: "" });
  };

  const handleLogoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    console.log("Logo file dropped:", file);
    if (file && ['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setNewClient({ ...newClient, logo: file });
      setLogoPreview(URL.createObjectURL(file));
      setFormErrors({ ...formErrors, logo: "" });
    } else {
      setFormErrors({ ...formErrors, logo: "Please drop a valid JPEG, JPG, or PNG file" });
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
                <h1 className="text-2xl font-bold gradient-text">Clients</h1>
                <p className="text-sm text-gray-600">Enterprise Hiring Management</p>
              </div>
            </div>
            <Button
              onClick={() => setIsCreateClientModalOpen(true)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              disabled={isLoading}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Client
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {isLoading && <p className="text-center">Loading...</p>}
        {error && <p className="text-center text-red-500">{error}</p>}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients
              .filter(client => client.companyName.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((client) => (
                <Card
                  key={client.id}
                  className="glass hover:shadow-lg transition-all duration-300 cursor-pointer hover:scale-105"
                  onClick={() => navigate(`/campaign-dashboard/${client.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center space-x-3">
                      <img
                        src={client.logoPath || '/default-logo.png'}
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
          <Dialog open={isCreateClientModalOpen} onOpenChange={setIsCreateClientModalOpen}>
            <DialogContent className="sm:max-w-[800px]">
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
                <DialogDescription>
                  Create a new client to manage hiring campaigns
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="grid grid-cols-2 gap-4">
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
                      className="min-h-[80px]"
                    />
                    {formErrors.description && <p className="text-red-500 text-xs">{formErrors.description}</p>}
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Company Logo</Label>
                    <div
                      className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-500 transition-colors"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleLogoDrop}
                    >
                      {logoPreview ? (
                        <div className="flex flex-col items-center">
                          <img src={logoPreview} alt="Logo preview" className="w-24 h-24 object-contain mb-2" />
                          <Button
                            variant="outline"
                            onClick={() => {
                              setNewClient({ ...newClient, logo: undefined });
                              setLogoPreview(null);
                            }}
                            disabled={isLoading}
                          >
                            Remove Logo
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center space-y-2">
                          <Upload className="w-8 h-8 text-gray-400" />
                          <p className="text-sm text-gray-600">Drag and drop logo here or click to upload</p>
                          <p className="text-xs text-gray-500">Supports JPEG, JPG, PNG</p>
                          <input
                            type="file"
                            id="logo"
                            accept="image/jpeg,image/jpg,image/png"
                            onChange={handleLogoChange}
                            className="hidden"
                            disabled={isLoading}
                          />
                          <label htmlFor="logo">
                            <Button asChild disabled={isLoading}>
                              <span>Choose File</span>
                            </Button>
                          </label>
                        </div>
                      )}
                    </div>
                    {formErrors.logo && <p className="text-red-500 text-xs">{formErrors.logo}</p>}
                  </div>
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
      </main>
      <QChat /> {/* Added QChat component */}
    </div>
  );
};

export default ClientDashboard;