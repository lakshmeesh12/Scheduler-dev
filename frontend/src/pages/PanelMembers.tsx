import { useState } from "react";
import { Plus, Users, Mail, Phone, Edit, Trash2, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface PanelMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  level: 'junior' | 'mid' | 'senior' | 'lead';
  skills: string[];
  isActive: boolean;
}

const PanelMembers = () => {
  const [panelMembers, setPanelMembers] = useState<PanelMember[]>([
    {
      id: "1",
      name: "John Smith",
      email: "john.smith@company.com",
      phone: "+1-555-0101",
      role: "Senior Software Engineer",
      department: "Engineering",
      level: "senior",
      skills: ["React", "Node.js", "TypeScript", "AWS"],
      isActive: true,
    },
    {
      id: "2",
      name: "Sarah Johnson",
      email: "sarah.johnson@company.com",
      phone: "+1-555-0102",
      role: "Product Manager",
      department: "Product",
      level: "mid",
      skills: ["Product Strategy", "Agile", "Data Analysis"],
      isActive: true,
    },
    {
      id: "3",
      name: "Michael Chen",
      email: "michael.chen@company.com",
      phone: "+1-555-0103",
      role: "Tech Lead",
      department: "Engineering",
      level: "lead",
      skills: ["System Design", "Python", "DevOps", "Mentoring"],
      isActive: true,
    },
  ]);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<PanelMember | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const { toast } = useToast();

  const [newMember, setNewMember] = useState<Partial<PanelMember>>({
    name: "",
    email: "",
    phone: "",
    role: "",
    department: "",
    level: "mid",
    skills: [],
    isActive: true,
  });

  const departments = Array.from(new Set(panelMembers.map(m => m.department)));

  const filteredMembers = panelMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         member.role.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = filterDepartment === "all" || member.department === filterDepartment;
    return matchesSearch && matchesDepartment;
  });

  const handleAddMember = () => {
    if (!newMember.name || !newMember.email || !newMember.role) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const member: PanelMember = {
      id: Date.now().toString(),
      name: newMember.name!,
      email: newMember.email!,
      phone: newMember.phone || "",
      role: newMember.role!,
      department: newMember.department || "General",
      level: newMember.level || "mid",
      skills: newMember.skills || [],
      isActive: true,
    };

    setPanelMembers(prev => [...prev, member]);
    setNewMember({
      name: "",
      email: "",
      phone: "",
      role: "",
      department: "",
      level: "mid",
      skills: [],
      isActive: true,
    });
    setIsAddDialogOpen(false);

    toast({
      title: "Panel Member Added",
      description: `${member.name} has been added to the panel.`,
    });
  };

  const handleToggleActive = (id: string) => {
    setPanelMembers(prev =>
      prev.map(member =>
        member.id === id ? { ...member, isActive: !member.isActive } : member
      )
    );
  };

  const handleDelete = (id: string) => {
    setPanelMembers(prev => prev.filter(member => member.id !== id));
    toast({
      title: "Panel Member Removed",
      description: "The panel member has been removed successfully.",
    });
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'junior': return 'bg-green-100 text-green-800';
      case 'mid': return 'bg-blue-100 text-blue-800';
      case 'senior': return 'bg-purple-100 text-purple-800';
      case 'lead': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Panel Members</h1>
            <p className="text-muted-foreground">Manage your interview panel members</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Panel Member
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Panel Member</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={newMember.name || ""}
                      onChange={(e) => setNewMember(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newMember.email || ""}
                      onChange={(e) => setNewMember(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Enter email address"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={newMember.phone || ""}
                      onChange={(e) => setNewMember(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role *</Label>
                    <Input
                      id="role"
                      value={newMember.role || ""}
                      onChange={(e) => setNewMember(prev => ({ ...prev, role: e.target.value }))}
                      placeholder="Enter job role"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={newMember.department || ""}
                      onChange={(e) => setNewMember(prev => ({ ...prev, department: e.target.value }))}
                      placeholder="Enter department"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="level">Level</Label>
                    <Select value={newMember.level} onValueChange={(value) => setNewMember(prev => ({ ...prev, level: value as any }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="junior">Junior</SelectItem>
                        <SelectItem value="mid">Mid Level</SelectItem>
                        <SelectItem value="senior">Senior</SelectItem>
                        <SelectItem value="lead">Lead</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddMember}>
                    Add Member
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search members by name, email, or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="glass"
                />
              </div>
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger className="w-48 glass">
                  <SelectValue placeholder="Filter by department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Members Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((member) => (
            <Card key={member.id} className={`glass-card hover-lift ${!member.isActive ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-lg">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <div>
                      <CardTitle className="text-lg">{member.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{member.role}</p>
                    </div>
                  </div>
                  <Badge 
                    className={getLevelColor(member.level)}
                    variant="secondary"
                  >
                    {member.level}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Building className="w-4 h-4" />
                  <span>{member.department}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{member.email}</span>
                </div>
                {member.phone && (
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{member.phone}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {member.skills.slice(0, 3).map((skill) => (
                    <Badge key={skill} variant="outline" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {member.skills.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{member.skills.length - 3} more
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(member.id)}
                      className={member.isActive ? "text-green-600" : "text-red-600"}
                    >
                      {member.isActive ? "Active" : "Inactive"}
                    </Button>
                  </div>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDelete(member.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredMembers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No Panel Members Found</h3>
            <p className="text-muted-foreground">
              {searchQuery || filterDepartment !== "all" 
                ? "No members match your current filters." 
                : "Start by adding your first panel member."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PanelMembers;