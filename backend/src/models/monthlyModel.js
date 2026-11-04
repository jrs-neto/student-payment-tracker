import pool from "../config/database.js";

export const monthlyModel = {
  // 1. Listar todos os meses de referência ordenados cronologicamente
  async findAllMonths() {
    const query = `
      SELECT id, year, month, created_at
      FROM reference_months
      ORDER BY year ASC, month ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
  },

  // 2. Verificar se um mês de referência específico existe
  async findMonthById(referenceId) {
    const query = `
      SELECT id, year, month, created_at
      FROM reference_months
      WHERE id = $1;
    `;
    const result = await pool.query(query, [referenceId]);
    return result.rows[0] || null;
  },

  // 2.1. Verificar se um mês por ano e mês numérico existe (útil para checar destino na cópia)
  async findMonthByYearAndMonth(year, month) {
    const query = `
      SELECT id, year, month, created_at
      FROM reference_months
      WHERE year = $1 AND month = $2;
    `;
    const result = await pool.query(query, [year, month]);
    return result.rows[0] || null;
  },

  // 3. Listar os registros mensais de um mês específico com ordenação por prioridade de status e vencimento (America/Sao_Paulo)
  async findRecordsByMonthId(referenceId) {
    const query = `
      SELECT id, student_id, reference_month_id, student_name, amount, due_date, is_paid, created_at
      FROM monthly_records
      WHERE reference_month_id = $1
      ORDER BY
        CASE
          WHEN is_paid = false AND due_date < (NOW() AT TIME ZONE 'America/Sao_Paulo')::date THEN 1
          WHEN is_paid = false AND due_date >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date THEN 2
          ELSE 3
        END ASC,
        due_date ASC,
        id ASC;
    `;
    const result = await pool.query(query, [referenceId]);
    return result.rows;
  },

  // 4. Calcular o resumo financeiro do mês com SUM e NUMERIC (total_expected, total_paid, total_pending)
  async getMonthFinancialSummary(referenceId) {
    const query = `
      SELECT
        COALESCE(SUM(amount), 0) AS total_expected,
        COALESCE(SUM(CASE WHEN is_paid = true THEN amount ELSE 0 END), 0) AS total_paid,
        COALESCE(SUM(CASE WHEN is_paid = false THEN amount ELSE 0 END), 0) AS total_pending
      FROM monthly_records
      WHERE reference_month_id = $1;
    `;
    const result = await pool.query(query, [referenceId]);
    return result.rows[0];
  },

  // 5. Consultar um aluno por ID, incluindo seu status de atividade (para validações do Service)
  async findStudentById(studentId) {
    const query = `
      SELECT id, name, guardian_name, guardian_email, is_active, created_at
      FROM students
      WHERE id = $1;
    `;
    const result = await pool.query(query, [studentId]);
    return result.rows[0] || null;
  },

  // 6. Criar um registro mensal
  async createRecord({ student_id, reference_month_id, student_name, amount, due_date }) {
    const query = `
      INSERT INTO monthly_records (student_id, reference_month_id, student_name, amount, due_date, is_paid)
      VALUES ($1, $2, $3, $4, $5, false)
      RETURNING id, student_id, reference_month_id, student_name, amount, due_date, is_paid, created_at;
    `;
    const values = [student_id, reference_month_id, student_name, amount, due_date];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // 7. Consultar um registro mensal por ID
  async findRecordById(recordId) {
    const query = `
      SELECT id, student_id, reference_month_id, student_name, amount, due_date, is_paid, created_at
      FROM monthly_records
      WHERE id = $1;
    `;
    const result = await pool.query(query, [recordId]);
    return result.rows[0] || null;
  },

  // 8. Atualizar student_name, amount e due_date de um registro
  async updateRecord(recordId, { student_name, amount, due_date }) {
    const query = `
      UPDATE monthly_records
      SET student_name = $1, amount = $2, due_date = $3
      WHERE id = $4
      RETURNING id, student_id, reference_month_id, student_name, amount, due_date, is_paid, created_at;
    `;
    const values = [student_name, amount, due_date, recordId];
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  },

  // 9. Atualizar exclusivamente is_paid de um registro
  async updateRecordPaymentStatus(recordId, is_paid) {
    const query = `
      UPDATE monthly_records
      SET is_paid = $1
      WHERE id = $2
      RETURNING id, student_id, reference_month_id, student_name, amount, due_date, is_paid, created_at;
    `;
    const values = [is_paid, recordId];
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  },

  // 10. Excluir um registro mensal
  async deleteRecord(recordId) {
    const query = `
      DELETE FROM monthly_records
      WHERE id = $1
      RETURNING id, student_id, reference_month_id, student_name, amount, due_date, is_paid, created_at;
    `;
    const result = await pool.query(query, [recordId]);
    return result.rows[0] || null;
  },

  // 11. Criar um mês de referência dentro de uma transação ativa
  async createMonthWithClient(client, { year, month }) {
    const query = `
      INSERT INTO reference_months (year, month)
      VALUES ($1, $2)
      RETURNING id, year, month, created_at;
    `;
    const result = await client.query(query, [year, month]);
    return result.rows[0];
  },

  // 12. Criar um registro mensal dentro de uma transação ativa (para cópia em lote)
  async createRecordWithClient(client, { student_id, reference_month_id, student_name, amount, due_date }) {
    const query = `
      INSERT INTO monthly_records (student_id, reference_month_id, student_name, amount, due_date, is_paid)
      VALUES ($1, $2, $3, $4, $5, false)
      RETURNING id, student_id, reference_month_id, student_name, amount, due_date, is_paid, created_at;
    `;
    const values = [student_id, reference_month_id, student_name, amount, due_date];
    const result = await client.query(query, values);
    return result.rows[0];
  },

  // 13. Excluir todas as mensalidades vinculadas a um mês de referência dentro de uma transação ativa
  async deleteRecordsByReferenceIdWithClient(client, referenceId) {
    const query = `
      DELETE FROM monthly_records
      WHERE reference_month_id = $1
      RETURNING id;
    `;
    const result = await client.query(query, [referenceId]);
    return result.rows;
  },

  // 14. Excluir o mês de referência pelo seu ID dentro de uma transação ativa
  async deleteMonthWithClient(client, referenceId) {
    const query = `
      DELETE FROM reference_months
      WHERE id = $1
      RETURNING id, year, month, created_at;
    `;
    const result = await client.query(query, [referenceId]);
    return result.rows[0] || null;
  },
};
