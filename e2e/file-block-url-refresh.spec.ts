import { expect, test } from "@playwright/test";

import { STUB_API_URL, stubApi } from "./fixtures/stub-api";

// Actual archive edit route; API and time are mocked, no real file/server data.
for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`FRT-240 file URL refresh and recovery ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    page.on("pageerror", error => { throw error; });
    await stubApi(page, { authed: true, scenario: "data" });
    await page.route(`${STUB_API_URL}/experiences/frt240`, async route => {
      await route.fulfill({ json: { status: "success", message: "ok", data: {
        id: "frt240", user_id: "e2e", type: "club", importance: null,
        content: {
          schema_version: 2, template_version: 9,
          title: "첨부 링크 갱신 확인", summary: "FRT-240 API mock", status: "draft", tags: [], fields: {},
          custom: [{ entryType: "field", key: "custom.frt240", type: "file", label: "검토용 첨부", value: {
            type: "file", description: "", evidenceType: "", fileId: "frt240-file", fileName: "검토용 문서.txt", mimeType: "text/plain", size: 1024,
            url: "https://files.example/stale",
          } }],
        }, created_at: "2026-10-25T00:00:00Z", updated_at: "2026-10-25T00:00:00Z",
      } } });
    });
    let requests = 0;
    let fail = false;
    await page.route(`${STUB_API_URL}/files/frt240-file/download`, async route => {
      requests += 1;
      await route.fulfill(fail
        ? { status: 503, json: { status: "error", error: { message: "temporarily unavailable" } } }
        : { json: { status: "success", message: "ok", data: `https://files.example/link-${requests}` } });
    });
    await page.clock.install();
    await page.goto("/archive/frt240/edit");
    const download = page.getByRole("link", { name: "검토용 문서.txt 다운로드", exact: true });
    await expect(download).toHaveAttribute("href", /https:\/\/files.example\/link-\d+/);
    const initialRequests = requests;
    await download.scrollIntoViewIfNeeded();
    await page.getByRole("group", { name: "검토용 첨부", exact: true }).screenshot({ path: testInfo.outputPath("success.jpg"), type: "jpeg", quality: 70 });
    await page.clock.fastForward(300_000);
    await expect(download).toHaveAttribute("href", `https://files.example/link-${initialRequests + 1}`);
    fail = true;
    await page.clock.fastForward(300_000);
    const retry = page.getByRole("button", { name: "다운로드 링크 다시 시도" });
    await expect(retry).toBeVisible();
    await expect(download).toHaveCount(0);
    await page.getByRole("group", { name: "검토용 첨부", exact: true }).screenshot({ path: testInfo.outputPath("failure.jpg"), type: "jpeg", quality: 70 });
    const failedCount = requests;
    await page.clock.fastForward(600_000);
    expect(requests).toBe(failedCount);
    fail = false;
    await retry.click();
    await expect(download).toHaveAttribute("href", `https://files.example/link-${failedCount + 1}`);
    await expect(retry).toHaveCount(0);
    await expect(page.getByText("검토용 문서.txt", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("group", { name: "검토용 첨부", exact: true }).screenshot({ path: testInfo.outputPath("recovered.jpg"), type: "jpeg", quality: 70 });
  });
}

test("FRT-240 audio preview selects renewed native resource", async ({ page }) => {
  await stubApi(page, { authed: true, scenario: "data" });
  await page.route(`${STUB_API_URL}/experiences/frt240-audio`, async route => {
    await route.fulfill({ json: { status: "success", message: "ok", data: {
      id: "frt240-audio", user_id: "e2e", type: "club", importance: null,
      content: { schema_version: 2, template_version: 9, title: "오디오 갱신", summary: "mock", status: "draft", tags: [], fields: {},
        custom: [{ entryType: "field", key: "custom.audio", type: "file", label: "오디오 첨부", value: {
          type: "file", description: "", evidenceType: "", fileId: "audio-file", fileName: "sample.wav", mimeType: "audio/wav", size: 204,
        } }],
      }, created_at: "2026-10-25T00:00:00Z", updated_at: "2026-10-25T00:00:00Z",
    } } });
  });
  let requests = 0;
  await page.route(`${STUB_API_URL}/files/audio-file/download`, async route => {
    requests += 1;
    await route.fulfill({ json: { status: "success", message: "ok", data: `https://files.example/audio-${requests}.wav` } });
  });
  // Synthetic silence, no user file data. Valid PCM header allows native resource selection.
  const wav = Buffer.alloc(204);
  wav.write("RIFF", 0); wav.writeUInt32LE(196, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(160, 40);
  await page.route("https://files.example/audio-*.wav", route => route.fulfill({ contentType: "audio/wav", body: wav }));
  await page.clock.install();
  await page.goto("/archive/frt240-audio/edit");
  const audio = page.locator("audio");
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentSrc)).toMatch(/audio-\d+\.wav/);
  const firstSrc = await audio.evaluate((el: HTMLAudioElement) => el.currentSrc);
  await page.clock.fastForward(300_000);
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentSrc)).not.toBe(firstSrc);
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.readyState)).toBeGreaterThanOrEqual(1);
});
