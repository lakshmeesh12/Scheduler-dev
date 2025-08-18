import { useState } from "react";
import { Calendar, Clock, Users, ChevronRight, Search, Filter, CheckCircle, XCircle, Clock as PendingClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";

interface EventDetails {
  id: string;
  candidateId: string;
  candidateName: string;
  position: string;
  scheduledDate: string;
  duration: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  candidateResponse: 'accepted' | 'declined' | 'pending';
  panelResponse: {
    [memberId: string]: {
      name: string;
      response: 'accepted' | 'declined' | 'pending';
      responseDate?: string;
    };
  };
  eventType: 'interview' | 'meeting' | 'screening';
  round: number;
  lastActivity: string;
}

const EventTrackerList = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");

  const [events] = useState<EventDetails[]>([
    {
      id: "1",
      candidateId: "1",
      candidateName: "Sarah Johnson",
      position: "Senior Frontend Developer",
      scheduledDate: "2025-08-16 10:00 AM",
      duration: "45 minutes",
      status: 'upcoming',
      candidateResponse: 'accepted',
      panelResponse: {
        '1': { name: 'John Smith', response: 'accepted', responseDate: '2025-08-14' },
        '2': { name: 'Michael Chen', response: 'pending' },
      },
      eventType: 'interview',
      round: 2,
      lastActivity: "2025-08-14",
    },
    {
      id: "2",
      candidateId: "2",
      candidateName: "Michael Chen",
      position: "Backend Engineer",
      scheduledDate: "2025-08-15 2:00 PM",
      duration: "60 minutes",
      status: 'upcoming',
      candidateResponse: 'pending',
      panelResponse: {
        '1': { name: 'Sarah Johnson', response: 'accepted', responseDate: '2025-08-13' },
        '3': { name: 'Tech Lead', response: 'accepted', responseDate: '2025-08-13' },
      },
      eventType: 'interview',
      round: 1,
      lastActivity: "2025-08-13",
    },
    {
      id: "3",
      candidateId: "3",
      candidateName: "Emily Rodriguez",
      position: "Full Stack Developer",
      scheduledDate: "2025-08-12 3:00 PM",
      duration: "45 minutes",
      status: 'completed',
      candidateResponse: 'accepted',
      panelResponse: {
        '1': { name: 'John Smith', response: 'accepted', responseDate: '2025-08-11' },
        '2': { name: 'Sarah Johnson', response: 'accepted', responseDate: '2025-08-11' },
      },
      eventType: 'interview',
      round: 3,
      lastActivity: "2025-08-12",
    },
    {
      id: "4",
      candidateId: "4",
      candidateName: "Alex Thompson",
      position: "DevOps Engineer",
      scheduledDate: "2025-08-18 11:00 AM",
      duration: "30 minutes",
      status: 'upcoming',
      candidateResponse: 'pending',
      panelResponse: {
        '4': { name: 'DevOps Lead', response: 'declined', responseDate: '2025-08-13' },
        '5': { name: 'System Architect', response: 'pending' },
      },
      eventType: 'screening',
      round: 1,
      lastActivity: "2025-08-13",
    },
  ]);

  const filterEventsByTab = (events: EventDetails[], tab: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (tab) {
      case 'upcoming':
        return events.filter(event => {
          const eventDate = new Date(event.scheduledDate);
          return eventDate > now && event.status !== 'cancelled';
        });
      case 'today':
        return events.filter(event => {
          const eventDate = new Date(event.scheduledDate);
          const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
          return eventDay.getTime() === today.getTime() && event.status !== 'cancelled';
        });
      case 'past':
        return events.filter(event => {
          const eventDate = new Date(event.scheduledDate);
          return eventDate < now || event.status === 'completed';
        });
      default:
        return events;
    }
  };

  const filteredEvents = filterEventsByTab(events, activeTab).filter(event => {
    const matchesSearch = event.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         event.position.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || event.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      case 'ongoing': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getResponseIcon = (response: string) => {
    switch (response) {
      case 'accepted': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'declined': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending': return <PendingClock className="w-4 h-4 text-yellow-600" />;
      default: return <PendingClock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getPanelResponseSummary = (panelResponse: EventDetails['panelResponse']) => {
    const responses = Object.values(panelResponse);
    const accepted = responses.filter(r => r.response === 'accepted').length;
    const declined = responses.filter(r => r.response === 'declined').length;
    const pending = responses.filter(r => r.response === 'pending').length;
    const total = responses.length;

    return { accepted, declined, pending, total };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Event Tracker</h1>
            <p className="text-muted-foreground">Track all interview events and panel responses</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Upcoming</p>
                  <p className="text-2xl font-bold">{filterEventsByTab(events, 'upcoming').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Today</p>
                  <p className="text-2xl font-bold">{filterEventsByTab(events, 'today').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{events.filter(e => e.status === 'completed').length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Events</p>
                  <p className="text-2xl font-bold">{events.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by candidate name or position..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="glass"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48 glass">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="glass">
            <TabsTrigger value="all">All Events</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            {/* Event List */}
            {filteredEvents.map((event) => {
              const panelSummary = getPanelResponseSummary(event.panelResponse);
              
              return (
                <Card key={event.id} className="glass-card hover-lift">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-lg">
                              {event.candidateName.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <h3 className="text-lg font-semibold">{event.candidateName}</h3>
                              <Badge className={getStatusColor(event.status)} variant="secondary">
                                {event.status}
                              </Badge>
                              <Badge variant="outline">
                                Round {event.round}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground">{event.position}</p>
                            <div className="flex items-center space-x-4 mt-1">
                              <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                                <Calendar className="w-4 h-4" />
                                <span>{event.scheduledDate}</span>
                              </div>
                              <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                <span>{event.duration}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-6">
                        {/* Candidate Response */}
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Candidate</p>
                          <div className="flex items-center space-x-1">
                            {getResponseIcon(event.candidateResponse)}
                            <span className="text-sm font-medium capitalize">{event.candidateResponse}</span>
                          </div>
                        </div>

                        {/* Panel Response Summary */}
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Panel ({panelSummary.total})</p>
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-1">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-sm">{panelSummary.accepted}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <XCircle className="w-4 h-4 text-red-600" />
                              <span className="text-sm">{panelSummary.declined}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <PendingClock className="w-4 h-4 text-yellow-600" />
                              <span className="text-sm">{panelSummary.pending}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action */}
                        <Link to={`/event-tracker/${event.id}`}>
                          <Button variant="outline" className="glass">
                            <span className="mr-2">View Details</span>
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {filteredEvents.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">No Events Found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== "all" 
                    ? "No events match your current filters." 
                    : `No ${activeTab === 'all' ? '' : activeTab + ' '}events found.`}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default EventTrackerList;