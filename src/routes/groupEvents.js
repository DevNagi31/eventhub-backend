import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireGroupAdmin, requireGroupMember } from '../middleware/groupPermissions.js';

const router = express.Router();

// Get events for a group
router.get('/group/:groupId', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        ge.id, ge.group_id, ge.event_id, ge.title, ge.description,
        ge.venue_name, ge.start_time, ge.is_official, ge.rsvp_count,
        ge.lat, ge.lng,
        e.title as official_title,
        e.description as official_description,
        e.venue_name as official_venue,
        e.category,
        u.username as created_by_username,
        COUNT(DISTINCT er.user_id) FILTER (WHERE er.status = 'going') as going_count
      FROM group_events ge
      LEFT JOIN events e ON ge.event_id = e.id
      LEFT JOIN users u ON ge.created_by = u.id
      LEFT JOIN event_rsvps er ON ge.id = er.group_event_id
      WHERE ge.group_id = $1 AND ge.start_time >= NOW()
      GROUP BY ge.id, e.id, u.username
      ORDER BY ge.start_time`,
      [req.params.groupId]
    );

    const events = result.rows.map(event => ({
      ...event,
      displayTitle: event.is_official ? event.official_title : event.title,
      displayDescription: event.is_official ? event.official_description : event.description,
      displayVenue: event.is_official ? event.official_venue : event.venue_name
    }));

    res.json(events);
  } catch (error) {
    console.error('Error fetching group events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Attach official event to group (admin/moderator only)
router.post('/attach', authenticateToken, async (req, res) => {
  try {
    const { groupId, eventId } = req.body;

    if (!groupId || !eventId) {
      return res.status(400).json({ error: 'Group ID and Event ID required' });
    }

    const member = await query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user.id]
    );

    if (member.rows.length === 0 || !['admin', 'moderator'].includes(member.rows[0].role)) {
      return res.status(403).json({ error: 'Admin or moderator privileges required' });
    }

    const event = await query('SELECT * FROM events WHERE id = $1', [eventId]);
    
    if (event.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const eventData = event.rows[0];

    const result = await query(
      `INSERT INTO group_events (
        group_id, event_id, is_official, created_by, start_time, created_at
      ) VALUES ($1, $2, true, $3, $4, NOW())
      RETURNING *`,
      [groupId, eventId, req.user.id, eventData.start_time]
    );

    res.status(201).json({
      message: 'Event attached to group successfully',
      groupEvent: result.rows[0]
    });
  } catch (error) {
    console.error('Error attaching event:', error);
    res.status(500).json({ error: 'Failed to attach event' });
  }
});

// Create custom group event (admin/moderator only)
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { groupId, title, description, location, venueName, startTime } = req.body;

    if (!groupId || !title || !location || !startTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const member = await query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user.id]
    );

    if (member.rows.length === 0 || !['admin', 'moderator'].includes(member.rows[0].role)) {
      return res.status(403).json({ error: 'Admin or moderator privileges required' });
    }

    const result = await query(
      `INSERT INTO group_events (
        group_id, title, description, lat, lng, venue_name,
        start_time, is_official, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, NOW())
      RETURNING *`,
      [
        groupId,
        title,
        description || '',
        location.lat,
        location.lng,
        venueName || '',
        startTime,
        req.user.id
      ]
    );

    res.status(201).json({
      message: 'Custom event created successfully',
      groupEvent: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating custom event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// RSVP to group event
router.post('/:eventId/rsvp', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;

    if (!['going', 'interested', 'not_going'].includes(status)) {
      return res.status(400).json({ error: 'Invalid RSVP status' });
    }

    const groupEvent = await query(
      'SELECT group_id FROM group_events WHERE id = $1',
      [req.params.eventId]
    );

    if (groupEvent.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const member = await query(
      'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupEvent.rows[0].group_id, req.user.id]
    );

    if (member.rows.length === 0) {
      return res.status(403).json({ error: 'Must be a group member to RSVP' });
    }

    await query(
      `INSERT INTO event_rsvps (group_event_id, user_id, status, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (group_event_id, user_id)
       DO UPDATE SET status = $3`,
      [req.params.eventId, req.user.id, status]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM event_rsvps 
       WHERE group_event_id = $1 AND status = 'going'`,
      [req.params.eventId]
    );

    await query(
      'UPDATE group_events SET rsvp_count = $1 WHERE id = $2',
      [countResult.rows[0].count, req.params.eventId]
    );

    res.json({ message: 'RSVP updated successfully' });
  } catch (error) {
    console.error('Error updating RSVP:', error);
    res.status(500).json({ error: 'Failed to update RSVP' });
  }
});

// Get RSVPs for an event
router.get('/:eventId/rsvps', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        u.id, u.username, u.avatar_url,
        er.status, er.created_at
      FROM event_rsvps er
      JOIN users u ON er.user_id = u.id
      WHERE er.group_event_id = $1
      ORDER BY er.created_at`,
      [req.params.eventId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching RSVPs:', error);
    res.status(500).json({ error: 'Failed to fetch RSVPs' });
  }
});

// Delete group event (admin only)
router.delete('/:eventId', authenticateToken, async (req, res) => {
  try {
    const event = await query(
      'SELECT group_id, created_by FROM group_events WHERE id = $1',
      [req.params.eventId]
    );

    if (event.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const member = await query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
      [event.rows[0].group_id, req.user.id]
    );

    const isCreator = event.rows[0].created_by === req.user.id;
    const isAdmin = member.rows[0]?.role === 'admin';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Only event creator or group admin can delete' });
    }

    await query('DELETE FROM group_events WHERE id = $1', [req.params.eventId]);

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;
