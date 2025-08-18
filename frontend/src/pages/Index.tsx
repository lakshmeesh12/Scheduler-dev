import { useState, useMemo, useRef, useEffect } from "react";
import { Search, Plus, Users, Filter, SortDesc, MoreHorizontal, Sparkles, Briefcase, MapPin, Clock, Upload, X, FileText, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { fetchMatchingResumes } from '@/api';
import { SidebarTrigger } from "@/components/ui/sidebar";
interface Candidate {
  resume_id: string;
  resume_name: string;
  aggregated_score: number;
  primary_vs_primary: {
    matched_skills: string[];
    missing_skills: string[];
    total_matched: number;
    total_required: number;
    match_percentage: number;
  };
  rank: number;
}
const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searchResponse, setSearchResponse] = useState("");
  const [error, setError] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState({
    total_experience: null as [number, number] | null, // null means no filter applied
    location: "",
  });
  const [filtersApplied, setFiltersApplied] = useState(false); // Track if filters are applied
  const [sortBy, setSortBy] = useState<"match_score" | "total_experience">("match_score");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
 
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'].includes(file.type)) {
      setUploadedFile(file);
      setError("");
    } else {
      setError("Please upload a valid file (.pdf, .doc, .docx, or .txt)");
    }
  };
  const removeFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  const handleSearch = async () => {
    if (!searchQuery.trim() && !uploadedFile) {
      setError("Please enter a job description or upload a JD file.");
      return;
    }
    setIsLoading(true);
    setError("");
    setCandidates([]);
    setSearchResponse("");
    try {
      const formData = new FormData();
      if (searchQuery.trim()) {
        formData.append("job_description", searchQuery);
      }
      if (uploadedFile) {
        setIsAnalyzingFile(true);
        formData.append("file", uploadedFile);
      }
      console.log("Index: Sending /find-match request with:", { job_description: searchQuery, file: uploadedFile?.name });
      const response = await fetchMatchingResumes(formData);
      console.log("Index: /find-match response:", response);
      setCandidates(response.matching_results);
      setSearchResponse(
        uploadedFile
          ? `Based on your job description file for "${response.job_title}", I found ${response.total_resumes_processed} matching candidates.`
          : `Based on your job description for "${response.job_title}", I found ${response.total_resumes_processed} matching candidates.`
      );
    } catch (err) {
      console.error("Index: Error fetching matching resumes:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch matching resumes.");
    } finally {
      setIsLoading(false);
      setIsAnalyzingFile(false);
    }
  };
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };
  const renderResponse = (response: string) => {
    return response
      .replace(/\*\*([^\*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br />")
      .replace(/(?:-|\*)\s+([^\n]+)/g, "<li>$1</li>")
      .replace(/(<li>.*?(?:<li>.*?(?:<br \/>|$))*)/g, "<ul class='list-disc pl-5'>$1</ul>")
      .replace(/<br \/><ul/g, "<ul")
      .replace(/<\/ul><br \/>/g, "</ul>");
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const measurerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    adjustHeight();
  }, [searchQuery]);

  const adjustHeight = () => {
    if (measurerRef.current && textareaRef.current) {
      const textarea = textareaRef.current;
      const measurer = measurerRef.current;

      // Set content to value or placeholder
      measurer.textContent = searchQuery || textarea.placeholder;

      // Add a newline to account for potential last line
      measurer.appendChild(document.createElement('br'));

      // Match styles
      const styles = window.getComputedStyle(textarea);
      measurer.style.fontSize = styles.fontSize;
      measurer.style.fontFamily = styles.fontFamily;
      measurer.style.fontWeight = styles.fontWeight;
      measurer.style.letterSpacing = styles.letterSpacing;
      measurer.style.lineHeight = styles.lineHeight;
      measurer.style.padding = styles.padding;
      measurer.style.width = styles.width;
      measurer.style.whiteSpace = 'pre-wrap';
      measurer.style.wordBreak = 'break-word';
      measurer.style.overflowWrap = 'break-word';

      const maxHeight = 120; // px
      const minHeight = 48; // px
      let newHeight = measurer.scrollHeight;
      newHeight = Math.max(newHeight, minHeight);
      newHeight = Math.min(newHeight, maxHeight);

      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY = newHeight >= maxHeight ? 'auto' : 'hidden';
    }
  };

  const uniqueLocations = useMemo(() => {
    // Location not available in API response, using placeholder
    return ["any", "Remote", "Bangalore", "Hyderabad", "Pune"];
  }, []);
  const filteredAndSortedCandidates = useMemo(() => {
    let result = [...candidates];
    if (filtersApplied && filters.total_experience) {
      result = result.filter((candidate) => {
        const experience = candidate.aggregated_score * 20; // Normalize to 0-20 years
        return experience >= filters.total_experience![0] && experience <= filters.total_experience![1];
        // Location filter not applied since location data isn't in API response
      });
    }
    result.sort((a, b) => {
      let valueA: number, valueB: number;
      if (sortBy === "match_score") {
        valueA = a.aggregated_score;
        valueB = b.aggregated_score;
      } else {
        valueA = a.aggregated_score * 20; // Normalize for experience
        valueB = b.aggregated_score * 20;
      }
      return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
    });
    return result;
  }, [candidates, filters, filtersApplied, sortBy, sortDirection]);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <SidebarTrigger className="p-2" />
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center animate-glow">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold gradient-text">QHub</h1>
                <p className="text-sm text-gray-600">Enterprise Candidate Search</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/hiring-campaign-tracker">
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Hiring Campaign Tracker
                </Button>
              </Link>
              <Badge variant="outline" className="glass border-blue-200 text-blue-700">
                <Sparkles className="w-3 h-3 mr-1" />
                AI Powered
              </Badge>
              <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                JD
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero Search Section */}
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold gradient-text mb-4">
            Find Your Perfect Candidate
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Use natural language or upload a job description to find matching candidates with AI-powered matching
          </p>
          {/* Search Interface */}
          <div className="max-w-4xl mx-auto relative">
            <div className={`glass-card p-6 transition-all duration-500 ${isSearchFocused ? "animate-glow scale-105" : ""}`}>
              <div className="relative flex items-center">
                <Search className="absolute left-4 top-4 text-gray-400 w-5 h-5" />
                <textarea
                  ref={textareaRef}
                  placeholder="Describe the role: e.g., 'Senior React Developer with 5+ years experience, knowledge of TypeScript and Node.js'"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSearch()}
                  className="pl-12 pr-48 py-4 text-lg border-0 bg-transparent focus:ring-0 focus:outline-none rounded-lg w-full min-h-[48px] resize-none overflow-hidden"
                  disabled={isLoading}
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                  <Button
                    onClick={handleSearch}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all duration-300 hover:scale-105"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Search
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload">
                    <Button
                      type="button"
                      variant="outline"
                      className="cursor-pointer glass border-gray-200 hover:scale-105 transition-all duration-300"
                      disabled={isLoading}
                      onClick={() => fileInputRef.current?.click()} // Programmatically trigger file input
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload JD
                    </Button>
                  </label>
                </div>
              </div>
              {/* Hidden measurer */}
              <div
                ref={measurerRef}
                className="absolute top-[-9999px] left-[-9999px] invisible pointer-events-none"
                style={{ position: 'absolute', visibility: 'hidden' }}
              />
              {/* File Upload Display */}
              <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-center space-x-4">
                {uploadedFile && (
                  <div className="flex items-center space-x-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm">{uploadedFile.name}</span>
                    <button
                      onClick={removeFile}
                      className="hover:text-red-600 transition-colors"
                      disabled={isLoading}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {isAnalyzingFile && (
                  <div className="text-center">
                    <p className="text-sm text-blue-600">Analyzing job description...</p>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4">
              <Link
                to="/legacy-search"
                className="text-sm text-blue-600 hover:text-blue-800 underline underline-offset-4 transition-colors duration-200"
              >
                Switch to Legacy Search →
              </Link>
            </div>
          </div>
          {/* Search Response */}
          {searchResponse && (
            <div className="mt-6 max-w-4xl mx-auto glass-card p-6 rounded-lg">
              <div
                className="text-gray-700 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: renderResponse(searchResponse) }}
              />
            </div>
          )}
          {/* Error */}
          {error && (
            <div className="mt-6 max-w-4xl mx-auto glass-card p-6 text-red-600">
              {error}
            </div>
          )}
        </div>
        {/* Controls Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex items-center space-x-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="glass border-gray-200 hover:scale-105 transition-all duration-300">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card bg-white/60 backdrop-blur-md border border-gray-200/50 max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold text-gray-800">Filter Candidates</DialogTitle>
                </DialogHeader>
                <div className="space-y-8 py-6">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Total Experience (Years)</Label>
                    <div className="flex items-center space-x-4 mt-3">
                      <Slider
                        value={filters.total_experience || [0, 20]}
                        onValueChange={(value) => setFilters((prev) => ({ ...prev, total_experience: value as [number, number] }))}
                        min={0}
                        max={20}
                        step={0.5}
                        className="flex-1 custom-slider"
                      />
                      <span className="text-sm text-gray-600 font-medium">
                        {filters.total_experience ? `${filters.total_experience[0]} - ${filters.total_experience[1]} years` : "Any"}
                      </span>
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      <span>Drag either thumb to adjust range</span>
                      <span>0 - 20 years</span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Location</Label>
                    <Select
                      value={filters.location}
                      onValueChange={(value) => setFilters((prev) => ({ ...prev, location: value }))}
                    >
                      <SelectTrigger className="glass border-gray-200/50 bg-white/50 mt-2">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent className="glass-card bg-white/90 backdrop-blur-sm border-gray-200/50">
                        {uniqueLocations.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {loc === "any" ? "Any" : loc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFilters({ total_experience: null, location: "" });
                        setFiltersApplied(false);
                      }}
                      className="glass border-gray-200"
                    >
                      Clear Filters
                    </Button>
                    <Button
                      onClick={() => setFiltersApplied(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Apply Filters
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Select
              value={`${sortBy}:${sortDirection}`}
              onValueChange={(value) => {
                const [by, direction] = value.split(":") as ["match_score" | "total_experience", "asc" | "desc"];
                setSortBy(by);
                setSortDirection(direction);
              }}
            >
              <SelectTrigger className="glass border-gray-200 w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="match_score:desc">Match Score (High to Low)</SelectItem>
                <SelectItem value="match_score:asc">Match Score (Low to High)</SelectItem>
                <SelectItem value="total_experience:desc">Experience (High to Low)</SelectItem>
                <SelectItem value="total_experience:asc">Experience (Low to High)</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-600">
              {filteredAndSortedCandidates.length} candidates found
            </span>
          </div>
          <Link to="/add-candidate">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Add Candidate
            </Button>
          </Link>
        </div>
        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {[...Array(6)].map((_, index) => (
              <Card key={index} className="glass-card">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <Skeleton className="w-12 h-12 rounded-xl" />
                      <div>
                        <Skeleton className="h-5 w-32 mb-2" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-14" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {/* Candidates Grid */}
        {!isLoading && filteredAndSortedCandidates.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedCandidates.map((candidate, index) => (
              <Link to={`/candidate/${candidate.resume_id}`} key={candidate.resume_id}>
                <Card
                  className="glass-card hover-lift cursor-pointer animate-slide-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                          {getInitials(candidate.resume_name)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900">{candidate.resume_name}</h3>
                          <p className="text-sm text-gray-600">Rank #{candidate.rank}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="p-1 h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center text-sm text-gray-600 space-x-4">
                      <div className="flex items-center">
                        <Briefcase className="w-4 h-4 mr-1" />
                        {(candidate.aggregated_score * 20).toFixed(1)} years exp (est.)
                      </div>
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        N/A
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {candidate.primary_vs_primary.matched_skills.slice(0, 3).map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          {skill}
                        </Badge>
                      ))}
                      {candidate.primary_vs_primary.matched_skills.length > 3 && (
                        <Badge variant="secondary" className="text-xs bg-gray-50 text-gray-600">
                          +{candidate.primary_vs_primary.matched_skills.length - 3}
                        </Badge>
                      )}
                    </div>
                    <div className="pt-2">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Match Score</span>
                        <span className="text-sm font-bold text-green-600">{Math.round(candidate.primary_vs_primary.match_percentage * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-1000"
                          style={{ width: `${candidate.primary_vs_primary.match_percentage * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
        {/* No Results State */}
        {!isLoading && filteredAndSortedCandidates.length === 0 && (searchQuery || uploadedFile) && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No candidates found. Try adjusting your search query or filters.</p>
          </div>
        )}
        {/* Load More */}
        {!isLoading && filteredAndSortedCandidates.length > 0 && (
          <div className="text-center mt-12">
            <Button variant="outline" className="glass border-gray-200 hover:scale-105 transition-all duration-300">
              Load More Candidates
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};
export default Index;