import { query } from '../config/database.js';

class GroupService {
  async getUserGroups(userId) {
    try {
      const result = await query(
        `SELECT g.*, gm.role, gm.joined_at
         FROM groups g
         JOIN group_members gm ON g.id = gm.group_id
         WHERE gm.user_id = $1
         ORDER BY gm.joined_at DESC`,
        [userId]
      );

      return result.rows;
    } catch (error) {
      console.error('Error fetching user groups:', error);
      return [];
    }
  }

  async getGroupStats(groupId) {
    try {
      const result = await query(
        `SELECT 
          COUNT(DISTINCT gm.user_id) as member_count,
          COUNT(DISTINCT ge.id) as event_count,
          COUNT(DISTINCT gp.id) as post_count
         FROM groups g
         LEFT JOIN group_members gm ON g.id = gm.group_id
         LEFT JOIN group_events ge ON g.id = ge.group_id
         LEFT JOIN group_posts gp ON g.id = gp.group_id
         WHERE g.id = $1`,
        [groupId]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error fetching group stats:', error);
      return null;
    }
  }

  async isUserMember(groupId, userId) {
    try {
      const result = await query(
        'SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking membership:', error);
      return false;
    }
  }
}

export default new GroupService();
