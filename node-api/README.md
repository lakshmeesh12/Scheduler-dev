# Resume Finder Tool - Backend

A Node.js backend application built with clean architecture principles for finding suitable profiles from a database based on job descriptions. The system uses AI-powered matching to connect job requirements with candidate profiles.

## 🏗️ Architecture

This project follows **Clean Architecture** principles with the following layers:

```
src/
├── application/          # Business Logic Layer
│   └── services/        # Application services
├── domain/              # Domain Layer
│   ├── models/         # Entity models
│   └── repositories/   # Repository interfaces
├── infrastructure/      # Infrastructure Layer
│   ├── database/       # Database connection
│   ├── external/       # External service clients
│   ├── middleware/     # Express middleware
│   └── validation/     # Input validation
└── interfaces/          # Presentation Layer
    ├── controllers/    # HTTP controllers
    └── routes/         # Route definitions
```

## 🚀 Features

- **Profile Management**: Create, read, update, and delete candidate profiles
- **Job Description Management**: Manage job postings and requirements
- **AI-Powered Matching**: Intelligent matching between profiles and job descriptions
- **File Upload Support**: Resume file upload with validation
- **Search & Filtering**: Advanced search capabilities for profiles and jobs
- **Match Analytics**: Statistics and insights on matching results
- **Rate Limiting**: Protection against API abuse
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Structured error responses

## 🛠️ Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Validation**: Joi
- **File Upload**: Multer
- **Security**: Helmet, CORS
- **AI Integration**: Custom AI service client
- **Development**: Nodemon, ESLint, Prettier

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- AI Server (for embedding generation and similarity calculations)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd resume-finder-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` file with your configuration:
   ```env
   NODE_ENV=development
   PORT=3000
   DB_URI=mongodb://localhost:27017/resume_finder
   AI_SERVER_URL=http://localhost:5000
   AI_SERVER_API_KEY=your_ai_server_api_key
   JWT_SECRET=your_super_secret_jwt_key_here
   ```

4. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 📚 API Endpoints

### Profile Management
- `POST /api/profiles` - Create a new profile (with file upload)
- `GET /api/profiles` - Get all profiles (with pagination)
- `GET /api/profiles/:id` - Get profile by ID
- `PUT /api/profiles/:id` - Update profile
- `DELETE /api/profiles/:id` - Delete profile
- `GET /api/profiles/search` - Search profiles
- `POST /api/profiles/extract-skills` - Extract skills from resume text

### Job Description Management
- `POST /api/jobs` - Create a new job description
- `GET /api/jobs` - Get all job descriptions (with pagination)
- `GET /api/jobs/:id` - Get job description by ID
- `PUT /api/jobs/:id` - Update job description
- `DELETE /api/jobs/:id` - Delete job description
- `GET /api/jobs/search` - Search job descriptions
- `POST /api/jobs/extract-requirements` - Extract requirements from job description

### Matching System
- `POST /api/jobs/:jobId/matches` - Find matching profiles for a job
- `GET /api/jobs/:jobId/matches` - Get match results for a job
- `GET /api/jobs/:jobId/matches/statistics` - Get matching statistics
- `PUT /api/matches/:matchId/status` - Update match status
- `GET /api/matches/:jobId/:profileId` - Calculate match between specific job and profile

### System
- `GET /api/status` - System health check
- `GET /health` - Application health check

## 🔍 Usage Examples

### Creating a Profile
```bash
curl -X POST http://localhost:3000/api/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "resumeText": "Experienced software developer with 5 years in React and Node.js...",
    "skills": [
      {"name": "JavaScript", "level": "Advanced"},
      {"name": "React", "level": "Expert"}
    ]
  }'
```

### Creating a Job Description
```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior Frontend Developer",
    "company": "TechCorp",
    "description": "We are looking for a senior frontend developer...",
    "requirements": "5+ years of experience with React, TypeScript...",
    "experienceLevel": "Senior",
    "skills": [
      {"name": "React", "importance": "Required"},
      {"name": "TypeScript", "importance": "Required"}
    ],
    "createdBy": "hr@techcorp.com"
  }'
```

### Finding Matches
```bash
curl -X POST http://localhost:3000/api/jobs/JOB_ID/matches?limit=10&minScore=70
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix
```

## 📁 Project Structure Details

### Domain Layer
- **Models**: Define the core entities (Profile, JobDescription, MatchResult)
- **Repositories**: Abstract data access patterns

### Application Layer
- **Services**: Business logic implementation
- **Use Cases**: Specific application operations

### Infrastructure Layer
- **Database**: MongoDB connection and configuration
- **External Services**: AI service client
- **Middleware**: Express middleware for validation, rate limiting, etc.

### Interfaces Layer
- **Controllers**: HTTP request/response handling
- **Routes**: API endpoint definitions

## 🔒 Security Features

- **Rate Limiting**: Different limits for general, upload, and AI endpoints
- **Input Validation**: Comprehensive request validation using Joi
- **File Upload Security**: File type and size restrictions
- **Error Handling**: Structured error responses without sensitive data exposure
- **CORS Configuration**: Configurable cross-origin request handling

## 🎯 Matching Algorithm

The matching system uses multiple factors:

1. **Skills Matching** (40% weight)
   - Required vs. preferred skills
   - Skill level comparisons

2. **Experience Matching** (30% weight)
   - Years of experience
   - Relevant work history

3. **Education Matching** (10% weight)
   - Degree relevance
   - Educational background

4. **AI Semantic Similarity** (20% weight)
   - Vector embeddings comparison
   - Contextual relevance

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Environment Variables
Ensure all required environment variables are set in production:
- Database connection strings
- AI service configuration
- Security keys
- File upload paths

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the existing issues
2. Create a new issue with detailed description
3. Include environment details and error logs

---

Built with ❤️ using Node.js and Clean Architecture principles.
