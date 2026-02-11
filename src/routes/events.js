import express from 'express';
import { query } from '../config/database.js';
import { optionalAuth } from '../middleware/auth.js';
import { apiLimiter } from '../utils/apiRateLimiter.js';
import eventAggregator from '../services/eventAggregator.js';
import { calculateDistance } from '../utils/geoUtils.js';

const router = express.Router();

// Search events by location
router.get('/search', apiLimiter, optionalAuth, async (req, res) => {
  try {
    const { 
      lat, 
      lng, 
      radius = 50, 
      category, 
      eventType,
      startDate,
      endDate,
      limit = 50 
    } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    let queryText = `
      SELECT 
        id, external_id, title, description, event_type, category,
        lat, lng, venue_name, start_time, end_time, price, registration_url, source
      FROM events
      WHERE start_time >= $1
    `;

    const params = [startDate || new Date()];
    let paramIndex = 2;

    if (category) {
      queryText += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (eventType) {
      queryText += ` AND event_type = $${paramIndex}`;
      params.push(eventType);
      paramIndex++;
    }

    if (endDate) {
      queryText += ` AND start_time <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    queryText += ` ORDER BY start_time LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await query(queryText, params);

    // Filter by distance and calculate distance
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const maxRadius = parseFloat(radius);

    const events = result.rows
      .map(event => {
        const distance = calculateDistance(userLat, userLng, event.lat, event.lng);
        return { ...event, distance_miles: distance.toFixed(2) };
      })
      .filter(event => parseFloat(event.distance_miles) <= maxRadius)
      .sort((a, b) => parseFloat(a.distance_miles) - parseFloat(b.distance_miles));

    res.json({
      count: events.length,
      events
    });
  } catch (error) {
    console.error('Error searching events:', error);
    res.status(500).json({ error: 'Failed to search events' });
  }
});

// Get single event by ID
router.get('/:id', apiLimiter, async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        id, external_id, title, description, event_type, category,
        lat, lng, venue_name, start_time, end_time, price, 
        registration_url, source, raw_data, created_at
       FROM events WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Refresh events from APIs
router.post('/refresh', apiLimiter, async (req, res) => {
  try {
    const { lat, lng, radius = 50, categories = [], games = [] } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Location required' });
    }

    const events = await eventAggregator.fetchAndStoreEvents(
      { lat, lng },
      radius,
      { categories, games, includeEsports: true }
    );

    res.json({
      message: 'Events refreshed successfully',
      count: events.length
    });
  } catch (error) {
    console.error('Error refreshing events:', error);
    res.status(500).json({ error: 'Failed to refresh events' });
  }
});

// Get categories
router.get('/meta/categories', async (req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT category, event_type, COUNT(*) as count
       FROM events
       WHERE start_time >= NOW()
       GROUP BY category, event_type
       ORDER BY count DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

export default router;
