import { createClient } from 'redis';

let redisClient = null;

async function connectRedis() {
  if (!process.env.REDIS_URL) {
    console.log('⚠️  Redis URL not configured - running without cache');
    return null;
  }

  try {
    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: false // Don't retry in production
      }
    });

    redisClient.on('error', (err) => {
      console.log('⚠️  Redis unavailable:', err.message);
    });

    await redisClient.connect();
    console.log('✅ Connected to Redis');
    return redisClient;
  } catch (error) {
    console.log('⚠️  Redis unavailable - running without cache');
    return null;
  }
}

export { connectRedis, redisClient };
