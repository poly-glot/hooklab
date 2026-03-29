import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, firestore, functions } from "./firebase-init";
import type { Endpoint, RequestLog, User } from "./api";

// ── Collection references ─────────────────────────────────────────
const usersCol = collection(firestore, "users");
const endpointsCol = collection(firestore, "endpoints");
const executionsCol = collection(firestore, "executions");

// ── Type helpers ──────────────────────────────────────────────────
function toTimestampString(ts: unknown): string {
  if (ts instanceof Timestamp) {
    return ts.toDate().toISOString();
  }
  if (ts && typeof ts === "object" && "seconds" in ts) {
    return new Date(
      (ts as { seconds: number }).seconds * 1000
    ).toISOString();
  }
  return new Date().toISOString();
}

function docToEndpoint(id: string, data: DocumentData): Endpoint {
  return {
    id,
    userId: data.userId ?? "",
    name: data.name ?? "",
    script: data.script ?? "",
    defaultStatusCode: data.defaultStatusCode ?? 200,
    defaultContentType: data.defaultContentType ?? "application/json",
    defaultBody: data.defaultBody ?? '{"ok": true}',
    isActive: data.isActive !== false,
    createdAt: toTimestampString(data.createdAt),
  };
}

function docToRequestLog(id: string, data: DocumentData): RequestLog {
  return {
    id,
    endpointId: data.endpointId ?? "",
    method: data.method ?? "POST",
    url: data.url ?? "",
    headers: data.headers ?? {},
    query: data.query ?? {},
    body: data.body ?? "",
    ip: data.ip ?? "",
    responseStatus: data.responseStatus ?? 200,
    responseBody: data.responseBody ?? "",
    timestamp: toTimestampString(data.timestamp),
  };
}

// ── User operations ───────────────────────────────────────────────
export async function createUserDocument(
  uid: string,
  email: string,
  isAnonymous: boolean
): Promise<void> {
  const userRef = doc(usersCol, uid);
  await setDoc(
    userRef,
    {
      email,
      isAnonymous,
      displayName: isAnonymous ? "Guest" : email.split("@")[0],
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
      endpointCount: 0,
      quotas: {
        maxEndpoints: isAnonymous ? 3 : 50,
        maxExecutionsPerDay: isAnonymous ? 100 : 10000,
        usedExecutionsToday: 0,
      },
    },
    { merge: true }
  );
}

export async function getUserDocument(
  uid: string
): Promise<User | null> {
  const userRef = doc(usersCol, uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    email: data.email ?? "",
    createdAt: toTimestampString(data.createdAt),
  };
}

export async function updateLastLogin(uid: string): Promise<void> {
  const userRef = doc(usersCol, uid);
  await updateDoc(userRef, { lastLoginAt: serverTimestamp() });
}

// ── Endpoint operations ───────────────────────────────────────────
export async function getEndpoints(
  userId: string
): Promise<Endpoint[]> {
  const q = query(
    endpointsCol,
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => docToEndpoint(d.id, d.data()));
}

export async function getEndpoint(
  endpointId: string
): Promise<Endpoint | null> {
  const ref = doc(endpointsCol, endpointId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return docToEndpoint(snap.id, snap.data());
}

export async function createEndpoint(
  userId: string,
  name: string
): Promise<Endpoint> {
  const defaultScript = `// Access the incoming request via the 'request' object:
// - request.method (string)
// - request.headers (object)
// - request.query (object)
// - request.body (string)
// - request.url (string)
//
// Return a response object:
return {
  status: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ok: true, timestamp: Date.now() })
};`;

  const docRef = await addDoc(endpointsCol, {
    name,
    userId,
    script: defaultScript,
    isActive: true,
    defaultStatusCode: 200,
    defaultContentType: "application/json",
    defaultBody: '{"ok": true}',
    totalExecutions: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const snap = await getDoc(docRef);
  return docToEndpoint(snap.id, snap.data() ?? {});
}

export async function updateEndpoint(
  endpointId: string,
  data: Partial<
    Pick<
      Endpoint,
      "name" | "script" | "defaultStatusCode" | "defaultContentType" | "defaultBody" | "isActive"
    >
  >
): Promise<Endpoint> {
  const ref = doc(endpointsCol, endpointId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return docToEndpoint(snap.id, snap.data() ?? {});
}

export async function deleteEndpoint(
  endpointId: string
): Promise<void> {
  const ref = doc(endpointsCol, endpointId);
  await deleteDoc(ref);
}

// ── Execution / request log operations ────────────────────────────
export async function getExecutions(
  endpointId: string,
  userId?: string
): Promise<RequestLog[]> {
  // Firestore rules require userId filter for reads on executions
  const uid = userId || auth.currentUser?.uid;
  if (!uid) return [];
  const q = query(
    executionsCol,
    where("endpointId", "==", endpointId),
    where("userId", "==", uid),
    orderBy("timestamp", "desc"),
    limit(100)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => docToRequestLog(d.id, d.data()));
}

export async function clearExecutions(
  endpointId: string
): Promise<void> {
  // Use the API endpoint instead of Cloud Functions (which may not be deployed)
  const { api } = await import("./api");
  await api.clearRequestLogs(endpointId);
}

export async function deleteExecution(
  endpointId: string,
  executionId: string
): Promise<void> {
  const { api } = await import("./api");
  await api.deleteRequestLog(endpointId, executionId);
}

// ── Real-time listeners ───────────────────────────────────────────
export function onEndpointsSnapshot(
  userId: string,
  callback: (endpoints: Endpoint[]) => void
): Unsubscribe {
  const q = query(
    endpointsCol,
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snapshot: QuerySnapshot) => {
    const endpoints = snapshot.docs.map((d) =>
      docToEndpoint(d.id, d.data())
    );
    callback(endpoints);
  });
}

export function onExecutionsSnapshot(
  endpointId: string,
  callback: (executions: RequestLog[]) => void,
  userId?: string
): Unsubscribe {
  // Firestore rules require userId filter for reads on executions
  const uid = userId || auth.currentUser?.uid;
  if (!uid) {
    callback([]);
    return () => {};
  }
  const q = query(
    executionsCol,
    where("endpointId", "==", endpointId),
    where("userId", "==", uid),
    orderBy("timestamp", "desc"),
    limit(100)
  );
  return onSnapshot(q, (snapshot: QuerySnapshot) => {
    const executions = snapshot.docs.map((d) =>
      docToRequestLog(d.id, d.data())
    );
    callback(executions);
  });
}

// ── Guest seed data ───────────────────────────────────────────────
export async function seedGuestData(): Promise<void> {
  const seedFn = httpsCallable(functions, "seedGuestData");
  await seedFn({});
}
