const axios = require('axios');

class AIServiceClient {
  constructor() {
    this.baseURL = process.env.AI_SERVER_URL || 'http://localhost:5000';
    this.apiKey = process.env.AI_SERVER_API_KEY;
    this.timeout = 30000; // 30 seconds
  }

  async generateProfileEmbedding(profileData) {
    try {
      // Combine profile text for embedding generation
      const profileText = this._combineProfileText(profileData);
      
      const response = await axios.post(
        `${this.baseURL}/api/embeddings/profile`,
        {
          text: profileText,
          type: 'profile'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: this.timeout
        }
      );

      return response.data.embedding;
    } catch (error) {
      console.error('AI Service Error (Profile Embedding):', error.message);
      throw new Error(`Failed to generate profile embedding: ${error.message}`);
    }
  }

  async generateJobEmbedding(jobData) {
    try {
      // Combine job text for embedding generation
      const jobText = this._combineJobText(jobData);
      
      const response = await axios.post(
        `${this.baseURL}/api/embeddings/job`,
        {
          text: jobText,
          type: 'job'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: this.timeout
        }
      );

      return response.data.embedding;
    } catch (error) {
      console.error('AI Service Error (Job Embedding):', error.message);
      throw new Error(`Failed to generate job embedding: ${error.message}`);
    }
  }

  async calculateSimilarity(embedding1, embedding2) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/similarity`,
        {
          embedding1,
          embedding2
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: this.timeout
        }
      );

      return {
        semanticSimilarity: response.data.similarity * 100, // Convert to percentage
        keywordMatch: response.data.keywordMatch || 0,
        contextualRelevance: response.data.contextualRelevance || 0
      };
    } catch (error) {
      console.error('AI Service Error (Similarity):', error.message);
      throw new Error(`Failed to calculate similarity: ${error.message}`);
    }
  }

  async extractSkills(resumeText) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/extract/skills`,
        {
          text: resumeText
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: this.timeout
        }
      );

      return response.data.skills.map(skill => ({
        name: skill.name,
        level: skill.level || 'Intermediate',
        confidence: skill.confidence || 0.8
      }));
    } catch (error) {
      console.error('AI Service Error (Skill Extraction):', error.message);
      throw new Error(`Failed to extract skills: ${error.message}`);
    }
  }

  async extractJobRequirements(jobDescription) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/extract/requirements`,
        {
          text: jobDescription
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: this.timeout
        }
      );

      return {
        skills: response.data.skills || [],
        experience: response.data.experience || '',
        education: response.data.education || '',
        certifications: response.data.certifications || []
      };
    } catch (error) {
      console.error('AI Service Error (Requirements Extraction):', error.message);
      throw new Error(`Failed to extract requirements: ${error.message}`);
    }
  }

  async analyzeProfileJobFit(profileText, jobDescription) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/analyze/fit`,
        {
          profile: profileText,
          job: jobDescription
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: this.timeout
        }
      );

      return {
        fitScore: response.data.fitScore,
        strengths: response.data.strengths || [],
        weaknesses: response.data.weaknesses || [],
        recommendations: response.data.recommendations || [],
        confidence: response.data.confidence || 0.8
      };
    } catch (error) {
      console.error('AI Service Error (Profile-Job Fit):', error.message);
      throw new Error(`Failed to analyze profile-job fit: ${error.message}`);
    }
  }

  async getRankingExplanation(matches) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/explain/ranking`,
        {
          matches: matches.map(match => ({
            profileId: match.profileId,
            score: match.matchScore,
            details: match.matchDetails
          }))
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: this.timeout
        }
      );

      return response.data.explanation;
    } catch (error) {
      console.error('AI Service Error (Ranking Explanation):', error.message);
      throw new Error(`Failed to get ranking explanation: ${error.message}`);
    }
  }

  async checkServiceHealth() {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000
      });

      return {
        status: 'healthy',
        version: response.data.version || 'unknown',
        uptime: response.data.uptime || 0
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  _combineProfileText(profileData) {
    const parts = [
      `Name: ${profileData.firstName} ${profileData.lastName}`,
      profileData.resumeText || '',
      `Skills: ${(profileData.skills || []).map(s => s.name).join(', ')}`,
      `Experience: ${(profileData.experience || []).map(exp => 
        `${exp.position} at ${exp.company} - ${exp.description || ''}`
      ).join('. ')}`,
      `Education: ${(profileData.education || []).map(edu => 
        `${edu.degree} in ${edu.field} from ${edu.institution}`
      ).join('. ')}`
    ];

    return parts.filter(part => part.trim() !== '').join('\n\n');
  }

  _combineJobText(jobData) {
    const parts = [
      `Position: ${jobData.title}`,
      `Company: ${jobData.company}`,
      `Experience Level: ${jobData.experienceLevel}`,
      `Description: ${jobData.description}`,
      `Requirements: ${jobData.requirements}`,
      `Skills: ${(jobData.skills || []).map(s => `${s.name} (${s.importance})`).join(', ')}`,
      jobData.location ? `Location: ${jobData.location}` : '',
      jobData.employmentType ? `Type: ${jobData.employmentType}` : ''
    ];

    return parts.filter(part => part.trim() !== '').join('\n\n');
  }
}

module.exports = AIServiceClient;
