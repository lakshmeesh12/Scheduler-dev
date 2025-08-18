const JobDescriptionService = require('../../application/services/JobDescriptionService');
const { jobDescriptionValidation, queryValidation } = require('../../infrastructure/validation/schemas');

class JobDescriptionController {
  constructor() {
    this.jobDescriptionService = new JobDescriptionService();
  }

  async createJobDescription(req, res, next) {
    try {
      // Validate request body
      const { error, value } = jobDescriptionValidation.create.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.details.map(d => d.message)
          }
        });
      }

      const job = await this.jobDescriptionService.createJobDescription(value);

      res.status(201).json({
        success: true,
        data: {
          jobDescription: job,
          message: 'Job description created successfully'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async getJobDescriptionById(req, res, next) {
    try {
      const { id } = req.params;
      
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid job description ID format' }
        });
      }

      const job = await this.jobDescriptionService.getJobDescriptionById(id);

      res.status(200).json({
        success: true,
        data: { jobDescription: job }
      });
    } catch (error) {
      if (error.message === 'Job description not found') {
        return res.status(404).json({
          success: false,
          error: { message: 'Job description not found' }
        });
      }
      next(error);
    }
  }

  async getAllJobDescriptions(req, res, next) {
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

      const result = await this.jobDescriptionService.getAllJobDescriptions(value);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async updateJobDescription(req, res, next) {
    try {
      const { id } = req.params;
      
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid job description ID format' }
        });
      }

      // Validate request body
      const { error, value } = jobDescriptionValidation.update.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.details.map(d => d.message)
          }
        });
      }

      const job = await this.jobDescriptionService.updateJobDescription(id, value);

      res.status(200).json({
        success: true,
        data: {
          jobDescription: job,
          message: 'Job description updated successfully'
        }
      });
    } catch (error) {
      if (error.message === 'Job description not found') {
        return res.status(404).json({
          success: false,
          error: { message: 'Job description not found' }
        });
      }
      next(error);
    }
  }

  async deleteJobDescription(req, res, next) {
    try {
      const { id } = req.params;
      
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid job description ID format' }
        });
      }

      await this.jobDescriptionService.deleteJobDescription(id);

      res.status(200).json({
        success: true,
        data: { message: 'Job description deleted successfully' }
      });
    } catch (error) {
      if (error.message === 'Job description not found') {
        return res.status(404).json({
          success: false,
          error: { message: 'Job description not found' }
        });
      }
      next(error);
    }
  }

  async searchJobDescriptions(req, res, next) {
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

      let jobs;
      if (searchParams.query) {
        jobs = await this.jobDescriptionService.searchJobDescriptions(searchParams.query, paginationParams);
      } else if (searchParams.company) {
        jobs = await this.jobDescriptionService.findJobsByCompany(searchParams.company, paginationParams);
      } else if (searchParams.skills && searchParams.skills.length > 0) {
        jobs = await this.jobDescriptionService.findJobsBySkills(searchParams.skills, paginationParams);
      } else {
        jobs = await this.jobDescriptionService.getAllJobDescriptions(paginationParams);
      }

      res.status(200).json({
        success: true,
        data: jobs
      });
    } catch (error) {
      next(error);
    }
  }

  async extractRequirements(req, res, next) {
    try {
      const { description } = req.body;

      if (!description || description.trim() === '') {
        return res.status(400).json({
          success: false,
          error: { message: 'Job description is required' }
        });
      }

      const requirements = await this.jobDescriptionService.extractRequirementsFromDescription(description);

      res.status(200).json({
        success: true,
        data: { requirements }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = JobDescriptionController;
