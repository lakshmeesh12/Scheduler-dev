import axios from 'axios';
import { AxiosRequestConfig } from "axios"; // should work in v1.6+


const API_BASE_URL = 'http://localhost:8000'; // Update if your backend runs on a different URL/port
const NODE_API_BASE_URL = 'http://localhost:3001';

// Interface for User data from /users endpoint
export interface User {
  user_id: string;
  display_name?: string;
  email: string;
  given_name?: string;
  surname?: string;
  job_title?: string;
  office_location?: string;
  working_hours?: {
    start_time: string;
    end_time: string;
  };
  timezone?: string;
}

export interface LoginResponse {
  login_url: string;
}

export interface PanelSelection {
  user_ids: string[];
  created_by: string;
}

export interface PanelSelectionResponse {
  session_id: string;
}

export interface InterviewDetails {
  title: string;
  description: string;
  duration: number;
  date: string;
  preferred_timezone: string;
  location: string;
}

export interface InterviewDetailsResponse {
  message: string;
}

export interface TimeSlot {
  start: string;
  end: string;
  date: string;
}

export interface AvailabilityResponse {
  slots: TimeSlot[];
  metadata: {
    total_slots: number;
    date: string;
    duration_minutes: number;
    timezone: string;
    panel_members: number;
    note?: string;
  };
}

export interface ApiError {
  error: string;
}

export interface PanelMember {
  user_id: string;
  display_name: string;
  email: string;
  role?: string; // Made role optional
  avatar?: string;
}

export interface InterviewRoundTimeSlot {
  id: string;
  start: string;
  end: string;
  date: string;
  available: boolean;
  availableMembers: string[];
}

// export interface InterviewRoundData {
//   id: string;
//   roundNumber: number;
//   status: 'draft' | 'scheduled' | 'completed';
//   panel: PanelMember[];
//   details: InterviewDetails | null;
//   selectedTimeSlot: InterviewRoundTimeSlot | null;
//   schedulingOption: 'direct' | 'candidate_choice' | null;
//   candidateId: string;
//   sessionId: string | null;
//   createdAt?: string;
// }

export interface InterviewRoundResponse {
  message: string;
  id: string;
}

export interface ApiCandidate {
  profile_id: string;
  name: string;
  email?: string;
  recent_designation?: string;
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const initiateLogin = (): string => {
  return 'http://localhost:8000/login';
};

export const fetchUsers = async (): Promise<User[]> => {
  try {
    const response = await apiClient.get<{ users: User[] }>('/users');
    return response.data.users;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error((error.response.data as ApiError).error || 'Failed to fetch users');
    }
    throw new Error('Network error while fetching users');
  }
};

export const savePanelSelection = async (userIds: string[], createdBy: string): Promise<string> => {
  try {
    const response = await apiClient.post<PanelSelectionResponse>('/panel-selection', {
      user_ids: userIds,
      created_by: createdBy,
    });
    return response.data.session_id;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error((error.response.data as ApiError).error || 'Failed to save panel selection');
    }
    throw new Error('Network error while saving panel selection');
  }
};

export const saveInterviewDetails = async (sessionId: string, details: InterviewDetails): Promise<string> => {
  try {
    const response = await apiClient.post<InterviewDetailsResponse>(`/interview-details/${sessionId}`, details);
    return response.data.message;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error((error.response.data as ApiError).error || 'Failed to save interview details');
    }
    throw new Error('Network error while saving interview details');
  }
};

export const fetchAvailableSlots = async (sessionId: string): Promise<AvailabilityResponse> => {
  try {
    const response = await apiClient.get<AvailabilityResponse>(`/available-slots/${sessionId}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error((error.response.data as ApiError).error || 'Failed to fetch available slots');
    }
    throw new Error('Network error while fetching available slots');
  }
};

export const fetchAllAvailableSlots = async (sessionId: string): Promise<AvailabilityResponse> => {
  try {
    const response = await apiClient.get<AvailabilityResponse>(`/all-available-slots/${sessionId}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error((error.response.data as ApiError).error || 'Failed to fetch all available slots');
    }
    throw new Error('Network error while fetching all available slots');
  }
};

