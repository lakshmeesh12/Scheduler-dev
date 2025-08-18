const ProfileRepository = require('../../domain/repositories/ProfileRepository');
const JobDescriptionRepository = require('../../domain/repositories/JobDescriptionRepository');
const MatchResultRepository = require('../../domain/repositories/MatchResultRepository');
const AIServiceClient = require('../../infrastructure/external/AIServiceClient');

class MatchingService {
  constructor() {
    this.profileRepository = new ProfileRepository();
    this.jobDescriptionRepository = new JobDescriptionRepository();
    this.matchResultRepository = new MatchResultRepository();
    this.aiServiceClient = new AIServiceClient();
  }

  async findMatchingProfiles(jobId, options = {}) {
    try {
      const { limit = 20, minScore = 60 } = options;

      // Get job description
      const job = await this.jobDescriptionRepository.findById(jobId);
      if (!job) {
        throw new Error('Job description not found');
      }

      // Get all active profiles
      const profilesData = await this.profileRepository.findAll({ limit: 1000 });
      const profiles = profilesData.profiles;

      if (profiles.length === 0) {
        return {
          matches: [],
          totalMatches: 0,
          jobDescription: job
        };
      }

      // Calculate matches for each profile
      const matches = [];
      for (const profile of profiles) {
        try {
          const matchResult = await this.calculateMatch(job, profile);
          
          if (matchResult.matchScore >= minScore) {
            matches.push(matchResult);
          }
        } catch (error) {
          console.warn(`Failed to calculate match for profile ${profile._id}:`, error.message);
        }
      }

      // Sort by match score and limit results
      matches.sort((a, b) => b.matchScore - a.matchScore);
      const limitedMatches = matches.slice(0, limit);

      // Save match results to database
      try {
        await this.matchResultRepository.bulkCreate(limitedMatches);
      } catch (error) {
        console.warn('Failed to save match results:', error.message);
      }

      return {
        matches: limitedMatches,
        totalMatches: matches.length,
        jobDescription: job
      };
    } catch (error) {
      throw new Error(`Failed to find matching profiles: ${error.message}`);
    }
  }

  async calculateMatch(job, profile) {
    try {
      // Calculate different aspects of the match
      const skillsMatch = this._calculateSkillsMatch(job.skills, profile.skills);
      const experienceMatch = this._calculateExperienceMatch(job, profile.experience);
      const educationMatch = this._calculateEducationMatch(job, profile.education);
      
      // Calculate AI-based semantic similarity if embeddings are available
      let aiAnalysis = {
        semanticSimilarity: 0,
        keywordMatch: 0,
        contextualRelevance: 0
      };

      if (job.aiEmbedding && profile.aiEmbedding) {
        try {
          aiAnalysis = await this.aiServiceClient.calculateSimilarity(
            job.aiEmbedding,
            profile.aiEmbedding
          );
        } catch (error) {
          console.warn('Failed to calculate AI similarity:', error.message);
        }
      }

      // Calculate overall match score (weighted average)
      const weights = {
        skills: 0.4,
        experience: 0.3,
        education: 0.1,
        ai: 0.2
      };

      const overallScore = (
        skillsMatch.score * weights.skills +
        experienceMatch.score * weights.experience +
        educationMatch.score * weights.education +
        aiAnalysis.semanticSimilarity * weights.ai
      );

      // Generate match insights
      const matchDetails = this._generateMatchInsights(
        skillsMatch,
        experienceMatch,
        educationMatch
      );

      return {
        jobDescriptionId: job._id,
        profileId: profile._id,
        matchScore: Math.round(overallScore),
        matchDetails,
        aiAnalysis,
        status: 'Active'
      };
    } catch (error) {
      throw new Error(`Failed to calculate match: ${error.message}`);
    }
  }

  _calculateSkillsMatch(jobSkills, profileSkills) {
    if (!jobSkills || !profileSkills || jobSkills.length === 0 || profileSkills.length === 0) {
      return {
        score: 0,
        matchedSkills: [],
        missingSkills: jobSkills ? jobSkills.map(s => s.name) : []
      };
    }

    const profileSkillNames = profileSkills.map(s => s.name.toLowerCase());

    const matchedSkills = [];
    const missingSkills = [];

    jobSkills.forEach(jobSkill => {
      const skillName = jobSkill.name.toLowerCase();
      if (profileSkillNames.includes(skillName)) {
        matchedSkills.push(jobSkill.name);
      } else {
        missingSkills.push(jobSkill.name);
      }
    });

    // Calculate score based on required vs preferred skills
    let score = 0;
    const requiredSkills = jobSkills.filter(s => s.importance === 'Required');
    const preferredSkills = jobSkills.filter(s => s.importance === 'Preferred');

    if (requiredSkills.length > 0) {
      const matchedRequired = requiredSkills.filter(s => 
        profileSkillNames.includes(s.name.toLowerCase())
      ).length;
      score += (matchedRequired / requiredSkills.length) * 70; // 70% weight for required
    }

    if (preferredSkills.length > 0) {
      const matchedPreferred = preferredSkills.filter(s => 
        profileSkillNames.includes(s.name.toLowerCase())
      ).length;
      score += (matchedPreferred / preferredSkills.length) * 30; // 30% weight for preferred
    }

    return {
      score: Math.min(score, 100),
      matchedSkills,
      missingSkills
    };
  }

