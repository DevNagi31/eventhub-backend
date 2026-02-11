import { query } from '../config/database.js';

export const requireGroupMember = async (req, res, next) => {
  const { groupId } = req.params;
  const userId = req.user.id;

  try {
    const result = await query(
      'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'You must be a group member' });
    }

    req.groupMember = result.rows[0];
    next();
  } catch (error) {
    console.error('Error checking group membership:', error);
    res.status(500).json({ error: 'Failed to verify membership' });
  }
};

export const requireGroupAdmin = async (req, res, next) => {
  const { groupId } = req.params;
  const userId = req.user.id;

  try {
    const result = await query(
      'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2 AND role IN ($3, $4)',
      [groupId, userId, 'admin', 'moderator']
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Admin or moderator privileges required' });
    }

    req.groupMember = result.rows[0];
    next();
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ error: 'Failed to verify permissions' });
  }
};
