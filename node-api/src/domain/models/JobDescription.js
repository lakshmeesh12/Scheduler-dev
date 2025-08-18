const mongoose = require('mongoose');
const UUID = require('uuid-js');

const jobDescriptionSchema = new mongoose.Schema({
  jobdescription_id: {
    type: String,
    required: true,
    unique: true,
    default: () => UUID.create().toString(),
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  requirements: {
    type: String,
    required: true
  },
  skills: [{
    name: {
      type: String,
      required: true
    },
    importance: {
      type: String,
      enum: ['Required', 'Preferred', 'Nice-to-have'],
      default: 'Required'
    }
  }],
  experienceLevel: {
    type: String,
    enum: ['Entry', 'Mid', 'Senior', 'Lead', 'Executive'],
    required: true
  },
  location: {
    type: String,
    trim: true
  },
  salaryRange: {
    min: Number,
    max: Number,
    currency: {
      type: String,
      default: 'USD'
    }
  },
  employmentType: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'],
    default: 'Full-time'
  },
  aiEmbedding: {
    type: [Number],
    index: true
  },
  createdBy: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for better query performance
jobDescriptionSchema.index({ jobdescription_id: 1 });
jobDescriptionSchema.index({ title: 1 });
jobDescriptionSchema.index({ company: 1 });
jobDescriptionSchema.index({ 'skills.name': 1 });
jobDescriptionSchema.index({ experienceLevel: 1 });
jobDescriptionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('JobDescription', jobDescriptionSchema);
