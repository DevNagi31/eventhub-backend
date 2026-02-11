import sportsService from './sportsService.js';
import esportsService from './esportsService.js';
import scraperService from './scraperService.js';
import { query } from '../config/database.js';

class EventAggregator {
  constructor() {
    this.sources = {
      sports: sportsService,
      esports: esportsService,
      scraper: scraperService
    };
  }

  async fetchAndStoreEvents(location, radius = 50, options = {}) {
    try {
      const { categories = [], games = [], includeEsports = true, useScraper = true } = options;

      const promises = [];

      // Try API sources first (if keys are configured)
      if (process.env.SEATGEEK_CLIENT_ID && process.env.SEATGEEK_CLIENT_ID !== 'your_seatgeek_client_id') {
        promises.push(
          this.sources.sports.fetchEvents(location, radius, categories)
        );
      }

      if (includeEsports && process.env.PANDASCORE_API_KEY && process.env.PANDASCORE_API_KEY !== 'your_pandascore_api_key') {
        promises.push(
          this.sources.esports.fetchEvents(location, radius, games)
        );
      }

      // Always use scraper as fallback/supplement
      if (useScraper) {
        console.log('Using web scraper to fetch events...');
        promises.push(
          this.sources.scraper.scrapeAllSources(location)
        );
      }

      const results = await Promise.allSettled(promises);
      
      const allEvents = results
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value);

      console.log(`✅ Aggregated ${allEvents.length} total events`);
      return allEvents;
    } catch (error) {
      console.error('Event aggregation error:', error);
      return [];
    }
  }

  async storeEvents(events) {
    // Events are already stored by individual services
    return events;
  }
}

export default new EventAggregator();
