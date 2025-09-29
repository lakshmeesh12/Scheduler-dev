import { useState, useEffect, ReactNode, Component, ErrorInfo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Calendar, Eye, Users, Filter } from "lucide-react";
import { AggregatedScore, HiringCampaign } from "@/api";
import { SearchCandidateDetailModal } from "./CandidateModals";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-red-600 text-sm font-inter">
          <h2 className="text-lg font-semibold">Something went wrong.</h2>
          <p>Please try again or contact support.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const CandidateSearchResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { campaignId } = useParams<{ campaignId: string }>();
  const [selectedSearchCandidate, setSelectedSearchCandidate] = useState<AggregatedScore | null>(null);
  const [filteredResults, setFilteredResults] = useState<AggregatedScore[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    minMatch: "",
    maxMatch: "",
    skill: "",
    minRank: "",
    maxRank: "",
  });

  const searchResults: AggregatedScore[] = location.state?.searchResults || [];
  const jobTitle: string = location.state?.jobTitle || "Campaign";
  const clientId: string = location.state?.clientId || "";

  useEffect(() => {
    if (!location.state?.searchResults && campaignId) {
      navigate(`/candidate-search/${campaignId}`);
    }
    setFilteredResults(searchResults); // Initialize filtered results
  }, [location.state, navigate, campaignId, searchResults]);

  const handleViewProfile = (candidate: AggregatedScore) => {
    if (!candidate.profile_id) {
      console.error("Missing profile ID for candidate", candidate);
      return;
    }
    localStorage.setItem('selectedCandidate', JSON.stringify({ ...candidate, campaignId, campaignTitle: jobTitle }));
    navigate(`/candidate-details/${candidate.profile_id}`);
  };

  const handleScheduleInterview = (candidate: AggregatedScore) => {
    if (!campaignId) {
      console.error("Missing campaign ID");
      return;
    }
    if (!candidate.profile_id) {
      console.error("Missing profile ID for candidate", candidate);
      return;
    }
    sessionStorage.setItem('campaignId', campaignId);
    sessionStorage.setItem('clientId', clientId);
    const profileId = candidate.profile_id;
    navigate(`/schedule-interview/${profileId}`, {
      state: {
        candidate: {
          profile_id: profileId,
          name: candidate.resume_name,
        },
        campaign: {
          campaignId,
          campaignTitle: jobTitle,
        },
      },
    });
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    let results = [...searchResults];

    // Filter by overall match percentage
    if (filters.minMatch) {
      const min = parseFloat(filters.minMatch);
      results = results.filter((candidate) => Math.round(candidate.aggregated_score * 100) >= min);
    }
    if (filters.maxMatch) {
      const max = parseFloat(filters.maxMatch);
      results = results.filter((candidate) => Math.round(candidate.aggregated_score * 100) <= max);
    }

    // Filter by specific skill
    if (filters.skill) {
      results = results.filter((candidate) =>
        candidate.primary_vs_primary.matched_skills.some((skill) =>
          skill.toLowerCase().includes(filters.skill.toLowerCase())
        )
      );
    }

    // Filter by rank
    if (filters.minRank) {
      const min = parseInt(filters.minRank);
      results = results.filter((candidate) => candidate.rank >= min);
    }
    if (filters.maxRank) {
      const max = parseInt(filters.maxRank);
      results = results.filter((candidate) => candidate.rank <= max);
    }

    setFilteredResults(results);
  };

  const resetFilters = () => {
    setFilters({
      minMatch: "",
      maxMatch: "",
      skill: "",
      minRank: "",
      maxRank: "",
    });
    setFilteredResults(searchResults);
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden font-inter text-sm">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <SidebarTrigger className="p-2 text-gray-600 hover:text-gray-800" />
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Candidate Search Results
                </h1>
                <p className="text-xs text-gray-500">For {jobTitle}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-gray-300 hover:bg-gray-100"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
              >
                <Filter className="w-3 h-3 mr-1" /> Filters
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-gray-300 hover:bg-gray-100"
                onClick={() => navigate(-1)}
              >
                Back to Campaign
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {isFilterOpen && (
          <Card className="border-none shadow-sm bg-white/90 backdrop-blur-sm mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-md font-semibold text-gray-900">Filter Candidates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-gray-600">Min Overall Match (%)</Label>
                  <Input
                    type="number"
                    value={filters.minMatch}
                    onChange={(e) => handleFilterChange("minMatch", e.target.value)}
                    placeholder="e.g., 70"
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Max Overall Match (%)</Label>
                  <Input
                    type="number"
                    value={filters.maxMatch}
                    onChange={(e) => handleFilterChange("maxMatch", e.target.value)}
                    placeholder="e.g., 100"
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Skill</Label>
                  <Input
                    type="text"
                    value={filters.skill}
                    onChange={(e) => handleFilterChange("skill", e.target.value)}
                    placeholder="e.g., JavaScript"
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Min Rank</Label>
                  <Input
                    type="number"
                    value={filters.minRank}
                    onChange={(e) => handleFilterChange("minRank", e.target.value)}
                    placeholder="e.g., 1"
                    className="text-xs mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Max Rank</Label>
                  <Input
                    type="number"
                    value={filters.maxRank}
                    onChange={(e) => handleFilterChange("maxRank", e.target.value)}
                    placeholder="e.g., 10"
                    className="text-xs mt-1"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-gray-300 hover:bg-gray-100"
                  onClick={resetFilters}
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  className="text-xs bg-indigo-600 hover:bg-indigo-700"
                  onClick={applyFilters}
                >
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="border-none shadow-sm bg-white/90 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-gray-900">Candidate Search Results</CardTitle>
            <p className="text-xs text-gray-500">
              Found {filteredResults.length} matching candidates for {jobTitle}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {filteredResults.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {/* Header Row */}
                  <div className="grid grid-cols-12 gap-4 py-3 px-4 bg-gray-50 rounded-t-lg border-b border-gray-200">
                    <div className="col-span-2 text-xs font-medium text-gray-600">Rank</div>
                    <div className="col-span-4 text-xs font-medium text-gray-600">Candidate</div>
                    <div className="col-span-2 text-xs font-medium text-gray-600">Overall Match</div>
                    <div className="col-span-2 text-xs font-medium text-gray-600">Matched Skills</div>
                    <div className="col-span-2 text-xs font-medium text-gray-600">Actions</div>
                  </div>
                  
                  {filteredResults.map((candidate, index) => (
                    <div
                      key={candidate.profile_id || `candidate-${index}`}
                      className="grid grid-cols-12 gap-4 py-4 px-4 hover:bg-gray-50 transition-all duration-200 cursor-pointer border-b border-gray-100 last:border-b-0 group"
                      onClick={() => setSelectedSearchCandidate(candidate)}
                    >
                      {/* Rank */}
                      <div className="col-span-2 flex items-center">
                        <Badge className="bg-indigo-100 text-indigo-700 text-xs font-medium">
                          #{candidate.rank}
                        </Badge>
                      </div>
                      
                      {/* Candidate Info */}
                      <div className="col-span-4 flex flex-col justify-center">
                        <h3 className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {candidate.resume_name}
                        </h3>
                      </div>
                      
                      {/* Overall Match */}
                      <div className="col-span-2 flex items-center">
                        <span className="text-sm font-medium text-indigo-600">
                          {Math.round(candidate.aggregated_score * 100)}%
                        </span>
                      </div>
                      
                      {/* Matched Skills */}
                      <div className="col-span-2 flex flex-col justify-center">
                        {candidate.primary_vs_primary.matched_skills.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {candidate.primary_vs_primary.matched_skills.slice(0, 2).map((skill, skillIndex) => (
                              <Badge 
                                key={skillIndex} 
                                variant="secondary" 
                                className="text-xs bg-green-50 text-green-700 border-green-200 px-2 py-0.5"
                              >
                                {skill}
                              </Badge>
                            ))}
                            {candidate.primary_vs_primary.matched_skills.length > 2 && (
                              <Badge 
                                variant="secondary" 
                                className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5"
                              >
                                +{candidate.primary_vs_primary.matched_skills.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No matches</span>
                        )}
                      </div>
                      
                      {/* Actions */}
                      <div className="col-span-2 flex items-center space-x-2">
                        <Button
                          size="sm"
                          className="text-xs bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded-md shadow-sm transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewProfile(candidate);
                          }}
                        >
                          <Eye className="w-3 h-3 mr-1" /> View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs border-gray-300 hover:bg-gray-100 px-2.5 py-1 rounded-md shadow-sm transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleScheduleInterview(candidate);
                          }}
                        >
                          <Calendar className="w-3 h-3 mr-1" /> Schedule
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-600 mb-1">No Candidates Found</p>
                  <p className="text-xs text-gray-400">No matching candidates found for this campaign.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
      {selectedSearchCandidate && (
        <ErrorBoundary>
          <SearchCandidateDetailModal
            candidate={selectedSearchCandidate}
            onClose={() => setSelectedSearchCandidate(null)}
            handleViewProfile={handleViewProfile}
            handleScheduleInterview={handleScheduleInterview}
            selectedCampaign={{ id: campaignId || "", jobTitle } as HiringCampaign}
          />
        </ErrorBoundary>
      )}
    </div>
  );
};

export default CandidateSearchResults;