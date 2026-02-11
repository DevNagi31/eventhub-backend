import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = express.Router();

// Get messages for a group
router.get('/:groupId', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    // Check if user is member of group
    const memberCheck = await query(
      'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.user.id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    // Get messages
    const messages = await query(
      `SELECT gm.*, u.username 
       FROM group_messages gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1
       ORDER BY gm.created_at DESC
       LIMIT $2`,
      [groupId, limit]
    );

    res.json({ messages: messages.rows.reverse() });
  } catch (error) {
    console.error('Error fetching group messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

export default router;
