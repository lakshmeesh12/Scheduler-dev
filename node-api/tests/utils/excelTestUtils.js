const XLSX = require('xlsx');
const path = require('path');

/**
 * Utility to create sample Excel files for testing
 */
class ExcelTestUtils {
  /**
   * Creates a sample Excel file with candidate data
   * @param {string} filePath - Path where to save the Excel file
   * @param {Array} candidateData - Array of candidate objects
   */
  static createSampleExcelFile(filePath, candidateData = null) {
    const defaultData = candidateData || [
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
      },
      {
        'S.no': 3,
        'Candidate Name': 'Bob Wilson',
        'Mobile Number': '+1122334455',
        'E mail Id': 'bob.wilson@example.com',
        'Total Experience': '7 years',
        'Company': 'Enterprise Solutions',
        'CTC': '25 LPA',
        'ECTC': '30 LPA',
        'Offer in Hand': 'Yes',
        'Notice': '60 days',
        'Current Location': 'Chicago',
        'Preferred Location': 'Remote',
        'Availability for interview': 'Weekends only'
      }
    ];

    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(defaultData);

    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');

    // Write the file
    XLSX.writeFile(workbook, filePath);

    return filePath;
  }

  /**
   * Creates an Excel file with invalid structure for testing validation
   * @param {string} filePath - Path where to save the Excel file
   */
  static createInvalidExcelFile(filePath) {
    const invalidData = [
      {
        'Wrong Header 1': 'John Doe',
        'Wrong Header 2': 'john@example.com',
        'Missing Fields': 'Invalid structure'
      }
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(invalidData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Invalid');
    XLSX.writeFile(workbook, filePath);

    return filePath;
  }

  /**
   * Creates an empty Excel template with correct headers
   * @param {string} filePath - Path where to save the Excel file
   */
  static createEmptyTemplate(filePath) {
    const headers = [
      'S.no',
      'Candidate Name', 
      'Mobile Number',
      'E mail Id',
      'Total Experience',
      'Company',
      'CTC',
      'ECTC',
      'Offer in Hand',
      'Notice',
      'Current Location',
      'Preferred Location',
      'Availability for interview'
    ];

    // Create empty row with headers only
    const templateData = [headers.reduce((acc, header) => {
      acc[header] = '';
      return acc;
    }, {})];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, filePath);

    return filePath;
  }

  /**
   * Gets the expected headers for candidate Excel files
   */
  static getExpectedHeaders() {
    return [
      'S.no',
      'Candidate Name',
      'Mobile Number', 
      'E mail Id',
      'Total Experience',
      'Company',
      'CTC',
      'ECTC',
      'Offer in Hand',
      'Notice',
      'Current Location',
      'Preferred Location',
      'Availability for interview'
    ];
  }
}

module.exports = ExcelTestUtils;
