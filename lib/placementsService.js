// lib/placementsService.js
import { collection, getDocs, query, where, addDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "./firebase";

// Collections
// placements: one document per company/year or per drive outcome
// Shape suggestion:
// {
//   id,
//   company: string,
//   year: number, // academic/graduation year e.g., 2025
//   role?: string,
//   packageLpa?: number, // e.g., 12.5
//   stipendPerMonth?: number, // e.g., 50000
//   internshipDurationMonths?: number, // e.g., 6
//   internshipPeriod?: string, // e.g., "Jan–Jun 2026"
//   hiredCount: number,
//   students: Array<{ name: string, admissionNumber?: string, department?: string }>,
//   visitedOn?: string, // ISO date
//   isActive?: boolean,
//   createdAt?: string,
//   updatedAt?: string
// }
// placementTips: tips from placed students
// {
//   id,
//   title: string,
//   content: string,
//   studentName?: string,
//   company?: string,
//   year?: number,
//   isActive?: boolean,
//   createdAt?: string,
// }

const PLACEMENTS = "placements";
const TIPS = "placementTips";

export const placementsService = {
  // Admin/all
  async getAllPlacements(year = null) {
    const base = collection(db, PLACEMENTS);
    const q = year ? query(base, where("year", "==", year)) : base;
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async getPlacements(year = null) {
    const base = collection(db, PLACEMENTS);
    const q = year ? query(base, where("year", "==", year)) : base;
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Filter active if field exists
    return items.filter((x) => x.isActive !== false);
  },

  async getSummary(year = null) {
    const items = await this.getPlacements(year);
    const companies = new Set();
    let totalHired = 0;
    let topPackage = null;
    for (const p of items) {
      if (p.company) companies.add(p.company.trim());
      totalHired += Number(p.hiredCount || (p.students?.length || 0));
      const pkg = Number(p.packageLpa || 0);
      if (!isNaN(pkg)) {
        if (topPackage === null || pkg > topPackage) topPackage = pkg;
      }
    }
    return {
      totalCompanies: companies.size,
      totalHired,
      topPackage: topPackage || 0,
    };
  },

  async getTopCompanies(limitCount = 10, year = null) {
    const items = await this.getPlacements(year);
    const counts = new Map();
    for (const p of items) {
      const key = (p.company || "").trim();
      if (!key) continue;
      const inc = Number(p.hiredCount || (p.students?.length || 0)) || 0;
      counts.set(key, (counts.get(key) || 0) + inc);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limitCount)
      .map(([company, hires]) => ({ company, hires }));
  },

  async getOffers(year = null) {
    // Full list, most recent first if visitedOn exists
    const items = await this.getPlacements(year);
    return items.sort((a, b) => {
      const da = a.visitedOn ? new Date(a.visitedOn).getTime() : 0;
      const dbv = b.visitedOn ? new Date(b.visitedOn).getTime() : 0;
      return dbv - da;
    });
  },

  async getTips(year = null) {
    const base = collection(db, TIPS);
    const q = base; // kept simple to avoid composite index
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return items.filter((x) => x.isActive !== false && (!year || x.year === year));
  },

  async getAllTips(year = null) {
    const base = collection(db, TIPS);
    const q = base;
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return year ? items.filter((x) => x.year === year) : items;
  },

  // Admin mutations: placements
  async createPlacement(data, actor) {
    const now = new Date().toISOString();
    const payload = {
      isActive: true,
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    const ref = await addDoc(collection(db, PLACEMENTS), payload);
    return { id: ref.id, ...payload };
  },
  async updatePlacement(id, data, actor) {
    const ref = doc(db, PLACEMENTS, id);
    const payload = { ...data, updatedAt: new Date().toISOString() };
    await updateDoc(ref, payload);
    return { id, ...payload };
  },
  async toggleActivePlacement(id, isActive, actor) {
    const ref = doc(db, PLACEMENTS, id);
    await updateDoc(ref, { isActive, updatedAt: new Date().toISOString() });
  },
  async deletePlacement(id, actor) {
    const ref = doc(db, PLACEMENTS, id);
    await updateDoc(ref, { isActive: false, deletedAt: new Date().toISOString() });
  },

  // Admin mutations: tips
  async createTip(data, actor) {
    const now = new Date().toISOString();
    const payload = { isActive: true, createdAt: now, updatedAt: now, ...data };
    const ref = await addDoc(collection(db, TIPS), payload);
    return { id: ref.id, ...payload };
  },
  async updateTip(id, data, actor) {
    const ref = doc(db, TIPS, id);
    const payload = { ...data, updatedAt: new Date().toISOString() };
    await updateDoc(ref, payload);
    return { id, ...payload };
  },
  async toggleActiveTip(id, isActive, actor) {
    const ref = doc(db, TIPS, id);
    await updateDoc(ref, { isActive, updatedAt: new Date().toISOString() });
  },
  async deleteTip(id, actor) {
    const ref = doc(db, TIPS, id);
    await updateDoc(ref, { isActive: false, deletedAt: new Date().toISOString() });
  },
};