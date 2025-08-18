const MatchingService = require('../../application/services/MatchingService');
const { matchingValidation, queryValidation } = require('../../infrastructure/validation/schemas');

class MatchingController {
  constructor() {
    this.matchingService = new MatchingService();
  }

  async findMatches(req, res, next) {
    try {
      const { jobId } = req.params;
      
      if (!jobId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid job ID format' }
        });
      }

      // Validate query parameters
      const queryParams = { jobId, ...req.query };
      const { error, value } = matchingValidation.findMatches.validate(queryParams);
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid parameters',
            details: error.details.map(d => d.message)
          }
        });
      }

      const result = await this.matchingService.findMatchingProfiles(jobId, {
        limit: value.limit,
        minScore: value.minScore
      });

      res.status(200).json({
        success: true,
        data: {
          ...result,
          message: `Found ${result.totalMatches} matching profiles`
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

  async getMatchResults(req, res, next) {
    try {
      const { jobId } = req.params;
      
      if (!jobId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid job ID format' }
        });
      }

      // Validate pagination parameters
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

      const { minScore = 0 } = req.query;
      const options = {
        ...value,
        minScore: parseInt(minScore)
      };

      const result = await this.matchingService.getMatchResults(jobId, options);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMatchStatus(req, res, next) {
    try {
      const { matchId } = req.params;
      
      if (!matchId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid match ID format' }
        });
      }

      // Validate request body
      const { error, value } = matchingValidation.updateStatus.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation error',
            details: error.details.map(d => d.message)
          }
        });
      }

      const updatedMatch = await this.matchingService.updateMatchStatus(
        matchId,
        value.status,
        value.reviewedBy,
        value.notes
      );

      res.status(200).json({
        success: true,
        data: {
          match: updatedMatch,
          message: 'Match status updated successfully'
        }
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: { message: 'Match result not found' }
        });
      }
      next(error);
    }
  }

  async getMatchStatistics(req, res, next) {
    try {
      const { jobId } = req.params;
      
      if (!jobId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid job ID format' }
        });
      }

      const statistics = await this.matchingService.getMatchStatistics(jobId);

      res.status(200).json({
        success: true,
        data: { statistics }
      });
    } catch (error) {
      next(error);
    }
  }

  async calculateSingleMatch(req, res, next) {
    try {
      const { jobId, profileId } = req.params;
      
      if (!jobId.match(/^[0-9a-fA-F]{24}$/) || !profileId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Invalid ID format' }
        });
      }

      // Get job and profile
      const job = await this.matchingService.jobDescriptionRepository.findById(jobId);
      const profile = await this.matchingService.profileRepository.findById(profileId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: { message: 'Job description not found' }
        });
      }

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: { message: 'Profile not found' }
        });
      }

      const matchResult = await this.matchingService.calculateMatch(job, profile);

      res.status(200).json({
        success: true,
        data: {
          match: matchResult,
          job: {
            id: job._id,
            title: job.title,
            company: job.company
          },
          profile: {
            id: profile._id,
            name: `${profile.firstName} ${profile.lastName}`,
            email: profile.email
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = MatchingController;
