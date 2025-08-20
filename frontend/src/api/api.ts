import axios, { AxiosResponse } from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export interface Candidate {
  id: string;
  name: string;
  date_of_birth: string;
  skills: string[];
  personal_information: {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
  };
  professional_information: {
    position: string;
    current_last_company: string;
    location: string;
    current_ctc: number;
    expected_ctc: number;
    total_experience: number;
  };
  professional_summary: string;
  resume_uploaded: string;
  projects: { title: string; description: string }[];
  certifications: string[];
}

export interface AddResumesResponse {
  message: string;
  results: string[];
  errors: string[];
  parsed_resumes: Candidate[];
}

export interface SearchResponse {
  response: string;
  id: string;
  match: Candidate[];
  metadata: {
    query_plan: any;
    retrieved_results_count: number;
    confidence: number;
  };
}

export interface AllCandidatesResponse {
  candidates: Candidate[];
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Get all candidates
export const getAllCandidates = async (): Promise<AllCandidatesResponse> => {
  try {
    const response: AxiosResponse<AllCandidatesResponse> = await apiClient.get('/candidates');
    return response.data;
  } catch (error) {
    console.error('Get all candidates error:', error);
    throw new Error('Failed to fetch all candidates. Please try again later.');
  }
};

// Ingest candidates with optional files
export const ingestCandidates = async (candidates: Candidate[], files: File[]): Promise<AddResumesResponse> => {
  try {
    const formData = new FormData();
    formData.append('employees', JSON.stringify(candidates));
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response: AxiosResponse<AddResumesResponse> = await apiClient.post('/ingest', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Ingest candidates error:', error);
    throw new Error('Failed to ingest candidates. Please try again later.');
  }
};

// Upload resumes
export const uploadResumes = async (files: File[]): Promise<AddResumesResponse> => {
  try {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response: AxiosResponse<AddResumesResponse> = await apiClient.post('/add-resumes', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Upload resumes error:', error);
    throw new Error('Failed to upload resumes. Please try again later.');
  }
};

// Search candidates
export const searchCandidates = async (query: string, limit: number = 1000, file?: File): Promise<SearchResponse> => {


  try {
    const response: AxiosResponse<SearchResponse> = await apiClient.post('/search', { query, limit });
    return response.data;
  } catch (error) {
    console.error('Search error:', error);
    throw new Error('Failed to fetch candidates. Please try again later.');
  }
};

// Fetch candidate by ID
export const getCandidateById = async (id: string): Promise<Candidate> => {
  try {
    const response: AxiosResponse<Candidate> = await apiClient.get(`/candidate/${id}`);
    return response.data;
  } catch (error) {
    console.error('Fetch candidate error:', error);
    throw new Error('Failed to fetch candidate details. Please try again later.');
  }
};

// Client and Campaign Management Interfaces
export interface TalentAcquisitionTeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Recruiter' | 'Hiring Manager' | 'Coordinator';
  isHiringManager: boolean;
}

export interface Client {
  id: string;
  name: string;
  logo: string;
  description: string;
  location: string;
  industry: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface HiringCampaign {
  id: string;
  clientId: string;
  jobTitle: string;
  description: string;
  experienceLevel: "Junior" | "Mid-level" | "Senior";
  positions: number;
  location: string;
  department: string;
  jobType: "Full-time" | "Part-time" | "Contract";
  status: "Active" | "Completed" | "On Hold";
  startDate: string;
  candidatesApplied: number;
  candidatesHired: number;
  currentRound: string;
  talentAcquisitionTeam: TalentAcquisitionTeamMember[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface CampaignCreate {
  clientId: string;
  jobTitle: string;
  description: string;
  experienceLevel: "Junior" | "Mid-level" | "Senior";
  positions: number;
  location: string;
  department: string;
  jobType: "Full-time" | "Part-time" | "Contract";
  startDate: string;
  talentAcquisitionTeam?: TalentAcquisitionTeamMember[];
}

export interface ClientCreate {
  name: string;
  description: string;
  location: string;
  industry: string;
}

// Mock API functions (to be replaced with real API calls)
export const fetchAllClients = async (): Promise<Client[]> => {
  // Mock data - replace with actual API call
  return [
    {
      id: "1",
      name: "Microsoft",
      logo: "/src/assets/microsoft-logo.png",
      description: "Technology corporation developing computer software, consumer electronics, personal computers, and related services.",
      location: "Redmond, WA",
      industry: "Technology",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "admin",
      updatedBy: "admin"
    },
    {
      id: "2", 
      name: "Unilever",
      logo: "/src/assets/unilever-logo.png",
      description: "British-Dutch transnational consumer goods company with products spanning food, beverages, cleaning agents, and personal care products.",
      location: "London, UK",
      industry: "Consumer Goods",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "admin",
      updatedBy: "admin"
    },
    {
      id: "3",
      name: "ArcelorMittal", 
      logo: "/src/assets/arcelormittal-logo.png",
      description: "Multinational steel manufacturing corporation, one of the largest steel producers in the world.",
      location: "Luxembourg City, Luxembourg",
      industry: "Steel & Mining",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "admin",
      updatedBy: "admin"
    }
  ];
};

export const createClient = async (clientData: ClientCreate): Promise<Client> => {
  // Mock implementation - replace with actual API call
  const newClient: Client = {
    id: Date.now().toString(),
    ...clientData,
    logo: "/src/assets/placeholder-logo.png",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: sessionStorage.getItem("user_id") || "current_user",
    updatedBy: sessionStorage.getItem("user_id") || "current_user"
  };
  return newClient;
};

export const fetchCampaignsByClientId = async (clientId: string): Promise<HiringCampaign[]> => {
  // Mock data - replace with actual API call
  return [
    {
      id: "1",
      clientId,
      jobTitle: "Senior React Developer",
      description: "Looking for an experienced React developer with 5+ years of experience in building modern web applications.",
      experienceLevel: "Senior",
      positions: 2,
      location: "Seattle, WA",
      department: "Engineering",
      jobType: "Full-time",
      status: "Active",
      startDate: "2024-01-15",
      candidatesApplied: 45,
      candidatesHired: 1,
      currentRound: "Technical Interview",
      talentAcquisitionTeam: [
        {
          id: "1",
          name: "Sarah Johnson",
          email: "sarah.johnson@company.com",
          role: "Hiring Manager",
          isHiringManager: true
        },
        {
          id: "2", 
          name: "Mike Chen",
          email: "mike.chen@company.com",
          role: "Recruiter",
          isHiringManager: false
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "sarah.johnson",
      updatedBy: "mike.chen"
    }
  ];
};

export const createCampaign = async (campaignData: CampaignCreate): Promise<HiringCampaign> => {
  // Mock implementation - replace with actual API call
  const newCampaign: HiringCampaign = {
    id: Date.now().toString(),
    ...campaignData,
    status: "Active",
    candidatesApplied: 0,
    candidatesHired: 0,
    currentRound: "Not Started",
    talentAcquisitionTeam: campaignData.talentAcquisitionTeam || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: sessionStorage.getItem("user_id") || "current_user",
    updatedBy: sessionStorage.getItem("user_id") || "current_user"
  };
  return newCampaign;
};

export const fetchCampaignById = async (campaignId: string): Promise<HiringCampaign> => {
  // Mock implementation - replace with actual API call
  const campaigns = await fetchCampaignsByClientId("1");
  const campaign = campaigns.find(c => c.id === campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }
  return campaign;
};

// Candidate search function for campaigns
export interface CampaignCandidate {
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
  campaignId?: string; // Tagged with campaign ID
}

export const searchCandidatesForCampaign = async (
  jobDescription: string, 
  campaignId: string,
  file?: File
): Promise<{ candidates: CampaignCandidate[]; response: string }> => {
  // Mock implementation - replace with actual API call
  try {
    const mockCandidates: CampaignCandidate[] = [
      {
        resume_id: "1",
        resume_name: "Alice Johnson",
        aggregated_score: 0.89,
        primary_vs_primary: {
          matched_skills: ["React", "TypeScript", "Node.js", "AWS"],
          missing_skills: ["GraphQL"],
          total_matched: 4,
          total_required: 5,
          match_percentage: 0.8
        },
        rank: 1,
        campaignId
      },
      {
        resume_id: "2", 
        resume_name: "David Chen",
        aggregated_score: 0.82,
        primary_vs_primary: {
          matched_skills: ["React", "JavaScript", "Python"],
          missing_skills: ["TypeScript", "AWS"],
          total_matched: 3,
          total_required: 5,
          match_percentage: 0.6
        },
        rank: 2,
        campaignId
      }
    ];

    return {
      candidates: mockCandidates,
      response: `Found ${mockCandidates.length} matching candidates for the campaign based on the job description.`
    };
  } catch (error) {
    console.error('Campaign candidate search error:', error);
    throw new Error('Failed to search candidates for campaign. Please try again later.');
  }
};