export interface InterviewRoundData {
  id: string;
  roundNumber: number;
  status: 'draft' | 'scheduled' | 'completed';
  panel: PanelMember[];
  details: InterviewDetails | null;
  selectedTimeSlot: InterviewRoundTimeSlot | null;
  schedulingOption: 'direct' | 'candidate_choice' | null;
  candidateId: string;
  campaignId: string;
  clientId: string;
  sessionId: string | null;
  createdAt?: string;
}

export const fetchInterviewRounds = async (candidateId: string, campaignId: string, clientId: string): Promise<InterviewRoundData[]> => {
  try {
    console.log("api.ts: Fetching interview rounds for candidateId:", candidateId, "campaignId:", campaignId, "clientId:", clientId);
    const response = await apiClient.get<InterviewRoundData[]>(`/interview-rounds/${candidateId}/${campaignId}/${clientId}`);
    console.log("api.ts: Interview rounds fetched successfully:", response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error("api.ts: Error response from backend:", error.response.status, error.response.data);
      throw new Error((error.response.data as ApiError).error || `HTTP error ${error.response.status}: Failed to fetch interview rounds`);
    }
    console.error("api.ts: Network error fetching interview rounds:", error);
    throw new Error('Network error while fetching interview rounds');
  }
};

export const saveInterviewRound = async (roundData: InterviewRoundData): Promise<InterviewRoundResponse> => {
  try {
    console.log("api.ts: Sending request to save interview round:", roundData);
    const updatedRoundData = {
      ...roundData,
      panel: roundData.panel.map(member => ({
        ...member,
        role: member.role || "Interviewer",
      })),
    };
    const response = await apiClient.post<InterviewRoundResponse>('/interview-rounds/', updatedRoundData);
    console.log("api.ts: Interview round saved successfully:", response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error("api.ts: Error response from backend:", error.response.status, error.response.data);
      throw new Error((error.response.data as ApiError).error || `HTTP error ${error.response.status}: Failed to save interview round`);
    }
    console.error("api.ts: Network error saving interview round:", error);
    throw new Error('Network error while saving interview round');
  }
};

// Interface for Candidate data from /profile endpoint
export interface ApiCandidate {
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
  profile_id: string;
  file_name: string;
  processed_at: string;
}

// Interface for /profile API response
export interface ProfileResponse {
  message: string;
  count: number;
  body: ApiCandidate[];
}

// Fetch all candidate profiles
export const fetchAllProfiles = async (): Promise<ApiCandidate[]> => {
  try {
    const response = await apiClient.get<ProfileResponse>('/profile');
    return response.data.body;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error((error.response.data as ApiError).error || 'Failed to fetch profiles');
    }
    throw new Error('Network error while fetching profiles');
  }
};

export interface SingleProfileResponse {
  message: string;
  body: ApiCandidate;
}

// Fetch a single candidate profile by profile_id
export const fetchProfileById = async (profileId: string): Promise<ApiCandidate> => {
  try {
    const response = await apiClient.get<SingleProfileResponse>(`/profile/${profileId}`);
    return response.data.body;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error((error.response.data as ApiError).error || 'Failed to fetch profile');
    }
    throw new Error('Network error while fetching profile');
  }
};

interface SkillMatchDetails {
  matched_skills: string[];
  missing_skills: string[];
  total_matched: number;
  total_required: number;
  match_percentage: number;
}

interface AggregatedScore {
  resume_name: string;
  resume_id: string;
  aggregated_score: number;
  score_breakdown: {
    primary_vs_primary: number;
    primary_vs_secondary: number;
    secondary_vs_primary: number;
    secondary_vs_secondary: number;
  };
  primary_vs_primary: SkillMatchDetails;
  secondary_vs_secondary: SkillMatchDetails;
  rank: number;
}

