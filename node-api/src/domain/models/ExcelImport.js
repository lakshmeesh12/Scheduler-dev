const mongoose = require('mongoose');
const UUID = require('uuid-js');

const excelImportSchema = new mongoose.Schema({
  excelimport_id: {
    type: String,
    required: true,
    unique: true,
    default: () => UUID.create().toString(),
    index: true
  },
  importId: {
    type: String,
    required: true,
    unique: true
  },
  profileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Profile',
    default: null
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  // Original Excel data
  serialNumber: {
    type: Number,
    required: true
  },
  candidateName: {
    type: String,
    trim: true
  },
  mobileNumber: {
    type: String,
    trim: true
  },
  emailId: {
    type: String,
    trim: true,
    lowercase: true,
    index: true
  },
  totalExperience: {
    type: String,
    trim: true
  },
  company: {
    type: String,
    trim: true
  },
  ctc: {
    type: String,
    trim: true
  },
  ectc: {
    type: String,
    trim: true
  },
  offerInHand: {
    type: String,
    trim: true
  },
  notice: {
    type: String,
    trim: true
  },
  currentLocation: {
    type: String,
    trim: true
  },
  preferredLocation: {
    type: String,
    trim: true
  },
  availabilityForInterview: {
    type: String,
    trim: true
  },
  // Import metadata
  importBatch: {
    type: String,
    required: true,
    index: true
  },
  importDate: {
    type: Date,
    default: Date.now
  },
  fileName: {
    type: String,
    required: true
  },
  rowNumber: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['processed', 'linked_to_existing', 'created_new_profile', 'error'],
    default: 'processed'
  },
  processingNotes: {
    type: String,
    trim: true
  },
  // Matching criteria used
  matchedBy: {
    type: String,
    enum: ['email', 'phone', 'both', 'none'],
    default: 'none'
  }
}, {
  timestamps: true
});

// Indexes for better query performance
excelImportSchema.index({ excelimport_id: 1 });
excelImportSchema.index({ emailId: 1 });
excelImportSchema.index({ mobileNumber: 1 });
excelImportSchema.index({ userId: 1 });
excelImportSchema.index({ importBatch: 1 });
excelImportSchema.index({ importDate: -1 });
excelImportSchema.index({ profileId: 1 });

module.exports = mongoose.model('ExcelImport', excelImportSchema);
