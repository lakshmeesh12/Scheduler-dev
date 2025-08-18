const ProfileRepository = require('../../domain/repositories/ProfileRepository');
const ExcelImportRepository = require('../../domain/repositories/ExcelImportRepository');
const AIServiceClient = require('../../infrastructure/external/AIServiceClient');

class ProfileService {
  constructor() {
    this.profileRepository = new ProfileRepository();
    this.excelImportRepository = new ExcelImportRepository();
    this.aiServiceClient = new AIServiceClient();
  }

  async createProfile(profileData, resumeFile = null) {
    try {
      // Add resume file information if provided
      if (resumeFile) {
        profileData.resumeFile = {
          filename: resumeFile.filename,
          originalName: resumeFile.originalname,
          mimeType: resumeFile.mimetype,
          size: resumeFile.size,
          path: resumeFile.path
        };
      }

      // Create profile in database
      const profile = await this.profileRepository.create(profileData);

      // Generate AI embedding for the profile
      try {
        const embedding = await this.aiServiceClient.generateProfileEmbedding(profileData);
        if (embedding) {
          await this.profileRepository.updateAiEmbedding(profile._id, embedding);
        }
      } catch (aiError) {
        console.warn('Failed to generate AI embedding for profile:', aiError.message);
        // Continue without AI embedding
      }

      return profile;
    } catch (error) {
      throw new Error(`Failed to create profile: ${error.message}`);
    }
  }

  async getProfileById(id) {
    try {
      const profile = await this.profileRepository.findById(id);
      if (!profile) {
        throw new Error('Profile not found');
      }
      
      // Merge with Excel import data
      const mergedProfile = await this._mergeProfileWithExcelData(profile);
      
      return mergedProfile;
    } catch (error) {
      throw new Error(`Failed to get profile: ${error.message}`);
    }
  }

  async getAllProfiles(options = {}) {
    try {
      // Get profiles from the profiles collection
      const profilesResult = await this.profileRepository.findAll(options);
      
      // Merge with Excel import data
      const mergedProfiles = await this._mergeProfilesWithExcelData(profilesResult.profiles);
      
      // Get standalone Excel import records (records without linked profiles)
      const standaloneExcelProfiles = await this._getStandaloneExcelProfiles(options);
      
      // Combine merged profiles with standalone Excel profiles
      const allProfiles = [...mergedProfiles, ...standaloneExcelProfiles];
      
      return {
        ...profilesResult,
        profiles: allProfiles,
        total: profilesResult.total + standaloneExcelProfiles.length
      };
    } catch (error) {
      throw new Error(`Failed to get profiles: ${error.message}`);
    }
  }

  async updateProfile(id, updateData) {
    try {
      const profile = await this.profileRepository.update(id, updateData);
      if (!profile) {
        throw new Error('Profile not found');
      }

      // Regenerate AI embedding if profile content changed
      if (updateData.resumeText || updateData.skills || updateData.experience) {
        try {
          const embedding = await this.aiServiceClient.generateProfileEmbedding(profile);
          if (embedding) {
            await this.profileRepository.updateAiEmbedding(id, embedding);
          }
        } catch (aiError) {
          console.warn('Failed to update AI embedding for profile:', aiError.message);
        }
      }

      return profile;
    } catch (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }
  }

