const mongoose = require('mongoose');
const UUID = require('uuid-js');

const profileSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true,
    default: () => UUID.create().toString(),
    index: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  skills: [{
    name: {
      type: String,
      required: true
    },
    level: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
      default: 'Intermediate'
    }
  }],
  experience: [{
    company: {
      type: String,
      required: true
    },
    position: {
      type: String,
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date
    },
    description: {
      type: String
    },
    technologies: [String]
  }],
  education: [{
    institution: {
      type: String,
      required: true
    },
    degree: {
      type: String,
      required: true
    },
    field: {
      type: String,
      required: true
    },
    graduationYear: {
      type: Number
    },
    gpa: {
      type: Number,
      min: 0,
      max: 4
    }
  }],
  resumeText: {
    type: String,
    required: false // Made optional for Excel imports
  },
  // Excel import fields
  totalExperience: {
    type: String,
    trim: true
  },
  currentCompany: {
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
  noticePeriod: {
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
  dataSource: {
    type: String,
    enum: ['manual', 'excel_import', 'api'],
    default: 'manual'
  },
  resumeFile: {
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    path: String
  },
  aiEmbedding: {
    type: [Number],
    index: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
profileSchema.index({ user_id: 1 });
profileSchema.index({ email: 1 });
profileSchema.index({ 'skills.name': 1 });
profileSchema.index({ 'experience.technologies': 1 });
profileSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Profile', profileSchema);
