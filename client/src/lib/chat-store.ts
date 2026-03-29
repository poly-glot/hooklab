/**
 * Firestore-backed chat conversation persistence.
 *
 * Collections:
 *   users/{uid}/conversations/{conversationId}
 *   users/{uid}/conversations/{conversationId}/messages/{messageId}
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { firestore, auth } from "./firebase-init";

export interface Conversation {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  error?: string;
  reportData?: string; // JSON-serialized ReportQueryResponse
}

function tsToISO(ts: unknown): string {
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (ts && typeof ts === "object" && "seconds" in ts) {
    return new Date((ts as { seconds: number }).seconds * 1000).toISOString();
  }
  return new Date().toISOString();
}

function getUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not authenticated");
  return uid;
}

function conversationsCol() {
  return collection(firestore, "users", getUid(), "conversations");
}

function messagesCol(conversationId: string) {
  return collection(
    firestore,
    "users",
    getUid(),
    "conversations",
    conversationId,
    "messages"
  );
}

// ── Conversation CRUD ────────────────────────────────────────────

export async function createConversation(): Promise<Conversation> {
  const now = new Date();
  const name = now.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const ref = await addDoc(conversationsCol(), {
    name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: ref.id,
    name,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export async function getConversations(): Promise<Conversation[]> {
  const q = query(conversationsCol(), orderBy("updatedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name ?? "",
      createdAt: tsToISO(data.createdAt),
      updatedAt: tsToISO(data.updatedAt),
    };
  });
}

export async function renameConversation(
  conversationId: string,
  newName: string
): Promise<void> {
  const ref = doc(conversationsCol(), conversationId);
  await updateDoc(ref, { name: newName, updatedAt: serverTimestamp() });
}

export async function deleteConversation(
  conversationId: string
): Promise<void> {
  // Delete all messages first
  const msgSnap = await getDocs(messagesCol(conversationId));
  await Promise.all(msgSnap.docs.map((d) => deleteDoc(d.ref)));
  // Delete conversation
  await deleteDoc(doc(conversationsCol(), conversationId));
}

// ── Message CRUD ─────────────────────────────────────────────────

export async function addMessage(
  conversationId: string,
  msg: Omit<PersistedMessage, "id">
): Promise<string> {
  const ref = await addDoc(messagesCol(conversationId), {
    role: msg.role,
    content: msg.content,
    timestamp: serverTimestamp(),
    error: msg.error ?? null,
    reportData: msg.reportData ?? null,
  });

  // Touch conversation updatedAt
  await updateDoc(doc(conversationsCol(), conversationId), {
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function getMessages(
  conversationId: string
): Promise<PersistedMessage[]> {
  const q = query(messagesCol(conversationId), orderBy("timestamp", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      role: data.role,
      content: data.content ?? "",
      timestamp: tsToISO(data.timestamp),
      error: data.error ?? undefined,
      reportData: data.reportData ?? undefined,
    };
  });
}
