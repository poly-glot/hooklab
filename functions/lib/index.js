"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateAnalytics = exports.cleanupOldExecutions = exports.onEndpointDeleted = exports.onEndpointCreated = exports.clearExecutions = exports.recordExecution = exports.seedGuestData = void 0;
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firestore_1 = require("firebase-functions/v2/firestore");
const app_1 = require("firebase-admin/app");
const firestore_2 = require("firebase-admin/firestore");
const uuid_1 = require("uuid");
(0, app_1.initializeApp)();
const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
const region = "europe-west1";
function db() {
    return (0, firestore_2.getFirestore)("hooklab");
}
// ── 1. Seed guest data ─────────────────────────────────────────────
exports.seedGuestData = (0, https_1.onCall)({ enforceAppCheck: !isEmulator, region }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "Must be authenticated");
    }
    const firestore = db();
    const userRef = firestore.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (userSnap.exists && userSnap.data()?.seeded) {
        return { success: true, message: "Already seeded" };
    }
    const batch = firestore.batch();
    const sampleEndpoints = [
        { name: "Payment Webhooks", requestCount: 8 },
        { name: "Order Notifications", requestCount: 6 },
        { name: "User Signups", requestCount: 5 },
        { name: "Stripe Events", requestCount: 7 },
        { name: "GitHub Push Events", requestCount: 4 },
        { name: "Slack Alerts", requestCount: 3 },
    ];
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
    for (const sample of sampleEndpoints) {
        const endpointId = (0, uuid_1.v4)();
        const endpointRef = firestore.collection("endpoints").doc(endpointId);
        batch.set(endpointRef, {
            name: sample.name,
            userId: uid,
            script: defaultScript,
            isActive: true,
            defaultStatusCode: 200,
            defaultContentType: "application/json",
            defaultBody: '{"ok": true}',
            totalExecutions: sample.requestCount,
            createdAt: firestore_2.Timestamp.now(),
            updatedAt: firestore_2.Timestamp.now(),
        });
        // Seed some sample executions
        const methods = ["POST", "GET", "PUT", "DELETE", "PATCH"];
        for (let i = 0; i < Math.min(sample.requestCount, 3); i++) {
            const execId = (0, uuid_1.v4)();
            const execRef = firestore.collection("executions").doc(execId);
            batch.set(execRef, {
                endpointId,
                userId: uid,
                method: methods[i % methods.length],
                url: `/w/${endpointId}`,
                headers: { "content-type": "application/json", host: "localhost" },
                query: {},
                body: JSON.stringify({ test: true, index: i }),
                ip: "127.0.0.1",
                responseStatus: 200,
                responseBody: '{"ok": true}',
                status: "success",
                duration: Math.floor(Math.random() * 100) + 10,
                timestamp: firestore_2.Timestamp.fromMillis(Date.now() - i * 60000 * (Math.random() * 10 + 1)),
            });
        }
    }
    // Mark user as seeded
    batch.set(userRef, { seeded: true, endpointCount: sampleEndpoints.length }, { merge: true });
    await batch.commit();
    return { success: true, message: "Demo data created" };
});
// ── 2. Execute webhook (called by Cloud Run / server) ──────────────
exports.recordExecution = (0, https_1.onCall)({ region, timeoutSeconds: 30 }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "Must be authenticated");
    }
    const { endpointId, execution } = request.data;
    if (!endpointId || !execution) {
        throw new https_1.HttpsError("invalid-argument", "endpointId and execution required");
    }
    const firestore = db();
    // Verify endpoint ownership
    const endpointRef = firestore.collection("endpoints").doc(endpointId);
    const endpointSnap = await endpointRef.get();
    if (!endpointSnap.exists || endpointSnap.data()?.userId !== uid) {
        throw new https_1.HttpsError("permission-denied", "Endpoint not found");
    }
    // Check quota
    const userRef = firestore.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data();
    const isAnon = userData?.isAnonymous === true;
    const maxDaily = isAnon ? 100 : 10000;
    const usedToday = userData?.quotas?.usedExecutionsToday ?? 0;
    if (usedToday >= maxDaily) {
        throw new https_1.HttpsError("resource-exhausted", "Daily execution quota exceeded");
    }
    // Record execution
    const execId = (0, uuid_1.v4)();
    const execRef = firestore.collection("executions").doc(execId);
    await firestore.runTransaction(async (tx) => {
        tx.set(execRef, {
            ...execution,
            endpointId,
            userId: uid,
            timestamp: firestore_2.Timestamp.now(),
        });
        tx.update(endpointRef, {
            totalExecutions: firestore_2.FieldValue.increment(1),
            lastExecutedAt: firestore_2.Timestamp.now(),
        });
        tx.set(userRef, { quotas: { usedExecutionsToday: firestore_2.FieldValue.increment(1) } }, { merge: true });
    });
    return { success: true, executionId: execId };
});
// ── 3. Clear executions for an endpoint ────────────────────────────
exports.clearExecutions = (0, https_1.onCall)({ enforceAppCheck: !isEmulator, region }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new https_1.HttpsError("unauthenticated", "Must be authenticated");
    }
    const { endpointId } = request.data;
    if (!endpointId) {
        throw new https_1.HttpsError("invalid-argument", "endpointId is required");
    }
    const firestore = db();
    // Verify ownership
    const endpointSnap = await firestore
        .collection("endpoints")
        .doc(endpointId)
        .get();
    if (!endpointSnap.exists || endpointSnap.data()?.userId !== uid) {
        throw new https_1.HttpsError("permission-denied", "Endpoint not found");
    }
    // Delete all executions for this endpoint (batch delete in chunks of 500)
    const execQuery = firestore
        .collection("executions")
        .where("endpointId", "==", endpointId);
    let deleted = 0;
    let snapshot = await execQuery.limit(500).get();
    while (!snapshot.empty) {
        const batch = firestore.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        deleted += snapshot.size;
        snapshot = await execQuery.limit(500).get();
    }
    // Reset counter
    await firestore.collection("endpoints").doc(endpointId).update({
        totalExecutions: 0,
    });
    return { success: true, deleted };
});
// ── 4. Endpoint counter triggers ───────────────────────────────────
exports.onEndpointCreated = (0, firestore_1.onDocumentCreated)({ document: "endpoints/{endpointId}", database: "hooklab", region }, async (event) => {
    const endpoint = event.data?.data();
    if (!endpoint)
        return;
    const firestore = db();
    await firestore
        .collection("users")
        .doc(endpoint.userId)
        .set({ endpointCount: firestore_2.FieldValue.increment(1) }, { merge: true });
});
exports.onEndpointDeleted = (0, firestore_1.onDocumentDeleted)({ document: "endpoints/{endpointId}", database: "hooklab", region }, async (event) => {
    const endpoint = event.data?.data();
    if (!endpoint)
        return;
    const firestore = db();
    // Decrement user counter
    await firestore
        .collection("users")
        .doc(endpoint.userId)
        .set({ endpointCount: firestore_2.FieldValue.increment(-1) }, { merge: true });
    // Clean up all executions for this endpoint
    const execQuery = firestore
        .collection("executions")
        .where("endpointId", "==", event.params.endpointId);
    let snapshot = await execQuery.limit(500).get();
    while (!snapshot.empty) {
        const batch = firestore.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        snapshot = await execQuery.limit(500).get();
    }
});
// ── 5. Daily cleanup of old executions ─────────────────────────────
exports.cleanupOldExecutions = (0, scheduler_1.onSchedule)({
    schedule: "every 24 hours",
    timeZone: "Europe/London",
    region,
}, async () => {
    const firestore = db();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);
    console.log(`Starting cleanup for executions older than ${cutoffDate.toISOString()}`);
    let totalDeleted = 0;
    const query = firestore
        .collection("executions")
        .where("timestamp", "<", firestore_2.Timestamp.fromDate(cutoffDate))
        .limit(500);
    let snapshot = await query.get();
    while (!snapshot.empty) {
        const batch = firestore.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        totalDeleted += snapshot.size;
        snapshot = await query.get();
    }
    // Reset daily quotas for all users
    const usersSnapshot = await firestore.collection("users").get();
    const quotaBatch = firestore.batch();
    usersSnapshot.docs.forEach((doc) => {
        quotaBatch.set(doc.ref, { quotas: { usedExecutionsToday: 0 } }, { merge: true });
    });
    await quotaBatch.commit();
    console.log(`Cleanup completed: ${totalDeleted} old executions deleted, quotas reset`);
});
// ── 6. Hourly analytics aggregation ────────────────────────────────
exports.aggregateAnalytics = (0, scheduler_1.onSchedule)({
    schedule: "every 1 hours",
    timeZone: "Europe/London",
    region,
}, async () => {
    const firestore = db();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const executions = await firestore
        .collection("executions")
        .where("timestamp", ">=", firestore_2.Timestamp.fromDate(startOfDay))
        .get();
    let successCount = 0;
    let failedCount = 0;
    let totalDuration = 0;
    const endpointStats = {};
    executions.docs.forEach((doc) => {
        const data = doc.data();
        if (data.status === "success")
            successCount++;
        else
            failedCount++;
        totalDuration += data.duration ?? 0;
        const epId = data.endpointId;
        if (!endpointStats[epId]) {
            endpointStats[epId] = { count: 0, avgDuration: 0 };
        }
        endpointStats[epId].count++;
        endpointStats[epId].avgDuration += data.duration ?? 0;
    });
    // Finalize averages
    Object.values(endpointStats).forEach((stat) => {
        stat.avgDuration =
            stat.count > 0 ? Math.round(stat.avgDuration / stat.count) : 0;
    });
    await firestore
        .collection("analytics")
        .doc(todayStr)
        .set({
        date: todayStr,
        totalExecutions: executions.size,
        successfulExecutions: successCount,
        failedExecutions: failedCount,
        averageExecutionTime: executions.size > 0
            ? Math.round(totalDuration / executions.size)
            : 0,
        endpointStats,
        updatedAt: firestore_2.Timestamp.now(),
    }, { merge: true });
    console.log(`Analytics aggregated for ${todayStr}: ${executions.size} executions`);
});
//# sourceMappingURL=index.js.map