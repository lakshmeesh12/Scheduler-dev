const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_PATH || './uploads';
const excelUploadDir = path.join(uploadDir, 'excel');

if (!fs.existsSync(excelUploadDir)) {
  fs.mkdirSync(excelUploadDir, { recursive: true });
}

// Configure storage for Excel files
const excelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, excelUploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'candidates-' + uniqueSuffix + ext);
  }
});

// File filter for Excel files only
const excelFileFilter = (req, file, cb) => {
  // Accept only Excel files
  const allowedTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only Excel files (.xls, .xlsx) and CSV files are allowed.'), false);
  }
};

// Configure multer for Excel uploads
const excelUpload = multer({
  storage: excelStorage,
  fileFilter: excelFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for Excel files
  }
});

// Upload middleware for single Excel file
const uploadExcelSingle = excelUpload.single('excelFile');

// Upload middleware with error handling
const excelUploadMiddleware = (req, res, next) => {
  uploadExcelSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'File too large',
            details: 'Excel file size must be less than 10MB'
          }
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid field name',
            details: 'Use "excelFile" as the field name'
          }
        });
      }
      return res.status(400).json({
        success: false,
        error: {
          message: 'Upload error',
          details: err.message
        }
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'File validation error',
          details: err.message
        }
      });
    }
    next();
  });
};

module.exports = {
  excelUploadMiddleware,
  excelUploadDir
};