  async deleteProfile(id) {
    try {
      const profile = await this.profileRepository.delete(id);
      if (!profile) {
        throw new Error('Profile not found');
      }
      return { message: 'Profile deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete profile: ${error.message}`);
    }
  }

  async searchProfiles(searchText, options = {}) {
    try {
      if (!searchText || searchText.trim() === '') {
        return await this.getAllProfiles(options);
      }

      const searchResult = await this.profileRepository.searchByText(searchText, options);
      
      // Merge with Excel import data
      const mergedProfiles = await this._mergeProfilesWithExcelData(searchResult.profiles || searchResult);
      
      return {
        ...searchResult,
        profiles: mergedProfiles
      };
    } catch (error) {
      throw new Error(`Failed to search profiles: ${error.message}`);
    }
  }

  async findProfilesBySkills(skills, options = {}) {
    try {
      if (!skills || skills.length === 0) {
        throw new Error('Skills array is required');
      }

      const skillsResult = await this.profileRepository.findBySkills(skills, options);
      
      // Merge with Excel import data
      const mergedProfiles = await this._mergeProfilesWithExcelData(skillsResult.profiles || skillsResult);
      
      return {
        ...skillsResult,
        profiles: mergedProfiles
      };
    } catch (error) {
      throw new Error(`Failed to find profiles by skills: ${error.message}`);
    }
  }

  async extractSkillsFromResume(resumeText) {
    try {
      return await this.aiServiceClient.extractSkills(resumeText);
    } catch (error) {
      console.warn('Failed to extract skills using AI:', error.message);
      // Fallback to basic keyword extraction
      return this._extractSkillsBasic(resumeText);
    }
  }

  async validateProfileData(profileData) {
    const errors = [];

    // Required fields validation
    if (!profileData.firstName || profileData.firstName.trim() === '') {
      errors.push('First name is required');
    }

    if (!profileData.lastName || profileData.lastName.trim() === '') {
      errors.push('Last name is required');
    }

    if (!profileData.email || profileData.email.trim() === '') {
      errors.push('Email is required');
    } else if (!this._isValidEmail(profileData.email)) {
      errors.push('Invalid email format');
    }

    if (!profileData.resumeText || profileData.resumeText.trim() === '') {
      errors.push('Resume text is required');
    }

    // Check for duplicate email
    if (profileData.email) {
      const existingProfile = await this.profileRepository.findByEmail(profileData.email);
      if (existingProfile) {
        errors.push('Profile with this email already exists');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  _extractSkillsBasic(resumeText) {
    // Basic skill extraction using common programming/technical keywords
    const commonSkills = [
      'JavaScript', 'Python', 'Java', 'C++', 'C#', 'React', 'Angular', 'Vue',
      'Node.js', 'Express', 'MongoDB', 'SQL', 'PostgreSQL', 'MySQL',
      'Git', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'HTML', 'CSS'
    ];

    const foundSkills = [];
    const resumeTextLower = resumeText.toLowerCase();

    commonSkills.forEach(skill => {
      if (resumeTextLower.includes(skill.toLowerCase())) {
        foundSkills.push({
          name: skill,
          level: 'Intermediate' // Default level
        });
      }
    });

    return foundSkills;
  }

  _isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async _mergeProfilesWithExcelData(profiles) {
    try {
      const mergedProfiles = [];
      
      for (const profile of profiles) {
        const mergedProfile = await this._mergeProfileWithExcelData(profile);
        mergedProfiles.push(mergedProfile);
      }
      
      return mergedProfiles;
    } catch (error) {
      console.warn('Error merging profiles with Excel data:', error.message);
      return profiles; // Return original profiles if merge fails
    }
  }

  async _mergeProfileWithExcelData(profile) {
    try {
      // Find Excel import data for this profile (by profileId or userId)
      let excelImportData = null;
      
      // First try to find by profileId
      if (profile._id) {
        excelImportData = await this.excelImportRepository.findByProfileId(profile._id);
      }
      
      // If not found by profileId, try by userId (in case profile ID is stored as userId)
      if (!excelImportData && profile._id) {
        excelImportData = await this.excelImportRepository.findByUserId(profile._id.toString());
      }
      
      // If no Excel data found, return original profile
      if (!excelImportData || excelImportData.length === 0) {
        return {
          ...profile.toObject ? profile.toObject() : profile,
          dataSource: 'profile_only'
        };
      }
      
      // Get the most recent Excel import record
      const latestExcelImport = Array.isArray(excelImportData) 
        ? excelImportData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
        : excelImportData;
      
      // Merge data with Excel import taking precedence
      const mergedProfile = {
        ...(profile.toObject ? profile.toObject() : profile)
      };
      
      // Map Excel import fields to profile fields (Excel data takes precedence)
      if (latestExcelImport.candidateName) {
        const nameParts = latestExcelImport.candidateName.trim().split(' ');
        mergedProfile.firstName = nameParts[0] || mergedProfile.firstName;
        mergedProfile.lastName = nameParts.slice(1).join(' ') || mergedProfile.lastName;
      }
      
      if (latestExcelImport.emailId) {
        mergedProfile.email = latestExcelImport.emailId;
      }
      
      if (latestExcelImport.mobileNumber) {
        mergedProfile.phone = latestExcelImport.mobileNumber;
      }
      
      if (latestExcelImport.totalExperience) {
        mergedProfile.totalExperience = latestExcelImport.totalExperience;
      }
      
      if (latestExcelImport.company) {
        mergedProfile.currentCompany = latestExcelImport.company;
      }
      
      if (latestExcelImport.ctc) {
        mergedProfile.ctc = latestExcelImport.ctc;
      }
      
      if (latestExcelImport.ectc) {
        mergedProfile.ectc = latestExcelImport.ectc;
      }
      
      if (latestExcelImport.offerInHand) {
        mergedProfile.offerInHand = latestExcelImport.offerInHand;
      }
      
      if (latestExcelImport.notice) {
        mergedProfile.noticePeriod = latestExcelImport.notice;
      }
      
      if (latestExcelImport.currentLocation) {
        mergedProfile.currentLocation = latestExcelImport.currentLocation;
      }
      
      if (latestExcelImport.preferredLocation) {
        mergedProfile.preferredLocation = latestExcelImport.preferredLocation;
      }
      
      if (latestExcelImport.availabilityForInterview) {
        mergedProfile.availabilityForInterview = latestExcelImport.availabilityForInterview;
      }
      
      // Add Excel import metadata
      mergedProfile.excelImportData = {
        importId: latestExcelImport.importId,
        importBatch: latestExcelImport.importBatch,
        fileName: latestExcelImport.fileName,
        importedAt: latestExcelImport.createdAt,
        status: latestExcelImport.status,
        matchedBy: latestExcelImport.matchedBy,
        processingNotes: latestExcelImport.processingNotes
      };
      
      mergedProfile.dataSource = 'merged_with_excel';
      
      return mergedProfile;
      
    } catch (error) {
      console.warn(`Error merging profile ${profile._id} with Excel data:`, error.message);
      return {
        ...profile.toObject ? profile.toObject() : profile,
        dataSource: 'profile_only'
      };
    }
  }

  async _getStandaloneExcelProfiles(options = {}) {
    try {
      // Get Excel import records that don't have linked profiles (profileId is null)
      const standaloneImports = await this.excelImportRepository.findStandaloneImports();
      
      if (!standaloneImports || standaloneImports.length === 0) {
        return [];
      }
      
      // Convert Excel import records to profile format
      const standaloneProfiles = standaloneImports.map(excelImport => {
        const nameParts = excelImport.candidateName ? excelImport.candidateName.trim().split(' ') : ['Unknown'];
        
        return {
          _id: excelImport.userId, // Use userId as profile ID for standalone records
          firstName: nameParts[0] || 'Unknown',
          lastName: nameParts.slice(1).join(' ') || '',
          email: excelImport.emailId,
          phone: excelImport.mobileNumber,
          totalExperience: excelImport.totalExperience,
          currentCompany: excelImport.company,
          ctc: excelImport.ctc,
          ectc: excelImport.ectc,
          offerInHand: excelImport.offerInHand,
          noticePeriod: excelImport.notice,
          currentLocation: excelImport.currentLocation,
          preferredLocation: excelImport.preferredLocation,
          availabilityForInterview: excelImport.availabilityForInterview,
          resumeText: `Profile imported from Excel: ${excelImport.candidateName || 'Unknown'}`,
          dataSource: 'excel_only',
          excelImportData: {
            importId: excelImport.importId,
            importBatch: excelImport.importBatch,
            fileName: excelImport.fileName,
            importedAt: excelImport.createdAt,
            status: excelImport.status,
            matchedBy: excelImport.matchedBy,
            processingNotes: excelImport.processingNotes,
            rowNumber: excelImport.rowNumber
          },
          createdAt: excelImport.createdAt,
          updatedAt: excelImport.updatedAt
        };
      });
      
      return standaloneProfiles;
      
    } catch (error) {
      console.warn('Error getting standalone Excel profiles:', error.message);
      return [];
    }
  }
}

module.exports = ProfileService;
