import pool from "../config/database.js";

export const userModel = {
  async findByEmail(email) {
    const query = `
      SELECT
        id,
        name,
        email,
        password_hash,
        google_id,
        created_at,
        claimed_at
      FROM users
      WHERE email = $1
      LIMIT 1;
    `;

    const { rows } = await pool.query(query, [email]);

    return rows[0] ?? null;
  },

  async findById(id) {
    const query = `
      SELECT
        id,
        name,
        email,
        google_id,
        created_at,
        claimed_at
      FROM users
      WHERE id = $1
      LIMIT 1;
    `;

    const { rows } = await pool.query(query, [id]);

    return rows[0] ?? null;
  },

  async create({ name, email, passwordHash }) {
    const query = `
      INSERT INTO users (
        name,
        email,
        password_hash
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        name,
        email,
        google_id,
        created_at,
        claimed_at;
    `;

    const values = [name, email, passwordHash];

    const { rows } = await pool.query(query, values);

    return rows[0];
  },

  async claimLegacy({ name, email, passwordHash }) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const legacyResult = await client.query(
        `
          SELECT
            id,
            password_hash,
            google_id,
            claimed_at
          FROM users
          WHERE email = $1
          FOR UPDATE;
        `,
        ["legado@studenttracker.local"],
      );

      const legacyUser = legacyResult.rows[0];

      if (
        !legacyUser ||
        legacyUser.password_hash !== null ||
        legacyUser.google_id !== null ||
        legacyUser.claimed_at !== null
      ) {
        await client.query("ROLLBACK");
        return null;
      }

      const updateResult = await client.query(
        `
          UPDATE users
          SET
            name = $1,
            email = $2,
            password_hash = $3,
            claimed_at = CURRENT_TIMESTAMP
          WHERE id = $4
            AND claimed_at IS NULL
          RETURNING
            id,
            name,
            email,
            google_id,
            created_at,
            claimed_at;
        `,
        [name, email, passwordHash, legacyUser.id],
      );

      if (updateResult.rowCount !== 1) {
        await client.query("ROLLBACK");
        return null;
      }

      await client.query("COMMIT");

      return updateResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
