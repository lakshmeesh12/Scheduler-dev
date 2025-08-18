const XLSX = require('xlsx');
const ProfileRepository = require('../../domain/repositories/ProfileRepository');
const ExcelImportRepository = require('../../domain/repositories/ExcelImportRepository');
const UUID  = require('uuid-js');

class ExcelProcessingService {
  constructor() {
    this.profileRepository = new ProfileRepository();
    this.excelImportRepository = new ExcelImportRepository();
    this.expectedHeaders = [
      'S.no', 'Serial No', 'SNo', 'Sr No', 'Sr.No',
      'Candidate Name', 'Name', 'Full Name', 'Candidate',
      'Mobile Number', 'Mobile', 'Phone', 'Phone Number', 'Contact Number', 'Contact',
      'E mail Id', 'Email', 'Email Id', 'Email ID', 'E-mail', 'Mail Id', 'Mail ID',
      'Total Experience', 'Experience', 'Total Exp', 'Exp', 'Years of Experience', 'Work Experience',
      'Company', 'Current Company', 'Organization', 'Employer',
      'CTC', 'Current CTC', 'Salary', 'Current Salary',
      'ECTC', 'Expected CTC', 'Expected Salary', 'Exp CTC',
      'Offer in Hand', 'Offer', 'Job Offer',
      'Notice', 'Notice Period', 'NP',
      'Current Location', 'Location', 'City',
      'Preferred Location', 'Pref Location', 'Preferred City',
      'Availability for interview', 'Availability', 'Interview Availability', 'Available for Interview'
    ];
  }

  async processExcelFile(filePath) {
    try {
      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0]; // Get first sheet
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert sheet to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (!jsonData || jsonData.length === 0) {
        throw new Error('Excel file is empty or has no data');
      }

      // Generate unique import batch ID
      const importBatch = UUID.create();
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop();

      const results = {
        processed: 0,
        created: 0,
        updated: 0,
        linkedToExisting: 0,
        errors: [],
        importBatch,
        excelImportIds: []
      };

      // Process each row
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNumber = i + 2; // Excel row number (1-based + header)

        try {
          // Extract and validate row data
          const candidateData = this._mapExcelRowToProfile(row, rowNumber);
          
          if (!candidateData || (!candidateData.email && !candidateData.phone)) {
            results.errors.push({
              row: rowNumber,
              error: 'Missing required fields: Either Email or Phone number is required'
            });
            continue;
          }

          // Check for existing profile by email or phone
          const existingProfile = await this.findExistingProfile(
            candidateData.email, 
            candidateData.phone
          );

          let userId;
          let profileId = null;
          let status = 'processed';
          let matchedBy = 'none';
          let processingNotes = '';

          if (existingProfile) {
            // Use existing profile's ID as userId
            userId = existingProfile._id.toString();
            profileId = existingProfile._id;
            status = 'linked_to_existing';
            
            // Determine how it was matched
            if (existingProfile.email === candidateData.email && existingProfile.phone === candidateData.phone) {
              matchedBy = 'both';
            } else if (existingProfile.email === candidateData.email) {
              matchedBy = 'email';
            } else if (existingProfile.phone === candidateData.phone) {
              matchedBy = 'phone';
            }
            
            processingNotes = `Linked to existing profile: ${existingProfile.name}`;
            results.linkedToExisting++;
          } else {
            // Generate new UUID for new candidate
            userId = UUID.create();
            status = 'created_new_profile';
            processingNotes = 'New candidate - UUID generated';
            results.created++;
          }

          // Create Excel import record
          const excelImportData = {
            importId: UUID.create(),
            profileId,
            userId,
            serialNumber: candidateData.serialNumber || i + 1,
            candidateName: candidateData.candidateName,
            mobileNumber: candidateData.phone,
            emailId: candidateData.email,
            totalExperience: candidateData.totalExperience,
            company: candidateData.currentCompany,
            ctc: candidateData.ctc,
            ectc: candidateData.ectc,
            offerInHand: candidateData.offerInHand,
            notice: candidateData.noticePeriod,
            currentLocation: candidateData.currentLocation,
            preferredLocation: candidateData.preferredLocation,
            availabilityForInterview: candidateData.availabilityForInterview,
            importBatch,
            fileName,
            rowNumber,
            status,
            processingNotes,
            matchedBy
          };

          // Save Excel import record
          const excelImport = await this.excelImportRepository.create(excelImportData);
          results.excelImportIds.push(excelImport._id);

          results.processed++;

        } catch (rowError) {
          results.errors.push({
            row: rowNumber,
            error: rowError.message
          });
        }
      }