interface MatchingResponse {
  jd_text: string;
  job_title: string;
  total_resumes_processed: number;
  matching_results: AggregatedScore[];
  timestamp: string;
  execution_time_ms: number;
}

const BASE_URL = "http://localhost:8000"; // Update with your backend URL

const fetchWithToken = async (url: string, options: RequestInit = {}) => {
  const sessionId = localStorage.getItem("session_id");
  const headers = new Headers(options.headers || {});
  
  if (sessionId) {
    headers.append("Authorization", `Bearer ${sessionId}`);
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
};

export const fetchMatchingResumes = async (formData: FormData): Promise<MatchingResponse> => {
  return fetchWithToken(`${BASE_URL}/find-match`, {
    method: "POST",
    body: formData,
  });
};

export type { MatchingResponse, AggregatedScore, SkillMatchDetails };

interface ScheduleEventRequest {
  slot: {
    start: string;
    end: string;
  };
  mail_template: {
    subject: string;
    body: string;
  };
  candidate_email: string | null;
  candidate_name?: string | null;
  recent_designation?: string | null;
  campaign_id?: string | null;
  to_emails: string[];
  cc_emails: string[];
}

interface ScheduleEventResponse {
  message?: string;
  error?: string;
}

const scheduleEvent = async (sessionId: string, request: ScheduleEventRequest): Promise<ScheduleEventResponse> => {
  return fetchWithToken(`${BASE_URL}/schedule-event/${sessionId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
};

export type { ScheduleEventRequest, ScheduleEventResponse };
export { scheduleEvent };

interface EventTrackerResponse {
  status?: string;
  candidate?: {
    name: string;
    email: string;
  };
  position?: string;
  scheduled_time?: {
    date: string;
    start_time: string;
    duration: number;
  };
  virtual?: boolean;
  candidate_response?: {
    name: string;
    email: string;
    response: string;
    response_time: string;
  };
  panel_response_status?: {
    summary: {
      accepted: number;
      declined: number;
      tentative: number;
      pending: number;
    };
    responses: Array<{
      name: string;
      email: string;
      role: string | null;
      response: string;
      response_time: string;
    }>;
  };
  error?: string;
}

const trackEvent = async (sessionId: string): Promise<EventTrackerResponse> => {
  return fetchWithToken(`${BASE_URL}/event-tracker/${sessionId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
};



interface UploadResumeResponse {
  message: string;
  uploaded_files_count?: number;
  status?: string;
  save_errors?: Array<{
    filename: string;
    error: string;
  }>;
  errors?: Array<{
    filename: string;
    error: string;
  }>;
  valid_files_count?: number;
}

const uploadResumes = async (files: File[]): Promise<UploadResumeResponse> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });

  return fetchWithToken(`${BASE_URL}/upload-resumes`, {
    method: 'POST',
    body: formData,
  });
};

interface ImportExcelResponse {
  success?: boolean;
  message?: string;
  status?: string;
  data?: any;
  error?: { message: string; details?: string };
}

const importExcel = async (file: File): Promise<ImportExcelResponse> => {
  const formData = new FormData();
  formData.append('excelFile', file);

  const response = await fetch(`${NODE_API_BASE_URL}/api/profiles/import-excel`, {
    method: 'POST',
    body: formData,
  });

  const responseData = await response.json().catch(() => ({}));
  console.log('importExcel: Response:', responseData);

  if (!response.ok) {
    console.log('importExcel: Error response:', responseData);
    throw new Error(`HTTP error! status: ${response.status}, message: ${responseData.error?.message || 'Unknown error'}`);
  }

  return responseData;
};

export type { EventTrackerResponse, UploadResumeResponse, ImportExcelResponse };
export { trackEvent, uploadResumes, importExcel };

