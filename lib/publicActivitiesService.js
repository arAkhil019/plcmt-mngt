// lib/publicActivitiesService.js
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";

const COLLECTION = "publicActivities";

// Normalize various date/time inputs to a stable YYYY-MM-DD string for day-based calendar
function normalizeToISODate(dateInput, timeInput) {
  if (!dateInput) return null;

  // Firestore Timestamp-like
  if (typeof dateInput?.toDate === "function") {
    try {
      return dateInput.toDate().toISOString().slice(0, 10);
    } catch {}
  }

  // If already YYYY-MM-DD
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }

  // Try common D/M/Y or D-M-Y formats (assume day-first by default)
  if (typeof dateInput === "string" && /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.test(dateInput.trim())) {
    const [, dStr, mStr, yStr] = dateInput.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/) || [];
    const d = String(dStr).padStart(2, "0");
    const m = String(mStr).padStart(2, "0");
    const y = yStr;
    // If ambiguous like 02/03/2025, we stick with day-first (03 Feb vs 02 Mar) typical in India
    const iso = `${y}-${m}-${d}`;
    const test = new Date(`${iso}T00:00:00Z`);
    if (!isNaN(test.getTime())) return iso;
  }

  // Try Y/M/D or Y-M-D with non-dash separators
  if (typeof dateInput === "string" && /^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/.test(dateInput.trim())) {
    const [, yStr, mStr, dStr] = dateInput.trim().match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/) || [];
    const d = String(dStr).padStart(2, "0");
    const m = String(mStr).padStart(2, "0");
    const y = yStr;
    const iso = `${y}-${m}-${d}`;
    const test = new Date(`${iso}T00:00:00Z`);
    if (!isNaN(test.getTime())) return iso;
  }

  // Fallback: try Date parsing and clamp to date
  try {
    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  } catch {}

  return null;
}

export const publicActivitiesService = {
  async getActivePublicActivities() {
    // Avoid composite index by querying only on isActive and sorting client-side by date
    const qRef = query(collection(db, COLLECTION), where("isActive", "==", true));
    const snap = await getDocs(qRef);
    const items = snap.docs.map(d => {
      const raw = { id: d.id, ...d.data() };
      const isoDate = normalizeToISODate(raw.date);
      return { ...raw, date: isoDate || raw.date };
    });
    return items
      .filter(e => !!e.date && !isNaN(new Date(`${e.date}T00:00:00Z`).getTime()))
      .sort((a, b) => {
        const da = new Date(`${a.date}T00:00:00Z`).getTime();
        const db = new Date(`${b.date}T00:00:00Z`).getTime();
        return da - db; // ascending
      });
  },

  async getByActivityId(activityId) {
    const qRef = query(collection(db, COLLECTION), where("activityId", "==", activityId), limit(1));
    const snap = await getDocs(qRef);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  },

  async publishFromActivity(activity, publisherInfo = {}) {
    const now = new Date().toISOString();
    const existing = await this.getByActivityId(activity.id);
    const normalizedDate = normalizeToISODate(activity.date, activity.time);
    if (!normalizedDate) {
      throw new Error("Activity has an invalid date. Please set a valid date (YYYY-MM-DD) on the activity and try again.");
    }
    const clean = {
      activityId: activity.id,
      company: activity.company || "",
      activityName: activity.activityName || activity.name || "",
      activityType: activity.activityType || "",
      date: normalizedDate,
      time: activity.time || "",
      mode: activity.mode || "",
      location: activity.location || "",
      isActive: true,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      publishedBy: publisherInfo.id || "unknown",
      publishedByName: publisherInfo.name || "Unknown User",
    };
    if (existing) {
      await updateDoc(doc(db, COLLECTION, existing.id), clean);
      return { id: existing.id, ...clean };
    }
    const ref = await addDoc(collection(db, COLLECTION), clean);
    return { id: ref.id, ...clean };
  },

  async unpublish(activityId, updaterInfo = {}) {
    const existing = await this.getByActivityId(activityId);
    if (!existing) return { success: false };
    await updateDoc(doc(db, COLLECTION, existing.id), {
      isActive: false,
      updatedAt: new Date().toISOString(),
      unpublishedBy: updaterInfo.id || "unknown",
      unpublishedByName: updaterInfo.name || "Unknown User",
    });
    return { success: true };
  },

  async deleteByActivityId(activityId) {
    const existing = await this.getByActivityId(activityId);
    if (!existing) return { success: false };
    await deleteDoc(doc(db, COLLECTION, existing.id));
    return { success: true };
  }
};
