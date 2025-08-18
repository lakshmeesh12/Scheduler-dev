require('dotenv').config({ path: '.env.test' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_URI = process.env.DB_URI_TEST || 'mongodb://localhost:27017/resume_finder_test';

// Global test setup
beforeAll(() => {
  // Global setup logic
});

afterAll(() => {
  // Global cleanup logic
});
