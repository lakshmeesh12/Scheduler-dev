const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const { connectDatabase } = require('./infrastructure/database/connection');
const errorHandler = require('./infrastructure/middleware/errorHandler');
const routes = require('./interfaces/routes');

class App {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001;
    
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  initializeMiddlewares() {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:8080',
      credentials: true
    }));
    
    // Compression middleware
    this.app.use(compression());
    
    // Logging middleware
    this.app.use(morgan('combined'));
    
    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Static files
    this.app.use('/uploads', express.static('uploads'));
  }

  initializeRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // API routes
    this.app.use('/api', routes);
    
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl
      });
    });
  }

  initializeErrorHandling() {
    this.app.use(errorHandler);
  }

  async start() {
    try {
      await connectDatabase();
      console.log('✅ Database connected successfully');
      
      this.app.listen(this.port, () => {
        console.log(`🚀 Server running on port ${this.port}`);
        console.log(`📝 Environment: ${process.env.NODE_ENV}`);
      });
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the application
const app = new App();
app.start();

module.exports = app;
