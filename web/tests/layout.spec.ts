import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const WIDTHS = [320, 360, 375, 393, 412, 768];
const TABS = ["words", "decks", "dashboard"] as const;

test.beforeAll(() => {
  const dir = path.join(process.cwd(), "test-results");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

for (const width of WIDTHS) {
  for (const tab of TABS) {
    test(`Layout at ${width}px — ${tab}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 852 });
      await page.goto(`/dev-layout-test?tab=${tab}`);
      await page.waitForLoadState("networkidle");

      // 1. Assert no horizontal page-level scroll
      const noHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth <= window.innerWidth;
      });
      expect(noHorizontalScroll, `Horizontal page scroll detected at ${width}px on ${tab}`).toBe(true);

      // 2. Assert computed font-size >= 13px and bounding height >= 40px on every visible tappable control
      const tappables = await page.evaluate(() => {
        const elements = Array.from(
          document.querySelectorAll<HTMLElement>("[role=radio], [role=tab], nav a, button")
        );
        return elements
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden"
            );
          })
          .map((el) => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return {
              tag: el.tagName,
              text: el.innerText.trim().slice(0, 25),
              role: el.getAttribute("role"),
              fontSize: parseFloat(style.fontSize),
              height: rect.height,
            };
          });
      });

      for (const ctrl of tappables) {
        expect(
          ctrl.fontSize,
          `Control <${ctrl.tag}> "${ctrl.text}" font-size (${ctrl.fontSize}px) is below 13px`
        ).toBeGreaterThanOrEqual(13);

        expect(
          ctrl.height,
          `Control <${ctrl.tag}> "${ctrl.text}" height (${ctrl.height}px) is below 40px`
        ).toBeGreaterThanOrEqual(40);
      }

      // 3. Assert inside each group, neighbouring items have a gap >= 2px and never overlap
      const groupChecks = await page.evaluate(() => {
        const groups = Array.from(
          document.querySelectorAll<HTMLElement>(
            "[role=radiogroup], nav div.apple-segmented-container, [role=tablist]"
          )
        );
        const results: {
          name: string;
          gapOk: boolean;
          overlap: boolean;
          gap: number;
          item1: string;
          item2: string;
        }[] = [];

        for (const g of groups) {
          const items = Array.from(g.children).filter(
            (ch) =>
              ch instanceof HTMLElement &&
              window.getComputedStyle(ch).display !== "none" &&
              ch.getBoundingClientRect().width > 0
          ) as HTMLElement[];

          for (let i = 0; i < items.length - 1; i++) {
            const r1 = items[i].getBoundingClientRect();
            const r2 = items[i + 1].getBoundingClientRect();

            // Detect 2D bounding-box intersection
            const horizontalOverlap = !(r1.right <= r2.left || r2.right <= r1.left);
            const verticalOverlap = !(r1.bottom <= r2.top || r2.bottom <= r1.top);
            const overlap = horizontalOverlap && verticalOverlap;

            const gap = Math.min(
              Math.abs(r2.left - r1.right),
              Math.abs(r1.left - r2.right)
            );

            results.push({
              name: g.getAttribute("aria-label") || g.className,
              gapOk: gap >= 1.5, // 2px with subpixel rendering
              overlap,
              gap,
              item1: items[i].innerText.trim().slice(0, 15),
              item2: items[i + 1].innerText.trim().slice(0, 15),
            });
          }
        }
        return results;
      });

      for (const gc of groupChecks) {
        expect(
          gc.overlap,
          `Overlap between "${gc.item1}" and "${gc.item2}" in ${gc.name}`
        ).toBe(false);
        expect(
          gc.gapOk,
          `Gap (${gc.gap}px) < 2px between "${gc.item1}" and "${gc.item2}" in ${gc.name}`
        ).toBe(true);
      }

      // 4. Assert active nav item is fully inside visible area of nav container
      const navVisibility = await page.evaluate(() => {
        const nav = document.querySelector<HTMLElement>('nav[aria-label="Main Navigation"]');
        if (!nav) return { ok: false, reason: "Nav container not found" };
        const activeLink = nav.querySelector<HTMLElement>('a[data-active="true"]');
        if (!activeLink) return { ok: false, reason: "Active nav link not found" };

        const navRect = nav.getBoundingClientRect();
        const linkRect = activeLink.getBoundingClientRect();

        const insideLeft = linkRect.left >= navRect.left - 1.5;
        const insideRight = linkRect.right <= navRect.right + 1.5;

        return {
          ok: insideLeft && insideRight,
          navLeft: navRect.left,
          navRight: navRect.right,
          linkLeft: linkRect.left,
          linkRight: linkRect.right,
          text: activeLink.innerText.trim(),
        };
      });

      expect(
        navVisibility.ok,
        `Active nav link "${navVisibility.text}" is not fully visible in nav: Link [${navVisibility.linkLeft}, ${navVisibility.linkRight}] vs Nav [${navVisibility.navLeft}, ${navVisibility.navRight}]`
      ).toBe(true);

      // Save screenshot
      await page.screenshot({
        path: `test-results/${tab}-${width}.png`,
        fullPage: true,
      });
    });
  }

  // RTL Test at each width
  test(`Layout RTL at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 852 });
    await page.goto(`/dev-layout-test?tab=words`);
    await page.evaluate(() => {
      document.documentElement.setAttribute("dir", "rtl");
    });
    await page.waitForTimeout(100);

    const noHorizontalScrollRTL = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(noHorizontalScrollRTL, `Horizontal scroll in RTL at ${width}px`).toBe(true);

    await page.screenshot({
      path: `test-results/words-${width}-rtl.png`,
      fullPage: true,
    });
  });
}
