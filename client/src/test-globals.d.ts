import type { Firestore } from "firebase/firestore";

declare global {
  var authedFirestore: (auth: { uid: string; [key: string]: unknown } | null) => Firestore;
  var anonymousFirestore: (uid: string) => Firestore;
}

export {};
