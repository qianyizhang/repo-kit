import { test, expect } from "@playwright/test";
test("standalone domain operations, copy and diagnostics work without a host", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4397");
  await page.locator("#note").selectOption("welcome");
  await expect(page.locator("#note-body")).toContainText(
    "A small selected note",
  );
  await page.locator("#draft").fill("hi");
  await expect(page.locator("#send")).toBeDisabled();
  await page.locator("#prepare").click();
  await expect(page.locator("#copy-text")).toContainText("hi");
  await page.getByRole("button", { name: "App info", exact: true }).click();
  await expect(page.locator("#metadata-json")).toContainText("standalone");
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await expect(page.locator("#tools h3")).toHaveCount(8);
  await page.getByRole("button", { name: "Interactions", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save diagnostic capture", exact: true }),
  ).toBeDisabled();
  await page.locator("#event-list button").last().click();
  await page
    .getByRole("button", { name: "Save diagnostic capture", exact: true })
    .click();
  await expect(page.locator("#capture-status")).toContainText("Saved");
});
test("failed event inspection cannot capture the previously selected interaction", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4397");
  await page.getByRole("button", { name: "App info", exact: true }).click();
  await page.getByRole("button", { name: "Interactions", exact: true }).click();
  await page.locator("#event-list button").first().click();
  await expect(page.locator("#save-capture")).toBeEnabled();
  await page.locator("#refresh-events").click();
  await page.route("**/api/logs_event", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        isError: true,
        content: [{ type: "text", text: "Expired diagnostic fixture" }],
      }),
    }),
  );
  await page
    .locator("#event-list button")
    .filter({ hasText: /^server/ })
    .first()
    .click();
  await expect(page.locator("#payload")).toContainText(
    "Expired diagnostic fixture",
  );
  await expect(page.locator("#save-capture")).toBeDisabled();
});

test("host receives exact plain text without evidence reads; inspector matches", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4398");
  const app = page.frameLocator("iframe");
  await app.locator("#draft").fill(" hi ");
  await app.locator("#send").click();
  await expect(app.locator("#delivery")).toContainText("Accepted by host");
  const messages = JSON.parse((await page.locator("#messages").textContent())!);
  expect(messages).toEqual([
    { role: "user", content: [{ type: "text", text: " hi " }] },
  ]);
  expect(
    JSON.parse((await page.locator("#calls").textContent())!),
  ).not.toContain("note_read");
  await app.locator("#inspect-send").click();
  await app.locator("#event-list button").first().click();
  const event = JSON.parse((await app.locator("#payload").textContent())!);
  expect(JSON.parse(event.payload.text)).toEqual(messages[0]);
  expect(
    JSON.parse((await page.locator("#calls").textContent())!),
  ).not.toContain("logs_capture");
  await app
    .getByRole("button", { name: "Save diagnostic capture", exact: true })
    .click();
  await expect(app.locator("#capture-status")).toContainText("Saved");
  expect(JSON.parse((await page.locator("#calls").textContent())!)).toContain(
    "logs_capture",
  );
});
test("pending acknowledgment preserves a newer draft and blocks repeated clicks", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4398");
  const app = page.frameLocator("iframe");
  await page.locator("#mode").selectOption("slow");
  await app.locator("#draft").fill("first");
  await app.locator("#send").click();
  await expect(app.locator("#send")).toBeDisabled();
  await app.locator("#draft").fill("newer");
  await expect(app.locator("#delivery")).toContainText("Accepted by host");
  await expect(app.locator("#draft")).toHaveValue("newer");
  expect(
    JSON.parse((await page.locator("#messages").textContent())!),
  ).toHaveLength(1);
});
test("selected context is explicit and unrelated notes stay absent", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4398");
  const app = page.frameLocator("iframe");
  await app.locator("#note").selectOption("welcome");
  await expect(app.locator("#note-body")).toContainText(
    "A small selected note",
  );
  await app.locator("#attach").check();
  await app.locator("#draft").fill("Explain this");
  await app.locator("#send").click();
  await expect(page.locator("#messages")).toContainText("Selected context");
  await expect(page.locator("#messages")).not.toContainText("unrelated note");
});
for (const mode of ["reject", "timeout"])
  test(`${mode} retains the draft without retry`, async ({ page }) => {
    await page.goto("http://127.0.0.1:4398");
    const app = page.frameLocator("iframe");
    await page.locator("#mode").selectOption(mode);
    await app.locator("#draft").fill("keep");
    await app.locator("#send").click();
    await expect(app.locator("#delivery")).toContainText(
      mode === "reject" ? "rejected" : "uncertain",
    );
    await expect(app.locator("#draft")).toHaveValue("keep");
    expect(
      JSON.parse((await page.locator("#messages").textContent())!),
    ).toHaveLength(1);
  });
test("missing message capability, narrow dark layout and local teardown are explicit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 950 });
  await page.goto("http://127.0.0.1:4398/?limited");
  const app = page.frameLocator("iframe");
  await app.locator("#draft").fill("hi");
  await expect(app.locator("#send")).toBeDisabled();
  await expect(app.locator("#delivery")).toContainText("unavailable");
  await page.locator("#theme").click();
  await expect(app.locator("html")).toHaveAttribute("data-theme", "dark");
  await app.getByRole("button", { name: "App info", exact: true }).click();
  await app
    .getByRole("button", { name: "Conversation flow", exact: true })
    .click();
  await expect(app.locator("#fixtures")).toContainText("Plain greeting");
  await page.screenshot({
    path: "test-results/mcp-info-narrow.png",
    fullPage: true,
  });
  await app.locator("#close-info").click();
  await page.locator("#teardown").click();
  await expect(app.locator("#connection")).toContainText("not cancelled");
});
