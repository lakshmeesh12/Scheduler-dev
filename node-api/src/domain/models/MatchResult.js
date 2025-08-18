const mongoose = require('mongoose');
const UUID = require('uuid-js');

const matchResultSchema = new mongoose.Schema({
  matchresult_id: {
    type: String,
    required: true,
    unique: true,
    default: () => UUID.create().toString(),
    index: true
  },
  jobDescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobDescription',
    required: true
  },
  profileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Profile',
    required: true
  },
  matchScore: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  matchDetails: {
    skillsMatch: {
      score: Number,
      matchedSkills: [String],
      missingSkills: [String]
    },
    experienceMatch: {
      score: Number,
      yearsExperience: Number,
      relevantExperience: [String]
    },
    educationMatch: {
      score: Number,
      relevantEducation: [String]
    },
    overallMatch: {
      strengths: [String],
      weaknesses: [String],
      recommendations: [String]
    }
  },
  aiAnalysis: {
    semanticSimilarity: Number,
    keywordMatch: Number,
    contextualRelevance: Number
  },
  status: {
    type: String,
    enum: ['Active', 'Reviewed', 'Shortlisted', 'Rejected'],
    default: 'Active'
  },
  reviewedBy: {
    type: String
  },
  reviewedAt: {
    type: Date
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
matchResultSchema.index({ matchresult_id: 1 });
matchResultSchema.index({ jobDescriptionId: 1, matchScore: -1 });
matchResultSchema.index({ profileId: 1 });
matchResultSchema.index({ matchScore: -1 });
matchResultSchema.index({ status: 1 });
matchResultSchema.index({ createdAt: -1 });

module.exports = mongoose.model('MatchResult', matchResultSchema);
