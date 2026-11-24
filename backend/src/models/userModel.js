import pool from "../config/database.js";

export const userModel = {
  async findByEmail(email) {
    const query = `
      SELECT
        id,
        name,
        email,
        password_hash,
        is_demo,
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
        is_demo,
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

  async findByIdForGoogleLink(id) {
    const query = `
      SELECT
        id,
        name,
        email,
        password_hash,
        is_demo,
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

  async findByGoogleId(googleId) {
    const query = `
      SELECT
        id,
        name,
        email,
        is_demo,
        google_id,
        created_at,
        claimed_at
      FROM users
      WHERE google_id = $1
      LIMIT 1;
    `;

    const { rows } = await pool.query(query, [googleId]);

    return rows[0] ?? null;
  },

  async create({ name, email, passwordHash }, client = pool) {
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
        is_demo,
        google_id,
        created_at,
        claimed_at;
    `;

    const values = [name, email, passwordHash];

    const { rows } = await client.query(query, values);

    return rows[0];
  },

  async createGoogleAccount({ name, email, googleId }, client = pool) {
    const query = `
      INSERT INTO users (
        name,
        email,
        password_hash,
        google_id
      )
      VALUES ($1, $2, NULL, $3)
      RETURNING
        id,
        name,
        email,
        is_demo,
        google_id,
        created_at,
        claimed_at;
    `;

    const values = [name, email, googleId];

    const { rows } = await client.query(query, values);

    return rows[0];
  },

  async linkGoogleId(userId, googleId) {
    const query = `
      UPDATE users
      SET google_id = $1
      WHERE id = $2
        AND google_id IS NULL
      RETURNING
        id,
        name,
        email,
        is_demo,
        google_id,
        created_at,
        claimed_at;
    `;

    const { rows } = await pool.query(query, [googleId, userId]);

    return rows[0] ?? null;
  },

  async claimLegacy({ name, email, passwordHash }) {
    const client = await pool.connect();
    let transactionStarted = false;

    const rollback = async () => {
      if (!transactionStarted) return;

      // Impede uma segunda tentativa caso o ROLLBACK falhe.
      transactionStarted = false;

      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Erro ao desfazer reivindicação da conta legada:", rollbackError.message);
      }
    };

    try {
      await client.query("BEGIN");
      transactionStarted = true;

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
        await rollback();
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
          is_demo,
          google_id,
          created_at,
          claimed_at;
      `,
        [name, email, passwordHash, legacyUser.id],
      );

      if (updateResult.rowCount !== 1) {
        await rollback();
        return null;
      }

      await client.query("COMMIT");
      transactionStarted = false;

      return updateResult.rows[0];
    } catch (error) {
      await rollback();
      throw error;
    } finally {
      client.release();
    }
  },
};
