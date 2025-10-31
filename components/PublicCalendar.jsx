"use client";

import React, { useMemo, useState } from "react";

function toDayKey(value) {
  if (!value) return null;
  // If already YYYY-MM-DD
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // Try to parse safely
  try {
    // If value looks like D/M/Y etc., new Date may still parse; clamp via UTC to avoid tz shifting date
    const d = new Date(value);
    if (!isNaN(d.getTime())) return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0,10);
  } catch {}
  return null;
}

// Simple month calendar that highlights days with events and lists them on click
export default function PublicCalendar({ events = [] }) {
  const [current, setCurrent] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  // Activity type-based styles
  const getTypeKey = (t) => (t || "").toLowerCase().replace(/\s+/g, "_");
  const typeStyles = (type) => {
    const key = getTypeKey(type);
    const map = {
      pre_placement_talk: {
        dot: "bg-amber-500",
        badge: "bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
        border: "border-amber-300 dark:border-amber-800",
        cardBg: "bg-amber-50 dark:bg-amber-900/25",
        cardText: "text-amber-900 dark:text-amber-200",
        cardBorder: "border-amber-200 dark:border-amber-800"
      },
      technical_round: {
        dot: "bg-indigo-500",
        badge: "bg-indigo-50 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200",
        border: "border-indigo-300 dark:border-indigo-800",
        cardBg: "bg-indigo-50 dark:bg-indigo-900/25",
        cardText: "text-indigo-900 dark:text-indigo-200",
        cardBorder: "border-indigo-200 dark:border-indigo-800"
      },
      written_test: {
        dot: "bg-emerald-500",
        badge: "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
        border: "border-emerald-300 dark:border-emerald-800",
        cardBg: "bg-emerald-50 dark:bg-emerald-900/25",
        cardText: "text-emerald-900 dark:text-emerald-200",
        cardBorder: "border-emerald-200 dark:border-emerald-800"
      },
      hr_round: {
        dot: "bg-pink-500",
        badge: "bg-pink-50 text-pink-800 dark:bg-pink-900/30 dark:text-pink-200",
        border: "border-pink-300 dark:border-pink-800",
        cardBg: "bg-pink-50 dark:bg-pink-900/25",
        cardText: "text-pink-900 dark:text-pink-200",
        cardBorder: "border-pink-200 dark:border-pink-800"
      },
      online_assessment: {
        dot: "bg-blue-500",
        badge: "bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
        border: "border-blue-300 dark:border-blue-800",
        cardBg: "bg-blue-50 dark:bg-blue-900/25",
        cardText: "text-blue-900 dark:text-blue-200",
        cardBorder: "border-blue-200 dark:border-blue-800"
      },
      shortlist: {
        dot: "bg-cyan-500",
        badge: "bg-cyan-50 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200",
        border: "border-cyan-300 dark:border-cyan-800",
        cardBg: "bg-cyan-50 dark:bg-cyan-900/25",
        cardText: "text-cyan-900 dark:text-cyan-200",
        cardBorder: "border-cyan-200 dark:border-cyan-800"
      },
      offer: {
        dot: "bg-violet-500",
        badge: "bg-violet-50 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200",
        border: "border-violet-300 dark:border-violet-800",
        cardBg: "bg-violet-50 dark:bg-violet-900/25",
        cardText: "text-violet-900 dark:text-violet-200",
        cardBorder: "border-violet-200 dark:border-violet-800"
      },
    };
    return map[key] || {
      dot: "bg-blue-500",
      badge: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      border: "border-blue-300 dark:border-blue-800",
      cardBg: "bg-blue-50 dark:bg-blue-900/25",
      cardText: "text-blue-900 dark:text-blue-200",
      cardBorder: "border-blue-200 dark:border-blue-800"
    };
  };

  // Normalize events by date key YYYY-MM-DD
  const eventsByDay = useMemo(() => {
    const map = new Map();
    events.forEach((e) => {
      const key = toDayKey(e?.date);
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return map;
  }, [events]);

  const presentTypes = useMemo(() => {
    const s = new Set();
    for (const [, arr] of eventsByDay) {
      arr.forEach((e) => e?.activityType && s.add(getTypeKey(e.activityType)));
    }
    return Array.from(s);
  }, [eventsByDay]);

  const startOfMonth = useMemo(() => new Date(current.getFullYear(), current.getMonth(), 1), [current]);
  const endOfMonth = useMemo(() => new Date(current.getFullYear(), current.getMonth() + 1, 0), [current]);

  const startDayIndex = (startOfMonth.getDay() + 6) % 7; // make Monday=0
  const daysInMonth = endOfMonth.getDate();
  const totalCells = Math.ceil((startDayIndex + daysInMonth) / 7) * 7;

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startDayIndex + 1; // 1..daysInMonth for current month
    const date = new Date(current.getFullYear(), current.getMonth(), dayNum);
    const inThisMonth = dayNum >= 1 && dayNum <= daysInMonth;
    const key = inThisMonth ? new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString().slice(0, 10) : null;
    const dayEvents = key ? eventsByDay.get(key) || [] : [];
    return { inThisMonth, date, dayNum: inThisMonth ? dayNum : null, dayEvents, key };
  });

  const monthLabel = current.toLocaleString(undefined, { month: "long", year: "numeric" });

  const goPrev = () => setCurrent(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  const goNext = () => setCurrent(new Date(current.getFullYear(), current.getMonth() + 1, 1));
  const goToday = () => setCurrent(new Date());
  const now = new Date();
  const todayKey = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);

  // Month/event navigation helpers
  const allEventKeys = useMemo(() => Array.from(eventsByDay.keys()).sort(), [eventsByDay]);
  const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
  const hasEventsThisMonth = useMemo(() => allEventKeys.some(k => k?.startsWith(monthKey)), [allEventKeys, monthKey]);
  const nextEventKey = useMemo(() => {
    const todayStr = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0,10);
    return allEventKeys.find(k => k >= todayStr) || allEventKeys[0] || null;
  }, [allEventKeys, now]);
  const prevEventKey = useMemo(() => {
    const todayStr = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0,10);
    const past = allEventKeys.filter(k => k <= todayStr);
    return past.length ? past[past.length - 1] : (allEventKeys.length ? allEventKeys[allEventKeys.length - 1] : null);
  }, [allEventKeys, now]);
  const jumpToEvent = (key) => {
    if (!key) return;
    const [y, m, d] = key.split('-').map(Number);
    setCurrent(new Date(y, m - 1, 1));
    setSelectedDate(key);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <button onClick={goPrev} className="px-3 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-800">
          Prev
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-semibold">{monthLabel}</h2>
          <button onClick={goToday} className="px-2 py-1 text-xs rounded-md border border-gray-200 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-800">Today</button>
        </div>
        <div className="flex items-center gap-2">
          {!hasEventsThisMonth && (
            <>
              <button onClick={() => jumpToEvent(prevEventKey)} disabled={!prevEventKey} className="px-2 py-1 text-xs rounded-md border border-gray-200 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-800 dark:hover:bg-gray-800">Prev Event</button>
              <button onClick={() => jumpToEvent(nextEventKey)} disabled={!nextEventKey} className="px-2 py-1 text-xs rounded-md border border-gray-200 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-800 dark:hover:bg-gray-800">Next Event</button>
            </>
          )}
          <button onClick={goNext} className="px-3 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-gray-800">
            Next
          </button>
        </div>
      </div>

      {!hasEventsThisMonth && (
        <div className="mb-2 text-[11px] sm:text-xs text-gray-500 dark:text-gray-400">No events this month. Use Next Event to jump where events exist.</div>
      )}

      <div className="grid grid-cols-7 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
        {"Mon Tue Wed Thu Fri Sat Sun".split(" ").map((d) => (
          <div className="py-2 text-center" key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {cells.map((cell, idx) => {
          const isToday = cell.key === todayKey;
          const hasEvents = (cell.dayEvents?.length || 0) > 0;
          const tooltip = hasEvents ? cell.dayEvents.map(e => `${e.company || ""}${e.activityName ? ` • ${e.activityName}` : ""}${e.time ? ` @ ${e.time}` : ""}`).join("\n") : undefined;
          return (
            <button
              key={idx}
              disabled={!cell.inThisMonth}
              onClick={() => setSelectedDate(cell.key)}
              title={tooltip}
              className={[
                "min-h-20 sm:min-h-28 rounded-lg border text-left p-2 transition-colors",
                cell.inThisMonth ? "bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800" : "bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-900 text-gray-400",
                hasEvents ? "ring-1 ring-blue-200/70 dark:ring-blue-900/40" : "",
                isToday ? "shadow-sm border-blue-300 dark:border-blue-800" : "",
                "hover:bg-gray-50 dark:hover:bg-gray-900"
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span className={"text-xs sm:text-sm " + (isToday ? "font-bold text-blue-700 dark:text-blue-300" : "text-gray-700 dark:text-gray-200")}>{cell.dayNum || ""}</span>
                {hasEvents && (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {cell.dayEvents.length} events
                  </span>
                )}
              </div>
              {/* Pastel event cards (reference style) */}
              <div className="mt-2 space-y-1.5">
                {cell.dayEvents.slice(0, 2).map((e, i) => {
                  const styles = typeStyles(e.activityType);
                  return (
                    <div
                      key={i}
                      className={`w-full rounded-md px-2.5 py-1.5 border ${styles.cardBorder} ${styles.cardBg} ${styles.cardText} shadow-[0_1px_0_rgba(0,0,0,0.02)] hover:shadow-sm transition-shadow`}
                      title={`${e.company || ""}${e.activityName ? ` • ${e.activityName}` : ""}${e.time ? ` @ ${e.time}` : ""}`}
                    >
                      <div className="truncate text-[11px] sm:text-xs font-medium">{e.company || e.activityName || e.name}</div>
                      {e.time ? (
                        <div className="text-[10px] sm:text-[11px] opacity-70 leading-tight">{e.time}</div>
                      ) : null}
                    </div>
                  );
                })}
                {cell.dayEvents.length > 3 && (
                  <button
                    type="button"
                    onClick={(ev) => { ev.stopPropagation(); setSelectedDate(cell.key); }}
                    className="text-left w-full text-[10px] sm:text-xs text-blue-700 hover:underline dark:text-blue-300"
                  >
                    +{cell.dayEvents.length - 2} more
                  </button>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day drawer */}
      {selectedDate && (
        <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-800">
            <div className="font-medium">Events on {selectedDate}</div>
            <button onClick={() => setSelectedDate(null)} className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">Close</button>
          </div>
          <div className="p-4 sm:p-6">
            {(eventsByDay.get(selectedDate) || []).length === 0 ? (
              <div className="text-sm text-gray-500">No events on this day.</div>
            ) : (
              <ul className="space-y-3">
                {(eventsByDay.get(selectedDate) || []).map((e, i) => {
                  const styles = typeStyles(e.activityType);
                  return (
                    <li key={i} className={`p-3 rounded-lg border ${styles.border} bg-white/60 dark:bg-black/30`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium truncate">{e.activityName || e.name}</div>
                        {e.activityType && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${styles.badge}`}>{e.activityType}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex flex-wrap gap-2">
                        {e.company ? <span>{e.company}</span> : null}
                        {e.time ? <span>• {e.time}</span> : null}
                        {e.location ? <span>• {e.location}</span> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      {presentTypes.length > 0 && (
        <div className="mt-4 flex items-center gap-3 flex-wrap text-[11px] sm:text-xs">
          <span className="text-gray-500">Legend:</span>
          {presentTypes.map((k) => {
            const styles = typeStyles(k);
            const label = k.replace(/_/g, " ");
            return (
              <span key={k} className={`inline-flex items-center gap-2 px-2 py-0.5 rounded-full ${styles.badge}`}>
                <span className={`h-2 w-2 rounded-full ${styles.dot}`}></span>
                {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