  _calculateExperienceMatch(job, profileExperience) {
    if (!profileExperience || profileExperience.length === 0) {
      return {
        score: 0,
        yearsExperience: 0,
        relevantExperience: []
      };
    }

    // Calculate total years of experience
    const currentDate = new Date();
    let totalYears = 0;
    const relevantExperience = [];

    profileExperience.forEach(exp => {
      const startDate = new Date(exp.startDate);
      const endDate = exp.endDate ? new Date(exp.endDate) : currentDate;
      const years = (endDate - startDate) / (365.25 * 24 * 60 * 60 * 1000);
      totalYears += years;

      // Check if experience is relevant based on job requirements
      const jobDescription = `${job.description} ${job.requirements}`.toLowerCase();
      const expDescription = `${exp.position} ${exp.description || ''}`.toLowerCase();
      
      // Simple relevance check (can be enhanced with AI)
      if (this._hasRelevantKeywords(jobDescription, expDescription)) {
        relevantExperience.push(exp.position);
      }
    });

    // Score based on experience level requirements
    let score = 50; // Base score

    const experienceLevelScores = {
      'Entry': { min: 0, max: 2 },
      'Mid': { min: 2, max: 5 },
      'Senior': { min: 5, max: 10 },
      'Lead': { min: 7, max: 15 },
      'Executive': { min: 10, max: 20 }
    };

    const levelReq = experienceLevelScores[job.experienceLevel];
    if (levelReq) {
      if (totalYears >= levelReq.min && totalYears <= levelReq.max) {
        score = 90;
      } else if (totalYears >= levelReq.min) {
        score = 80; // Over-qualified
      } else {
        score = Math.max(20, (totalYears / levelReq.min) * 60); // Under-qualified
      }
    }

    // Bonus for relevant experience
    if (relevantExperience.length > 0) {
      score += 10;
    }

    return {
      score: Math.min(score, 100),
      yearsExperience: Math.round(totalYears * 10) / 10,
      relevantExperience
    };
  }

  _calculateEducationMatch(job, profileEducation) {
    if (!profileEducation || profileEducation.length === 0) {
      return {
        score: 30, // Base score for no education info
        relevantEducation: []
      };
    }

    const relevantEducation = [];
    let score = 50; // Base score

    profileEducation.forEach(edu => {
      // Check for relevant degree/field
      const jobRequirements = `${job.description} ${job.requirements}`.toLowerCase();
      const eduInfo = `${edu.degree} ${edu.field}`.toLowerCase();

      if (this._hasRelevantKeywords(jobRequirements, eduInfo)) {
        relevantEducation.push(`${edu.degree} in ${edu.field}`);
        score += 20;
      }

      // Bonus for higher education
      if (edu.degree.toLowerCase().includes('master')) {
        score += 10;
      } else if (edu.degree.toLowerCase().includes('phd')) {
        score += 15;
      }
    });

    return {
      score: Math.min(score, 100),
      relevantEducation
    };
  }

  _hasRelevantKeywords(jobText, candidateText) {
    // Simple keyword matching (can be enhanced with NLP)
    const jobWords = jobText.split(/\W+/).filter(word => word.length > 3);
    const candidateWords = candidateText.split(/\W+/).filter(word => word.length > 3);

    const commonWords = jobWords.filter(word => 
      candidateWords.some(cWord => cWord.includes(word) || word.includes(cWord))
    );

    return commonWords.length >= 2; // At least 2 common words
  }

  _generateMatchInsights(skillsMatch, experienceMatch, educationMatch) {
    const strengths = [];
    const weaknesses = [];
    const recommendations = [];

    // Analyze strengths
    if (skillsMatch.score >= 80) {
      strengths.push('Strong technical skills alignment');
    }
    if (experienceMatch.score >= 80) {
      strengths.push('Relevant work experience');
    }
    if (educationMatch.score >= 80) {
      strengths.push('Appropriate educational background');
    }

    // Analyze weaknesses
    if (skillsMatch.score < 60) {
      weaknesses.push('Missing key technical skills');
      if (skillsMatch.missingSkills.length > 0) {
        recommendations.push(`Consider training in: ${skillsMatch.missingSkills.slice(0, 3).join(', ')}`);
      }
    }
    if (experienceMatch.score < 60) {
      weaknesses.push('Limited relevant experience');
      recommendations.push('May require additional mentoring or training');
    }

    // General recommendations
    if (strengths.length === 0) {
      recommendations.push('Consider alternative candidates or modify requirements');
    } else if (weaknesses.length === 1) {
      recommendations.push('Good candidate with minor gaps');
    }

    return {
      skillsMatch,
      experienceMatch,
      educationMatch,
      overallMatch: {
        strengths,
        weaknesses,
        recommendations
      }
    };
  }

  async getMatchResults(jobId, options = {}) {
    try {
      return await this.matchResultRepository.findByJobId(jobId, options);
    } catch (error) {
      throw new Error(`Failed to get match results: ${error.message}`);
    }
  }

  async updateMatchStatus(matchId, status, reviewedBy, notes) {
    try {
      return await this.matchResultRepository.updateStatus(matchId, status, reviewedBy, notes);
    } catch (error) {
      throw new Error(`Failed to update match status: ${error.message}`);
    }
  }

  async getMatchStatistics(jobId) {
    try {
      return await this.matchResultRepository.getMatchStatistics(jobId);
    } catch (error) {
      throw new Error(`Failed to get match statistics: ${error.message}`);
    }
  }
}

module.exports = MatchingService;
