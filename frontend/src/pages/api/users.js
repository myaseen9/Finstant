import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

let pool;
if (!global.pool) {
  global.pool = new Pool({ connectionString: process.env.DATABASE_URL });
}
pool = global.pool;

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Fetch all users
    try {
      const result = await pool.query(`
        SELECT id, username, first_name, last_name, role, designation, is_active, created_at 
        FROM app_user 
        ORDER BY 
          CASE role 
            WHEN 'superadmin' THEN 1 
            WHEN 'admin' THEN 2 
            ELSE 3 
          END, 
          LOWER(first_name) ASC
      `);
      return res.status(200).json(result.rows);
    } catch (error) {
      console.error('Fetch Users Error:', error);
      return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  } 
  
  if (req.method === 'POST') {
    // Create new user
    const { username, password, first_name, last_name, role, designation } = req.body;
    
    if (!username || !password || !first_name) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
      const checkUser = await pool.query('SELECT id FROM app_user WHERE username = $1', [username.toLowerCase()]);
      if (checkUser.rows.length > 0) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const result = await pool.query(
        `INSERT INTO app_user (username, password_hash, first_name, last_name, role, designation, is_active, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, true, now()) RETURNING id, username, first_name, last_name, role, designation, is_active, created_at`,
        [username.toLowerCase(), hashedPassword, first_name, last_name || '', role || 'user', designation || 'User']
      );

      return res.status(201).json({ message: 'User created successfully', user: result.rows[0] });
    } catch (error) {
      console.error('Create User Error:', error);
      return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }

  if (req.method === 'PUT') {
    // Update user status
    const { id, is_active } = req.body;
    
    if (!id) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    try {
      // Security Check: Protect superadmins
      const roleCheck = await pool.query('SELECT role FROM app_user WHERE id = $1', [id]);
      if (roleCheck.rows.length > 0 && roleCheck.rows[0].role === 'superadmin') {
        return res.status(403).json({ message: 'Forbidden: Cannot modify a Super Admin' });
      }

      const result = await pool.query(
        'UPDATE app_user SET is_active = $1 WHERE id = $2 RETURNING id, is_active',
        [is_active, id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      return res.status(200).json({ message: 'User updated successfully', user: result.rows[0] });
    } catch (error) {
      console.error('Update User Error:', error);
      return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    // Hard delete user
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    try {
      // Security Check: Protect superadmins
      const roleCheck = await pool.query('SELECT role FROM app_user WHERE id = $1', [id]);
      if (roleCheck.rows.length > 0 && roleCheck.rows[0].role === 'superadmin') {
        return res.status(403).json({ message: 'Forbidden: Cannot delete a Super Admin' });
      }

      // Due to onDelete: Cascade, chat_session and chat_message entries will also be deleted automatically.
      const result = await pool.query('DELETE FROM app_user WHERE id = $1 RETURNING id', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      return res.status(200).json({ message: 'User permanently deleted' });
    } catch (error) {
      console.error('Delete User Error:', error);
      return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}
