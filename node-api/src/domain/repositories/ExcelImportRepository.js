const ExcelImport = require('../models/ExcelImport');

class ExcelImportRepository {
  async create(excelImportData) {
    try {
      const excelImport = new ExcelImport(excelImportData);
      return await excelImport.save();
    } catch (error) {
      throw new Error(`Failed to create excel import record: ${error.message}`);
    }
  }

  async findByEmail(email) {
    try {
      return await ExcelImport.find({ emailId: email }).sort({ importDate: -1 });
    } catch (error) {
      throw new Error(`Failed to find excel imports by email: ${error.message}`);
    }
  }

  async findByPhone(phone) {
    try {
      return await ExcelImport.find({ mobileNumber: phone }).sort({ importDate: -1 });
    } catch (error) {
      throw new Error(`Failed to find excel imports by phone: ${error.message}`);
    }
  }

  async findByUserId(userId) {
    try {
      return await ExcelImport.find({ userId }).sort({ importDate: -1 });
    } catch (error) {
      throw new Error(`Failed to find excel imports by userId: ${error.message}`);
    }
  }

  async findByImportBatch(importBatch) {
    try {
      return await ExcelImport.find({ importBatch }).sort({ rowNumber: 1 });
    } catch (error) {
      throw new Error(`Failed to find excel imports by batch: ${error.message}`);
    }
  }

  async findByProfileId(profileId) {
    try {
      return await ExcelImport.find({ profileId }).sort({ importDate: -1 });
    } catch (error) {
      throw new Error(`Failed to find excel imports by profileId: ${error.message}`);
    }
  }

  async updateProfileLink(importId, profileId, status, notes) {
    try {
      return await ExcelImport.findOneAndUpdate(
        { importId },
        { 
          profileId, 
          status, 
          processingNotes: notes 
        },
        { new: true }
      );
    } catch (error) {
      throw new Error(`Failed to update excel import: ${error.message}`);
    }
  }

  async getAllByStatus(status, pagination = {}) {
    try {
      const { page = 1, limit = 10 } = pagination;
      const skip = (page - 1) * limit;

      const [imports, total] = await Promise.all([
        ExcelImport.find({ status })
          .populate('profileId', 'name email phone')
          .sort({ importDate: -1 })
          .skip(skip)
          .limit(limit),
        ExcelImport.countDocuments({ status })
      ]);

      return {
        imports,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      throw new Error(`Failed to get excel imports by status: ${error.message}`);
    }
  }

  async getImportStats(importBatch) {
    try {
      const stats = await ExcelImport.aggregate([
        { $match: { importBatch } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const result = {
        total: 0,
        processed: 0,
        linked_to_existing: 0,
        created_new_profile: 0,
        error: 0
      };

      stats.forEach(stat => {
        result[stat._id] = stat.count;
        result.total += stat.count;
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to get import stats: ${error.message}`);
    }
  }

  async findStandaloneImports() {
    try {
      // Find Excel import records that don't have linked profiles (profileId is null or undefined)
      return await ExcelImport.find({ 
        $or: [
          { profileId: null },
          { profileId: { $exists: false } }
        ]
      }).sort({ createdAt: -1 });
    } catch (error) {
      throw new Error(`Failed to find standalone excel imports: ${error.message}`);
    }
  }

  async findAll(options = {}) {
    try {
      const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = options;
      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const excelImports = await ExcelImport.find()
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const total = await ExcelImport.countDocuments();

      return {
        excelImports,
        total,
        page,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw new Error(`Failed to find all excel imports: ${error.message}`);
    }
  }
}

module.exports = ExcelImportRepository;
