import { expect, test, type Page } from "@playwright/test";

type Win = Window & { cls: number; marker?: number };

const collectErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
};

test("una página de nudo bakea, reproduce, avanza por pasos y se puede recorrer", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("/nudos/nudo-simple/");
  await expect(page.getByRole("heading", { name: "Nudo simple" })).toBeVisible();
  await expect(page.locator("[data-baked=true]")).toBeVisible({ timeout: 60_000 });

  // Movimiento reducido: el nudo espera al botón de reproducir.
  const play = page.getByRole("button", { name: "Reproducir" });
  await expect(play).toHaveAttribute("aria-pressed", "false");
  await play.click();
  await expect(page.getByRole("button", { name: "Pausar" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByRole("button", { name: /^Paso 4:/ }).click();
  await expect(page.getByLabel("Reproducción")).toContainText(
    "Tirá de las dos puntas para ajustar",
  );
  expect(errors).toEqual([]);
});

test.describe("sin JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("la página prerenderizada tiene todo el layout, el póster y las etiquetas para compartir", async ({
    page,
  }) => {
    await page.goto("/nudos/nudo-zeppelin/");
    await expect(page.getByRole("heading", { name: "Nudo Zeppelin" })).toBeVisible();
    await expect(page.getByLabel("Reproducción")).toContainText("1/7");
    await expect(page.getByRole("button", { name: /^Paso 7:/ })).toBeAttached();
    await expect(page.locator('img[src="/og/zeppelin.jpg"]').first()).toBeVisible();
    // Por lo menos los primeros nudos; un número exacto se rompería cada vez que se agrega uno.
    await expect.poll(() => page.locator("dialog a").count()).toBeGreaterThan(4);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /\/og\/zeppelin\.jpg$/,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/nudos\/nudo-zeppelin\/$/,
    );
  });
});

test("la carga no mueve el layout", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as Win).cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[])
        if (!e.hadRecentInput) (window as unknown as Win).cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/nudos/as-de-guia/");
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as unknown as Win).cls)).toBe(0);
});

test("el selector cambia de nudo sin recargar, y el historial funciona", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/nudos/nudo-simple/");
  await page.evaluate(() => ((window as unknown as Win).marker = 1));
  await page.getByRole("button", { name: "Todos los nudos" }).click();
  await page.getByRole("link", { name: /As de guía/ }).click();
  await expect(page).toHaveURL(/\/nudos\/as-de-guia\/$/);
  await expect(page.getByRole("heading", { name: "As de guía" })).toBeVisible();
  await expect(page).toHaveTitle(/As de guía/);
  expect(await page.evaluate(() => (window as unknown as Win).marker)).toBe(1);

  await page.goBack();
  await expect(page.getByRole("heading", { name: "Nudo simple" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("restablecer vista devuelve la cámara después de arrastrar", async ({ page }) => {
  await page.goto("/nudos/nudo-simple/");
  const reset = page.getByRole("button", { name: "Restablecer vista" });
  await expect(reset).toBeDisabled();
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.width / 2, box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.width / 2 + 160, box.height / 2 - 60, { steps: 4 });
  await page.mouse.up();
  await expect(reset).toBeEnabled();
  await reset.click();
  await expect(reset).toBeDisabled();
});

test("los links viejos con ?knot= redirigen y las páginas desconocidas dan 404", async ({
  page,
}) => {
  await page.goto("/?knot=zeppelin");
  await expect(page).toHaveURL(/\/nudos\/nudo-zeppelin\/$/);
  const response = await page.goto("/nudos/no-existe/");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /no está acá/ })).toBeVisible();
});

test("las URLs viejas en inglés redirigen a las nuevas en castellano", async ({ page }) => {
  const response = await page.goto("/knots/bowline/");
  expect(response?.request().redirectedFrom()?.url()).toMatch(/\/knots\/bowline\/$/);
  await expect(page).toHaveURL(/\/nudos\/as-de-guia\/$/);
  await expect(page.getByRole("heading", { name: "As de guía" })).toBeVisible();
  await page.goto("/stargazers/");
  await expect(page).toHaveURL(/\/estrellas\/$/);
});
