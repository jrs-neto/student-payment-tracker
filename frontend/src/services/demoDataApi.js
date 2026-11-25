const clone = (value) => structuredClone(value);

function demoError(message, status = 400) {
  const error = new Error(message);
  error.response = { status, data: { error: { status, message } } };
  return error;
}

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function recordStatus(record) {
  if (record.is_paid) return "paid";
  return String(record.due_date).slice(0, 10) < todayInSaoPaulo() ? "overdue" : "pending";
}

function summarize(records) {
  return records.reduce((summary, record) => {
    const amount = Number(record.amount) || 0;
    summary.total_expected += amount;
    if (record.is_paid) summary.total_paid += amount;
    else summary.total_pending += amount;
    return summary;
  }, { total_expected: 0, total_paid: 0, total_pending: 0 });
}

export function createDemoApi(sourceApi) {
  let students = null;
  let months = null;
  const recordsByMonth = new Map();

  async function ensureStudents() {
    if (students === null) students = clone((await sourceApi.get("/students")).data || []);
    return students;
  }

  async function ensureMonths() {
    if (months === null) months = clone((await sourceApi.get("/months")).data || []);
    return months;
  }

  async function ensureRecords(monthId) {
    if (!recordsByMonth.has(String(monthId))) {
      const response = await sourceApi.get(`/months/${monthId}/records`);
      recordsByMonth.set(String(monthId), clone(response.data?.records || []));
    }
    return recordsByMonth.get(String(monthId));
  }

  async function ensureAllRecords() {
    const allMonths = await ensureMonths();
    await Promise.all(allMonths.map((month) => ensureRecords(month.id)));
  }

  function allRecords() {
    return [...recordsByMonth.values()].flat();
  }

  function createRecordResponse(record) {
    return { ...clone(record), status: recordStatus(record) };
  }

  async function get(path) {
    const [pathname, queryString = ""] = path.split("?");
    if (pathname === "/students") {
      let result = await ensureStudents();
      const status = new URLSearchParams(queryString).get("status");
      if (status === "active") result = result.filter((student) => student.is_active);
      if (status === "inactive") result = result.filter((student) => !student.is_active);
      return { data: clone(result) };
    }
    const studentMatch = pathname.match(/^\/students\/(\d+)$/);
    if (studentMatch) {
      const student = (await ensureStudents()).find((entry) => entry.id === Number(studentMatch[1]));
      if (!student) throw demoError("Aluno não encontrado.", 404);
      return { data: clone(student) };
    }
    if (pathname === "/months") return { data: clone(await ensureMonths()) };
    const monthRecordsMatch = pathname.match(/^\/months\/(\d+)\/records$/);
    if (monthRecordsMatch) {
      const monthId = Number(monthRecordsMatch[1]);
      const month = (await ensureMonths()).find((entry) => entry.id === monthId);
      if (!month) throw demoError("Mês de referência não encontrado.", 404);
      const records = (await ensureRecords(monthId)).map(createRecordResponse);
      return { data: { month: clone(month), records, financialSummary: summarize(records) } };
    }
    return sourceApi.get(path);
  }

  async function post(path, payload = {}) {
    const studentCollection = path === "/students" || path === "/students/";
    if (studentCollection) {
      const currentStudents = await ensureStudents();
      if (typeof payload.name !== "string" || !payload.name.trim()) throw demoError("Nome do aluno é obrigatório.");
      if (payload.guardian_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.guardian_email)) throw demoError("E-mail do responsável inválido.");
      const student = {
        id: Math.max(0, ...currentStudents.map((entry) => Number(entry.id) || 0)) + 1,
        name: payload.name.trim(),
        guardian_name: payload.guardian_name?.trim() || null,
        guardian_email: payload.guardian_email?.trim().toLowerCase() || null,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      students = [...currentStudents, student];
      return { data: clone(student), status: 201 };
    }

    const monthCreateMatch = path.match(/^\/months\/(\d+)\/records$/);
    if (monthCreateMatch) {
      const monthId = Number(monthCreateMatch[1]);
      const month = (await ensureMonths()).find((entry) => entry.id === monthId);
      if (!month) throw demoError("Mês de referência não encontrado.", 404);
      const student = (await ensureStudents()).find((entry) => entry.id === Number(payload.student_id) && entry.is_active);
      if (!student) throw demoError("Aluno ativo não encontrado.", 404);
      const records = await ensureRecords(monthId);
      if (records.some((record) => Number(record.student_id) === Number(student.id))) throw demoError("Este aluno já possui um registro neste mês de referência.", 409);
      const record = {
        id: Math.max(0, ...allRecords().map((entry) => Number(entry.id) || 0)) + 1,
        student_id: student.id,
        reference_month_id: monthId,
        student_name: student.name,
        amount: String(payload.amount),
        due_date: String(payload.due_date).slice(0, 10),
        is_paid: false,
        created_at: new Date().toISOString(),
      };
      records.push(record);
      return { data: createRecordResponse(record), status: 201 };
    }

    if (path === "/months" || path === "/months/") {
      const allowedKeys = ["year", "month"];
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw demoError("Dados inválidos.", 400);
      }
      const unexpectedKeys = Object.keys(payload).filter((key) => !allowedKeys.includes(key));
      if (unexpectedKeys.length > 0) {
        throw demoError("Foram enviados campos não permitidos.", 400);
      }
      if (typeof payload.year !== "number" || !Number.isInteger(payload.year) || payload.year < 2000 || payload.year > 2100) {
        throw demoError("O campo year deve ser um ano válido entre 2000 e 2100.", 400);
      }
      if (typeof payload.month !== "number" || !Number.isInteger(payload.month) || payload.month < 1 || payload.month > 12) {
        throw demoError("O campo month deve ser um mês válido entre 1 e 12.", 400);
      }
      const allMonths = await ensureMonths();
      if (allMonths.some((entry) => Number(entry.year) === payload.year && Number(entry.month) === payload.month)) {
        throw demoError("Este mês de referência já existe.", 409);
      }
      const month = {
        id: Math.max(0, ...allMonths.map((entry) => Number(entry.id) || 0)) + 1,
        year: payload.year,
        month: payload.month,
        created_at: new Date().toISOString(),
      };
      months = [...allMonths, month];
      recordsByMonth.set(String(month.id), []);
      return { data: clone(month), status: 201 };
    }

    if (path === "/months/copy") {
      const allMonths = await ensureMonths();
      const sourceMonth = allMonths.find((month) => month.id === Number(payload.source_reference_id));
      if (!sourceMonth) throw demoError("Mês de origem não encontrado.", 404);
      if (allMonths.some((month) => Number(month.year) === Number(payload.target_year) && Number(month.month) === Number(payload.target_month))) {
        throw demoError("Já existe um mês de referência cadastrado para este período.", 409);
      }
      const sourceRecords = await ensureRecords(sourceMonth.id);
      const month = { id: Math.max(0, ...allMonths.map((entry) => Number(entry.id) || 0)) + 1, year: Number(payload.target_year), month: Number(payload.target_month), created_at: new Date().toISOString() };
      months = [...allMonths, month];
      const lastDay = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
      recordsByMonth.set(String(month.id), sourceRecords.map((record, index) => {
        const day = Math.min(Number(String(record.due_date).slice(8, 10)), lastDay);
        return { ...clone(record), id: Math.max(0, ...allRecords().map((entry) => Number(entry.id) || 0)) + index + 1, reference_month_id: month.id, due_date: `${month.year}-${String(month.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, is_paid: false, created_at: new Date().toISOString() };
      }));
      return { data: { message: "Registros copiados com sucesso.", target_reference_month: clone(month), copied_count: sourceRecords.length }, status: 201 };
    }

    throw demoError("Ação de demonstração não autorizada.", 403);
  }

  async function put(path, payload = {}) {
    const studentMatch = path.match(/^\/students\/(\d+)$/);
    if (studentMatch) {
      const id = Number(studentMatch[1]);
      const currentStudents = await ensureStudents();
      const index = currentStudents.findIndex((student) => student.id === id);
      if (index < 0) throw demoError("Aluno não encontrado.", 404);
      students = currentStudents.map((student) => student.id === id ? { ...student, name: payload.name.trim(), guardian_name: payload.guardian_name?.trim() || null, guardian_email: payload.guardian_email?.trim().toLowerCase() || null } : student);
      return { data: clone(students[index]) };
    }
    const recordMatch = path.match(/^\/months\/records\/(\d+)$/);
    if (recordMatch) {
      const record = await findRecord(Number(recordMatch[1]));
      if (!record) throw demoError("Mensalidade não encontrada.", 404);
      Object.assign(record, { amount: String(payload.amount), due_date: String(payload.due_date).slice(0, 10) });
      return { data: createRecordResponse(record) };
    }
    throw demoError("Ação de demonstração não autorizada.", 403);
  }

  async function patch(path, payload = {}) {
    const studentMatch = path.match(/^\/students\/(\d+)\/status$/);
    if (studentMatch) {
      const id = Number(studentMatch[1]);
      const currentStudents = await ensureStudents();
      let updated;
      students = currentStudents.map((student) => {
        if (student.id !== id) return student;
        updated = { ...student, is_active: Boolean(payload.is_active) };
        return updated;
      });
      if (!updated) throw demoError("Aluno não encontrado.", 404);
      return { data: clone(updated) };
    }
    const paymentMatch = path.match(/^\/months\/records\/(\d+)\/payment$/);
    if (paymentMatch) {
      const record = await findRecord(Number(paymentMatch[1]));
      if (!record) throw demoError("Mensalidade não encontrada.", 404);
      record.is_paid = Boolean(payload.is_paid);
      return { data: createRecordResponse(record) };
    }
    throw demoError("Ação de demonstração não autorizada.", 403);
  }

  async function findRecord(id) {
    await ensureAllRecords();
    return allRecords().find((record) => record.id === id) || null;
  }

  async function remove(path) {
    const studentMatch = path.match(/^\/students\/(\d+)$/);
    if (studentMatch) {
      const id = Number(studentMatch[1]);
      await ensureAllRecords();
      const currentStudents = await ensureStudents();
      const student = currentStudents.find((entry) => entry.id === id);
      if (!student) throw demoError("Aluno não encontrado.", 404);
      students = currentStudents.filter((entry) => entry.id !== id);
      for (const [monthId, records] of recordsByMonth) {
        recordsByMonth.set(monthId, records.filter((record) => Number(record.student_id) !== id));
      }
      return { data: clone(student) };
    }
    const monthMatch = path.match(/^\/months\/(\d+)$/);
    if (monthMatch) {
      const id = Number(monthMatch[1]);
      const allMonths = await ensureMonths();
      const month = allMonths.find((entry) => entry.id === id);
      if (!month) throw demoError("Mês de referência não encontrado.", 404);
      await ensureRecords(id);
      const deletedRecords = recordsByMonth.get(String(id));
      months = allMonths.filter((entry) => entry.id !== id);
      recordsByMonth.delete(String(id));
      return { data: { message: "Mês excluído.", deletedMonth: clone(month), deletedRecordsCount: deletedRecords.length } };
    }
    const recordMatch = path.match(/^\/months\/records\/(\d+)$/);
    if (recordMatch) {
      const id = Number(recordMatch[1]);
      await ensureAllRecords();
      for (const records of recordsByMonth.values()) {
        const index = records.findIndex((record) => record.id === id);
        if (index >= 0) return { data: clone(records.splice(index, 1)[0]) };
      }
      throw demoError("Mensalidade não encontrada.", 404);
    }
    throw demoError("Ação de demonstração não autorizada.", 403);
  }

  return { get, post, put, patch, delete: remove, reset() { students = null; months = null; recordsByMonth.clear(); } };
}

let sharedDemoApi;
export function getDemoApi(sourceApi) {
  if (!sharedDemoApi) sharedDemoApi = createDemoApi(sourceApi);
  return sharedDemoApi;
}

export function resetDemoData() {
  sharedDemoApi?.reset();
}
