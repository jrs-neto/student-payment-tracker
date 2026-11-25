import pool from "../config/database.js";

export const monthlyModel = {
  // 1. Listar meses pertencentes ao usuário.
  async findAllMonths(userId) {
    const query = `
      SELECT id, year, month, created_at
      FROM reference_months
      WHERE user_id = $1
      ORDER BY year ASC, month ASC;
    `;

    const result = await pool.query(query, [userId]);

    return result.rows;
  },

  // 2. Buscar mês de referência pertencente ao usuário.
  async findMonthById(referenceId, userId) {
    const query = `
      SELECT id, year, month, created_at
      FROM reference_months
      WHERE id = $1
        AND user_id = $2;
    `;

    const result = await pool.query(query, [referenceId, userId]);

    return result.rows[0] || null;
  },

  // 3. Buscar mês por ano e mês, considerando o proprietário.
  async findMonthByYearAndMonth(year, month, userId) {
    const query = `
      SELECT id, year, month, created_at
      FROM reference_months
      WHERE year = $1
        AND month = $2
        AND user_id = $3;
    `;

    const result = await pool.query(query, [year, month, userId]);

    return result.rows[0] || null;
  },

  // 4. Listar registros mensais de um mês pertencente ao usuário.
  async findRecordsByMonthId(referenceId, userId) {
    const query = `
      SELECT
        id,
        student_id,
        reference_month_id,
        student_name,
        amount,
        due_date,
        is_paid,
        created_at
      FROM monthly_records
      WHERE reference_month_id = $1
        AND user_id = $2
      ORDER BY
        CASE
          WHEN is_paid = false
            AND due_date < (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
          THEN 1
          WHEN is_paid = false
            AND due_date >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
          THEN 2
          ELSE 3
        END ASC,
        due_date ASC,
        id ASC;
    `;

    const result = await pool.query(query, [referenceId, userId]);

    return result.rows;
  },

  // 5. Calcular resumo financeiro do mês pertencente ao usuário.
  async getMonthFinancialSummary(referenceId, userId) {
    const query = `
      SELECT
        COALESCE(SUM(amount), 0) AS total_expected,
        COALESCE(
          SUM(CASE WHEN is_paid = true THEN amount ELSE 0 END),
          0
        ) AS total_paid,
        COALESCE(
          SUM(CASE WHEN is_paid = false THEN amount ELSE 0 END),
          0
        ) AS total_pending
      FROM monthly_records
      WHERE reference_month_id = $1
        AND user_id = $2;
    `;

    const result = await pool.query(query, [referenceId, userId]);

    return result.rows[0];
  },

  // 6. Consultar aluno pertencente ao usuário.
  async findStudentById(studentId, userId) {
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

    const result = await pool.query(query, [studentId, userId]);

    return result.rows[0] || null;
  },

  // 7. Criar registro mensal vinculado ao usuário.
  async createRecord({ student_id, reference_month_id, student_name, amount, due_date }, userId) {
    const query = `
      INSERT INTO monthly_records (
        student_id,
        reference_month_id,
        student_name,
        amount,
        due_date,
        is_paid,
        user_id
      )
      VALUES ($1, $2, $3, $4, $5, false, $6)
      RETURNING
        id,
        student_id,
        reference_month_id,
        student_name,
        amount,
        due_date,
        is_paid,
        created_at;
    `;

    const values = [student_id, reference_month_id, student_name, amount, due_date, userId];

    const result = await pool.query(query, values);

    return result.rows[0];
  },

  // 8. Consultar registro mensal pertencente ao usuário.
  async findRecordById(recordId, userId) {
    const query = `
      SELECT
        id,
        student_id,
        reference_month_id,
        student_name,
        amount,
        due_date,
        is_paid,
        created_at
      FROM monthly_records
      WHERE id = $1
        AND user_id = $2;
    `;

    const result = await pool.query(query, [recordId, userId]);

    return result.rows[0] || null;
  },

  // 9. Atualizar registro mensal pertencente ao usuário.
  async updateRecord(recordId, { student_name, amount, due_date }, userId) {
    const query = `
      UPDATE monthly_records
      SET
        student_name = $1,
        amount = $2,
        due_date = $3
      WHERE id = $4
        AND user_id = $5
      RETURNING
        id,
        student_id,
        reference_month_id,
        student_name,
        amount,
        due_date,
        is_paid,
        created_at;
    `;

    const values = [student_name, amount, due_date, recordId, userId];

    const result = await pool.query(query, values);

    return result.rows[0] || null;
  },

  // 10. Atualizar pagamento de registro pertencente ao usuário.
  async updateRecordPaymentStatus(recordId, is_paid, userId) {
    const query = `
      UPDATE monthly_records
      SET is_paid = $1
      WHERE id = $2
        AND user_id = $3
      RETURNING
        id,
        student_id,
        reference_month_id,
        student_name,
        amount,
        due_date,
        is_paid,
        created_at;
    `;

    const result = await pool.query(query, [is_paid, recordId, userId]);

    return result.rows[0] || null;
  },

  // 11. Excluir registro mensal pertencente ao usuário.
  async deleteRecord(recordId, userId) {
    const query = `
      DELETE FROM monthly_records
      WHERE id = $1
        AND user_id = $2
      RETURNING
        id,
        student_id,
        reference_month_id,
        student_name,
        amount,
        due_date,
        is_paid,
        created_at;
    `;

    const result = await pool.query(query, [recordId, userId]);

    return result.rows[0] || null;
  },

  // 12. Criar mês de referência dentro de uma transação.
  async createMonthWithClient(client, { year, month }, userId) {
    const query = `
      INSERT INTO reference_months (
        year,
        month,
        user_id
      )
      VALUES ($1, $2, $3)
      RETURNING id, year, month, created_at;
    `;

    const result = await client.query(query, [year, month, userId]);

    return result.rows[0];
  },

  // 12.1. Criar mês de referência avulso.
  async createMonth({ year, month }, userId) {
    const query = `
      INSERT INTO reference_months (
        year,
        month,
        user_id
      )
      VALUES ($1, $2, $3)
      RETURNING id, year, month, created_at;
    `;

    const result = await pool.query(query, [year, month, userId]);

    return result.rows[0];
  },

  // 12.2. Assegurar a existência da competência de forma atômica e idempotente.
  async ensureMonthExists(year, month, userId) {
    const query = `
      INSERT INTO reference_months (
        year,
        month,
        user_id
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, year, month) DO NOTHING
      RETURNING id, year, month, created_at;
    `;

    const result = await pool.query(query, [year, month, userId]);

    return result.rows[0] || null;
  },

  // 13. Criar registro mensal dentro de uma transação.
  async createRecordWithClient(client, { student_id, reference_month_id, student_name, amount, due_date }, userId) {
    const query = `
      INSERT INTO monthly_records (
        student_id,
        reference_month_id,
        student_name,
        amount,
        due_date,
        is_paid,
        user_id
      )
      VALUES ($1, $2, $3, $4, $5, false, $6)
      RETURNING
        id,
        student_id,
        reference_month_id,
        student_name,
        amount,
        due_date,
        is_paid,
        created_at;
    `;

    const values = [student_id, reference_month_id, student_name, amount, due_date, userId];

    const result = await client.query(query, values);

    return result.rows[0];
  },

  // 14. Excluir mensalidades de um mês pertencente ao usuário.
  async deleteRecordsByReferenceIdWithClient(client, referenceId, userId) {
    const query = `
      DELETE FROM monthly_records
      WHERE reference_month_id = $1
        AND user_id = $2
      RETURNING id;
    `;

    const result = await client.query(query, [referenceId, userId]);

    return result.rows;
  },

  // 15. Excluir mês de referência pertencente ao usuário.
  async deleteMonthWithClient(client, referenceId, userId) {
    const query = `
      DELETE FROM reference_months
      WHERE id = $1
        AND user_id = $2
      RETURNING id, year, month, created_at;
    `;

    const result = await client.query(query, [referenceId, userId]);

    return result.rows[0] || null;
  },
};