interface SchedulerResponse {
  interviews: {
    session_id: string;
    candidate: {
      email: string;
      name: string;
      recent_designation: string;
      profile_id: string;
    };
    event_start_time: string;
    panel_emails: string[];
  }[];
  statistics: {
    total: number;
    scheduled: number;
    pending: number;
    completed: number;
  };
  error?: string;
}

const fetchSchedulerData = async (): Promise<SchedulerResponse> => {
  const response = await fetch(`${API_BASE_URL}/scheduler`, {
    method: 'GET',
  });

  const responseData = await response.json().catch(() => ({}));
  console.log('fetchSchedulerData: Response:', responseData);

  if (!response.ok) {
    console.log('fetchSchedulerData: Error response:', responseData);
    throw new Error(`HTTP error! status: ${response.status}, message: ${responseData.error || 'Unknown error'}`);
  }

  return responseData;
};

export type { SchedulerResponse };
export { fetchSchedulerData };

interface EventUpdateRequest {
  remove_emails: string[];
  add_emails: string[];
}

interface EventUpdateResponse {
  success?: boolean;
  error?: string;
}

const updateEvent = async (sessionId: string, removeEmails: string[], addEmails: string[]): Promise<EventUpdateResponse> => {
  const authSessionId = localStorage.getItem("session_id");
  if (!authSessionId) {
    throw new Error("No session ID found");
  }

  const response = await fetch(`http://localhost:8000/event-update/${sessionId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authSessionId}`,
    },
    body: JSON.stringify({
      remove_emails: removeEmails,
      add_emails: addEmails,
    }),
  });

  const responseData = await response.json().catch(() => ({}));
  console.log('updateEvent: Response:', responseData);

  if (!response.ok) {
    console.log('updateEvent: Error response:', responseData);
    throw new Error(`HTTP error! status: ${response.status}, message: ${responseData.error || 'Unknown error'}`);
  }

  return responseData;
};

export type { EventUpdateRequest, EventUpdateResponse };
export { updateEvent };

export interface Interview {
  _id: string;
  session_id: string;
  user_ids: string[];
  created_by: string;
  created_at: string;
  interview_details: {
    title: string;
    description: string;
    duration: number;
    date: string;
    preferred_timezone: string;
    location: string;
    meeting_type: string | null;
  };
  updated_at: string;
  campaign_id: string;
  scheduled_event: {
    event_id: string;
    start: string;
    end: string;
    candidate_email: string;
    panel_emails: string[];
    created_at: string;
  };
}

// export interface HiringCampaign {
//   id: string;
//   jobTitle: string;
//   department: string;
//   positions: number;
//   status: "Active" | "Completed" | "On Hold";
//   startDate: string;
//   endDate?: string;
//   location: string;
//   candidatesApplied: number;
//   candidatesHired: number;
//   currentRound: string;
//   description: string;
//   experienceLevel: "Junior" | "Mid-level" | "Senior";
//   jobType: "Full-time" | "Part-time" | "Contract";
//   client_id: string;
//   Interview?: Interview[];
// }

// export interface CampaignCreate {
//   jobTitle: string;
//   description: string;
//   experienceLevel: "Junior" | "Mid-level" | "Senior";
//   positions: number;
//   location: string;
//   department: string;
//   jobType: "Full-time" | "Part-time" | "Contract";
//   startDate: string;
//   client_id: string;
// }

export interface ClientCreate {
  companyName: string;
  location: string;
  industry: string;
  description: string;
  logo?: File;
}

export interface Client {
  id: string;
  companyName: string;
  location: string;
  industry: string;
  description: string;
  logoPath?: string;
}

export interface ApiError {
  error: string;
}

