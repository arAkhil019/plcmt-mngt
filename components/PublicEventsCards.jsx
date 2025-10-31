"use client";

import React, { useMemo } from "react";
import { BriefcaseIcon, ActivityIcon, ClockIcon, MapPinIcon } from "./icons";

function parseDateParts(iso) {
  if (!iso) return { day: "—", month: "" };
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return {
      day: String(d),
      month: dt.toLocaleString(undefined, { month: "short" })
    };
  } catch {
    return { day: "—", month: "" };
  }
}

function typeTheme(type) {
  const key = (type || "").toLowerCase().replace(/\s+/g, "_");
  const map = {
    pre_placement_talk: {
      bg: "bg-blue-600",
      ring: "ring-blue-500/30",
      pill: "bg-white text-blue-700",
      text: "text-white",
      sub: "text-white/80",
      bar: "bg-white/60",
      gradFrom: "from-blue-500",
      gradTo: "to-blue-700"
    },
    technical_round: {
      bg: "bg-violet-500",
      ring: "ring-violet-500/30",
      pill: "bg-white text-violet-700",
      text: "text-white",
      sub: "text-white/80",
      bar: "bg-white/60",
      gradFrom: "from-violet-500",
      gradTo: "to-violet-700"
    },
    written_test: {
      bg: "bg-emerald-500",
      ring: "ring-emerald-500/30",
      pill: "bg-white text-emerald-700",
      text: "text-white",
      sub: "text-white/80",
      bar: "bg-white/60",
      gradFrom: "from-emerald-500",
      gradTo: "to-emerald-700"
    },
    hr_round: {
      bg: "bg-pink-500",
      ring: "ring-pink-500/30",
      pill: "bg-white text-pink-700",
      text: "text-white",
      sub: "text-white/80",
      bar: "bg-white/60",
      gradFrom: "from-pink-500",
      gradTo: "to-pink-700"
    },
    online_assessment: {
      bg: "bg-cyan-500",
      ring: "ring-cyan-500/30",
      pill: "bg-white text-cyan-700",
      text: "text-white",
      sub: "text-white/80",
      bar: "bg-white/60",
      gradFrom: "from-cyan-500",
      gradTo: "to-cyan-700"
    },
    shortlist: {
      bg: "bg-amber-400",
      ring: "ring-amber-400/30",
      pill: "bg-white text-amber-700",
      text: "text-white",
      sub: "text-white/80",
      bar: "bg-white/60",
      gradFrom: "from-amber-400",
      gradTo: "to-amber-600"
    },
    offer: {
      bg: "bg-yellow-400",
      ring: "ring-yellow-400/30",
      pill: "bg-white text-yellow-700",
      text: "text-white",
      sub: "text-white/80",
      bar: "bg-white/60",
      gradFrom: "from-yellow-400",
      gradTo: "to-yellow-600"
    }
  };
  return map[key] || {
    bg: "bg-blue-600",
    ring: "ring-blue-500/30",
    pill: "bg-white text-blue-700",
    text: "text-white",
    sub: "text-white/80",
    bar: "bg-white/60",
    gradFrom: "from-blue-500",
    gradTo: "to-blue-700"
  };
}

function typeIcon(type) {
  const key = (type || "").toLowerCase();
  if (key.includes("talk")) return "🎤";
  if (key.includes("technical")) return "🧩";
  if (key.includes("written") || key.includes("test")) return "✍️";
  if (key.includes("hr")) return "🤝";
  if (key.includes("online") || key.includes("assessment")) return "💻";
  if (key.includes("shortlist")) return "📋";
  if (key.includes("offer")) return "🎉";
  return "🏢";
}

function toGCalUrl({ title, details, location, start }) {
  try {
    const startIso = start ? new Date(start).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z") : null;
    const endIso = startIso; // single point for simplicity
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: title || "Placement Activity",
      details: details || "",
      location: location || "",
      dates: startIso && endIso ? `${startIso}/${endIso}` : ""
    });
    return `https://www.google.com/calendar/render?${params.toString()}`;
  } catch {
    return "https://www.google.com/calendar";
  }
}

export default function PublicEventsCards({ events = [] }) {
  const sorted = useMemo(() => {
    return [...events]
      .filter(e => e?.date)
      .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  }, [events]);

  if (sorted.length === 0) {
    return (
      <div className="text-sm text-gray-600 dark:text-gray-400">No upcoming events yet.</div>
    );
  }

  return (
    <div className="space-y-5 lg:space-y-6">
      {sorted.map((e) => {
        const theme = typeTheme(e.activityType);
        const { day, month } = parseDateParts(e.date);
        const title = e.company || e.activityName || "Placement Activity";
        const subtitleParts = [e.activityName && e.company ? e.activityName : e.activityType, e.time, e.location].filter(Boolean);
        const subtitle = subtitleParts.join(" • ");
        const gcal = toGCalUrl({ title, details: subtitle, location: e.location, start: e.date });

        return (
          <div key={`${e.activityId || e.id}-${e.date}-${e.time || ""}`} className={`relative overflow-hidden rounded-2xl md:rounded-3xl ${theme.text} ring-1 ${theme.ring} p-5 md:p-6 lg:p-7 shadow-md transition-transform hover:shadow-lg hover:-translate-y-0.5 md:min-h-[140px] w-full`}> 
            {/* Gradient background */}
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${theme.gradFrom} ${theme.gradTo}`}></div>
            <div className="relative flex items-start gap-4 md:gap-5">
              {/* Left icon (SVG, not emoji) */}
              <div className="hidden sm:flex h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-white/15 items-center justify-center shadow-sm">
                <BriefcaseIcon className="h-5 w-5 md:h-6 md:w-6 opacity-90" />
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-base sm:text-lg md:text-xl font-semibold truncate">{title}</div>
                {subtitle && (
                  <div className={`text-xs sm:text-sm md:text-base ${theme.sub} truncate`}>{subtitle}</div>
                )}
                {/* Chips */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {e.activityType ? (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-white/15">
                      <ActivityIcon className="h-3.5 w-3.5" /> {e.activityType}
                    </span>
                  ) : null}
                  {e.time ? (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-white/15">
                      <ClockIcon className="h-3.5 w-3.5" /> {e.time}
                    </span>
                  ) : null}
                  {e.mode ? (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-white/15">
                      {e.mode}
                    </span>
                  ) : null}
                  {e.location ? (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-white/15 truncate max-w-[200px] sm:max-w-[260px] md:max-w-[360px]">
                      <MapPinIcon className="h-3.5 w-3.5" /> {e.location}
                    </span>
                  ) : null}
                </div>
                {/* Progress line (decorative) */}
                <div className="mt-3 sm:mt-4 h-1.5 md:h-2 rounded-full bg-white/25 overflow-hidden">
                  <div className={`h-full w-1/3 ${theme.bar}`}></div>
                </div>
              </div>
              {/* Date pill */}
              <div className="flex flex-col items-center gap-1">
                <div className={`h-12 w-12 md:h-16 md:w-16 rounded-2xl ${theme.pill} grid place-items-center text-lg md:text-2xl font-bold`}>{day}</div>
                <div className="text-[10px] sm:text-xs opacity-90">{month}</div>
              </div>
            </div>
            <div className="mt-3 sm:mt-4 flex items-center justify-between">
              <a href={gcal} target="_blank" rel="noreferrer" className="text-xs sm:text-sm md:text-base font-medium underline underline-offset-2 opacity-95 hover:opacity-100">Add to Calendar</a>
              <span className="text-[10px] sm:text-xs md:text-sm opacity-80">Upcoming</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
