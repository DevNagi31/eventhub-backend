import faktoryClient from '../jobs/client.js';

class Scheduler {
  async start() {
    console.log('📅 Starting Faktory scheduler...');
    
    try {
      // Schedule event scraping every 4 hours
      await faktoryClient.scheduleEventScraping();
      console.log('✅ Faktory scheduler started - Events will scrape every 4 hours');
    } catch (error) {
      console.error('❌ Faktory scheduler failed:', error.message);
      throw error;
    }
  }

  async stop() {
    await faktoryClient.close();
  }
}

export default new Scheduler();
