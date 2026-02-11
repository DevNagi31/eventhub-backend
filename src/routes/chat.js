import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import aiChatbot from '../services/aiChatbot.js';
import { chatLimiter } from '../utils/apiRateLimiter.js';
import { query } from '../config/database.js';

const router = express.Router();

router.post('/message', authenticateToken, chatLimiter, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('Processing chat message from user:', req.user.id, 'Message:', message);

    const response = await aiChatbot.processQuery(message, req.user.id);
    
    console.log('AI Response:', response.message);

    let suggestedEventsDetails = [];
    if (response.suggestedEvents && response.suggestedEvents.length > 0) {
      const eventIds = response.suggestedEvents.map(e => e.id || e);
      const eventsResult = await query(
        `SELECT id, title, category, venue_name, start_time,
                lat as lat, lng as lng
         FROM events WHERE id = ANY($1)`,
        [eventIds]
      );
      suggestedEventsDetails = eventsResult.rows;
    }

    let suggestedGroupsDetails = [];
    if (response.suggestedGroups && response.suggestedGroups.length > 0) {
      const groupIds = response.suggestedGroups.map(g => g.id || g);
      const groupsResult = await query(
        `SELECT id, name, category, member_count
         FROM groups WHERE id = ANY($1)`,
        [groupIds]
      );
      suggestedGroupsDetails = groupsResult.rows;
    }

    res.json({
      message: response.message,
      suggestedEvents: suggestedEventsDetails,
      suggestedGroups: suggestedGroupsDetails
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process message', details: error.message });
  }
});

export default router;
