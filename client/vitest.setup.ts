import { beforeAll, beforeEach, afterEach, afterAll, vi } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { setLogLevel } from "firebase/app";
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Firestore rules testing configuration
const PROJECT_ID = "demo-webhook";
const FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR_HOST;

const COVERAGE_URL = `http://${FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}:ruleCoverage.html`;

let testEnv: RulesTestEnvironment;
let rulesTestInitialized = false;

beforeAll(async () => {
  setLogLevel("error");

  try {
    const rulesPath = path.resolve(path.join(__dirname, "..", "firestore.rules"));
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules: fs.readFileSync(rulesPath, "utf8"),
        host: "localhost",
        port: 8080,
      },
    });
    rulesTestInitialized = true;
  } catch (e) {
    // May fail if emulator not ready, continue for non-firestore tests
    console.warn("Could not initialize Firestore test environment:", (e as Error).message);
  }
});

/**
 * Get an authenticated Firestore instance for testing security rules.
 * Pass null for unauthenticated access.
 */
globalThis.authedFirestore = (auth: { uid: string; [key: string]: unknown } | null) => {
  if (!testEnv) {
    throw new Error("Test environment not initialized");
  }

  if (!auth) {
    return testEnv.unauthenticatedContext().firestore();
  }

  const { uid, ...token } = auth;
  return testEnv.authenticatedContext(uid, token).firestore();
};

/**
 * Get an authenticated Firestore for a specific provider
 * (e.g., anonymous auth has firebase.sign_in_provider = 'anonymous')
 */
globalThis.anonymousFirestore = (uid: string) => {
  if (!testEnv) {
    throw new Error("Test environment not initialized");
  }

  return testEnv
    .authenticatedContext(uid, {
      firebase: { sign_in_provider: "anonymous" },
    })
    .firestore();
};

beforeEach(() => {
  // Nothing special for now — DOM setup handled by jsdom env in vitest
});

afterEach(async (context) => {
  // Only clear Firestore for rules tests to avoid interfering with other tests
  const testPath = (context?.task as { file?: { name?: string } })?.file?.name || "";
  const isRulesTest = testPath.includes("firestore.rules");

  if (testEnv && rulesTestInitialized && isRulesTest) {
    await testEnv.clearFirestore();
  }
  vi.clearAllMocks();
});

afterAll(async () => {
  // Write the coverage report to a file (best effort)
  const coverageFile = "firestore-coverage.html";
  try {
    const stream = fs.createWriteStream(coverageFile);
    await new Promise<void>((resolve) => {
      const req = http.get(COVERAGE_URL, (res) => {
        res.pipe(stream, { end: true });
        stream.on("finish", () => {
          stream.close();
          resolve();
        });
      });
      req.on("error", () => {
        stream.close();
        resolve();
      });
      req.setTimeout(5000, () => {
        req.destroy();
        stream.close();
        resolve();
      });
    });
  } catch {
    // Ignore coverage errors
  }
});
