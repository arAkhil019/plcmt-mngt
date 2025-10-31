// lib/studentInfoService.js
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
} from "firebase/firestore";
import { db } from "./firebase";

const COLLECTION = "studentPublicInfo";

// Shape reference
// {
//   id,
//   title: string,
//   description?: string,
//   type?: 'announcement' | 'link' | 'resource' | 'faq',
//   url?: string,
//   category?: string,
//   isActive: boolean,
//   startDate?: string (ISO),
//   endDate?: string (ISO),
//   createdAt: string (ISO),
//   updatedAt: string (ISO),
//   createdBy?: string,
//   createdByName?: string,
//   lastUpdatedBy?: string,
//   lastUpdatedByName?: string,
// }

export const studentInfoService = {
  async getActiveItems() {
    try {
      const nowIso = new Date().toISOString();
      // Fetch active items; date filtering is done client-side for cross-field OR logic simplicity
      const qRef = query(collection(db, COLLECTION), where("isActive", "==", true), orderBy("updatedAt", "desc"));
      const snap = await getDocs(qRef);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Filter by date window if provided
      const filtered = items.filter((it) => {
        const { startDate, endDate } = it;
        const startOk = !startDate || startDate <= nowIso;
        const endOk = !endDate || endDate >= nowIso;
        return startOk && endOk;
      });
      return filtered;
    } catch (err) {
      console.error("studentInfoService.getActiveItems error", err);
      throw err;
    }
  },

  async getAllItems() {
    try {
      const qRef = query(collection(db, COLLECTION), orderBy("updatedAt", "desc"));
      const snap = await getDocs(qRef);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error("studentInfoService.getAllItems error", err);
      throw err;
    }
  },

  async getItemById(id) {
    const ref = doc(db, COLLECTION, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  },

  async createItem(data, creatorInfo = {}) {
    const now = new Date().toISOString();
    const clean = {
      title: data.title?.trim() || "",
      description: data.description?.trim() || "",
      type: data.type || "announcement",
      url: data.url?.trim() || "",
      category: data.category?.trim() || "",
      isActive: data.isActive !== false,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      createdAt: now,
      updatedAt: now,
      createdBy: creatorInfo.id || "unknown",
      createdByName: creatorInfo.name || "Unknown User",
      lastUpdatedBy: creatorInfo.id || "unknown",
      lastUpdatedByName: creatorInfo.name || "Unknown User",
    };
    const docRef = await addDoc(collection(db, COLLECTION), clean);
    return { id: docRef.id, ...clean };
  },

  async updateItem(id, updates, updaterInfo = {}) {
    const ref = doc(db, COLLECTION, id);
    const now = new Date().toISOString();
    const clean = {
      ...updates,
      updatedAt: now,
      lastUpdatedBy: updaterInfo.id || "unknown",
      lastUpdatedByName: updaterInfo.name || "Unknown User",
    };
    await updateDoc(ref, clean);
    return { id, ...clean };
  },

  async toggleActive(id, isActive, updaterInfo = {}) {
    return this.updateItem(id, { isActive }, updaterInfo);
  },

  async deleteItem(id, deleterInfo = {}) {
    // Soft delete by setting isActive false and appending deletedAt
    const ref = doc(db, COLLECTION, id);
    const now = new Date().toISOString();
    await updateDoc(ref, {
      isActive: false,
      deletedAt: now,
      updatedAt: now,
      lastUpdatedBy: deleterInfo.id || "unknown",
      lastUpdatedByName: deleterInfo.name || "Unknown User",
    });
    return { id, success: true };
  },
};
