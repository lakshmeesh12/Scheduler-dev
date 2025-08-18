const ProfileService = require('../../application/services/ProfileService');
const ExcelProcessingService = require('../../application/services/ExcelProcessingService');
const { profileValidation, queryValidation } = require('../../infrastructure/validation/schemas');
const fs = require('fs');

class ProfileController {
  constructor() {
    this.profileService = new ProfileService();
    this.excelProcessingService = new ExcelProcessingService();
  }

  async createProfile(req, res, next) {
    try {
      // Validate request body
      const { error, value } = profileValidation.create.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.details.map(d => d.message)
          }
        });
      }

      // Create profile with file if uploaded
      const profile = await this.profileService.createProfile(value, req.file);

      res.status(201).json({
        success: true,
        data: {
          profile,
          message: 'Profile created successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getProfileById(req, res, next) {
    try {
      const { id } = req.params;
      
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid profile ID format' }
        });
      }

      const profile = await this.profileService.getProfileById(id);

      res.status(200).json({
        success: true,
        data: { profile }
      });
    } catch (error) {
      if (error.message === 'Profile not found') {
        return res.status(404).json({
          success: false,
          error: { message: 'Profile not found' }
        });
      }
      next(error);
    }
  }

  async getAllProfiles(req, res, next) {
    try {
      // Validate query parameters
      const { error, value } = queryValidation.pagination.validate(req.query);
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid query parameters',
            details: error.details.map(d => d.message)
          }
        });
      }

      const result = await this.profileService.getAllProfiles(value);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const { id } = req.params;
      
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid profile ID format' }
        });
      }

      // Validate request body
      const { error, value } = profileValidation.update.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.details.map(d => d.message)
          }
        });
      }

      const profile = await this.profileService.updateProfile(id, value);

      res.status(200).json({
        success: true,
        data: {
          profile,
          message: 'Profile updated successfully'
        }
      });
    } catch (error) {
      if (error.message === 'Profile not found') {
        return res.status(404).json({
          success: false,
          error: { message: 'Profile not found' }
        });
      }
      next(error);
    }
  }

  async deleteProfile(req, res, next) {
    try {
      const { id } = req.params;
      
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid profile ID format' }
        });
      }

      await this.profileService.deleteProfile(id);

      res.status(200).json({
        success: true,
        data: { message: 'Profile deleted successfully' }
      });
    } catch (error) {
      if (error.message === 'Profile not found') {
        return res.status(404).json({
          success: false,
          error: { message: 'Profile not found' }
        });
      }
      next(error);
    }
  }

  async searchProfiles(req, res, next) {
    try {
      // Validate search parameters
      const searchValidation = queryValidation.search.validate(req.query);
      const paginationValidation = queryValidation.pagination.validate(req.query);

      if (searchValidation.error || paginationValidation.error) {
        const errors = [
          ...(searchValidation.error?.details || []),
          ...(paginationValidation.error?.details || [])
        ];
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid query parameters',
            details: errors.map(d => d.message)
          }
        });
      }

      const searchParams = searchValidation.value;
      const paginationParams = paginationValidation.value;

      let profiles;
      if (searchParams.query) {
        profiles = await this.profileService.searchProfiles(searchParams.query, paginationParams);
      } else if (searchParams.skills && searchParams.skills.length > 0) {
        profiles = await this.profileService.findProfilesBySkills(searchParams.skills, paginationParams);
      } else {
        profiles = await this.profileService.getAllProfiles(paginationParams);
      }

      res.status(200).json({
        success: true,
        data: profiles
      });
    } catch (error) {
      next(error);
    }
  }

  async extractSkills(req, res, next) {
    try {
      const { resumeText } = req.body;

      if (!resumeText || resumeText.trim() === '') {
        return res.status(400).json({
          success: false,
          error: { message: 'Resume text is required' }
        });
      }

      const skills = await this.profileService.extractSkillsFromResume(resumeText);

      res.status(200).json({
        success: true,
        data: { skills }
      });
    } catch (error) {
      next(error);
    }
  }

  async importFromExcel(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { message: 'Excel file is required' }
        });
      }

      // Validate Excel file structure first
      const validation = this.excelProcessingService.validateExcelStructure(req.file.path);
      
      if (!validation.valid) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid Excel file structure',
            details: validation.error
          }
        });
      }

      // Process the Excel file
      const result = await this.excelProcessingService.processExcelFile(req.file.path);

      // Clean up uploaded file after processing
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup uploaded file:', cleanupError.message);
      }

      res.status(200).json({
        success: true,
        data: {
          ...result,
          message: `Successfully processed ${result.processed} records. Created: ${result.created}, Linked to existing: ${result.linkedToExisting}, Errors: ${result.errors.length}`
        }
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.warn('Failed to cleanup uploaded file:', cleanupError.message);
        }
      }
      next(error);
    }
  }

  async validateExcelFile(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { message: 'Excel file is required' }
        });
      }

      const validation = this.excelProcessingService.validateExcelStructure(req.file.path);

      // Clean up uploaded file after validation
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to cleanup uploaded file:', cleanupError.message);
      }

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid Excel file structure',
            details: validation.error
          }
        });
      }

      res.status(200).json({
        success: true,
        data: {
          message: 'Excel file structure is valid',
          validation: validation
        }
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.warn('Failed to cleanup uploaded file:', cleanupError.message);
        }
      }
      next(error);
    }
  }

  async downloadExcelTemplate(req, res, next) {
    try {
      const templateData = this.excelProcessingService.getExcelTemplate();
      
      res.status(200).json({
        success: true,
        data: {
          template: templateData,
          headers: [
            'S.no', 'Candidate Name', 'Mobile Number', 'E mail Id',
            'Total Experience', 'Company', 'CTC', 'ECTC', 'Offer in Hand',
            'Notice', 'Current Location', 'Preferred Location', 'Availability for interview'
          ],
          alternativeHeaders: {
            email: ['E mail Id', 'Email', 'Email Id', 'Email ID', 'E-mail', 'Mail Id', 'Mail ID'],
            phone: ['Mobile Number', 'Mobile', 'Phone', 'Phone Number', 'Contact Number', 'Contact'],
            name: ['Candidate Name', 'Name', 'Full Name', 'Candidate'],
            experience: ['Total Experience', 'Experience', 'Total Exp', 'Exp', 'Years of Experience', 'Work Experience']
          },
          requiredFields: 'Either Email OR Phone number (or both)',
          message: 'Excel template structure with flexible header options - requires either email or phone'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getExcelImportsByUserId(req, res, next) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { message: 'User ID is required' }
        });
      }

      const imports = await this.excelProcessingService.getImportsByUserId(userId);

      res.status(200).json({
        success: true,
        data: { imports }
      });
    } catch (error) {
      next(error);
    }
  }

  async getExcelImportsByBatch(req, res, next) {
    try {
      const { batchId } = req.params;
      
      if (!batchId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Batch ID is required' }
        });
      }

      const imports = await this.excelProcessingService.getImportsByBatch(batchId);

      res.status(200).json({
        success: true,
        data: { imports }
      });
    } catch (error) {
      next(error);
    }
  }

  async getExcelImportStats(req, res, next) {
    try {
      const { batchId } = req.params;
      
      if (!batchId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Batch ID is required' }
        });
      }

      const stats = await this.excelProcessingService.getImportStats(batchId);

      res.status(200).json({
        success: true,
        data: { stats }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ProfileController;
