import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { query } from '../config/database.js';
import { calculateDistance } from '../utils/geoUtils.js';

dotenv.config();

class AIChatbot {
  constructor() {
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key') {
      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    } else {
      this.client = null;
      console.warn('⚠️  Anthropic API key not configured - chatbot will use mock responses');
    }
  }

  async processQuery(userMessage, userId) {
    try {
      const userContext = await this.getUserContext(userId);
      
      if (!this.client) {
        return this.getMockResponse(userMessage, userContext);
      }

      const systemPrompt = this.buildSystemPrompt(userContext);

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage }
        ]
      });

      const messageText = response.content[0].text;
      const parsed = this.parseResponse(messageText);

      return {
        message: parsed.message,
        suggestedEvents: parsed.eventIds,
        suggestedGroups: parsed.groupIds
      };
    } catch (error) {
      console.error('AI Chatbot error:', error);
      return {
        message: 'Sorry, I encountered an error processing your request. Please try again.',
        suggestedEvents: [],
        suggestedGroups: []
      };
    }
  }

  getMockResponse(userMessage, context) {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('basketball')) {
      const basketballEvents = context.recentEvents.filter(e => 
        e.category && e.category.toLowerCase().includes('basketball')
      );
      return {
        message: `I found ${basketballEvents.length} basketball events near you. Check them out on the Events page!`,
        suggestedEvents: basketballEvents.map(e => e.id).slice(0, 3),
        suggestedGroups: []
      };
    }
    
    if (lowerMessage.includes('valorant') || lowerMessage.includes('esports')) {
      const esportsEvents = context.recentEvents.filter(e => 
        e.event_type === 'esports'
      );
      return {
        message: `I found ${esportsEvents.length} esports events nearby. Check the Events page for details!`,
        suggestedEvents: esportsEvents.map(e => e.id).slice(0, 3),
        suggestedGroups: []
      };
    }

    return {
      message: `I can help you find sports and esports events near you. Try asking about specific sports like "basketball" or "valorant", or browse the Events and Groups pages to see what's available!`,
      suggestedEvents: context.recentEvents.map(e => e.id).slice(0, 3),
      suggestedGroups: context.nearbyGroups.map(g => g.id).slice(0, 2)
    };
  }

  async getUserContext(userId) {
    try {
      const userResult = await query(
        'SELECT username, preferences, lat, lng FROM users WHERE id = $1',
        [userId]
      );

      const user = userResult.rows[0];

      const groupsResult = await query(
        `SELECT g.id, g.name, g.category
         FROM groups g
         JOIN group_members gm ON g.id = gm.group_id
         WHERE gm.user_id = $1`,
        [userId]
      );

      const eventsResult = await query(
        `SELECT id, title, category, event_type, venue_name, start_time, lat, lng
         FROM events
         WHERE start_time >= NOW()
         ORDER BY start_time
         LIMIT 100`
      );

      const nearbyEvents = eventsResult.rows
        .map(event => {
          const distance = calculateDistance(user.lat, user.lng, event.lat, event.lng);
          return { ...event, distance };
        })
        .filter(event => event.distance <= 50)
        .slice(0, 20);

      const groupsNearbyResult = await query(
        `SELECT id, name, category, member_count, lat, lng
         FROM groups
         WHERE is_public = true
         ORDER BY member_count DESC
         LIMIT 50`
      );

      const nearbyGroups = groupsNearbyResult.rows
        .map(group => {
          const distance = calculateDistance(user.lat, user.lng, group.lat, group.lng);
          return { ...group, distance };
        })
        .filter(group => group.distance <= 50)
        .slice(0, 10);

      return {
        user: {
          username: user.username,
          preferences: user.preferences || [],
          location: { lat: user.lat, lng: user.lng }
        },
        userGroups: groupsResult.rows,
        recentEvents: nearbyEvents,
        nearbyGroups: nearbyGroups
      };
    } catch (error) {
      console.error('Error getting user context:', error);
      return { user: {}, userGroups: [], recentEvents: [], nearbyGroups: [] };
    }
  }

  buildSystemPrompt(context) {
    return `You are an event discovery assistant helping users find sports and esports events and groups.

User Info:
- Username: ${context.user.username}
- Interests: ${context.user.preferences?.join(', ') || 'None specified'}
- User's Groups: ${context.userGroups.map(g => `${g.name} (${g.category})`).join(', ') || 'None'}

Available Nearby Events (next 20):
${context.recentEvents.map(e => `event_${e.id}: ${e.title} - ${e.category} at ${e.venue_name} on ${new Date(e.start_time).toLocaleDateString()}`).join('\n')}

Available Nearby Groups:
${context.nearbyGroups.map(g => `group_${g.id}: ${g.name} (${g.category}) - ${g.member_count} members`).join('\n')}

Instructions:
- Help users find events or groups based on their interests
- Reference events as "event_<id>" and groups as "group_<id>" in your response
- Be concise and friendly
- If suggesting events, mention date and venue
- If suggesting groups, mention member count and category`;
  }

  parseResponse(text) {
    const eventIds = [];
    const eventMatches = text.matchAll(/event_(\d+)/g);
    for (const match of eventMatches) {
      eventIds.push(parseInt(match[1]));
    }

    const groupIds = [];
    const groupMatches = text.matchAll(/group_(\d+)/g);
    for (const match of groupMatches) {
      groupIds.push(parseInt(match[1]));
    }

    return {
      message: text,
      eventIds: [...new Set(eventIds)],
      groupIds: [...new Set(groupIds)]
    };
  }
}

export default new AIChatbot();
