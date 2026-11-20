import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityHeatmap, weekdayLabel } from "./ActivityHeatmap";
import { PreferencesProvider } from "./preferences";
import { dictionaries } from "@/lib/i18n";

const empty = {
  tasks: [],
  habits: [],
  habitLogs: [],
  focusSessions: [],
};

function render(today: string, weekStartsOn: number): string {
  return renderToStaticMarkup(
    <PreferencesProvider>
      <ActivityHeatmap
        {...empty}
        today={today}
        weekStartsOn={weekStartsOn}
        dayStartHour={0}
        timeZone="UTC"
      />
    </PreferencesProvider>,
  );
}

function cellTags(html: string): string[] {
  return html.match(/<(?:button|span)\b[^>]*data-hm-cell[^>]*>/g) ?? [];
}

describe("T4: single-month calendar SSR markup", () => {
  it("uses literal 28px circles, a 232px grid and five 28px rows with 6px gaps", () => {
    const html = render("2026-11-19", 6);
    expect(html).toContain("grid-template-columns:repeat(7, 28px)");
    expect(html).toContain("grid-template-rows:repeat(5, 28px)");
    expect(html).toContain("gap:6px");
    expect(html).toContain("width:232px");
    expect(html).toContain("height:164px");
    for (const tag of cellTags(html)) {
      expect(tag).toContain("width:28px");
      expect(tag).toContain("height:28px");
      expect(tag).toContain("border-radius:14px");
    }
  });

  it("uses six rows and a 198px height when the calendar needs them", () => {
    const html = render("2027-01-20", 6);
    expect(html).toContain('data-hm-block="true" data-rows="6"');
    expect(html).toContain("grid-template-rows:repeat(6, 28px)");
    expect(html).toContain("height:198px");
  });

  it("renders exactly one grid and every day, with future days aria-hidden", () => {
    const html = render("2026-11-19", 6);
    expect(html.match(/data-hm-block/g)).toHaveLength(1);
    expect(html).toContain('data-hm-block="true" data-rows="5"');
    const cells = cellTags(html);
    expect(cells).toHaveLength(30);
    expect(cells.filter((tag) => tag.includes('aria-hidden="true"'))).toHaveLength(11);
    expect(cells.filter((tag) => tag.startsWith("<button"))).toHaveLength(19);
    expect(html).toContain('data-day="2026-11-30"');
    expect(html).not.toContain('data-day="2026-12-01"');
  });

  it("places days explicitly and puts var(--hm-outline) on every cell", () => {
    const html = render("2026-11-19", 6);
    expect(html).toContain("grid-column:2");
    expect(html).toContain("grid-row:1");
    for (const tag of cellTags(html)) expect(tag).toContain("var(--hm-outline)");
  });

  it("renders seven centered weekday labels in week-start order", () => {
    const html = render("2026-11-19", 6);
    const header = html.match(/<div data-hm-weekdays="true"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
    const labels = Array.from(header.matchAll(/<span[^>]*>([^<]*)<\/span>/g), (match) => match[1]);
    const expected = Array.from({ length: 7 }, (_, index) =>
      new Intl.DateTimeFormat("ar-EG", { weekday: "narrow", timeZone: "UTC" }).format(
        new Date(Date.UTC(2023, 0, 1 + ((6 + index) % 7))),
      ),
    );
    expect(labels).toEqual(expected);
    expect(header).toContain("font-size:12px");
    expect(header).toContain("text-align:center");
    expect(header).toContain("white-space:nowrap");
    expect(weekdayLabel("en", 6, 0)).toBe("Sat");
    expect(weekdayLabel("en", 6, 6)).toBe("Fri");
  });

  it("renders exactly three outlined 16px tier swatches and their i18n labels", () => {
    const html = render("2026-11-19", 6);
    const legend = html.match(/<div data-hm-legend="true"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
    expect(legend.match(/data-hm-tier-swatch/g)).toHaveLength(3);
    const swatches = legend.match(/<span data-hm-tier-swatch[^>]*>/g) ?? [];
    for (const swatch of swatches) {
      expect(swatch).toContain("width:16px");
      expect(swatch).toContain("height:16px");
      expect(swatch).toContain("border-radius:8px");
      expect(swatch).toContain("var(--hm-outline)");
    }
    expect(legend).toContain(dictionaries.ar.heatmap.legendEmpty);
    expect(legend).toContain(dictionaries.ar.heatmap.legendLight);
    expect(legend).toContain(dictionaries.ar.heatmap.legendSolid);
    expect(legend).toContain(dictionaries.ar.heatmap.today);
    expect(legend).not.toContain(dictionaries.en.heatmap.legendLight);
  });

  it("keeps the LTR calendar below a header select with a 44px minimum target", () => {
    const html = render("2026-11-19", 6);
    expect(html).toContain('<div data-hm-root="true" dir="ltr">');
    expect(html.indexOf('id="hm-month"')).toBeLessThan(html.indexOf('data-hm-root="true"'));
    expect(html).toContain("min-h-11");
    expect(html).toContain(`aria-label="${dictionaries.ar.heatmap.monthDropdown}"`);
    expect(html).toContain('value="2026-11" selected=""');
  });

  it("keeps month labels stable in a UTC+ timezone", () => {
    const previous = process.env["TZ"];
    process.env["TZ"] = "Africa/Cairo";
    try {
      const html = render("2026-11-20", 6);
      const expected = new Intl.DateTimeFormat("ar-EG", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(2026, 10, 1)));
      expect(html).toContain(`value="2026-11" selected="">${expected}<`);
    } finally {
      process.env["TZ"] = previous;
    }
  });
});
