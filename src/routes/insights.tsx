import { createFileRoute } from "@tanstack/react-router";

/**
 * Route shell for /insights. The component (and recharts) live in
 * insights.lazy.tsx so ~386 kB stays off the cold path; this file carries
 * only document head metadata. Previously the 434-line component existed in
 * both files and the lazy route also (incorrectly) declared `head`.
 */
export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights — Tilth" },
      {
        name: "description",
        content: "Clear weekly and monthly trends across tasks, habits and focus.",
      },
      { property: "og:title", content: "Insights — Tilth" },
      {
        property: "og:description",
        content: "Clear weekly and monthly trends across tasks, habits and focus.",
      },
    ],
  }),
});
