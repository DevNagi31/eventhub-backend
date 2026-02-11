import cron from 'node-cron';
import eventAggregator from './eventAggregator.js';

class Scheduler {
  constructor() {
    this.jobs = [];
  }

  start() {
    console.log('📅 Starting event scraper...');

    // Scrape events every 4 hours (optimal frequency)
    const job = cron.schedule('0 */4 * * *', async () => {
      console.log('🕷️  Running scheduled event scraping...');
      try {
        await eventAggregator.fetchAndStoreEvents(
          { lat: 42.0987, lng: -75.9179 },
          100,
          { useScraper: true, includeEsports: true }
        );
        console.log('✅ Scheduled scraping completed');
      } catch (error) {
        console.error('❌ Scraping failed:', error);
      }
    });

    // Run immediately on startup
    this.runInitialScrape();

    this.jobs.push(job);
    console.log('✅ Scheduler started - Events will scrape every 4 hours');
  }

  async runInitialScrape() {
    console.log('🕷️  Running initial event scraping...');
    try {
      await eventAggregator.fetchAndStoreEvents(
        { lat: 42.0987, lng: -75.9179 },
        100,
        { useScraper: true, includeEsports: true }
      );
      console.log('✅ Initial scraping completed');
    } catch (error) {
      console.error('❌ Initial scraping failed:', error);
    }
  }

  stop() {
    this.jobs.forEach(job => job.stop());
  }
}

export default new Scheduler();
