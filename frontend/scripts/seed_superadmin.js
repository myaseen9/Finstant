require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function seedSuperAdmin() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/finance_db'
  });

  try {
    const username = 'yaseen2211';
    const password = 'kb44332211';
    
    // Check if exists
    const check = await pool.query('SELECT id FROM app_user WHERE username = $1', [username]);
    if (check.rows.length > 0) {
      console.log('Superadmin already exists. Updating password and role to be safe.');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await pool.query(
        `UPDATE app_user SET password_hash = $1, role = 'superadmin', designation = 'CEO', is_active = true WHERE username = $2`,
        [hashedPassword, username]
      );
      console.log('Superadmin updated successfully!');
      return;
    }

    // Insert
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    await pool.query(
      `INSERT INTO app_user (username, password_hash, first_name, last_name, role, designation, is_active, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, true, now())`,
      [username, hashedPassword, 'Muhammad', 'Yaseen', 'superadmin', 'CEO']
    );
    console.log('Superadmin created successfully!');
  } catch (error) {
    console.error('Error creating superadmin:', error);
  } finally {
    await pool.end();
  }
}

seedSuperAdmin();
