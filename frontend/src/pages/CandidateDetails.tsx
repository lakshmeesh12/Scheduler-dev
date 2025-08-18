import { useState, useEffect } from "react";
import { useLocation, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Briefcase, MapPin, Clock, Mail, User, FileText, Award, Code, Download, Link as LinkIcon } from "lucide-react";
import { fetchProfileById } from '@/api';

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
  primary_skills: { [category: string]: { [subcategory: string]: string[] } };
  secondary_skills: { [category: string]: { [subcategory: string]: string[] } };
  course: {
    institution: string;
    domain: string;
    level: string;
  }[] | null;
  certifications: string[];
  education: {
    institution: string | null;
    degree: string;
    domain: string;
  }[] | null;
  file_name: string;
  processed_at: string;
}

const CandidateDetails = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [candidate, setCandidate] = useState<Candidate | null>(location.state?.candidate || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!candidate && id) {
      const loadProfile = async () => {
        setLoading(true);
        try {
          const profile = await fetchProfileById(id);
          setCandidate(profile);
          setLoading(false);
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Failed to fetch profile');
          setLoading(false);
        }
      };
      loadProfile();
    }
  }, [id, candidate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Loading candidate details...</p>
        </div>
      </div>
    );
  }

  if (!candidate || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg">{error || "Candidate not found."}</p>
          <Link to="/">
            <Button className="mt-4 bg-blue-600 hover:bg-blue-700">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Search
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const getInitials = (name: string | null) => {
    return name
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
      : "N/A";
  };

  const handleDownloadResume = () => {
    console.log("Download resume for candidate:", candidate.name);
    // In a real app, this would trigger a download using candidate.file_name
  };

  const handleSendEmail = () => {
    if (candidate.email) {
      const subject = `Regarding your application - ${candidate.name || "Candidate"}`;
      const mailtoLink = `mailto:${candidate.email}?subject=${encodeURIComponent(subject)}`;
      window.open(mailtoLink);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <header className="glass border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center animate-glow">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text">Candidate Profile</h1>
              <p className="text-sm text-gray-600">{candidate.name || "Unknown"}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={handleDownloadResume}
              variant="outline"
              className="glass border-gray-200 hover:scale-105 transition-all duration-300"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Resume
            </Button>
            <Button
              onClick={handleSendEmail}
              variant="outline"
              className="glass border-gray-200 hover:scale-105 transition-all duration-300"
            >
              <Mail className="w-4 h-4 mr-2" />
              Send Email
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 mr-3"
              onClick={() => console.log("Shortlisted candidate:", candidate.name)}
            >
              <User className="w-4 h-4 mr-2" />
              Shortlist Candidate
            </Button>
            <Link to={`/schedule-interview/${candidate.profile_id}`}>
              <Button className="bg-purple-600 hover:bg-purple-700 mr-3">
                <Clock className="w-4 h-4 mr-2" />
                Schedule Interview
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Search
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="min-h-screen max-w-7xl mx-auto px-6 py-8">
        <Card className="glass-card mb-8 shadow-xl border-0 bg-white/80 backdrop-blur-lg">
          <CardHeader>
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold text-2xl">
                {getInitials(candidate.name)}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{candidate.name || "Unknown"}</h2>
                <p className="text-sm text-gray-600">ID: {candidate.profile_id}</p>
                <p className="text-sm text-gray-600">{candidate.work_history[0]?.designation || "N/A"}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8 p-8">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border border-blue-100">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-blue-600" />
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  <span>
                    <strong>Name:</strong> {candidate.name || "N/A"}
                  </span>
                </div>
                <div className="flex items-center">
                  <Mail className="w-4 h-4 mr-2" />
                  <span>
                    <strong>Email:</strong> {candidate.email || "N/A"}
                  </span>
                </div>
                {candidate.linkedin_url && (
                  <div className="flex items-center">
                    <LinkIcon className="w-4 h-4 mr-2" />
                    <span>
                      <strong>LinkedIn:</strong>{" "}
                      <a
                        href={candidate.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Profile
                      </a>
                    </span>
                  </div>
                )}
                {candidate.github_url && (
                  <div className="flex items-center">
                    <LinkIcon className="w-4 h-4 mr-2" />
                    <span>
                      <strong>GitHub:</strong>{" "}
                      <a
                        href={candidate.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Profile
                      </a>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border border-green-100">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <Briefcase className="w-5 h-5 mr-2 text-green-600" />
                Professional Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  <span>
                    <strong>Experience:</strong>{" "}
                    {candidate.total_experience !== null
                      ? `${candidate.total_experience} years`
                      : "N/A"}
                  </span>
                </div>
                {candidate.work_history && Array.isArray(candidate.work_history) && candidate.work_history.length > 0 ? (
                  <div className="md:col-span-2">
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Work History</h4>
                    {candidate.work_history.map((work, index) => (
                      <div key={index} className="mb-4">
                        <div className="flex items-center">
                          <Briefcase className="w-4 h-4 mr-2" />
                          <span>
                            <strong>{work.designation || "N/A"}</strong> at {work.company || "N/A"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 ml-6">
                          {work.start_date || "N/A"} - {work.end_date || "Present"}
                        </p>
                        <p className="text-sm text-gray-600 ml-6">{work.description || "No description provided"}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Work History</h4>
                    <p className="text-sm text-gray-600">No work history listed.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg border border-purple-100">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <Code className="w-5 h-5 mr-2 text-purple-600" />
                Technical Skills
              </h3>
              <div className="space-y-6">
                {(candidate.primary_skills && Object.keys(candidate.primary_skills).length > 0) ||
                (candidate.secondary_skills && Object.keys(candidate.secondary_skills).length > 0) ? (
                  <>
                    {candidate.primary_skills && Object.keys(candidate.primary_skills).length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-2">Primary Skills</h4>
                        <table className="w-full text-sm text-gray-600 border-collapse">
                          <thead>
                            <tr className="bg-blue-50">
                              <th className="p-3 text-left font-semibold text-gray-800 border-b border-blue-200">Category</th>
                              <th className="p-3 text-left font-semibold text-gray-800 border-b border-blue-200">Subcategory</th>
                              <th className="p-3 text-left font-semibold text-gray-800 border-b border-blue-200">Skills</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(candidate.primary_skills).flatMap(([category, subcategories]) =>
                              Object.entries(subcategories).map(([subcategory, skills]) => (
                                <tr key={`${category}-${subcategory}`} className="hover:bg-blue-100/50">
                                  <td className="p-3 border-b border-gray-200">{category}</td>
                                  <td className="p-3 border-b border-gray-200">{subcategory}</td>
                                  <td className="p-3 border-b border-gray-200">
                                    <div className="flex flex-wrap gap-2">
                                      {skills.length > 0 ? (
                                        skills.map((skill) => (
                                          <Badge
                                            key={skill}
                                            variant="secondary"
                                            className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                                          >
                                            {skill}
                                          </Badge>
                                        ))
                                      ) : (
                                        <span className="text-xs text-gray-600">No skills listed</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {candidate.secondary_skills && Object.keys(candidate.secondary_skills).length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-2">Secondary Skills</h4>
                        <table className="w-full text-sm text-gray-600 border-collapse">
                          <thead>
                            <tr className="bg-blue-50">
                              <th className="p-3 text-left font-semibold text-gray-800 border-b border-blue-200">Category</th>
                              <th className="p-3 text-left font-semibold text-gray-800 border-b border-blue-200">Subcategory</th>
                              <th className="p-3 text-left font-semibold text-gray-800 border-b border-blue-200">Skills</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(candidate.secondary_skills).flatMap(([category, subcategories]) =>
                              Object.entries(subcategories).map(([subcategory, skills]) => (
                                <tr key={`${category}-${subcategory}`} className="hover:bg-blue-100/50">
                                  <td className="p-3 border-b border-gray-200">{category}</td>
                                  <td className="p-3 border-b border-gray-200">{subcategory}</td>
                                  <td className="p-3 border-b border-gray-200">
                                    <div className="flex flex-wrap gap-2">
                                      {skills.length > 0 ? (
                                        skills.map((skill) => (
                                          <Badge
                                            key={skill}
                                            variant="secondary"
                                            className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                                          >
                                            {skill}
                                          </Badge>
                                        ))
                                      ) : (
                                        <span className="text-xs text-gray-600">No skills listed</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-600">No technical skills listed.</p>
                )}
              </div>
            </div>

            {candidate.education && Array.isArray(candidate.education) && candidate.education.length > 0 ? (
              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-6 rounded-lg border border-orange-100">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                  <Award className="w-5 h-5 mr-2 text-orange-600" />
                  Education
                </h3>
                <div className="space-y-4">
                  {candidate.education.map((edu, index) => (
                    <div key={index} className="text-sm text-gray-600">
                      <div className="flex items-center">
                        <Award className="w-4 h-4 mr-2" />
                        <span>
                          <strong>{edu.degree}</strong> in {edu.domain}, {edu.institution || "N/A"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-6 rounded-lg border border-orange-100">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                  <Award className="w-5 h-5 mr-2 text-orange-600" />
                  Education
                </h3>
                <p className="text-sm text-gray-600">No education details listed.</p>
              </div>
            )}

            {candidate.course && Array.isArray(candidate.course) && candidate.course.length > 0 ? (
              <div className="bg-gradient-to-r from-teal-50 to-cyan-50 p-6 rounded-lg border border-teal-100">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                  <Award className="w-5 h-5 mr-2 text-teal-600" />
                  Courses
                </h3>
                <div className="space-y-4">
                  {candidate.course.map((course, index) => (
                    <div key={index} className="text-sm text-gray-600">
                      <div className="flex items-center">
                        <Award className="w-4 h-4 mr-2" />
                        <span>
                          <strong>{course.level}</strong> in {course.domain}, {course.institution}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-teal-50 to-cyan-50 p-6 rounded-lg border border-teal-100">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                  <Award className="w-5 h-5 mr-2 text-teal-600" />
                  Courses
                </h3>
                <p className="text-sm text-gray-600">No courses listed.</p>
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Certifications</h3>
              {candidate.certifications.length > 0 ? (
                <ul className="list-disc pl-5 text-sm text-gray-600">
                  {candidate.certifications.map((cert) => (
                    <li key={cert} className="flex items-center">
                      <Award className="w-4 h-4 mr-2" />
                      {cert}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-600">No certifications listed.</p>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Key Projects</h3>
              {candidate.projects && Array.isArray(candidate.projects) && candidate.projects.length > 0 ? (
                <div className="space-y-4">
                  {candidate.projects.map((project) => (
                    <div key={project.title} className="text-sm text-gray-600">
                      <div className="flex items-center">
                        <Code className="w-4 h-4 mr-2" />
                        <span className="font-semibold">{project.title || "Untitled Project"}</span>
                      </div>
                      <p className="ml-6">{project.description || "No description provided"}</p>
                      {project.impact && <p className="ml-6 text-xs italic">Impact: {project.impact}</p>}
                      <p className="ml-6 text-xs">
                        {project.start_date || "N/A"} - {project.end_date || "N/A"}
                      </p>
                      <div className="ml-6 flex flex-wrap gap-2 mt-2">
                        {project.skills_tools && Array.isArray(project.skills_tools) && project.skills_tools.length > 0 ? (
                          project.skills_tools.map((skill) => (
                            <Badge
                              key={skill}
                              variant="secondary"
                              className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                            >
                              {skill}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-xs text-gray-600">No skills listed for this project.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-600">No projects listed.</p>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Resume Status</h3>
              <div className="flex items-center text-sm text-gray-600">
                <FileText className="w-4 h-4 mr-2" />
                <span>
                  <strong>File Name:</strong> {candidate.file_name}
                </span>
              </div>
              <div className="flex items-center text-sm text-gray-600 mt-2">
                <Clock className="w-4 h-4 mr-2" />
                <span>
                  <strong>Processed At:</strong>{" "}
                  {candidate.processed_at
                    ? new Date(candidate.processed_at).toLocaleString()
                    : "N/A"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CandidateDetails;