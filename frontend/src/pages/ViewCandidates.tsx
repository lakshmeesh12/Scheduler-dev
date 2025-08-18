
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronUp, Users, User, Mail, Phone, Briefcase, MapPin, Clock, Award, Code, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { fetchAllProfiles } from '@/api';

interface Candidate {
  profile_id: string;
  name: string | null;
  total_experience: number | null;
  email: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  projects: {
    title: string;
    description: string;
    skills_tools: string[];
    impact: string | null;
    start_date: string | null;
    end_date: string | null;
  }[];
  work_history: {
    company: string;
    designation: string;
    description: string;
    start_date: string;
    end_date: string | null;
  }[];
  primary_skills: { [category: string]: string[] };
  secondary_skills: { [category: string]: string[] };
  course: {
    institution: string;
    domain: string;
    level: string;
  }[];
  certifications: string[];
  education: {
    institution: string | null;
    degree: string;
    domain: string;
  }[];
  file_name: string;
  processed_at: string;
}

const ViewCandidates = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedCandidates, setExpandedCandidates] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadProfiles = async () => {
      setLoading(true);
      try {
        const profiles = await fetchAllProfiles();
        setCandidates(profiles);
        setLoading(false);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to fetch profiles');
        setLoading(false);
      }
    };
    loadProfiles();
  }, []);

  const toggleExpanded = (candidateId: string) => {
    const newExpandedCandidates = new Set(expandedCandidates);
    if (newExpandedCandidates.has(candidateId)) {
      newExpandedCandidates.delete(candidateId);
    } else {
      newExpandedCandidates.add(candidateId);
    }
    setExpandedCandidates(newExpandedCandidates);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <header className="glass border-b border-white/20 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold gradient-text">All Candidates</h1>
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">
          <div className="space-y-4">
            {[...Array(6)].map((_, index) => (
              <Card key={index} className="glass-card">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <Skeleton className="w-12 h-12 rounded-xl" />
                    <div className="flex-1">
                      <Skeleton className="h-5 w-48 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error}</p>
          <Link to="/">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Search
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center animate-glow">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold gradient-text">All Candidates</h1>
                <p className="text-sm text-gray-600">{candidates.length} candidates in database</p>
              </div>
            </div>
            <Link to="/">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Search
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="space-y-4">
          {candidates.map((candidate) => {
            const isExpanded = expandedCandidates.has(candidate.profile_id);
            return (
              <Card key={candidate.profile_id} className="glass-card hover:shadow-lg transition-all duration-200">
                <Collapsible>
                  <CollapsibleTrigger
                    className="w-full"
                    onClick={() => toggleExpanded(candidate.profile_id)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                            {getInitials(candidate.name || 'Unknown')}
                          </div>
                          <div className="text-left">
                            <h3 className="font-semibold text-lg text-gray-900">{candidate.name || 'Unknown'}</h3>
                            <p className="text-sm text-gray-600">{candidate.work_history[0]?.designation || 'N/A'}</p>
                            <p className="text-xs text-gray-500">
                              {candidate.total_experience !== null ? `${candidate.total_experience} years experience` : 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right text-sm text-gray-600">
                            <p className="font-medium">{candidate.work_history[0]?.company || 'N/A'}</p>
                            <p className="text-xs">{candidate.processed_at ? new Date(candidate.processed_at).toLocaleDateString() : 'N/A'}</p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-6 pb-6 border-t border-gray-200/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                        {/* Personal Information */}
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                            <User className="w-4 h-4 mr-2" />
                            Personal Information
                          </h4>
                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Mail className="w-4 h-4 mr-2 text-gray-400" />
                              {candidate.email || "N/A"}
                            </div>
                            {candidate.linkedin_url && (
                              <div className="flex items-center">
                                <svg
                                  className="w-4 h-4 mr-2 text-gray-400"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                                </svg>
                                <a
                                  href={candidate.linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  LinkedIn Profile
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Professional Information */}
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                            <Briefcase className="w-4 h-4 mr-2" />
                            Professional Details
                          </h4>
                          <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Briefcase className="w-4 h-4 mr-2 text-gray-400" />
                              {candidate.work_history[0]?.company || "N/A"}
                            </div>
                            <div className="flex items-center">
                              <Briefcase className="w-4 h-4 mr-2 text-gray-400" />
                              {candidate.work_history[0]?.designation || "N/A"}
                            </div>
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 mr-2 text-gray-400" />
                              {candidate.total_experience !== null
                                ? `${candidate.total_experience} years`
                                : "N/A"}
                            </div>
                          </div>
                        </div>

                        {/* <div>
                          <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                            <Award className="w-4 h-4 mr-2" />
                            Education
                          </h4>
                          <div className="space-y-2 text-sm text-gray-600">
                            {candidate.education.map((edu, index) => (
                              <div key={index} className="flex items-center">
                                <Award className="w-4 h-4 mr-2 text-gray-400" />
                                {edu.degree} in {edu.domain}, {edu.institution || "N/A"}
                              </div>
                            ))}
                          </div>
                        </div> */}

                        {/* Skills */}
                        {/* <div className="md:col-span-2">
                          <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                            <Code className="w-4 h-4 mr-2" />
                            Skills
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {[
                              ...Object.values(candidate.primary_skills).flatMap((category) =>
                                Object.values(category).flat()
                              ),
                              ...Object.values(candidate.secondary_skills).flatMap((category) =>
                                Object.values(category).flat()
                              ),
                            ].map((skill) => (
                              <Badge
                                key={skill}
                                variant="secondary"
                                className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                              >
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div> */}

                        {/* Certifications */}
                        {candidate.certifications.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                              <Award className="w-4 h-4 mr-2" />
                              Certifications
                            </h4>
                            <ul className="space-y-1 text-sm text-gray-600">
                              {candidate.certifications.map((cert, index) => (
                                <li key={index} className="flex items-center">
                                  <Award className="w-3 h-3 mr-2 text-gray-400" />
                                  {cert}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Projects */}
                        {candidate.projects.length > 0 && (
                          <div>
                            <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                              <Code className="w-4 h-4 mr-2" />
                              Key Projects
                            </h4>
                            <div className="space-y-2">
                              {candidate.projects.map((project, index) => (
                                <div key={index} className="text-sm">
                                  <p className="font-medium text-gray-800">{project.title}</p>
                                  <p className="text-gray-600 text-xs">{project.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200/50">
                        <Link to={`/candidate/${candidate.profile_id}`} state={{ candidate }}>
                          <Button variant="outline" size="sm">
                            View Full Profile
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>

        {candidates.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No candidates found in the database.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ViewCandidates;
