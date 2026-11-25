import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { authService } from "../../src/services/authService.js";
import { userModel } from "../../src/models/userModel.js";
import { authMiddleware } from "../../src/middlewares/authMiddleware.js";
import { readOnlyDemoMiddleware } from "../../src/middlewares/readOnlyDemoMiddleware.js";
import studentRoutes from "../../src/routes/studentRoutes.js";
import monthlyRoutes from "../../src/routes/monthlyRoutes.js";

const originalFindByEmail = userModel.findByEmail;
const originalFindById = userModel.findById;
const originalEnv = { enabled: process.env.DEMO_ENABLED, email: process.env.DEMO_ACCOUNT_EMAIL, secret: process.env.JWT_SECRET };

test("demo endpoint requires opt-in and issues a standard verifiable JWT for marked account", async () => {
  process.env.DEMO_ENABLED = "true";
  process.env.DEMO_ACCOUNT_EMAIL = "demo@example.test";
  process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";
  userModel.findByEmail = async () => ({ id: 42, name: "Demo", email: "demo@example.test", is_demo: true });

  const session = await authService.demoLogin();
  const payload = jwt.verify(session.token, process.env.JWT_SECRET, {
    algorithms: ["HS256"], issuer: "student-payment-tracker", audience: "student-payment-tracker-api",
  });
  assert.equal(payload.sub, "42");
  assert.equal(session.user.isDemo, true);

  process.env.DEMO_ENABLED = "false";
  await assert.rejects(authService.demoLogin(), (error) => error.status === 404);
});

test("auth middleware derives demo status from database and read-only guard blocks writes", async () => {
  process.env.DEMO_ENABLED = "true";
  process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";
  const token = jwt.sign({}, process.env.JWT_SECRET, {
    algorithm: "HS256", issuer: "student-payment-tracker", audience: "student-payment-tracker-api", subject: "42", expiresIn: "5m",
  });
  userModel.findById = async () => ({ id: 42, name: "Demo", email: "demo@example.test", is_demo: true });

  const req = { headers: { authorization: `Bearer ${token}` } };
  let nextCalled = false;
  await authMiddleware(req, { status() { throw new Error("unexpected response"); } }, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(req.user.isDemo, true);

  let statusCode;
  let body;
  readOnlyDemoMiddleware(req, {
    status(code) { statusCode = code; return this; },
    json(value) { body = value; return this; },
  }, () => assert.fail("demo write should not reach the handler"));
  assert.equal(statusCode, 403);
  assert.match(body.error.message, /somente leitura/i);

  process.env.DEMO_ENABLED = "false";
  let rejectedStatus;
  await authMiddleware(req, { status(code) { rejectedStatus = code; return this; }, json() {} }, () => assert.fail("disabled demo session must be rejected"));
  assert.equal(rejectedStatus, 401);
});

test("every student and monthly write route is guarded while reads remain available", () => {
  for (const router of [studentRoutes, monthlyRoutes]) {
    for (const layer of router.stack.filter((entry) => entry.route)) {
      const methods = Object.keys(layer.route.methods);
      if (methods.some((method) => ["post", "put", "patch", "delete"].includes(method))) {
        assert.ok(layer.route.stack.some((routeLayer) => routeLayer.handle === readOnlyDemoMiddleware), `${methods.join(",")} ${layer.route.path} must use read-only guard`);
      }
    }
  }
});

test.after(() => {
  userModel.findByEmail = originalFindByEmail;
  userModel.findById = originalFindById;
  if (originalEnv.enabled === undefined) delete process.env.DEMO_ENABLED; else process.env.DEMO_ENABLED = originalEnv.enabled;
  if (originalEnv.email === undefined) delete process.env.DEMO_ACCOUNT_EMAIL; else process.env.DEMO_ACCOUNT_EMAIL = originalEnv.email;
  if (originalEnv.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalEnv.secret;
  setTimeout(() => process.exit(0), 50);
});
