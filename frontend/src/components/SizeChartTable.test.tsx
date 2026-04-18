import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as fc from "fast-check";
import { SizeChartTable } from "./SizeChartTable";
import type { SizeChart, StandardSize } from "../types";

const ALL_SIZES: StandardSize[] = ["XS", "S", "M", "L", "XL", "XXL", "AllSize"];

function makeEntry(bust: string, waist: string, hip: string) {
  return { bust, waist, hip };
}

const sampleSizeChart: SizeChart = {
  XS: makeEntry("76–80", "60–64", "84–88"),
  S: makeEntry("81–85", "65–69", "89–93"),
  M: makeEntry("86–90", "70–74", "94–98"),
  L: makeEntry("91–95", "75–79", "99–103"),
  XL: makeEntry("96–100", "80–84", "104–108"),
  XXL: makeEntry("101–106", "85–90", "109–114"),
  AllSize: makeEntry("86–95", "70–79", "94–103"),
};

describe("SizeChartTable — unit tests", () => {
  it("renders a table with the correct column headers", () => {
    const html = renderToStaticMarkup(
      <SizeChartTable sizeChart={sampleSizeChart} availableSizes={["S", "M"]} />
    );
    expect(html).toContain("Ukuran");
    expect(html).toContain("Dada (cm)");
    expect(html).toContain("Pinggang (cm)");
    expect(html).toContain("Pinggul (cm)");
  });

  it("only renders rows for sizes in availableSizes", () => {
    const html = renderToStaticMarkup(
      <SizeChartTable sizeChart={sampleSizeChart} availableSizes={["S", "M"]} />
    );
    expect(html).toContain("S");
    expect(html).toContain("M");
    expect(html).not.toContain(">XS<");
    expect(html).not.toContain(">L<");
  });

  it("displays measurement ranges from sizeChart for standard sizes", () => {
    const html = renderToStaticMarkup(
      <SizeChartTable sizeChart={sampleSizeChart} availableSizes={["M"]} />
    );
    expect(html).toContain("86–90"); // bust
    expect(html).toContain("70–74"); // waist
    expect(html).toContain("94–98"); // hip
  });

  it("displays AllSize measurement ranges in the table row", () => {
    const html = renderToStaticMarkup(
      <SizeChartTable sizeChart={sampleSizeChart} availableSizes={["AllSize"]} />
    );
    expect(html).toContain("86–95"); // bust
    expect(html).toContain("70–79"); // waist
    expect(html).toContain("94–103"); // hip
  });

  it("shows descriptive note below table when AllSize is in availableSizes", () => {
    const html = renderToStaticMarkup(
      <SizeChartTable sizeChart={sampleSizeChart} availableSizes={["AllSize"]} />
    );
    expect(html).toContain("AllSize dirancang untuk berbagai tipe tubuh, setara dengan ukuran M atau L.");
  });

  it("does NOT show AllSize note when AllSize is not in availableSizes", () => {
    const html = renderToStaticMarkup(
      <SizeChartTable sizeChart={sampleSizeChart} availableSizes={["S", "M", "L"]} />
    );
    expect(html).not.toContain("AllSize dirancang");
  });

  it("shows AllSize note when mixed sizes include AllSize", () => {
    // Edge case: AllSize alongside other sizes
    const html = renderToStaticMarkup(
      <SizeChartTable sizeChart={sampleSizeChart} availableSizes={["M", "AllSize"]} />
    );
    expect(html).toContain("AllSize dirancang untuk berbagai tipe tubuh, setara dengan ukuran M atau L.");
  });

  it("renders fallback '—' when sizeChart entry is missing", () => {
    const html = renderToStaticMarkup(
      <SizeChartTable sizeChart={{}} availableSizes={["S"]} />
    );
    // Should render three fallback dashes for bust, waist, hip
    expect(html.match(/—/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("renders all seven standard sizes when all are in availableSizes", () => {
    const html = renderToStaticMarkup(
      <SizeChartTable sizeChart={sampleSizeChart} availableSizes={ALL_SIZES} />
    );
    for (const size of ALL_SIZES) {
      expect(html).toContain(size);
    }
    expect(html).toContain("AllSize dirancang untuk berbagai tipe tubuh, setara dengan ukuran M atau L.");
  });
});

/**
 * Property-based tests
 * Validates: Requirements 2.3
 */
describe("SizeChartTable — property tests", () => {
  const standardSizeArb = fc.constantFrom<StandardSize>(
    "XS", "S", "M", "L", "XL", "XXL", "AllSize"
  );

  const measurementArb = fc.tuple(
    fc.nat({ max: 50 }).map((n) => `${70 + n}–${75 + n}`),
    fc.nat({ max: 50 }).map((n) => `${55 + n}–${60 + n}`),
    fc.nat({ max: 50 }).map((n) => `${80 + n}–${85 + n}`)
  );

  const sizeChartArb = fc
    .uniqueArray(standardSizeArb, { minLength: 1, maxLength: 7 })
    .chain((sizes) =>
      fc
        .tuple(...sizes.map(() => measurementArb))
        .map((entries) => {
          const chart: SizeChart = {};
          sizes.forEach((size, i) => {
            chart[size] = { bust: entries[i][0], waist: entries[i][1], hip: entries[i][2] };
          });
          return { sizes: sizes as StandardSize[], chart };
        })
    );

  it("only rows for availableSizes appear in the rendered output", () => {
    fc.assert(
      fc.property(sizeChartArb, ({ sizes, chart }) => {
        const html = renderToStaticMarkup(
          <SizeChartTable sizeChart={chart} availableSizes={sizes} />
        );
        // Every available size label appears
        for (const size of sizes) {
          expect(html).toContain(`>${size}<`);
        }
        // Sizes NOT in availableSizes do not appear as row labels
        const absent = ALL_SIZES.filter((s) => !sizes.includes(s));
        for (const size of absent) {
          expect(html).not.toContain(`>${size}<`);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("measurement values from sizeChart appear in the rendered table", () => {
    fc.assert(
      fc.property(sizeChartArb, ({ sizes, chart }) => {
        const html = renderToStaticMarkup(
          <SizeChartTable sizeChart={chart} availableSizes={sizes} />
        );
        for (const size of sizes) {
          const entry = chart[size];
          expect(html).toContain(entry.bust);
          expect(html).toContain(entry.waist);
          expect(html).toContain(entry.hip);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("AllSize descriptive note appears iff AllSize is in availableSizes", () => {
    fc.assert(
      fc.property(sizeChartArb, ({ sizes, chart }) => {
        const html = renderToStaticMarkup(
          <SizeChartTable sizeChart={chart} availableSizes={sizes} />
        );
        const hasAllSize = sizes.includes("AllSize");
        if (hasAllSize) {
          expect(html).toContain(
            "AllSize dirancang untuk berbagai tipe tubuh, setara dengan ukuran M atau L."
          );
        } else {
          expect(html).not.toContain("AllSize dirancang");
        }
      }),
      { numRuns: 100 }
    );
  });
});
