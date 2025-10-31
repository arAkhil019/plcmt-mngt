"use client";

import React, { useEffect, useState } from "react";
import { studentInfoService } from "../lib/studentInfoService";
import { placementsService } from "../lib/placementsService";
import { GraduationCapIcon, LinkIcon, BuildingIcon } from "./icons";

export default function PublicLanding({ onLoginClick }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [resources, setResources] = useState([]);
  const [summary, setSummary] = useState({ totalCompanies: 0, totalHired: 0, topPackage: 0 });
  const [topCompanies, setTopCompanies] = useState([]);
  const [offers, setOffers] = useState([]);
  const [tips, setTips] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [activeInfo, sum, top, off, tp] = await Promise.all([
          studentInfoService.getActiveItems().catch(() => []),
          placementsService.getSummary().catch(() => ({ totalCompanies: 0, totalHired: 0, topPackage: 0 })),
          placementsService.getTopCompanies(8).catch(() => []),
          placementsService.getOffers().catch(() => []),
          placementsService.getTips().catch(() => []),
        ]);
        setAnnouncements(activeInfo.filter((it) => it.type === "announcement"));
        setResources(activeInfo.filter((it) => it.type === "link" || it.type === "resource"));
        setSummary(sum);
        setTopCompanies(top);
        setOffers(off);
        setTips(tp);
      } catch (e) {
        console.error("Failed to load public content:", e);
        setError("Unable to load public content right now.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="bg-gray-50 dark:bg-black min-h-screen text-gray-800 dark:text-gray-200">
      <header className="bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <nav className="container mx-auto px-3 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCapIcon className="h-5 w-5 sm:h-6 sm:w-6 text-gray-900 dark:text-white" />
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Placerly</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onLoginClick} className="h-9 px-4 rounded-md border border-gray-200 dark:border-gray-800 text-sm hover:bg-gray-100 dark:hover:bg-gray-800">
              Login
            </button>
          </div>
        </nav>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {/* Hero - Placements Overview */}
        <section className="mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold mb-2">Placements at a glance</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Company-wise hiring, offers, stipends, internship durations, and tips from recently placed students.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
              <div className="text-xs text-gray-600 dark:text-gray-400">Companies visited</div>
              <div className="text-2xl font-semibold">{summary.totalCompanies}</div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
              <div className="text-xs text-gray-600 dark:text-gray-400">Students hired</div>
              <div className="text-2xl font-semibold">{summary.totalHired}</div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
              <div className="text-xs text-gray-600 dark:text-gray-400">Top package (LPA)</div>
              <div className="text-2xl font-semibold">{summary.topPackage}</div>
            </div>
          </div>
        </section>

        {/* Top companies */}
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-semibold">Top companies</h3>
          </div>
          {topCompanies.length === 0 ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">No placement data available yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {topCompanies.map((c) => (
                <div key={c.company} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
                  <div className="text-sm font-semibold flex items-center gap-2"><BuildingIcon className="h-4 w-4" /> {c.company}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Hired: {c.hires}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Offers (company and details) */}
        <section className="mb-12">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-semibold">Recent offers</h3>
          </div>
          {offers.length === 0 ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">No offers recorded yet.</div>
          ) : (
            <div className="space-y-4">
              {offers.map((o) => (
                <div key={o.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div>
                      <div className="text-base sm:text-lg font-semibold flex items-center gap-2">
                        <BuildingIcon className="h-4 w-4" /> {o.company || 'Company'} {o.role ? `• ${o.role}` : ''}
                      </div>
                      <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 flex flex-wrap gap-2">
                        {typeof o.packageLpa === 'number' && !isNaN(o.packageLpa) ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-800">Package: {o.packageLpa} LPA</span>
                        ) : null}
                        {typeof o.stipendPerMonth === 'number' && !isNaN(o.stipendPerMonth) ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-800">Stipend: ₹{o.stipendPerMonth.toLocaleString()}/mo</span>
                        ) : null}
                        {o.internshipDurationMonths ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-800">Internship: {o.internshipDurationMonths} months</span>
                        ) : null}
                        {o.internshipPeriod ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-800">{o.internshipPeriod}</span>
                        ) : null}
                        {o.visitedOn ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-800">Visited: {new Date(o.visitedOn).toLocaleDateString()}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Hired: {o.hiredCount || (o.students?.length || 0)}</div>
                  </div>
                  {Array.isArray(o.students) && o.students.length > 0 ? (
                    <div className="mt-3">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Shortlisted students</div>
                      <div className="flex flex-wrap gap-1.5">
                        {o.students.map((s, idx) => (
                          <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-800 text-xs">{s.name || s.admissionNumber || 'Student'}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Announcements */}
        <section className="mb-12">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-semibold">Announcements</h3>
            {loading && <span className="text-sm text-gray-500">Loading...</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
          {announcements.length === 0 ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">No announcements right now.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
              {announcements.map((a) => (
                <div key={a.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
                  <div className="text-sm font-semibold">{a.title}</div>
                  {a.description ? <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-3">{a.description}</div> : null}
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-medium text-blue-700 dark:text-blue-300 hover:underline">Open link</a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Useful links & resources */}
        <section id="resources" className="mb-12">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-semibold">Useful links & resources</h3>
          </div>
          {resources.length === 0 ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">No resources yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
              {resources.map((r) => (
                <a key={r.id} href={r.url || "#"} target="_blank" rel="noreferrer" className="group rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 hover:shadow-md transition">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-gray-100 dark:bg-gray-900 grid place-items-center">
                      <LinkIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{r.title || "Resource"}</div>
                      {r.description ? <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{r.description}</div> : null}
                      {r.category ? <div className="mt-1 text-[10px] px-2 py-0.5 rounded-full inline-block border border-gray-200 dark:border-gray-800">{r.category}</div> : null}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* Tips from placed students */}
        <section className="mb-16">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-semibold">Tips from placed students</h3>
          </div>
          {tips.length === 0 ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">No tips shared yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {tips.slice(0, 6).map((t) => (
                <div key={t.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
                  <div className="font-medium">{t.title || 'Tip'}</div>
                  {t.content ? <div className="mt-1 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{t.content}</div> : null}
                  <div className="mt-2 text-xs text-gray-500">{[t.studentName, t.company, t.year].filter(Boolean).join(' • ')}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <footer className="border-t border-gray-200 dark:border-gray-800 py-6 text-center text-xs text-gray-600 dark:text-gray-400">
        <div className="container mx-auto px-4">© {new Date().getFullYear()} Placerly • For students and placement coordinators</div>
      </footer>
    </div>
  );
}
