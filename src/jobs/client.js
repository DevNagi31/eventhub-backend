import faktory from 'faktory-worker';

class FaktoryClient {
  constructor() {
    this.client = null;
  }

  async connect() {
    // Use faktory.connect() not Client.connect()
    this.client = await faktory.connect();
    console.log('📡 Connected to Faktory server');
    return this.client;
  }

  async pushJob(jobtype, args = {}, queue = 'default') {
    if (!this.client) {
      await this.connect();
    }

    const job = new faktory.Job(jobtype, args, { queue });
    await this.client.push(job);
    console.log(`✅ Pushed job: ${jobtype}`);
  }

  async scheduleEventScraping() {
    // Schedule immediate scraping
    await this.pushJob('scrape-events', {});
    
    // Schedule recurring job every 4 hours (14400000 ms)
    setInterval(async () => {
      await this.pushJob('scrape-events', {});
      console.log('✅ Scheduled recurring event scraping (every 4 hours)');
    }, 4 * 60 * 60 * 1000);
  }

  async close() {
    if (this.client) {
      await this.client.close();
    }
  }
}

export default new FaktoryClient();
