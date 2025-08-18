const Profile = require('../models/Profile');

class ProfileRepository {
  async create(profileData) {
    try {
      const profile = new Profile(profileData);
      return await profile.save();
    } catch (error) {
      throw new Error(`Failed to create profile: ${error.message}`);
    }
  }

  async findById(id) {
    try {
      return await Profile.findById(id);
    } catch (error) {
      throw new Error(`Failed to find profile: ${error.message}`);
    }
  }

  async findByEmail(email) {
    try {
      return await Profile.findOne({ email, isActive: true });
    } catch (error) {
      throw new Error(`Failed to find profile by email: ${error.message}`);
    }
  }

  async findByPhone(phone) {
    try {
      return await Profile.findOne({ phone, isActive: true });
    } catch (error) {
      throw new Error(`Failed to find profile by phone: ${error.message}`);
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

      const profiles = await Profile.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Profile.countDocuments(query);

      return {
        profiles,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to find profiles: ${error.message}`);
    }
  }

  async findBySkills(skills, options = {}) {
    try {
      const { limit = 10 } = options;
      
      return await Profile.find({
        'skills.name': { $in: skills },
        isActive: true
      })
        .limit(limit)
        .lean();
    } catch (error) {
      throw new Error(`Failed to find profiles by skills: ${error.message}`);
    }
  }

  async update(id, updateData) {
    try {
      return await Profile.findByIdAndUpdate(
        id,
        { ...updateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      );
    } catch (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }
  }

  async delete(id) {
    try {
      return await Profile.findByIdAndUpdate(
        id,
        { isActive: false, updatedAt: new Date() },
        { new: true }
      );
    } catch (error) {
      throw new Error(`Failed to delete profile: ${error.message}`);
    }
  }

  async searchByText(searchText, options = {}) {
    try {
      const { limit = 10 } = options;
      
      const searchRegex = new RegExp(searchText, 'i');
      
      return await Profile.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { resumeText: searchRegex },
          { 'skills.name': searchRegex },
          { 'experience.company': searchRegex },
          { 'experience.position': searchRegex }
        ],
        isActive: true
      })
        .limit(limit)
        .lean();
    } catch (error) {
      throw new Error(`Failed to search profiles: ${error.message}`);
    }
  }

  async updateAiEmbedding(id, embedding) {
    try {
      return await Profile.findByIdAndUpdate(
        id,
        { aiEmbedding: embedding, updatedAt: new Date() },
        { new: true }
      );
    } catch (error) {
      throw new Error(`Failed to update AI embedding: ${error.message}`);
    }
  }
}

module.exports = ProfileRepository;
