import axios from 'axios';
import dotenv from 'dotenv';
import cacheService from './cacheService.js';

dotenv.config();

class EsportsService {
  constructor() {
    this.baseURL = 'https://api.pandascore.co';
    this.apiKey = process.env.PANDASCORE_API_KEY;
  }

  async fetchEvents(location, radius = 50, games = []) {
    try {
      const cacheKey = cacheService.generateAPIKey('pandascore', { games });

      // Check cache first
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        console.log('✅ Returning cached PandaScore events');
        return cached;
      }

      // Fetch upcoming matches (PandaScore doesn't have location-based search)
      // We'll fetch all and filter later, or just show top tournaments
      const params = {
        token: this.apiKey,
        page: 1,
        per_page: 50,
        filter: 'upcoming'
      };

      // Fetch from multiple games if specified
      const gameAPIs = games.length > 0 ? games : ['lol', 'csgo', 'dota2', 'valorant'];
      const promises = gameAPIs.map(game => 
        axios.get(`${this.baseURL}/${game}/matches/upcoming`, { params })
          .catch(err => {
            console.error(`Error fetching ${game}:`, err.message);
            return { data: [] };
          })
      );

      const responses = await Promise.allSettled(promises);
      
      const allMatches = responses
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value.data || []);

      const events = allMatches.map(match => this.normalizeEvent(match));

      // Cache for 1 hour
      await cacheService.set(cacheKey, events, 3600);

      console.log(`✅ Fetched ${events.length} events from PandaScore`);
      return events;
    } catch (error) {
      console.error('PandaScore API error:', error.message);
      return [];
    }
  }

  normalizeEvent(match) {
    // PandaScore doesn't have exact location data, use tournament location if available
    const location = {
      lat: 0, // Default, will need to be enhanced
      lng: 0
    };

    return {
      externalId: `pandascore_${match.id}`,
      title: `${match.name || match.league?.name || 'Tournament Match'}`,
      description: `${match.opponents?.map(o => o.opponent?.name).join(' vs ') || ''}`,
      eventType: 'esports',
      category: match.videogame?.name?.toLowerCase() || 'esports',
      location,
      venueName: match.tournament?.name || 'Online',
      venueAddress: 'Online',
      startTime: new Date(match.scheduled_at || match.begin_at),
      endTime: null,
      price: null,
      registrationUrl: match.official_stream_url || match.live_url || null,
      source: 'pandascore',
      rawData: match
    };
  }
}

export default new EsportsService();
