import axios from 'axios';
import dotenv from 'dotenv';
import cacheService from './cacheService.js';

dotenv.config();

class SportsService {
  constructor() {
    this.baseURL = 'https://api.seatgeek.com/2';
    this.clientId = process.env.SEATGEEK_CLIENT_ID;
    this.clientSecret = process.env.SEATGEEK_CLIENT_SECRET;
  }

  async fetchEvents(location, radius = 50, categories = []) {
    try {
      const cacheKey = cacheService.generateAPIKey('seatgeek', { 
        lat: location.lat, 
        lng: location.lng, 
        radius, 
        categories 
      });

      // Check cache first
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        console.log('✅ Returning cached SeatGeek events');
        return cached;
      }

      // Build query params
      const params = {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        lat: location.lat,
        lon: location.lng,
        range: `${radius}mi`,
        per_page: 50,
        'datetime_utc.gte': new Date().toISOString()
      };

      // Add category filter if specified
      if (categories.length > 0) {
        // SeatGeek categories: sports, nba, nfl, nhl, mlb, etc.
        params.taxonomies_name = categories.join(',');
      }

      const response = await axios.get(`${this.baseURL}/events`, { params });

      const events = response.data.events.map(event => this.normalizeEvent(event));

      // Cache for 30 minutes
      await cacheService.set(cacheKey, events, 1800);

      console.log(`✅ Fetched ${events.length} events from SeatGeek`);
      return events;
    } catch (error) {
      console.error('SeatGeek API error:', error.message);
      return [];
    }
  }

  normalizeEvent(event) {
    return {
      externalId: `seatgeek_${event.id}`,
      title: event.title,
      description: event.description || '',
      eventType: 'sports',
      category: event.type || 'sports',
      location: {
        lat: event.venue.location.lat,
        lng: event.venue.location.lon
      },
      venueName: event.venue.name,
      venueAddress: `${event.venue.address}, ${event.venue.extended_address}`,
      startTime: new Date(event.datetime_utc),
      endTime: null,
      price: event.stats?.lowest_price || null,
      registrationUrl: event.url,
      source: 'seatgeek',
      rawData: event
    };
  }
}

export default new SportsService();
