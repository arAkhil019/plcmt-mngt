"use client";

import React, { useEffect, useMemo, useState } from "react";
import { studentInfoService } from "../lib/studentInfoService";
import { publicActivitiesService } from "../lib/publicActivitiesService";
import { unifiedActivitiesService } from "../lib/unifiedActivitiesService";
import { PlusIcon, EditIcon, TrashIcon, RefreshIcon, CheckIcon } from "./icons";
import { placementsService } from "../lib/placementsService";
import PublicEventsCards from "./PublicEventsCards";

export default function AdminStudentInfoManager({
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  userProfile,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "announcement",
    url: "",
    category: "",
    isActive: true,
    startDate: "",
    endDate: "",
  });

  // Public calendar preview state
  const [publicEvents, setPublicEvents] = useState([]);
  const [publicEventsLoading, setPublicEventsLoading] = useState(false);
  const [publicEventsError, setPublicEventsError] = useState("");

  // Activities for publish/unpublish
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [publishingId, setPublishingId] = useState(null);

  const allowed = useMemo(() => (userProfile?.role === "admin" || userProfile?.role === "cpc"), [userProfile]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const list = await studentInfoService.getAllItems();
      setItems(list);
    } catch (e) {
      console.error(e);
      setError("Failed to load student info");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  load();
  loadPublicEvents();
  loadActivities();
  loadPlacements();
  loadTips();
  }, []);

  // Placements state
  const [placements, setPlacements] = useState([]);
  const [placementsLoading, setPlacementsLoading] = useState(false);
  const [placementsError, setPlacementsError] = useState("");
  const [placementFormOpen, setPlacementFormOpen] = useState(false);
  const [placementEditing, setPlacementEditing] = useState(null);
  const [placementForm, setPlacementForm] = useState({
    company: "",
    role: "",
    year: new Date().getFullYear(),
    packageLpa: "",
    stipendPerMonth: "",
    internshipDurationMonths: "",
    internshipPeriod: "",
    visitedOn: "",
    hiredCount: 0,
    students: [],
    isActive: true,
  });

  const loadPlacements = async () => {
    try {
      setPlacementsLoading(true);
      setPlacementsError("");
      const list = await placementsService.getAllPlacements();
      // Most recent first by visitedOn
      setPlacements((list || []).sort((a,b)=> (new Date(b.visitedOn||0)) - (new Date(a.visitedOn||0))));
    } catch (e) {
      console.error(e);
      setPlacementsError("Failed to load placements");
    } finally {
      setPlacementsLoading(false);
    }
  };

  const openPlacementCreate = () => { setPlacementEditing(null); setPlacementForm({ company: "", role: "", year: new Date().getFullYear(), packageLpa: "", stipendPerMonth: "", internshipDurationMonths: "", internshipPeriod: "", visitedOn: "", hiredCount: 0, students: [], isActive: true }); setPlacementFormOpen(true); };
  const openPlacementEdit = (p) => {
    setPlacementEditing(p);
    setPlacementForm({
      company: p.company || "",
      role: p.role || "",
      year: p.year || new Date().getFullYear(),
      packageLpa: p.packageLpa ?? "",
      stipendPerMonth: p.stipendPerMonth ?? "",
      internshipDurationMonths: p.internshipDurationMonths ?? "",
      internshipPeriod: p.internshipPeriod || "",
      visitedOn: p.visitedOn || "",
      hiredCount: p.hiredCount || (p.students?.length || 0),
      students: p.students || [],
      isActive: p.isActive !== false,
    });
    setPlacementFormOpen(true);
  };
  const savePlacement = async () => {
    if (!allowed) return;
    if (!placementForm.company.trim()) { setPlacementsError("Company is required"); return; }
    try {
      setPlacementsLoading(true);
      setPlacementsError("");
      const payload = {
        ...placementForm,
        packageLpa: placementForm.packageLpa === "" ? null : Number(placementForm.packageLpa),
        stipendPerMonth: placementForm.stipendPerMonth === "" ? null : Number(placementForm.stipendPerMonth),
        internshipDurationMonths: placementForm.internshipDurationMonths === "" ? null : Number(placementForm.internshipDurationMonths),
        hiredCount: Number(placementForm.hiredCount || 0),
      };
      if (placementEditing) {
        await placementsService.updatePlacement(placementEditing.id, payload, { id: userProfile?.id, name: userProfile?.name });
      } else {
        await placementsService.createPlacement(payload, { id: userProfile?.id, name: userProfile?.name });
      }
      setPlacementFormOpen(false);
      await loadPlacements();
    } catch (e) {
      console.error(e);
      setPlacementsError("Failed to save placement");
    } finally {
      setPlacementsLoading(false);
    }
  };
  const togglePlacement = async (p) => {
    if (!allowed) return;
    try {
      const currentActive = p.isActive !== false;
      await placementsService.toggleActivePlacement(p.id, !currentActive, { id: userProfile?.id, name: userProfile?.name });
      await loadPlacements();
    } catch (e) {
      console.error(e);
      setPlacementsError("Failed to update placement");
    }
  };
  const deletePlacement = async (id) => {
    if (!allowed) return;
    if (!window.confirm("Soft delete this placement?")) return;
    try {
      await placementsService.deletePlacement(id, { id: userProfile?.id, name: userProfile?.name });
      await loadPlacements();
    } catch (e) {
      console.error(e);
      setPlacementsError("Failed to delete placement");
    }
  };

  // Tips state
  const [tips, setTips] = useState([]);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [tipsError, setTipsError] = useState("");
  const [tipFormOpen, setTipFormOpen] = useState(false);
  const [tipEditing, setTipEditing] = useState(null);
  const [tipForm, setTipForm] = useState({ title: "", content: "", studentName: "", company: "", year: new Date().getFullYear(), isActive: true });

  const loadTips = async () => {
    try {
      setTipsLoading(true);
      setTipsError("");
      const list = await placementsService.getAllTips();
      setTips(list || []);
    } catch (e) {
      console.error(e);
      setTipsError("Failed to load tips");
    } finally {
      setTipsLoading(false);
    }
  };
  const openTipCreate = () => { setTipEditing(null); setTipForm({ title: "", content: "", studentName: "", company: "", year: new Date().getFullYear(), isActive: true }); setTipFormOpen(true); };
  const openTipEdit = (t) => { setTipEditing(t); setTipForm({ title: t.title||"", content: t.content||"", studentName: t.studentName||"", company: t.company||"", year: t.year || new Date().getFullYear(), isActive: t.isActive !== false }); setTipFormOpen(true); };
  const saveTip = async () => {
    if (!allowed) return;
    if (!tipForm.title.trim()) { setTipsError("Title is required"); return; }
    try {
      setTipsLoading(true);
      setTipsError("");
      if (tipEditing) {
        await placementsService.updateTip(tipEditing.id, tipForm, { id: userProfile?.id, name: userProfile?.name });
      } else {
        await placementsService.createTip(tipForm, { id: userProfile?.id, name: userProfile?.name });
      }
      setTipFormOpen(false);
      await loadTips();
    } catch (e) {
      console.error(e);
      setTipsError("Failed to save tip");
    } finally {
      setTipsLoading(false);
    }
  };
  const toggleTip = async (t) => {
    if (!allowed) return;
    try {
      const currentActive = t.isActive !== false;
      await placementsService.toggleActiveTip(t.id, !currentActive, { id: userProfile?.id, name: userProfile?.name });
      await loadTips();
    } catch (e) {
      console.error(e);
      setTipsError("Failed to update tip");
    }
  };
  const deleteTip = async (id) => {
    if (!allowed) return;
    if (!window.confirm("Soft delete this tip?")) return;
    try {
      await placementsService.deleteTip(id, { id: userProfile?.id, name: userProfile?.name });
      await loadTips();
    } catch (e) {
      console.error(e);
      setTipsError("Failed to delete tip");
    }
  };

  const loadPublicEvents = async () => {
    try {
      setPublicEventsLoading(true);
      setPublicEventsError("");
      const events = await publicActivitiesService.getActivePublicActivities();
      setPublicEvents(events || []);
    } catch (e) {
      console.error(e);
      setPublicEventsError("Failed to load public calendar");
    } finally {
      setPublicEventsLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ title: "", description: "", type: "announcement", url: "", category: "", isActive: true, startDate: "", endDate: "" });
    setEditing(null);
  };

  const openCreate = () => { resetForm(); setFormOpen(true); };
  const openEdit = (item) => {
    setEditing(item);
    setForm({
      title: item.title || "",
      description: item.description || "",
      type: item.type || "announcement",
      url: item.url || "",
      category: item.category || "",
      isActive: !!item.isActive,
      startDate: item.startDate || "",
      endDate: item.endDate || "",
    });
    setFormOpen(true);
  };

  const save = async () => {
    if (!allowed) return;
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    try {
      setLoading(true);
      setError("");
      if (editing) {
        await studentInfoService.updateItem(editing.id, { ...form }, { id: userProfile?.id, name: userProfile?.name });
      } else {
        await studentInfoService.createItem({ ...form }, { id: userProfile?.id, name: userProfile?.name });
      }
      setFormOpen(false);
      resetForm();
      await load();
    } catch (e) {
      console.error(e);
      setError("Failed to save item");
    } finally {
      setLoading(false);
    }
  };

  const del = async (id) => {
    if (!allowed) return;
    if (!window.confirm("Delete this item (soft delete)?")) return;
    try {
      setLoading(true);
      await studentInfoService.deleteItem(id, { id: userProfile?.id, name: userProfile?.name });
      await load();
    } catch (e) {
      console.error(e);
      setError("Failed to delete item");
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (item) => {
    if (!allowed) return;
    try {
      setLoading(true);
      await studentInfoService.toggleActive(item.id, !item.isActive, { id: userProfile?.id, name: userProfile?.name });
      await load();
    } catch (e) {
      console.error(e);
      setError("Failed to update item");
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async () => {
    try {
      setActivitiesLoading(true);
      setActivitiesError("");
      const list = await unifiedActivitiesService.getAllActivities();
      setActivities(list || []);
    } catch (e) {
      console.error(e);
      setActivitiesError("Failed to load activities");
    } finally {
      setActivitiesLoading(false);
    }
  };

  const publishedIds = useMemo(() => new Set((publicEvents || []).map(e => e.activityId)), [publicEvents]);

  const filteredActivities = useMemo(() => {
    const q = activitySearch.trim().toLowerCase();
    let list = activities || [];
    if (activeOnly) {
      list = list.filter(a => a.status !== "Deleted" && a.isActive !== false);
    }
    if (q) {
      list = list.filter(a =>
        (a.company || "").toLowerCase().includes(q) ||
        (a.activityName || "").toLowerCase().includes(q) ||
        (a.activityType || "").toLowerCase().includes(q)
      );
    }
    // Upcoming first
    return [...list].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  }, [activities, activitySearch, activeOnly]);

  const doPublish = async (activity) => {
    if (!allowed) return;
    try {
      setPublishingId(activity.id);
      await publicActivitiesService.publishFromActivity(activity, { id: userProfile?.id, name: userProfile?.name });
      await loadPublicEvents();
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to publish activity");
    } finally {
      setPublishingId(null);
    }
  };

  const doUnpublish = async (activity) => {
    if (!allowed) return;
    try {
      setPublishingId(activity.id);
      await publicActivitiesService.unpublish(activity.id, { id: userProfile?.id, name: userProfile?.name });
      await loadPublicEvents();
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to unpublish activity");
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Student Public Info</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Manage announcements, links, and resources shown on the public landing page.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} title="Refresh">
            <RefreshIcon className="h-4 w-4" />
          </Button>
          {allowed && (
            <Button onClick={openCreate}>
              <PlusIcon className="h-4 w-4 mr-2" /> New Item
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}

  <Card>
        <CardHeader>
          <CardTitle>All Items</CardTitle>
          <CardDescription>Latest first</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 px-2">Title</th>
                  <th className="py-2 px-2">Type</th>
                  <th className="py-2 px-2">Category</th>
                  <th className="py-2 px-2">Visible</th>
                  <th className="py-2 px-2">Period</th>
                  <th className="py-2 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-gray-200 dark:border-gray-800">
                    <td className="py-2 px-2">
                      <div className="font-medium">{it.title}</div>
                      {it.description && (
                        <div className="text-xs text-gray-500 line-clamp-2 max-w-md">{it.description}</div>
                      )}
                    </td>
                    <td className="py-2 px-2 capitalize">{it.type || "announcement"}</td>
                    <td className="py-2 px-2">{it.category || "—"}</td>
                    <td className="py-2 px-2">
                      {it.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Hidden</Badge>
                      )}
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-500">
                      {it.startDate || "—"} {it.endDate ? `→ ${it.endDate}` : ""}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-end gap-2">
                        {allowed && (
                          <>
                            <Button variant="outline" onClick={() => openEdit(it)} title="Edit">
                              <EditIcon className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" onClick={() => toggle(it)} title={it.isActive ? "Hide" : "Show"}>
                              <CheckIcon className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" onClick={() => del(it.id)} title="Delete">
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td className="py-6 px-2 text-center text-gray-500" colSpan={6}>
                      {loading ? "Loading..." : "No items yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Placements Manager */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Placements</CardTitle>
            <CardDescription>Manage company-wise offers and hires shown on public page.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadPlacements} title="Refresh"><RefreshIcon className="h-4 w-4" /></Button>
            {allowed && (
              <Button onClick={openPlacementCreate}><PlusIcon className="h-4 w-4 mr-2" /> New Placement</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {placementsError && <div className="text-sm text-red-600 mb-2">{placementsError}</div>}
          {placementsLoading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2 px-2">Company</th>
                    <th className="py-2 px-2">Role</th>
                    <th className="py-2 px-2">Package</th>
                    <th className="py-2 px-2">Stipend</th>
                    <th className="py-2 px-2">Internship</th>
                    <th className="py-2 px-2">Visited</th>
                    <th className="py-2 px-2">Hired</th>
                    <th className="py-2 px-2">Visible</th>
                    <th className="py-2 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {placements.map((p) => (
                    <tr key={p.id} className="border-t border-gray-200 dark:border-gray-800">
                      <td className="py-2 px-2">{p.company || "—"}</td>
                      <td className="py-2 px-2">{p.role || "—"}</td>
                      <td className="py-2 px-2">{p.packageLpa ? `${p.packageLpa} LPA` : "—"}</td>
                      <td className="py-2 px-2">{p.stipendPerMonth ? `₹${Number(p.stipendPerMonth).toLocaleString()}/mo` : "—"}</td>
                      <td className="py-2 px-2 text-xs">{[p.internshipDurationMonths ? `${p.internshipDurationMonths}m` : null, p.internshipPeriod].filter(Boolean).join(" • ") || "—"}</td>
                      <td className="py-2 px-2 whitespace-nowrap text-xs">{p.visitedOn ? p.visitedOn : "—"}</td>
                      <td className="py-2 px-2">{p.hiredCount || (p.students?.length || 0)}</td>
                      <td className="py-2 px-2">{p.isActive === false ? <Badge variant="secondary">Hidden</Badge> : <Badge variant="success">Active</Badge>}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center justify-end gap-2">
                          {allowed && (
                            <>
                              <Button variant="outline" onClick={() => openPlacementEdit(p)} title="Edit"><EditIcon className="h-4 w-4" /></Button>
                              <Button variant="outline" onClick={() => togglePlacement(p)} title={p.isActive === false ? "Show" : "Hide"}><CheckIcon className="h-4 w-4" /></Button>
                              <Button variant="outline" onClick={() => deletePlacement(p.id)} title="Delete"><TrashIcon className="h-4 w-4" /></Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {placements.length === 0 && (
                    <tr>
                      <td className="py-6 px-2 text-center text-gray-500" colSpan={9}>{placementsLoading ? "Loading…" : "No placements yet."}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {placementFormOpen && (
        <Card>
          <CardHeader>
            <CardTitle>{placementEditing ? "Edit Placement" : "New Placement"}</CardTitle>
            <CardDescription>Enter placement details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Company</label>
                <input value={placementForm.company} onChange={(e)=>setPlacementForm({...placementForm, company:e.target.value})} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Role</label>
                <input value={placementForm.role} onChange={(e)=>setPlacementForm({...placementForm, role:e.target.value})} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Year</label>
                <input value={placementForm.year} onChange={(e)=>setPlacementForm({...placementForm, year:Number(e.target.value)||""})} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Package (LPA)</label>
                <input value={placementForm.packageLpa} onChange={(e)=>setPlacementForm({...placementForm, packageLpa:e.target.value})} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Stipend per month (₹)</label>
                <input value={placementForm.stipendPerMonth} onChange={(e)=>setPlacementForm({...placementForm, stipendPerMonth:e.target.value})} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Internship duration (months)</label>
                <input value={placementForm.internshipDurationMonths} onChange={(e)=>setPlacementForm({...placementForm, internshipDurationMonths:e.target.value})} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-500">Internship period (e.g., Jan–Jun 2026)</label>
                <input value={placementForm.internshipPeriod} onChange={(e)=>setPlacementForm({...placementForm, internshipPeriod:e.target.value})} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Visited On (ISO date)</label>
                <input placeholder="YYYY-MM-DD" value={placementForm.visitedOn} onChange={(e)=>setPlacementForm({...placementForm, visitedOn:e.target.value})} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Hired Count</label>
                <input value={placementForm.hiredCount} onChange={(e)=>setPlacementForm({...placementForm, hiredCount:Number(e.target.value)||0})} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-500">Students (comma separated names)</label>
                <input value={(placementForm.students||[]).map(s=>s.name||s).join(", ")} onChange={(e)=>setPlacementForm({...placementForm, students:e.target.value.split(',').map(v=>({name:v.trim()})).filter(x=>x.name)})} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div className="flex items-center gap-2">
                <input id="pl_isActive" type="checkbox" checked={placementForm.isActive} onChange={(e)=>setPlacementForm({...placementForm, isActive:e.target.checked})} />
                <label htmlFor="pl_isActive" className="text-sm">Active</label>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button onClick={savePlacement}>{placementEditing ? "Update" : "Create"}</Button>
              <Button variant="outline" onClick={()=>{ setPlacementFormOpen(false); setPlacementEditing(null); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips Manager */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Placement Tips</CardTitle>
            <CardDescription>Manage tips shown on public page.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadTips} title="Refresh"><RefreshIcon className="h-4 w-4" /></Button>
            {allowed && (<Button onClick={openTipCreate}><PlusIcon className="h-4 w-4 mr-2" /> New Tip</Button>)}
          </div>
        </CardHeader>
        <CardContent>
          {tipsError && <div className="text-sm text-red-600 mb-2">{tipsError}</div>}
          {tipsLoading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-2 px-2">Title</th>
                    <th className="py-2 px-2">Student</th>
                    <th className="py-2 px-2">Company</th>
                    <th className="py-2 px-2">Year</th>
                    <th className="py-2 px-2">Visible</th>
                    <th className="py-2 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tips.map((t)=> (
                    <tr key={t.id} className="border-t border-gray-200 dark:border-gray-800">
                      <td className="py-2 px-2">{t.title || "—"}</td>
                      <td className="py-2 px-2">{t.studentName || "—"}</td>
                      <td className="py-2 px-2">{t.company || "—"}</td>
                      <td className="py-2 px-2">{t.year || "—"}</td>
                      <td className="py-2 px-2">{t.isActive === false ? <Badge variant="secondary">Hidden</Badge> : <Badge variant="success">Active</Badge>}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center justify-end gap-2">
                          {allowed && (
                            <>
                              <Button variant="outline" onClick={()=>openTipEdit(t)} title="Edit"><EditIcon className="h-4 w-4" /></Button>
                              <Button variant="outline" onClick={()=>toggleTip(t)} title={t.isActive === false ? "Show" : "Hide"}><CheckIcon className="h-4 w-4" /></Button>
                              <Button variant="outline" onClick={()=>deleteTip(t.id)} title="Delete"><TrashIcon className="h-4 w-4" /></Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {tips.length === 0 && (
                    <tr>
                      <td className="py-6 px-2 text-center text-gray-500" colSpan={6}>{tipsLoading ? "Loading…" : "No tips yet."}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {tipFormOpen && (
        <Card>
          <CardHeader>
            <CardTitle>{tipEditing ? "Edit Tip" : "New Tip"}</CardTitle>
            <CardDescription>Enter tip details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-500">Title</label>
                <input value={tipForm.title} onChange={(e)=>setTipForm({...tipForm, title:e.target.value})} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-500">Content</label>
                <textarea value={tipForm.content} onChange={(e)=>setTipForm({...tipForm, content:e.target.value})} className="mt-1 w-full min-h-24 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Student Name</label>
                <input value={tipForm.studentName} onChange={(e)=>setTipForm({...tipForm, studentName:e.target.value})} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Company</label>
                <input value={tipForm.company} onChange={(e)=>setTipForm({...tipForm, company:e.target.value})} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Year</label>
                <input value={tipForm.year} onChange={(e)=>setTipForm({...tipForm, year:Number(e.target.value)||""})} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div className="flex items-center gap-2">
                <input id="tip_isActive" type="checkbox" checked={tipForm.isActive} onChange={(e)=>setTipForm({...tipForm, isActive:e.target.checked})} />
                <label htmlFor="tip_isActive" className="text-sm">Active</label>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button onClick={saveTip}>{tipEditing ? "Update" : "Create"}</Button>
              <Button variant="outline" onClick={()=>{ setTipFormOpen(false); setTipEditing(null); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activities Publisher */}
      {allowed && (
        <Card>
          <CardHeader className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Publish Activities to Public Calendar</CardTitle>
                <CardDescription>Select an activity to publish/unpublish. Students will see only published activities.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={loadActivities} title="Reload Activities"><RefreshIcon className="h-4 w-4" /></Button>
                <Button variant="outline" onClick={loadPublicEvents} title="Reload Public Status"><RefreshIcon className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <input
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                placeholder="Search by company or activity name"
                className="w-full sm:w-80 h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
              />
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
                Active only
              </label>
            </div>
          </CardHeader>
          <CardContent>
            {activitiesError && <div className="text-sm text-red-600 mb-2">{activitiesError}</div>}
            {activitiesLoading ? (
              <div className="text-sm text-gray-500">Loading activities…</div>
            ) : (
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-2 px-2">Date</th>
                      <th className="py-2 px-2">Company</th>
                      <th className="py-2 px-2">Activity</th>
                      <th className="py-2 px-2">Status</th>
                      <th className="py-2 px-2">Published</th>
                      <th className="py-2 px-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActivities.map((a) => {
                      const isPublished = publishedIds.has(a.id);
                      return (
                        <tr key={a.id} className="border-t border-gray-200 dark:border-gray-800">
                          <td className="py-2 px-2 whitespace-nowrap text-xs">{a.date || "—"}</td>
                          <td className="py-2 px-2">{a.company || "—"}</td>
                          <td className="py-2 px-2">
                            <div className="font-medium">{a.activityName || "—"}</div>
                            <div className="text-xs text-gray-500">{a.activityType || ""}{a.time ? ` • ${a.time}` : ""}{a.location ? ` • ${a.location}` : ""}</div>
                          </td>
                          <td className="py-2 px-2 text-xs">{a.status || "—"}</td>
                          <td className="py-2 px-2">
                            {isPublished ? <Badge variant="success">Published</Badge> : <Badge variant="secondary">Not Published</Badge>}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center justify-end">
                              {isPublished ? (
                                <Button variant="outline" onClick={() => doUnpublish(a)} disabled={publishingId === a.id || publicEventsLoading}>
                                  Unpublish
                                </Button>
                              ) : (
                                <Button onClick={() => doPublish(a)} disabled={publishingId === a.id || publicEventsLoading}>
                                  Publish
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredActivities.length === 0 && (
                      <tr>
                        <td className="py-6 px-2 text-center text-gray-500" colSpan={6}>No activities found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Public Events Preview (same as public landing) */}
      <Card>
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Public Events Preview</CardTitle>
            <CardDescription>Exactly what students see on the landing page.</CardDescription>
          </div>
          <div className="mt-2 sm:mt-0">
            <Button variant="outline" onClick={loadPublicEvents} title="Refresh Calendar">
              <RefreshIcon className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {publicEventsError && (
            <div className="text-sm text-red-600 mb-2">{publicEventsError}</div>
          )}
          {publicEventsLoading ? (
            <div className="text-sm text-gray-500">Loading calendar…</div>
          ) : publicEvents.length === 0 ? (
            <div className="p-4 rounded-md border border-dashed border-gray-300 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
              No public events yet. Use "Publish Activity" above to add an activity to the public calendar. Ensure the activity has a valid date (YYYY-MM-DD).
            </div>
          ) : (
            <PublicEventsCards events={publicEvents} />
          )}
        </CardContent>
      </Card>

      {formOpen && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Edit Item" : "New Item"}</CardTitle>
            <CardDescription>Fill the details below</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Title</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
                  <option value="announcement">Announcement</option>
                  <option value="link">Link</option>
                  <option value="resource">Resource</option>
                  <option value="faq">FAQ</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-gray-500">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full min-h-24 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="text-xs text-gray-500">URL (optional)</label>
                <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Category (optional)</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="text-xs text-gray-500">Start Date (ISO)</label>
                <input value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} placeholder="YYYY-MM-DD" className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div>
                <label className="text-xs text-gray-500">End Date (ISO)</label>
                <input value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} placeholder="YYYY-MM-DD" className="mt-1 w-full h-10 px-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950" />
              </div>
              <div className="flex items-center gap-2">
                <input id="isActive" type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <label htmlFor="isActive" className="text-sm">Active</label>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button onClick={save}>{editing ? "Update" : "Create"}</Button>
              <Button variant="outline" onClick={() => { setFormOpen(false); resetForm(); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
