const JobDescription = require('../models/JobDescription');

class JobDescriptionRepository {
  async create(jobData) {
    try {
      const job = new JobDescription(jobData);
      return await job.save();
    } catch (error) {
      throw new Error(`Failed to create job description: ${error.message}`);
    }
  }

  async findById(id) {
    try {
      return await JobDescription.findById(id);
    } catch (error) {
      throw new Error(`Failed to find job description: ${error.message}`);
    }
  }

  async findAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        filters = {}
      } = options;

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const query = { isActive: true, ...filters };

      const jobs = await JobDescription.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await JobDescription.countDocuments(query);

      return {
        jobs,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to find job descriptions: ${error.message}`);
    }
  }

  async findByCompany(company, options = {}) {
    try {
      const { limit = 10 } = options;
      
      return await JobDescription.find({
        company: new RegExp(company, 'i'),
        isActive: true
      })
        .limit(limit)
        .lean();
    } catch (error) {
      throw new Error(`Failed to find jobs by company: ${error.message}`);
    }
  }

  async findBySkills(skills, options = {}) {
    try {
      const { limit = 10 } = options;
      
      return await JobDescription.find({
        'skills.name': { $in: skills },
        isActive: true
      })
        .limit(limit)
        .lean();
    } catch (error) {
      throw new Error(`Failed to find jobs by skills: ${error.message}`);
    }
  }

  async update(id, updateData) {
    try {
      return await JobDescription.findByIdAndUpdate(
        id,
        { ...updateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      );
    } catch (error) {
      throw new Error(`Failed to update job description: ${error.message}`);
    }
  }

  async delete(id) {
    try {
      return await JobDescription.findByIdAndUpdate(
        id,
        { isActive: false, updatedAt: new Date() },
        { new: true }
      );
    } catch (error) {
      throw new Error(`Failed to delete job description: ${error.message}`);
    }
  }

  async searchByText(searchText, options = {}) {
    try {
      const { limit = 10 } = options;
      
      const searchRegex = new RegExp(searchText, 'i');
      
      return await JobDescription.find({
        $or: [
          { title: searchRegex },
          { company: searchRegex },
          { description: searchRegex },
          { requirements: searchRegex },
          { 'skills.name': searchRegex }
        ],
        isActive: true
      })
        .limit(limit)
        .lean();
    } catch (error) {
      throw new Error(`Failed to search job descriptions: ${error.message}`);
    }
  }

  async updateAiEmbedding(id, embedding) {
    try {
      return await JobDescription.findByIdAndUpdate(
        id,
        { aiEmbedding: embedding, updatedAt: new Date() },
        { new: true }
      );
    } catch (error) {
      throw new Error(`Failed to update AI embedding: ${error.message}`);
    }
  }
}

module.exports = JobDescriptionRepository;
