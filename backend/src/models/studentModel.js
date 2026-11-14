import pool from "../config/database.js";

export const studentModel = {
  async create({ name, guardian_name, guardian_email }, userId) {
    const query = `
      INSERT INTO students (
        name,
        guardian_name,
        guardian_email,
        user_id
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        name,
        guardian_name,
        guardian_email,
        is_active,
        created_at;
    `;

    const values = [name, guardian_name, guardian_email, userId];

    const result = await pool.query(query, values);

    return result.rows[0];
  },

  async findAll(statusFilter, userId) {
    let query = `
      SELECT
        id,
        name,
        guardian_name,
        guardian_email,
        is_active,
        created_at
      FROM students
      WHERE user_id = $1
    `;

    const values = [userId];

    if (statusFilter === "active") {
      query += ` AND is_active = true`;
    } else if (statusFilter === "inactive") {
      query += ` AND is_active = false`;
    }

    query += ` ORDER BY id ASC;`;

    const result = await pool.query(query, values);

    return result.rows;
  },

  async findById(id, userId) {
    const query = `
      SELECT
        id,
        name,
        guardian_name,
        guardian_email,
        is_active,
        created_at
      FROM students
      WHERE id = $1
        AND user_id = $2;
    `;

    const result = await pool.query(query, [id, userId]);

    return result.rows[0] || null;
  },

  async update(id, { name, guardian_name, guardian_email }, userId) {
    const query = `
      UPDATE students
      SET
        name = $1,
        guardian_name = $2,
        guardian_email = $3
      WHERE id = $4
        AND user_id = $5
      RETURNING
        id,
        name,
        guardian_name,
        guardian_email,
        is_active,
        created_at;
    `;

    const values = [name, guardian_name, guardian_email, id, userId];

    const result = await pool.query(query, values);

    return result.rows[0] || null;
  },

  async updateStatus(id, is_active, userId) {
    const query = `
      UPDATE students
      SET is_active = $1
      WHERE id = $2
        AND user_id = $3
      RETURNING
        id,
        name,
        guardian_name,
        guardian_email,
        is_active,
        created_at;
    `;

    const values = [is_active, id, userId];

    const result = await pool.query(query, values);

    return result.rows[0] || null;
  },

  async countAll(userId) {
    const query = `
      SELECT COUNT(*) AS total
      FROM students
      WHERE user_id = $1;
    `;

    const result = await pool.query(query, [userId]);

    return Number(result.rows[0].total);
  },
};
