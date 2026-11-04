import pool from "../config/database.js";

export const studentModel = {
  async create({ name, guardian_name, guardian_email }) {
    const query = `
      INSERT INTO students (name, guardian_name, guardian_email)
      VALUES ($1, $2, $3)
      RETURNING id, name, guardian_name, guardian_email, is_active, created_at;
    `;
    const values = [name, guardian_name, guardian_email];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async findAll(statusFilter) {
    let query = `
      SELECT id, name, guardian_name, guardian_email, is_active, created_at
      FROM students
    `;
    const values = [];

    if (statusFilter === "active") {
      query += ` WHERE is_active = true`;
    } else if (statusFilter === "inactive") {
      query += ` WHERE is_active = false`;
    }

    query += ` ORDER BY id ASC;`;

    const result = await pool.query(query, values);
    return result.rows;
  },

  async findById(id) {
    const query = `
      SELECT id, name, guardian_name, guardian_email, is_active, created_at
      FROM students
      WHERE id = $1;
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  },

  async update(id, { name, guardian_name, guardian_email }) {
    const query = `
      UPDATE students
      SET name = $1, guardian_name = $2, guardian_email = $3
      WHERE id = $4
      RETURNING id, name, guardian_name, guardian_email, is_active, created_at;
    `;
    const values = [name, guardian_name, guardian_email, id];
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  },

  async updateStatus(id, is_active) {
    const query = `
      UPDATE students
      SET is_active = $1
      WHERE id = $2
      RETURNING id, name, guardian_name, guardian_email, is_active, created_at;
    `;
    const values = [is_active, id];
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  },
};
