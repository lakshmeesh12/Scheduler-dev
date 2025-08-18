const MatchResult = require('../models/MatchResult');

class MatchResultRepository {
  async create(matchData) {
    try {
      const match = new MatchResult(matchData);
      return await match.save();
    } catch (error) {
      throw new Error(`Failed to create match result: ${error.message}`);
    }
  }

  async findById(id) {
    try {
      return await MatchResult.findById(id)
        .populate('jobDescriptionId', 'title company')
        .populate('profileId', 'firstName lastName email');
    } catch (error) {
      throw new Error(`Failed to find match result: ${error.message}`);
    }
  }

  async findByJobId(jobId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'matchScore',
        sortOrder = 'desc',
        minScore = 0
      } = options;

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const matches = await MatchResult.find({
        jobDescriptionId: jobId,
        matchScore: { $gte: minScore }
      })
        .populate('profileId', 'firstName lastName email skills experience')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await MatchResult.countDocuments({
        jobDescriptionId: jobId,
        matchScore: { $gte: minScore }
      });

      return {
        matches,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to find matches by job ID: ${error.message}`);
    }
  }

  async findByProfileId(profileId, options = {}) {
    try {
      const { limit = 10, sortBy = 'matchScore', sortOrder = 'desc' } = options;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      return await MatchResult.find({ profileId })
        .populate('jobDescriptionId', 'title company experienceLevel')
        .sort(sort)
        .limit(limit)
        .lean();
    } catch (error) {
      throw new Error(`Failed to find matches by profile ID: ${error.message}`);
    }
  }

  async findTopMatches(jobId, limit = 10) {
    try {
      return await MatchResult.find({ jobDescriptionId: jobId })
        .populate('profileId', 'firstName lastName email skills experience')
        .sort({ matchScore: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      throw new Error(`Failed to find top matches: ${error.message}`);
    }
  }

  async update(id, updateData) {
    try {
      return await MatchResult.findByIdAndUpdate(
        id,
        { ...updateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      );
    } catch (error) {
      throw new Error(`Failed to update match result: ${error.message}`);
    }
  }

  async updateStatus(id, status, reviewedBy = null, notes = null) {
    try {
      const updateData = {
        status,
        updatedAt: new Date()
      };

      if (reviewedBy) {
        updateData.reviewedBy = reviewedBy;
        updateData.reviewedAt = new Date();
      }

      if (notes) {
        updateData.notes = notes;
      }

      return await MatchResult.findByIdAndUpdate(id, updateData, { new: true });
    } catch (error) {
      throw new Error(`Failed to update match status: ${error.message}`);
    }
  }

  async delete(id) {
    try {
      return await MatchResult.findByIdAndDelete(id);
    } catch (error) {
      throw new Error(`Failed to delete match result: ${error.message}`);
    }
  }

  async getMatchStatistics(jobId) {
    try {
      const stats = await MatchResult.aggregate([
        { $match: { jobDescriptionId: jobId } },
        {
          $group: {
            _id: null,
            totalMatches: { $sum: 1 },
            averageScore: { $avg: '$matchScore' },
            maxScore: { $max: '$matchScore' },
            minScore: { $min: '$matchScore' },
            highScoreCount: {
              $sum: { $cond: [{ $gte: ['$matchScore', 80] }, 1, 0] }
            },
            mediumScoreCount: {
              $sum: { $cond: [{ $and: [{ $gte: ['$matchScore', 60] }, { $lt: ['$matchScore', 80] }] }, 1, 0] }
            },
            lowScoreCount: {
              $sum: { $cond: [{ $lt: ['$matchScore', 60] }, 1, 0] }
            }
          }
        }
      ]);

      return stats[0] || {
        totalMatches: 0,
        averageScore: 0,
        maxScore: 0,
        minScore: 0,
        highScoreCount: 0,
        mediumScoreCount: 0,
        lowScoreCount: 0
      };
    } catch (error) {
      throw new Error(`Failed to get match statistics: ${error.message}`);
    }
  }

  async bulkCreate(matchesData) {
    try {
      return await MatchResult.insertMany(matchesData);
    } catch (error) {
      throw new Error(`Failed to bulk create matches: ${error.message}`);
    }
  }
}

module.exports = MatchResultRepository;