      return results;

    } catch (error) {
      throw new Error(`Failed to process Excel file: ${error.message}`);
    }
  }

  async findExistingProfile(email, phone) {
    try {
      // First try to find by email
      let profile = await this.profileRepository.findByEmail(email);
      if (profile) {
        return profile;
      }

      // If not found by email, try by phone
      if (phone) {
        profile = await this.profileRepository.findByPhone(phone);
        if (profile) {
          return profile;
        }
      }

      return null;
    } catch (error) {
      console.warn(`Error finding existing profile: ${error.message}`);
      return null;
    }
  }

  _mapExcelRowToProfile(row, rowNumber) {
    // Map Excel columns to profile fields with multiple variations
    const columnMappings = {
      // Serial number variations
      'S.no': 'serialNumber',
      'Serial No': 'serialNumber',
      'SNo': 'serialNumber',
      'S No': 'serialNumber',
      'Sr No': 'serialNumber',
      'Sr.No': 'serialNumber',
      
      // Name variations
      'Candidate Name': 'candidateName',
      'Name': 'candidateName',
      'Full Name': 'candidateName',
      'Candidate': 'candidateName',
      
      // Phone variations
      'Mobile Number': 'phone',
      'Mobile': 'phone',
      'Phone': 'phone',
      'Phone Number': 'phone',
      'Contact Number': 'phone',
      'Contact': 'phone',
      
      // Email variations
      'E mail Id': 'email',
      'Email': 'email',
      'Email Id': 'email',
      'Email ID': 'email',
      'E-mail': 'email',
      'Mail Id': 'email',
      'Mail ID': 'email',
      
      // Experience variations
      'Total Experience': 'totalExperience',
      'Experience': 'totalExperience',
      'Total Exp': 'totalExperience',
      'Exp': 'totalExperience',
      'Years of Experience': 'totalExperience',
      'Work Experience': 'totalExperience',
      
      // Company variations
      'Company': 'currentCompany',
      'Current Company': 'currentCompany',
      'Organization': 'currentCompany',
      'Employer': 'currentCompany',
      
      // Salary variations
      'CTC': 'ctc',
      'Current CTC': 'ctc',
      'Salary': 'ctc',
      'Current Salary': 'ctc',
      
      'ECTC': 'ectc',
      'Expected CTC': 'ectc',
      'Expected Salary': 'ectc',
      'Exp CTC': 'ectc',
      
      // Other fields
      'Offer in Hand': 'offerInHand',
      'Offer': 'offerInHand',
      'Job Offer': 'offerInHand',
      
      'Notice': 'noticePeriod',
      'Notice Period': 'noticePeriod',
      'NP': 'noticePeriod',
      
      'Current Location': 'currentLocation',
      'Location': 'currentLocation',
      'City': 'currentLocation',
      
      'Preferred Location': 'preferredLocation',
      'Pref Location': 'preferredLocation',
      'Preferred City': 'preferredLocation',
      
      'Availability for interview': 'availabilityForInterview',
      'Availability': 'availabilityForInterview',
      'Interview Availability': 'availabilityForInterview',
      'Available for Interview': 'availabilityForInterview'
    };

    // Find the correct column names (case-insensitive)
    const mappedData = {};
    Object.keys(row).forEach(key => {
      const trimmedKey = key.trim();
      const mapping = Object.keys(columnMappings).find(
        col => col.toLowerCase() === trimmedKey.toLowerCase()
      );
      
      if (mapping) {
        mappedData[columnMappings[mapping]] = row[key];
      }
    });

    // Validate required fields - need either email OR phone (or both)
    if (!mappedData.email && !mappedData.phone) {
      throw new Error(`Row ${rowNumber}: Either Email or Phone number is required. Found email: ${mappedData.email}, phone: ${mappedData.phone}`);
    }

    // Parse candidate name (optional now)
    let firstName = 'Unknown';
    let lastName = '';
    
    if (mappedData.candidateName && mappedData.candidateName.trim()) {
      const nameParts = mappedData.candidateName.trim().split(' ');
      firstName = nameParts[0] || 'Unknown';
      lastName = nameParts.slice(1).join(' ') || '';
    } else {
      // Generate name from email if name is not provided
      if (mappedData.email) {
        const emailPrefix = mappedData.email.split('@')[0];
        firstName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
        lastName = '';
      }
    }

    // Build profile object
    const profileData = {
      firstName: firstName,
      lastName: lastName,
      email: mappedData.email.toString().trim().toLowerCase(),
      phone: mappedData.phone ? mappedData.phone.toString().trim() : undefined,
      totalExperience: mappedData.totalExperience ? mappedData.totalExperience.toString().trim() : undefined,
      currentCompany: mappedData.currentCompany ? mappedData.currentCompany.toString().trim() : undefined,
      ctc: mappedData.ctc ? mappedData.ctc.toString().trim() : undefined,
      ectc: mappedData.ectc ? mappedData.ectc.toString().trim() : undefined,
      offerInHand: mappedData.offerInHand ? mappedData.offerInHand.toString().trim() : undefined,
      noticePeriod: mappedData.noticePeriod ? mappedData.noticePeriod.toString().trim() : undefined,
      currentLocation: mappedData.currentLocation ? mappedData.currentLocation.toString().trim() : undefined,
      preferredLocation: mappedData.preferredLocation ? mappedData.preferredLocation.toString().trim() : undefined,
      availabilityForInterview: mappedData.availabilityForInterview ? mappedData.availabilityForInterview.toString().trim() : undefined,
      dataSource: 'excel_import',
      resumeText: `Profile imported from Excel for ${firstName} ${lastName}` // Default resume text
    };

    // Remove undefined fields
    Object.keys(profileData).forEach(key => {
      if (profileData[key] === undefined || profileData[key] === '') {
        delete profileData[key];
      }
    });

    return profileData;
  }

  async _createOrUpdateProfile(profileData) {
    try {
      // Check if profile exists by email
      const existingProfile = await this.profileRepository.findByEmail(profileData.email);
      
      if (existingProfile) {
        // Update existing profile with new data from Excel
        // Excel data takes precedence over existing data
        const updateData = { ...profileData };
        delete updateData.email; // Don't update email
        
        const updatedProfile = await this.profileRepository.update(existingProfile._id, updateData);
        return {
          profile: updatedProfile,
          isNew: false
        };
      } else {
        // Create new profile
        const newProfile = await this.profileRepository.create(profileData);
        return {
          profile: newProfile,
          isNew: true
        };
      }
    } catch (error) {
      throw new Error(`Failed to create/update profile for ${profileData.email}: ${error.message}`);
    }
  }

  validateExcelStructure(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Get headers (first row)
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      const headers = [];
      
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        const cell = worksheet[cellAddress];
        if (cell && cell.v) {
          headers.push(cell.v.toString().trim());
        }
      }

      // Check for required headers - need either email OR phone (not both required)
      const emailHeaders = ['E mail Id', 'Email', 'Email Id', 'Email ID', 'E-mail', 'Mail Id', 'Mail ID'];
      const phoneHeaders = ['Mobile Number', 'Mobile', 'Phone', 'Phone Number', 'Contact Number', 'Contact'];
      
      const hasEmailHeader = emailHeaders.some(header => 
        headers.some(h => h.toLowerCase().trim() === header.toLowerCase())
      );
      
      const hasPhoneHeader = phoneHeaders.some(header => 
        headers.some(h => h.toLowerCase().trim() === header.toLowerCase())
      );

      // Must have either email OR phone (or both)
      if (!hasEmailHeader && !hasPhoneHeader) {
        return {
          valid: false,
          error: `Missing required identification field. Need either Email field (e.g., "Email", "E mail Id") OR Phone field (e.g., "Mobile Number", "Phone"). Found headers: ${headers.join(', ')}`
        };
      }

      // Optional headers for better data mapping
      const recommendedHeaders = [
        'S.no', 'Mobile Number', 'Total Experience', 'Company', 'CTC', 
        'ECTC', 'Offer in Hand', 'Notice', 'Current Location', 
        'Preferred Location', 'Availability for interview'
      ];

      const foundHeaders = headers.filter(h => 
        recommendedHeaders.some(rh => rh.toLowerCase() === h.toLowerCase())
      );

      return {
        valid: true,
        headers: headers,
        requiredFieldsFound: {
          email: hasEmailHeader,
          phone: hasPhoneHeader
        },
        foundHeaders: foundHeaders,
        missingRecommended: recommendedHeaders.filter(rh => 
          !headers.some(h => h.toLowerCase() === rh.toLowerCase())
        )
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  getExcelTemplate() {
    const templateData = [
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
      }
    ];

    return templateData;
  }

  async getImportsByUserId(userId) {
    try {
      return await this.excelImportRepository.findByUserId(userId);
    } catch (error) {
      throw new Error(`Failed to get imports by user ID: ${error.message}`);
    }
  }

  async getImportsByBatch(batchId) {
    try {
      return await this.excelImportRepository.findByImportBatch(batchId);
    } catch (error) {
      throw new Error(`Failed to get imports by batch: ${error.message}`);
    }
  }

  async getImportStats(batchId) {
    try {
      return await this.excelImportRepository.getImportStats(batchId);
    } catch (error) {
      throw new Error(`Failed to get import stats: ${error.message}`);
    }
  }
}

module.exports = ExcelProcessingService;