export const createClient = async (client: ClientCreate): Promise<Client> => {
  try {
    const formData = new FormData();
    formData.append('companyName', client.companyName);
    formData.append('location', client.location);
    formData.append('industry', client.industry);
    formData.append('description', client.description);
    if (client.logo) {
      console.log("Appending logo to FormData:", client.logo.name, client.logo.type);
      formData.append('logo', client.logo);
    } else {
      console.log("No logo file provided for FormData");
    }

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    };

    console.log("Sending create client request with FormData");
    const response = await apiClient.post<Client>('/api/new-client', formData, config);
    console.log("Create client response:", response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error("Create client API error:", error.response.data);
      throw new Error((error.response.data as ApiError).error || 'Failed to create client');
    }
    console.error("Create client network error:", error);
    throw new Error('Network error while creating client');
  }
};

export const fetchAllClients = async (): Promise<Client[]> => {
  try {
    console.log("Sending fetch all clients request");
    const response = await apiClient.get<Client[]>('/api/all-clients');
    console.log("Fetch all clients response:", response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error("Fetch clients API error:", error.response.data);
      throw new Error((error.response.data as ApiError).error || 'Failed to fetch clients');
    }
    console.error("Fetch clients network error:", error);
    throw new Error('Network error while fetching clients');
  }
};

export const fetchClientById = async (clientId: string): Promise<Client> => {
  try {
    const response = await apiClient.get<Client>(`/api/client/${clientId}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error((error.response.data as ApiError).error || 'Failed to fetch client');
    }
    throw new Error('Network error while fetching client');
  }
};

export interface TalentAcquisitionTeamMember {
  name: string;
  email: string;
  role: "Recruiter" | "Hiring Manager" | "Coordinator";
}

export interface CampaignCreate {
  jobTitle: string;
  description: string;
  experienceLevel: "Junior" | "Mid-level" | "Senior";
  positions: number;
  location: string;
  department: string;
  jobType: "Full-time" | "Part-time" | "Contract";
  startDate: string;
  client_id: string;
  campaign_id: string; // Add campaign_id
  created_by: string;
  talentAcquisitionTeam: TalentAcquisitionTeamMember[];
}

export interface HiringCampaign {
  id: string;
  jobTitle: string;
  department: string;
  positions: number;
  status: "Active" | "Completed" | "On Hold";
  startDate: string;
  endDate?: string;
  location: string;
  candidatesApplied: number;
  candidatesHired: number;
  currentRound: string;
  description: string;
  experienceLevel: "Junior" | "Mid-level" | "Senior";
  jobType: "Full-time" | "Part-time" | "Contract";
  client_id: string;
  campaign_id: string; // Add campaign_id
  created_by: string;
  created_by_name: string;
  talentAcquisitionTeam: TalentAcquisitionTeamMember[];
  Interview?: Interview[];
}

export interface ManagerCampaignCreate {
  title: string;
  description: string;
  contactPerson: string;
  contactNumber: string;
  location: string;
  startDate: string;
  client_id: string;
}

export interface ManagerCampaign {
  id: string;
  title: string;
  description: string;
  contactPerson: string;
  contactNumber: string;
  location: string;
  startDate: string;
  client_id: string;
}

export const fetchAllCampaigns = async (clientId: string, campaignId: string): Promise<HiringCampaign[]> => {
  try {
    if (!clientId || clientId.trim() === '' || clientId.toLowerCase() === 'none') {
      console.error('fetchAllCampaigns: Invalid clientId', clientId);
      throw new Error('Client ID is required to fetch campaigns');
    }
    if (!campaignId || campaignId.trim() === '' || campaignId.toLowerCase() === 'none') {
      console.error('fetchAllCampaigns: Invalid campaignId', campaignId);
      throw new Error('Campaign ID is required to fetch campaigns');
    }
    const params: { client_id: string; campaign_id: string } = { 
      client_id: clientId,
      campaign_id: campaignId
    };
    console.log('fetchAllCampaigns: Sending request with params:', JSON.stringify(params, null, 2));
    console.log('fetchAllCampaigns: Request URL:', `/api/all-campaigns?client_id=${encodeURIComponent(clientId)}&campaign_id=${encodeURIComponent(campaignId)}`);
    const response = await apiClient.get<HiringCampaign[]>('/api/all-campaigns', { params });
    console.log('fetchAllCampaigns: Response received:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('fetchAllCampaigns: Error:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('fetchAllCampaigns: Error response:', JSON.stringify(error.response.data, null, 2));
      throw new Error((error.response.data as ApiError).error || 'Failed to fetch campaigns');
    }
    throw new Error(error instanceof Error ? error.message : 'Network error while fetching campaigns');
  }
};

export const createCampaign = async (campaign: Omit<CampaignCreate, 'created_by'>): Promise<HiringCampaign> => {
  try {
    const userId = sessionStorage.getItem('user_id');
    if (!userId) {
      console.error('No user_id found in sessionStorage');
      throw new Error('User not authenticated. Please log in.');
    }

    const payload: CampaignCreate = {
      ...campaign,
      created_by: userId,
      talentAcquisitionTeam: campaign.talentAcquisitionTeam.map(({ name, email, role }) => ({
        name,
        email,
        role,
      })),
    };
    console.log('Sending payload to /api/new-campaign:', JSON.stringify(payload, null, 2)); // Enhanced logging

    const response = await apiClient.post<HiringCampaign>('/api/new-campaign', payload);
    console.log('API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in createCampaign:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Create campaign API error:', error.response.data);
      throw new Error((error.response.data as ApiError).error || 'Failed to create campaign');
    }
    throw new Error(error instanceof Error ? error.message : 'Network error while creating campaign');
  }
};

export const fetchCampaignById = async (campaignId: string): Promise<HiringCampaign> => {
  try {
    const response = await apiClient.get<HiringCampaign>(`/api/campaign/${campaignId}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error((error.response.data as ApiError).error || 'Failed to fetch campaign');
    }
    throw new Error('Network error while fetching campaign');
  }
};

