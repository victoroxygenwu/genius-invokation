/**
 * 图片资源构建脚本
 *
 * 功能：
 * 1. 从 API 下载所有卡牌/角色图片，转为 webp
 * 2. 压缩事件图片（10240×5760 → 1920×1080，JPEG → webp）
 * 3. 输出到 dist-resources/ 目录，供 Tauri 打包使用
 *
 * 用法：gnx scripts/bundle-images.ts
 */

import sharp from "sharp";
import { readdir, stat, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";

// ============================================================
// 配置
// ============================================================

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

const API_ENDPOINT = "https://static-data.piovium.org/api/v4";
const OUTPUT_DIR = join(PROJECT_ROOT, "dist-resources");
const CARDS_DIR = join(OUTPUT_DIR, "images", "cards");
const EVENTS_DIR = join(OUTPUT_DIR, "events");
const EVENTS_SOURCE_DIR = join(PROJECT_ROOT, "public", "events");

const CONCURRENCY = 16;
const WEBP_QUALITY = 80;
const EVENT_TARGET_WIDTH = 1920;

// ============================================================
// 工具函数
// ============================================================

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function pLimit(concurrency: number) {
  const active: Promise<void>[] = [];
  return async (fn: () => Promise<void>) => {
    while (active.length >= concurrency) {
      await Promise.race(active);
    }
    const p = fn().then(() => {
      active.splice(active.indexOf(p), 1);
    });
    active.push(p);
  };
}

// ============================================================
// 卡牌图片下载
// ============================================================

async function downloadCardImage(id: number, outputDir: string): Promise<boolean> {
  const outputPath = join(outputDir, `${id}.webp`);

  // 跳过已存在的文件
  if (await fileExists(outputPath)) {
    return false; // skipped
  }

  try {
    const url = `${API_ENDPOINT}/image/${id}?thumbnail=false&type=cardFace`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`  ⚠ 下载失败: ${id} (HTTP ${res.status})`);
      return false;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    await sharp(buffer)
      .webp({ quality: WEBP_QUALITY })
      .toFile(outputPath);

    return true; // downloaded
  } catch (e) {
    console.warn(`  ⚠ 处理失败: ${id}`, e instanceof Error ? e.message : e);
    return false;
  }
}

async function downloadAllCardImages(ids: number[]): Promise<void> {
  console.log(`\n📦 下载卡牌图片 (${ids.length} 张)...`);
  await ensureDir(CARDS_DIR);

  const limit = await pLimit(CONCURRENCY);
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let completed = 0;

  const tasks = ids.map((id) =>
    limit(async () => {
      const result = await downloadCardImage(id, CARDS_DIR);
      if (result === true) downloaded++;
      else if (result === false) skipped++;

      completed++;
      if (completed % 50 === 0 || completed === ids.length) {
        console.log(`  进度: ${completed}/${ids.length}`);
      }
    })
  );

  await Promise.all(tasks);

  console.log(`  ✅ 完成: ${downloaded} 下载, ${skipped} 跳过, ${failed} 失败`);
}

// ============================================================
// 事件图片压缩
// ============================================================

async function compressEventImage(filename: string): Promise<boolean> {
  const inputPath = join(EVENTS_SOURCE_DIR, filename);
  const outputName = filename.replace(/\.jpg$/i, ".webp");
  const outputPath = join(EVENTS_DIR, outputName);

  // 跳过已存在的文件
  if (await fileExists(outputPath)) {
    return false; // skipped
  }

  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // 只在宽度大于目标时缩放
    if ((metadata.width ?? 0) > EVENT_TARGET_WIDTH) {
      await image
        .resize({ width: EVENT_TARGET_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(outputPath);
    } else {
      await image
        .webp({ quality: WEBP_QUALITY })
        .toFile(outputPath);
    }

    return true; // compressed
  } catch (e) {
    console.warn(`  ⚠ 压缩失败: ${filename}`, e instanceof Error ? e.message : e);
    return false;
  }
}

async function compressAllEventImages(): Promise<void> {
  console.log(`\n🖼️ 压缩事件图片...`);
  await ensureDir(EVENTS_DIR);

  // 读取事件图片目录
  let files: string[];
  try {
    files = (await readdir(EVENTS_SOURCE_DIR)).filter((f) => f.endsWith(".jpg"));
  } catch {
    console.warn(`  ⚠ 事件图片目录不存在: ${EVENTS_SOURCE_DIR}`);
    return;
  }

  if (files.length === 0) {
    console.log(`  ℹ 没有找到事件图片`);
    return;
  }

  let compressed = 0;
  let skipped = 0;

  for (const file of files) {
    const result = await compressEventImage(file);
    if (result) compressed++;
    else skipped++;
  }

  console.log(`  ✅ 完成: ${compressed} 压缩, ${skipped} 跳过`);
}

// ============================================================
// 主流程
// ============================================================

async function getCardIds(): Promise<number[]> {
  // 从 assets-manager 的静态数据获取 ID
  const { default: charactersData } = await import("@gi-tcg/assets-manager/data/CHS/characters");
  const { default: actionCardsData } = await import("@gi-tcg/assets-manager/data/CHS/action_cards");

  const ids: number[] = [];

  // 角色（包括敌人）
  for (const char of charactersData as any[]) {
    ids.push(char.id);
  }

  // 行动牌（天赋牌 + 普通行动牌，id >= 200000）
  for (const card of actionCardsData as any[]) {
    if (card.id >= 200000) {
      ids.push(card.id);
    }
  }

  return [...new Set(ids)]; // 去重
}

async function main(): Promise<void> {
  console.log("🎮 七圣召唤 - 图片资源构建");
  console.log("=" .repeat(40));

  // 获取所有需要图片的 ID
  const cardIds = await getCardIds();
  console.log(`\n📊 统计:`);
  console.log(`  卡牌/角色: ${cardIds.length} 张`);

  // 下载卡牌图片
  await downloadAllCardImages(cardIds);

  // 压缩事件图片
  await compressAllEventImages();

  // 输出统计
  console.log("\n" + "=".repeat(40));
  console.log("✨ 构建完成!");
  console.log(`📁 输出目录: ${OUTPUT_DIR}`);
}

main().catch((e) => {
  console.error("❌ 构建失败:", e);
  process.exit(1);
});
