const express = require('express');
const ProfileController = require('../controllers/ProfileController');
const JobDescriptionController = require('../controllers/JobDescriptionController');
const MatchingController = require('../controllers/MatchingController');
const { uploadMiddleware } = require('../../infrastructure/middleware/uploadMiddleware');
const { excelUploadMiddleware } = require('../../infrastructure/middleware/excelUploadMiddleware');
const { generalLimiter, uploadLimiter, aiLimiter } = require('../../infrastructure/middleware/rateLimiter');

const router = express.Router();

// Initialize controllers
const profileController = new ProfileController();
const jobController = new JobDescriptionController();
const matchingController = new MatchingController();

// Apply general rate limiting to all routes
router.use(generalLimiter);

// Profile routes
router.post('/profiles', uploadLimiter, uploadMiddleware, (req, res, next) => {
  profileController.createProfile(req, res, next);
});

router.get('/profiles', (req, res, next) => {
  profileController.getAllProfiles(req, res, next);
});

router.get('/profiles/search', (req, res, next) => {
  profileController.searchProfiles(req, res, next);
});

// Excel import routes - must come before /profiles/:id
router.post('/profiles/import-excel', uploadLimiter, excelUploadMiddleware, (req, res, next) => {
  profileController.importFromExcel(req, res, next);
});

router.post('/profiles/validate-excel', uploadLimiter, excelUploadMiddleware, (req, res, next) => {
  profileController.validateExcelFile(req, res, next);
});

router.get('/profiles/excel-template', (req, res, next) => {
  profileController.downloadExcelTemplate(req, res, next);
});

// Excel import query routes
router.get('/profiles/excel-imports/user/:userId', (req, res, next) => {
  profileController.getExcelImportsByUserId(req, res, next);
});

router.get('/profiles/excel-imports/batch/:batchId', (req, res, next) => {
  profileController.getExcelImportsByBatch(req, res, next);
});

router.get('/profiles/excel-imports/stats/:batchId', (req, res, next) => {
  profileController.getExcelImportStats(req, res, next);
});

// Parameterized routes - must come after specific routes
router.get('/profiles/:id', (req, res, next) => {
  profileController.getProfileById(req, res, next);
});

router.put('/profiles/:id', uploadLimiter, uploadMiddleware, (req, res, next) => {
  profileController.updateProfile(req, res, next);
});

router.delete('/profiles/:id', (req, res, next) => {
  profileController.deleteProfile(req, res, next);
});

router.post('/profiles/extract-skills', aiLimiter, (req, res, next) => {
  profileController.extractSkills(req, res, next);
});

// Job Description routes
router.post('/jobs', (req, res, next) => {
  jobController.createJobDescription(req, res, next);
});

router.get('/jobs', (req, res, next) => {
  jobController.getAllJobDescriptions(req, res, next);
});

router.get('/jobs/search', (req, res, next) => {
  jobController.searchJobDescriptions(req, res, next);
});

router.get('/jobs/:id', (req, res, next) => {
  jobController.getJobDescriptionById(req, res, next);
});

router.put('/jobs/:id', (req, res, next) => {
  jobController.updateJobDescription(req, res, next);
});

router.delete('/jobs/:id', (req, res, next) => {
  jobController.deleteJobDescription(req, res, next);
});

router.post('/jobs/extract-requirements', aiLimiter, (req, res, next) => {
  jobController.extractRequirements(req, res, next);
});

// Matching routes
router.post('/jobs/:jobId/matches', aiLimiter, (req, res, next) => {
  matchingController.findMatches(req, res, next);
});

router.get('/jobs/:jobId/matches', (req, res, next) => {
  matchingController.getMatchResults(req, res, next);
});

router.get('/jobs/:jobId/matches/statistics', (req, res, next) => {
  matchingController.getMatchStatistics(req, res, next);
});

router.put('/matches/:matchId/status', (req, res, next) => {
  matchingController.updateMatchStatus(req, res, next);
});

router.get('/matches/:jobId/:profileId', aiLimiter, (req, res, next) => {
  matchingController.calculateSingleMatch(req, res, next);
});

// System status routes
router.get('/status', async (req, res) => {
  try {
    const AIServiceClient = require('../infrastructure/external/AIServiceClient');
    const aiClient = new AIServiceClient();
    const aiHealth = await aiClient.checkServiceHealth();

    res.status(200).json({
      success: true,
      data: {
        api: 'healthy',
        database: 'connected',
        aiService: aiHealth,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: {
        message: 'Service partially unavailable',
        details: error.message
      }
    });
  }
});

module.exports = router;
