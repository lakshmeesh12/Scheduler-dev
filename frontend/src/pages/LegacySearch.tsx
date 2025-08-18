
import { useState } from "react";
import { Search, Filter, Users, ArrowLeft, Briefcase, MapPin, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router-dom";

const LegacySearch = () => {
  const [filters, setFilters] = useState({
    skills: "",
    position: "",
    minExperience: "",
    maxExperience: "",
    minCtc: "",
    maxCtc: "",
    location: "",
    noticePeriod: ""
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      skills: "",
      position: "",
      minExperience: "",
      maxExperience: "",
      minCtc: "",
      maxCtc: "",
      location: "",
      noticePeriod: ""
    });
  };

  const handleSearch = () => {
    // TODO: Implement legacy search logic
    console.log("Searching with filters:", filters);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/" className="flex items-center text-gray-600 hover:text-gray-900 transition-colors">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to AI Search
              </Link>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Legacy Search</h1>
                  <p className="text-sm text-gray-600">Advanced Candidate Filtering</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center">
                    <Filter className="w-5 h-5 mr-2" />
                    Search Filters
                  </h3>
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Skills */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Skills
                  </label>
                  <Input
                    placeholder="e.g., React, Python, AWS"
                    value={filters.skills}
                    onChange={(e) => handleFilterChange("skills", e.target.value)}
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Position/Role
                  </label>
                  <Select value={filters.position} onValueChange={(value) => handleFilterChange("position", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="software-engineer">Software Engineer</SelectItem>
                      <SelectItem value="senior-software-engineer">Senior Software Engineer</SelectItem>
                      <SelectItem value="frontend-developer">Frontend Developer</SelectItem>
                      <SelectItem value="backend-developer">Backend Developer</SelectItem>
                      <SelectItem value="fullstack-developer">Full Stack Developer</SelectItem>
                      <SelectItem value="devops-engineer">DevOps Engineer</SelectItem>
                      <SelectItem value="data-scientist">Data Scientist</SelectItem>
                      <SelectItem value="product-manager">Product Manager</SelectItem>
                      <SelectItem value="ui-ux-designer">UI/UX Designer</SelectItem>
                      <SelectItem value="qa-engineer">QA Engineer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Experience Range */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Experience (Years)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Min"
                      type="number"
                      value={filters.minExperience}
                      onChange={(e) => handleFilterChange("minExperience", e.target.value)}
                    />
                    <Input
                      placeholder="Max"
                      type="number"
                      value={filters.maxExperience}
                      onChange={(e) => handleFilterChange("maxExperience", e.target.value)}
                    />
                  </div>
                </div>

                {/* CTC Range */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Current CTC (LPA)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Min"
                      type="number"
                      value={filters.minCtc}
                      onChange={(e) => handleFilterChange("minCtc", e.target.value)}
                    />
                    <Input
                      placeholder="Max"
                      type="number"
                      value={filters.maxCtc}
                      onChange={(e) => handleFilterChange("maxCtc", e.target.value)}
                    />
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Location
                  </label>
                  <Select value={filters.location} onValueChange={(value) => handleFilterChange("location", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bangalore">Bangalore</SelectItem>
                      <SelectItem value="mumbai">Mumbai</SelectItem>
                      <SelectItem value="delhi">Delhi</SelectItem>
                      <SelectItem value="pune">Pune</SelectItem>
                      <SelectItem value="hyderabad">Hyderabad</SelectItem>
                      <SelectItem value="chennai">Chennai</SelectItem>
                      <SelectItem value="kolkata">Kolkata</SelectItem>
                      <SelectItem value="ahmedabad">Ahmedabad</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notice Period */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Notice Period
                  </label>
                  <Select value={filters.noticePeriod} onValueChange={(value) => handleFilterChange("noticePeriod", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select notice period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Immediate</SelectItem>
                      <SelectItem value="15-days">15 Days</SelectItem>
                      <SelectItem value="1-month">1 Month</SelectItem>
                      <SelectItem value="2-months">2 Months</SelectItem>
                      <SelectItem value="3-months">3 Months</SelectItem>
                      <SelectItem value="more-than-3">More than 3 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleSearch} className="w-full bg-gray-800 hover:bg-gray-900 text-white">
                  <Search className="w-4 h-4 mr-2" />
                  Search Candidates
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results Area */}
          <div className="lg:col-span-3">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Search Results</h2>
              <p className="text-gray-600">Use the filters on the left to find candidates matching your criteria</p>
            </div>

            {/* Search Results Placeholder */}
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Search</h3>
                <p className="text-gray-600 mb-6">
                  Configure your search criteria using the filters on the left and click "Search Candidates" to find matching profiles.
                </p>
                <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4" />
                    <span>Advanced Filtering</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Briefcase className="w-4 h-4" />
                    <span>Professional Profiles</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>Real-time Results</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Example Results (when search is performed) */}
            <div className="mt-8 space-y-4 hidden">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                        JD
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">John Doe</h3>
                        <p className="text-gray-600">Senior Software Engineer</p>
                        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Briefcase className="w-4 h-4 mr-1" />
                            5 years exp
                          </span>
                          <span className="flex items-center">
                            <MapPin className="w-4 h-4 mr-1" />
                            Bangalore
                          </span>
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            ₹12 LPA
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="mb-2">Available</Badge>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-xs">React</Badge>
                        <Badge variant="outline" className="text-xs">Node.js</Badge>
                        <Badge variant="outline" className="text-xs">AWS</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegacySearch;