export const createManagerCampaign = async (campaign: ManagerCampaignCreate): Promise<ManagerCampaign> => {
  try {
    console.log('Sending payload to /api/create-campaign:', campaign);
    const response = await apiClient.post<ManagerCampaign>('/api/create-campaign', campaign);
    console.log('Create manager campaign response:', response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error("Create manager campaign API error:", error.response.data);
      throw new Error((error.response.data as ApiError).error || 'Failed to create campaign');
    }
    console.error("Create manager campaign network error:", error);
    throw new Error('Network error while creating campaign');
  }
};

export const fetchAllManagerCampaigns = async (clientId?: string): Promise<ManagerCampaign[]> => {
  try {
    const params = clientId ? { client_id: clientId } : {};
    console.log("Sending fetch all manager campaigns request with params:", params);
    const response = await apiClient.get<ManagerCampaign[]>('/api/get-campaigns', { params });
    console.log("Fetch all manager campaigns response:", response.data);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error("Fetch manager campaigns API error:", error.response.data);
      throw new Error((error.response.data as ApiError).error || 'Failed to fetch campaigns');
    }
    console.error("Fetch manager campaigns network error:", error);
    throw new Error('Network error while fetching campaigns');
  }
};

export const fetchManagerCampaignById = async (campaignId: string): Promise<ManagerCampaign> => {
  try {
    if (!campaignId || campaignId.trim() === '' || campaignId.toLowerCase() === 'none') {
      console.error('fetchManagerCampaignById: Invalid campaignId', campaignId);
      throw new Error('Campaign ID is required to fetch campaign');
    }
    console.log('fetchManagerCampaignById: Sending request for campaignId:', campaignId);
    const response = await apiClient.get<ManagerCampaign>(`/api/each-campaign/${campaignId}`);
    console.log('fetchManagerCampaignById: Response received:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('fetchManagerCampaignById: Error:', error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('fetchManagerCampaignById: Error response:', JSON.stringify(error.response.data, null, 2));
      throw new Error((error.response.data as ApiError).error || 'Failed to fetch campaign');
    }
    throw new Error(error instanceof Error ? error.message : 'Network error while fetching campaign');
  }
};