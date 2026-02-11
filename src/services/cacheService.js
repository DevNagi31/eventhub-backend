import redisClient from '../config/redis.js';

class CacheService {
  constructor() {
    this.defaultTTL = 3600; // 1 hour
  }

  async get(key) {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    try {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async delete(key) {
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  async deletePattern(pattern) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      return true;
    } catch (error) {
      console.error('Cache delete pattern error:', error);
      return false;
    }
  }

  // Generate cache key for events
  generateEventKey(lat, lng, radius, category) {
    return `events:${lat.toFixed(2)}:${lng.toFixed(2)}:${radius}:${category || 'all'}`;
  }

  // Generate cache key for API responses
  generateAPIKey(apiName, params) {
    return `api:${apiName}:${JSON.stringify(params)}`;
  }
}

export default new CacheService();
