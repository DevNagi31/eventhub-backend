import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, username, avatar_url, lat, lng, preferences, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const { preferences } = req.body;

    await query(
      'UPDATE users SET preferences = $1 WHERE id = $2',
      [JSON.stringify(preferences), req.user.id]
    );

    res.json({ message: 'Preferences updated successfully' });
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Update user location
router.put('/location', authenticateToken, async (req, res) => {
  try {
    const { lat, lng } = req.body;

    await query(
      'UPDATE users SET lat = $1, lng = $2 WHERE id = $3',
      [lat, lng, req.user.id]
    );

    res.json({ message: 'Location updated successfully' });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

export default router;
