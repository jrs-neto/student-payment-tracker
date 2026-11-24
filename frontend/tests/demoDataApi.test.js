import test from "node:test";
import assert from "node:assert/strict";
import { createDemoApi } from "../src/services/demoDataApi.js";

function fixtureApi() {
  const seedStudents = [
    { id: 1, name: "Ana Demo", guardian_name: "Responsável", guardian_email: "a@example.test", is_active: true },
    { id: 2, name: "Beto Demo", guardian_name: null, guardian_email: null, is_active: true },
  ];
  const seedMonth = { id: 10, year: 2026, month: 11 };
  const seedRecords = [{ id: 100, student_id: 1, reference_month_id: 10, student_name: "Ana Demo", amount: "100.00", due_date: "2026-11-10", is_paid: false }];
  let reads = 0;
  let writes = 0;
  return {
    stats: () => ({ reads, writes }),
    get: async (path) => {
      reads += 1;
      if (path === "/students") return { data: structuredClone(seedStudents) };
      if (path === "/months") return { data: [structuredClone(seedMonth)] };
      if (path === "/months/10/records") return { data: { month: structuredClone(seedMonth), records: structuredClone(seedRecords), financialSummary: { total_expected: "100.00", total_paid: "0.00", total_pending: "100.00" } } };
      throw new Error(`Unexpected read ${path}`);
    },
    post: async () => { writes += 1; throw new Error("network write must not occur"); },
    put: async () => { writes += 1; throw new Error("network write must not occur"); },
    patch: async () => { writes += 1; throw new Error("network write must not occur"); },
    delete: async () => { writes += 1; throw new Error("network write must not occur"); },
  };
}

test("demo CRUD stays in memory, updates summaries, and reset restores server seed", async () => {
  const sourceApi = fixtureApi();
  const demoApi = createDemoApi(sourceApi);

  const createdStudent = await demoApi.post("/students", { name: "Carla Demo", guardian_name: "Rita", guardian_email: "rita@example.test" });
  assert.equal(createdStudent.data.name, "Carla Demo");
  await demoApi.put(`/students/${createdStudent.data.id}`, { name: "Carla Atualizada", guardian_name: "Rita", guardian_email: "rita@example.test" });
  await demoApi.patch(`/students/${createdStudent.data.id}/status`, { is_active: false });
  assert.equal((await demoApi.get("/students?status=inactive")).data[0].name, "Carla Atualizada");
  await demoApi.patch(`/students/${createdStudent.data.id}/status`, { is_active: true });

  const createdRecord = await demoApi.post("/months/10/records", { student_id: createdStudent.data.id, student_name: "Carla Atualizada", amount: "250.00", due_date: "2026-11-20" });
  const recordId = createdRecord.data.id;
  await demoApi.put(`/months/records/${recordId}`, { amount: "300.00", due_date: "2026-11-22" });
  await demoApi.patch(`/months/records/${recordId}/payment`, { is_paid: true });
  let monthData = (await demoApi.get("/months/10/records")).data;
  assert.equal(monthData.records.find((entry) => entry.id === recordId).is_paid, true);
  assert.equal(monthData.financialSummary.total_expected, 400);
  assert.equal(monthData.financialSummary.total_paid, 300);

  await demoApi.delete(`/months/records/${recordId}`);
  await demoApi.delete(`/students/${createdStudent.data.id}`);
  assert.equal((await demoApi.get("/students")).data.length, 2);
  assert.equal((await demoApi.get("/months/10/records")).data.records.length, 1);

  const copiedMonth = await demoApi.post("/months/copy", { source_reference_id: 10, target_year: 2026, target_month: 12 });
  assert.equal(copiedMonth.data.copied_count, 1);
  assert.equal((await demoApi.get("/months")).data.length, 2);
  await demoApi.delete(`/months/${copiedMonth.data.target_reference_month.id}`);
  assert.equal((await demoApi.get("/months")).data.length, 1);

  assert.equal(sourceApi.stats().writes, 0);
  demoApi.reset();
  assert.equal((await demoApi.get("/students")).data.length, 2);
  monthData = (await demoApi.get("/months/10/records")).data;
  assert.equal(monthData.records.length, 1);
  assert.equal(monthData.records[0].amount, "100.00");
  assert.equal(sourceApi.stats().writes, 0);
});
