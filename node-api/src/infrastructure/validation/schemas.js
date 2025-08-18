const Joi = require('joi');

const profileValidation = {
  create: Joi.object({
    firstName: Joi.string().trim().min(1).max(50).required(),
    lastName: Joi.string().trim().min(1).max(50).required(),
    email: Joi.string().email().required(),
    phone: Joi.string().trim().min(10).max(20).optional(),
    skills: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        level: Joi.string().valid('Beginner', 'Intermediate', 'Advanced', 'Expert').default('Intermediate')
      })
    ).optional(),
    experience: Joi.array().items(
      Joi.object({
        company: Joi.string().required(),
        position: Joi.string().required(),
        startDate: Joi.date().required(),
        endDate: Joi.date().optional().allow(null),
        description: Joi.string().optional(),
        technologies: Joi.array().items(Joi.string()).optional()
      })
    ).optional(),
    education: Joi.array().items(
      Joi.object({
        institution: Joi.string().required(),
        degree: Joi.string().required(),
        field: Joi.string().required(),
        graduationYear: Joi.number().integer().min(1950).max(new Date().getFullYear() + 10).optional(),
        gpa: Joi.number().min(0).max(4).optional()
      })
    ).optional(),
    resumeText: Joi.string().min(10).required()
  }),

  update: Joi.object({
    firstName: Joi.string().trim().min(1).max(50).optional(),
    lastName: Joi.string().trim().min(1).max(50).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().trim().min(10).max(20).optional(),
    skills: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        level: Joi.string().valid('Beginner', 'Intermediate', 'Advanced', 'Expert').default('Intermediate')
      })
    ).optional(),
    experience: Joi.array().items(
      Joi.object({
        company: Joi.string().required(),
        position: Joi.string().required(),
        startDate: Joi.date().required(),
        endDate: Joi.date().optional().allow(null),
        description: Joi.string().optional(),
        technologies: Joi.array().items(Joi.string()).optional()
      })
    ).optional(),
    education: Joi.array().items(
      Joi.object({
        institution: Joi.string().required(),
        degree: Joi.string().required(),
        field: Joi.string().required(),
        graduationYear: Joi.number().integer().min(1950).max(new Date().getFullYear() + 10).optional(),
        gpa: Joi.number().min(0).max(4).optional()
      })
    ).optional(),
    resumeText: Joi.string().min(10).optional()
  }).min(1)
};

const excelImportValidation = {
  bulkImport: Joi.object({
    overwriteExisting: Joi.boolean().default(true),
    validateOnly: Joi.boolean().default(false),
    skipErrors: Joi.boolean().default(true)
  })
};

const jobDescriptionValidation = {
  create: Joi.object({
    title: Joi.string().trim().min(1).max(200).required(),
    company: Joi.string().trim().min(1).max(100).required(),
    description: Joi.string().min(10).required(),
    requirements: Joi.string().min(10).required(),
    skills: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        importance: Joi.string().valid('Required', 'Preferred', 'Nice-to-have').default('Required')
      })
    ).min(1).required(),
    experienceLevel: Joi.string().valid('Entry', 'Mid', 'Senior', 'Lead', 'Executive').required(),
    location: Joi.string().trim().max(100).optional(),
    salaryRange: Joi.object({
      min: Joi.number().min(0).optional(),
      max: Joi.number().min(0).optional(),
      currency: Joi.string().length(3).default('USD').optional()
    }).optional(),
    employmentType: Joi.string().valid('Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship').default('Full-time'),
    createdBy: Joi.string().required()
  }),

  update: Joi.object({
    title: Joi.string().trim().min(1).max(200).optional(),
    company: Joi.string().trim().min(1).max(100).optional(),
    description: Joi.string().min(10).optional(),
    requirements: Joi.string().min(10).optional(),
    skills: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        importance: Joi.string().valid('Required', 'Preferred', 'Nice-to-have').default('Required')
      })
    ).min(1).optional(),
    experienceLevel: Joi.string().valid('Entry', 'Mid', 'Senior', 'Lead', 'Executive').optional(),
    location: Joi.string().trim().max(100).optional(),
    salaryRange: Joi.object({
      min: Joi.number().min(0).optional(),
      max: Joi.number().min(0).optional(),
      currency: Joi.string().length(3).default('USD').optional()
    }).optional(),
    employmentType: Joi.string().valid('Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship').optional()
  }).min(1)
};

const matchingValidation = {
  findMatches: Joi.object({
    jobId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
    limit: Joi.number().integer().min(1).max(100).default(20),
    minScore: Joi.number().min(0).max(100).default(60)
  }),

  updateStatus: Joi.object({
    status: Joi.string().valid('Active', 'Reviewed', 'Shortlisted', 'Rejected').required(),
    reviewedBy: Joi.string().optional(),
    notes: Joi.string().max(500).optional()
  })
};

const queryValidation = {
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'firstName', 'lastName', 'title', 'company', 'matchScore').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  search: Joi.object({
    query: Joi.string().trim().min(1).max(200).optional(),
    skills: Joi.array().items(Joi.string()).optional(),
    experienceLevel: Joi.string().valid('Entry', 'Mid', 'Senior', 'Lead', 'Executive').optional(),
    company: Joi.string().trim().max(100).optional()
  })
};

module.exports = {
  profileValidation,
  jobDescriptionValidation,
  matchingValidation,
  queryValidation,
  excelImportValidation
};
