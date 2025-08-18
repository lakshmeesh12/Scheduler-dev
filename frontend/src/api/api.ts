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
