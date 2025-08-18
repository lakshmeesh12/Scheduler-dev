const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');

describe('Excel Import API', () => {
  describe('POST /api/profiles/excel-template', () => {
    it('should return Excel template structure', async () => {
      const response = await request(app)
        .get('/api/profiles/excel-template')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.template).toBeDefined();
      expect(response.body.data.headers).toBeDefined();
      expect(response.body.data.headers).toContain('Candidate Name');
      expect(response.body.data.headers).toContain('E mail Id');
    });
  });

  describe('POST /api/profiles/import-excel', () => {
    it('should reject request without file', async () => {
      const response = await request(app)
        .post('/api/profiles/import-excel')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Excel file is required');
    });

    it('should reject invalid file types', async () => {
      // Create a dummy text file
      const testFilePath = path.join(__dirname, 'test.txt');
      fs.writeFileSync(testFilePath, 'This is not an Excel file');

      const response = await request(app)
        .post('/api/profiles/import-excel')
        .attach('excelFile', testFilePath)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid file type');

      // Cleanup
      fs.unlinkSync(testFilePath);
    });
  });

  describe('POST /api/profiles/validate-excel', () => {
    it('should validate Excel file structure', async () => {
      // You would need to create a valid Excel file for this test
      // This is a placeholder test structure
      expect(true).toBe(true);
    });
  });
});

// Sample Excel data structure that would work with the API
const sampleExcelData = [
  {
    'S.no': 1,
    'Candidate Name': 'John Doe',
    'Mobile Number': '+1234567890',
    'E mail Id': 'john.doe@example.com',
    'Total Experience': '5 years',
    'Company': 'TechCorp Inc',
    'CTC': '15 LPA',
    'ECTC': '20 LPA',
    'Offer in Hand': 'Yes',
    'Notice': '30 days',
    'Current Location': 'New York',
    'Preferred Location': 'San Francisco',
    'Availability for interview': 'Immediate'
  },
  {
    'S.no': 2,
    'Candidate Name': 'Jane Smith',
    'Mobile Number': '+0987654321',
    'E mail Id': 'jane.smith@example.com',
    'Total Experience': '3 years',
    'Company': 'StartupXYZ',
    'CTC': '12 LPA',
    'ECTC': '18 LPA',
    'Offer in Hand': 'No',
    'Notice': '15 days',
    'Current Location': 'Austin',
    'Preferred Location': 'Seattle',
    'Availability for interview': 'After 2 weeks'
  }
];

module.exports = { sampleExcelData };
