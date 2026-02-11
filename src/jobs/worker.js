import faktory from 'faktory-worker';
import eventAggregator from '../services/eventAggregator.js';

export async function startWorker() {
  try {
    // Register job handler in the global registry FIRST
    console.log('Registering scrape-events handler...');
    faktory.registry['scrape-events'] = async (...args) => {
      console.log('🕷️  Faktory job: Scraping events STARTED...', JSON.stringify(args));
      
      try {
        const jobArgs = args[0] || {};
        const location = jobArgs.location || { lat: 42.0987, lng: -75.9179 };
        
        console.log('Starting event aggregator...');
        const events = await eventAggregator.fetchAndStoreEvents(
          location,
          100,
          { useScraper: true, includeEsports: true }
        );
        
        console.log(`✅ Faktory job completed: Scraped ${events.length} events`);
        return { success: true, count: events.length };
      } catch (error) {
        console.error('❌ Faktory job failed:', error);
        throw error;
      }
    };
    console.log('Handler registered:', typeof faktory.registry['scrape-events']);

    // DON'T await - let it run in background
    console.log('👷 Starting Faktory worker...');
    faktory.work({
      queues: ['default'],
      concurrency: 1,
    });

    console.log('✅ Faktory worker started (non-blocking)');
  } catch (error) {
    console.error('Failed to start Faktory worker:', error.message);
    throw error;
  }
}
