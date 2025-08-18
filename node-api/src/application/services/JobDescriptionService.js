const JobDescriptionRepository = require('../../domain/repositories/JobDescriptionRepository');
const AIServiceClient = require('../../infrastructure/external/AIServiceClient');

class JobDescriptionService {
  constructor() {
    this.jobDescriptionRepository = new JobDescriptionRepository();
    this.aiServiceClient = new AIServiceClient();
  }

  async createJobDescription(jobData) {
    try {
      // Create job description in database
      const job = await this.jobDescriptionRepository.create(jobData);

      // Generate AI embedding for the job description
      try {
        const embedding = await this.aiServiceClient.generateJobEmbedding(jobData);
        if (embedding) {
          await this.jobDescriptionRepository.updateAiEmbedding(job._id, embedding);
        }
      } catch (aiError) {
        console.warn('Failed to generate AI embedding for job:', aiError.message);
      }

      return job;
    } catch (error) {
      throw new Error(`Failed to create job description: ${error.message}`);
    }
  }

  async getJobDescriptionById(id) {
    try {
      const job = await this.jobDescriptionRepository.findById(id);
      if (!job) {
        throw new Error('Job description not found');
      }
      return job;
    } catch (error) {
      throw new Error(`Failed to get job description: ${error.message}`);
    }
  }

  async getAllJobDescriptions(options = {}) {
    try {
      return await this.jobDescriptionRepository.findAll(options);
    } catch (error) {
      throw new Error(`Failed to get job descriptions: ${error.message}`);
    }
  }

  async updateJobDescription(id, updateData) {
    try {
      const job = await this.jobDescriptionRepository.update(id, updateData);
      if (!job) {
        throw new Error('Job description not found');
      }

      // Regenerate AI embedding if job content changed
      if (updateData.description || updateData.requirements || updateData.skills) {
        try {
          const embedding = await this.aiServiceClient.generateJobEmbedding(job);
          if (embedding) {
            await this.jobDescriptionRepository.updateAiEmbedding(id, embedding);
          }
        } catch (aiError) {
          console.warn('Failed to update AI embedding for job:', aiError.message);
        }
      }

      return job;
    } catch (error) {
      throw new Error(`Failed to update job description: ${error.message}`);
    }
  }

  async deleteJobDescription(id) {
    try {
      const job = await this.jobDescriptionRepository.delete(id);
      if (!job) {
        throw new Error('Job description not found');
      }
      return { message: 'Job description deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete job description: ${error.message}`);
    }
  }

  async searchJobDescriptions(searchText, options = {}) {
    try {
      if (!searchText || searchText.trim() === '') {
        return await this.getAllJobDescriptions(options);
      }

      return await this.jobDescriptionRepository.searchByText(searchText, options);
    } catch (error) {
      throw new Error(`Failed to search job descriptions: ${error.message}`);
    }
  }

  async findJobsByCompany(company, options = {}) {
    try {
      if (!company || company.trim() === '') {
        throw new Error('Company name is required');
      }

      return await this.jobDescriptionRepository.findByCompany(company, options);
    } catch (error) {
      throw new Error(`Failed to find jobs by company: ${error.message}`);
    }
  }

  async findJobsBySkills(skills, options = {}) {
    try {
      if (!skills || skills.length === 0) {
        throw new Error('Skills array is required');
      }

      return await this.jobDescriptionRepository.findBySkills(skills, options);
    } catch (error) {
      throw new Error(`Failed to find jobs by skills: ${error.message}`);
    }
  }

  async extractRequirementsFromDescription(description) {
    try {
      return await this.aiServiceClient.extractJobRequirements(description);
    } catch (error) {
      console.warn('Failed to extract requirements using AI:', error.message);
      // Fallback to basic extraction
      return this._extractRequirementsBasic(description);
    }
  }

  async validateJobData(jobData) {
    const errors = [];

    // Required fields validation
    if (!jobData.title || jobData.title.trim() === '') {
      errors.push('Job title is required');
    }

    if (!jobData.company || jobData.company.trim() === '') {
      errors.push('Company name is required');
    }

    if (!jobData.description || jobData.description.trim() === '') {
      errors.push('Job description is required');
    }

    if (!jobData.requirements || jobData.requirements.trim() === '') {
      errors.push('Job requirements are required');
    }

    if (!jobData.experienceLevel) {
      errors.push('Experience level is required');
    }

    if (!jobData.createdBy || jobData.createdBy.trim() === '') {
      errors.push('Created by field is required');
    }

    // Validate experience level
    const validExperienceLevels = ['Entry', 'Mid', 'Senior', 'Lead', 'Executive'];
    if (jobData.experienceLevel && !validExperienceLevels.includes(jobData.experienceLevel)) {
      errors.push('Invalid experience level');
    }

    // Validate employment type
    const validEmploymentTypes = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'];
    if (jobData.employmentType && !validEmploymentTypes.includes(jobData.employmentType)) {
      errors.push('Invalid employment type');
    }

    // Validate salary range
    if (jobData.salaryRange) {
      if (jobData.salaryRange.min && jobData.salaryRange.max) {
        if (jobData.salaryRange.min > jobData.salaryRange.max) {
          errors.push('Minimum salary cannot be greater than maximum salary');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  _extractRequirementsBasic(description) {
    // Basic requirements extraction using common patterns
    const requirements = {
      skills: [],
      experience: '',
      education: ''
    };

    const descriptionLower = description.toLowerCase();

    // Extract common technical skills
    const commonSkills = [
      'javascript', 'python', 'java', 'react', 'angular', 'node.js',
      'sql', 'mongodb', 'git', 'docker', 'aws', 'azure'
    ];

    commonSkills.forEach(skill => {
      if (descriptionLower.includes(skill)) {
        requirements.skills.push({
          name: skill.charAt(0).toUpperCase() + skill.slice(1),
          importance: 'Required'
        });
      }
    });

    // Extract experience requirements
    const experiencePattern = /(\d+)[\s\-+]*years?\s+(?:of\s+)?experience/i;
    const experienceMatch = description.match(experiencePattern);
    if (experienceMatch) {
      requirements.experience = experienceMatch[0];
    }

    // Extract education requirements
    const educationKeywords = ['degree', 'bachelor', 'master', 'phd', 'diploma', 'certification'];
    const educationSentences = description.split(/[.!?]/).filter(sentence => {
      return educationKeywords.some(keyword => 
        sentence.toLowerCase().includes(keyword)
      );
    });

    if (educationSentences.length > 0) {
      requirements.education = educationSentences[0].trim();
    }

    return requirements;
  }
}

module.exports = JobDescriptionService;
