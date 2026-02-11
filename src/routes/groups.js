import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { requireGroupAdmin } from '../middleware/groupPermissions.js';
import { apiLimiter } from '../utils/apiRateLimiter.js';
import { calculateDistance } from '../utils/geoUtils.js';

const router = express.Router();

// Create group
router.post('/', authenticateToken, apiLimiter, async (req, res) => {
  try {
    const { name, description, category, eventType, location, city } = req.body;

    if (!name || !category || !location) {
      return res.status(400).json({ error: 'Name, category, and location required' });
    }

    const result = await query(
      `INSERT INTO groups (
        name, description, category, event_type, lat, lng, city, 
        creator_id, member_count, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, NOW(), NOW())
      RETURNING *`,
      [
        name,
        description || '',
        category,
        eventType || 'sports',
        location.lat,
        location.lng,
        city || '',
        req.user.id
      ]
    );

    const group = result.rows[0];

    await query(
      `INSERT INTO group_members (group_id, user_id, role, joined_at)
       VALUES ($1, $2, 'admin', NOW())`,
      [group.id, req.user.id]
    );

    res.status(201).json({
      message: 'Group created successfully',
      group
    });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Search groups
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { lat, lng, radius = 50, category, limit = 50 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    let queryText = `
      SELECT 
        g.id, g.name, g.description, g.category, g.event_type, g.city,
        g.cover_image_url, g.member_count, g.created_at, g.lat, g.lng,
        u.username as creator_name
      FROM groups g
      JOIN users u ON g.creator_id = u.id
      WHERE g.is_public = true
    `;

    const params = [];
    let paramIndex = 1;

    if (category) {
      queryText += ` AND g.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    queryText += ` LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await query(queryText, params);

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const maxRadius = parseFloat(radius);

    const groups = result.rows
      .map(group => {
        const distance = calculateDistance(userLat, userLng, group.lat, group.lng);
        return { ...group, distance_miles: distance.toFixed(2) };
      })
      .filter(group => parseFloat(group.distance_miles) <= maxRadius)
      .sort((a, b) => parseFloat(a.distance_miles) - parseFloat(b.distance_miles));

    res.json({
      count: groups.length,
      groups
    });
  } catch (error) {
    console.error('Error searching groups:', error);
    res.status(500).json({ error: 'Failed to search groups' });
  }
});

// Get single group
router.get('/:groupId', optionalAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        g.id, g.name, g.description, g.category, g.event_type, g.city,
        g.cover_image_url, g.member_count, g.is_public, g.created_at,
        g.lat, g.lng,
        u.id as creator_id, u.username as creator_name,
        COUNT(DISTINCT ge.id) as event_count
      FROM groups g
      JOIN users u ON g.creator_id = u.id
      LEFT JOIN group_events ge ON g.id = ge.group_id
      WHERE g.id = $1
      GROUP BY g.id, u.id, u.username`,
      [req.params.groupId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const group = result.rows[0];

    if (req.user) {
      const memberResult = await query(
        'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
        [req.params.groupId, req.user.id]
      );
      
      group.userRole = memberResult.rows[0]?.role || null;
      group.isMember = memberResult.rows.length > 0;
    }

    res.json(group);
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// Join group
router.post('/:groupId/join', authenticateToken, async (req, res) => {
  try {
    const existing = await query(
      'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.groupId, req.user.id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Already a member of this group' });
    }

    await query(
      `INSERT INTO group_members (group_id, user_id, role, joined_at)
       VALUES ($1, $2, 'member', NOW())`,
      [req.params.groupId, req.user.id]
    );

    await query(
      'UPDATE groups SET member_count = member_count + 1 WHERE id = $1',
      [req.params.groupId]
    );

    res.json({ message: 'Successfully joined group' });
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// Leave group
router.post('/:groupId/leave', authenticateToken, async (req, res) => {
  try {
    const member = await query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.groupId, req.user.id]
    );

    if (member.rows.length === 0) {
      return res.status(404).json({ error: 'Not a member of this group' });
    }

    if (member.rows[0].role === 'admin') {
      const adminCount = await query(
        'SELECT COUNT(*) FROM group_members WHERE group_id = $1 AND role = $2',
        [req.params.groupId, 'admin']
      );

      if (parseInt(adminCount.rows[0].count) === 1) {
        return res.status(400).json({ error: 'Cannot leave: you are the only admin' });
      }
    }

    await query(
      'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.groupId, req.user.id]
    );

    await query(
      'UPDATE groups SET member_count = member_count - 1 WHERE id = $1',
      [req.params.groupId]
    );

    res.json({ message: 'Successfully left group' });
  } catch (error) {
    console.error('Error leaving group:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// Get group members
router.get('/:groupId/members', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        u.id, u.username, u.avatar_url,
        gm.role, gm.joined_at
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = $1
      ORDER BY 
        CASE gm.role
          WHEN 'admin' THEN 1
          WHEN 'moderator' THEN 2
          ELSE 3
        END,
        gm.joined_at`,
      [req.params.groupId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Update group (admin only)
router.put('/:groupId', authenticateToken, requireGroupAdmin, async (req, res) => {
  try {
    const { name, description, coverImageUrl } = req.body;

    await query(
      `UPDATE groups 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           cover_image_url = COALESCE($3, cover_image_url),
           updated_at = NOW()
       WHERE id = $4`,
      [name, description, coverImageUrl, req.params.groupId]
    );

    res.json({ message: 'Group updated successfully' });
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Delete group (admin only)
router.delete('/:groupId', authenticateToken, requireGroupAdmin, async (req, res) => {
  try {
    const group = await query(
      'SELECT creator_id FROM groups WHERE id = $1',
      [req.params.groupId]
    );

    if (group.rows[0].creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Only group creator can delete group' });
    }

    await query('DELETE FROM groups WHERE id = $1', [req.params.groupId]);

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

export default router;
