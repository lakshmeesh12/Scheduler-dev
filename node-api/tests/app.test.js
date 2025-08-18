/**
 * @jest-environment node
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');

describe('Health Check', () => {
  test('GET /health should return 200', async () => {
    const response = await request(app.app)
      .get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('OK');
  });
});

describe('API Routes', () => {
  test('GET /api/status should return system status', async () => {
    const response = await request(app.app)
      .get('/api/status');
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});

// Clean up after tests
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});
