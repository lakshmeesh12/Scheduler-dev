import { useState, useEffect } from "react";
import { Search, Users, UserPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { fetchUsers, savePanelSelection, User } from "@/api";

interface PanelSelectionProps {
  onSave: (panel: User[]) => void;
  initialPanel?: User[];
  context?: "new" | "replace";
}

export const PanelSelection = ({ onSave, initialPanel = [], context = "new" }: PanelSelectionProps) => {
  const [selectionMode, setSelectionMode] = useState<"role" | "manual">("role");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [availableMembers, setAvailableMembers] = useState<User[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<User[]>(initialPanel);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Map roles to job titles from backend
  const predefinedPanels: { [key: string]: string[] } = {
    frontend: ["Technical Lead", "Senior Developer", "UI/UX Designer"],
    backend: ["Technical Lead", "Engineering Manager", "DevOps Engineer"],
    fullstack: ["Technical Lead", "Senior Developer", "Engineering Manager", "QA Engineer"],
    product: ["Product Manager", "Engineering Manager", "HR Manager"],
  };

  // Fetch users from backend
  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      try {
        const users = await fetchUsers();
        setAvailableMembers(users);
      } catch {
        setError("Failed to load panel members. Please try again.");
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not fetch panel members. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, [toast]);

  const getDisplayName = (member: User) => {
    if (member.given_name && member.surname) {
      return `${member.given_name} ${member.surname}`;
    }
    return member.display_name || member.email;
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const handleRoleSelection = (role: string) => {
    setSelectedRole(role);
    const jobTitles = predefinedPanels[role] || [];
    const panel = availableMembers.filter((m) => jobTitles.includes(m.job_title || ""));
    setSelectedMembers(panel);
  };

  const handleMemberToggle = (member: User) => {
    setSelectedMembers((prev) => {
      const isSelected = prev.some((m) => m.user_id === member.user_id);
      return isSelected ? prev.filter((m) => m.user_id !== member.user_id) : [...prev, member];
    });
  };

  const filteredMembers = availableMembers.filter((member) => {
    const name = getDisplayName(member).toLowerCase();
    const email = member.email.toLowerCase();
    const role = member.job_title?.toLowerCase() || "";
    return (
      name.includes(searchQuery.toLowerCase()) ||
      email.includes(searchQuery.toLowerCase()) ||
      role.includes(searchQuery.toLowerCase())
    );
  });

  const handleSave = async () => {
    if (selectedMembers.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select at least one panel member.",
      });
      return;
    }

    setLoading(true);
    try {
      if (context === "new") {
        const userIds = selectedMembers.map((m) => m.user_id);
        const createdBy = sessionStorage.getItem("user_id");
        console.log("user_id from localStorage:", createdBy);
        if (!createdBy) {
          console.log("No user_id found, redirecting to login");
          toast({
            variant: "destructive",
            title: "Error",
            description: "User not logged in. Redirecting to login...",
          });
          navigate("/");
          return;
        }
        const sessionId = await savePanelSelection(userIds, createdBy);

        localStorage.setItem("session_id", sessionId);

        toast({
          title: "Success",
          description: `Panel selection saved (Session ID: ${sessionId})`,
        });
      }

      onSave(selectedMembers);
    } catch (err) {
      console.error("Error saving panel selection:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save panel selection.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Selection Mode */}
      <div className="flex gap-4">
        <Button
          variant={selectionMode === "role" ? "default" : "outline"}
          onClick={() => setSelectionMode("role")}
          className="flex-1 text-sm h-8"
        >
          <Users className="w-3 h-3 mr-1" />
          Select by Role
        </Button>
        <Button
          variant={selectionMode === "manual" ? "default" : "outline"}
          onClick={() => setSelectionMode("manual")}
          className="flex-1 text-sm h-8"
        >
          <UserPlus className="w-3 h-3 mr-1" />
          Manual Selection
        </Button>
      </div>

      {error && <p className="text-red-600 text-xs">{error}</p>}
      {loading && <p className="text-gray-500 text-xs">Loading...</p>}

      {/* Role-based Selection */}
      {selectionMode === "role" && !loading && (
        <Card className="glass border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-blue-700">Select Panel by Job Role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select onValueChange={handleRoleSelection}>
              <SelectTrigger className="text-sm h-8">
                <SelectValue placeholder="Choose a job role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="frontend">Frontend Developer</SelectItem>
                <SelectItem value="backend">Backend Engineer</SelectItem>
                <SelectItem value="fullstack">Full Stack Developer</SelectItem>
                <SelectItem value="product">Product Manager</SelectItem>
              </SelectContent>
            </Select>

            {selectedRole && (
              <div className="mt-4">
                <h4 className="font-medium text-sm text-blue-700 mb-3">Assigned Panel Members:</h4>
                <div className="grid gap-3">
                  {selectedMembers.map((member) => (
                    <div
                      key={member.user_id}
                      className="flex items-center p-3 bg-blue-50 rounded-lg border border-blue-200"
                    >
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-medium mr-3">
                        {getInitials(getDisplayName(member))}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-800">{getDisplayName(member)}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                      <Badge variant="secondary" className="text-xs">{member.job_title || "Unknown Role"}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manual Selection */}
      {selectionMode === "manual" && !loading && (
        <Card className="glass border-purple-200">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-purple-700">Manual Panel Selection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
              <Input
                placeholder="Search panel members by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 text-sm h-8"
              />
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {filteredMembers.map((member) => {
                const isSelected = selectedMembers.some((m) => m.user_id === member.user_id);
                return (
                  <div
                    key={member.user_id}
                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-purple-50 border-purple-200 shadow-sm"
                        : "bg-white border-gray-200 hover:bg-gray-50"
                    }`}
                    onClick={() => handleMemberToggle(member)}
                  >
                    <Checkbox checked={isSelected} onChange={() => handleMemberToggle(member)} className="mr-3" />
                    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-medium mr-3">
                      {getInitials(getDisplayName(member))}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-800">{getDisplayName(member)}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{member.job_title || "Unknown Role"}</Badge>
                    {isSelected && <Check className="w-4 h-4 text-purple-600 ml-2" />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Panel Summary */}
      {selectedMembers.length > 0 && (
        <Card className="glass border-green-200">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-green-700">
              Selected Panel ({selectedMembers.length} members)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedMembers.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center bg-green-50 px-3 py-1 rounded-full border border-green-200"
                >
                  <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-medium mr-2">
                    {getInitials(getDisplayName(member))}
                  </div>
                  <span className="text-sm font-medium">{getDisplayName(member)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-700 text-sm py-1 px-3 h-8"
                disabled={loading || selectedMembers.length === 0}
              >
                <Check className="w-3 h-3 mr-1" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};