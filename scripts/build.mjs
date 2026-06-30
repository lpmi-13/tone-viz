import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { brotliCompress, constants as zlibConstants, gzip } from "node:zlib";

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildAssetsDir = path.join(root, ".build", "assets");
const distDir = path.join(root, "dist");
const distAssetsDir = path.join(distDir, "assets");
const sourceHtmlPath = path.join(root, "src", "index.html");
const sourceCssPath = path.join(root, "src", "styles.css");
const audioDir = path.join(root, "audio");

async function main() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distAssetsDir, { recursive: true });

  await copyDirectory(buildAssetsDir, distAssetsDir);
  await fs.copyFile(sourceCssPath, path.join(distAssetsDir, "styles.css"));
  await copyAudioAssets();

  const [scriptIntegrity, styleIntegrity] = await Promise.all([
    getIntegrity(path.join(distAssetsDir, "app.js")),
    getIntegrity(path.join(distAssetsDir, "styles.css"))
  ]);

  const csp = [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    `script-src 'self' '${scriptIntegrity.cspHash}'`,
    `style-src 'self' '${styleIntegrity.cspHash}'`,
    "img-src 'self' data:",
    "font-src 'self'",
    "media-src 'self' blob:",
    "connect-src 'none'"
  ].join("; ");

  const html = await fs.readFile(sourceHtmlPath, "utf8");
  const builtHtml = html
    .replace("<!-- build:csp -->", `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">`)
    .replace('href="./assets/styles.css"', `href="./assets/styles.css" integrity="${styleIntegrity.sri}"`)
    .replace('src="./assets/app.js"', `src="./assets/app.js" integrity="${scriptIntegrity.sri}"`);
  await fs.writeFile(path.join(distDir, "index.html"), builtHtml);

  const compressibleAssets = await findFiles(distAssetsDir, (filePath) => /\.(?:js|css)$/.test(filePath));
  await Promise.all(compressibleAssets.flatMap((filePath) => [writeGzip(filePath), writeBrotli(filePath)]));
}

async function copyAudioAssets() {
  try {
    await fs.access(audioDir);
  } catch {
    return;
  }

  await copyDirectory(audioDir, path.join(distDir, "audio"));
}

async function copyDirectory(from, to) {
  await fs.mkdir(to, { recursive: true });
  const entries = await fs.readdir(from, { withFileTypes: true });

  for (const entry of entries) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(source, target);
    } else if (entry.isFile()) {
      await fs.copyFile(source, target);
    }
  }
}

async function findFiles(directory, predicate) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return findFiles(filePath, predicate);
    }
    return entry.isFile() && predicate(filePath) ? [filePath] : [];
  }));

  return files.flat();
}

async function getIntegrity(filePath) {
  const content = await fs.readFile(filePath);
  const digest = createHash("sha256").update(content).digest("base64");
  return {
    sri: `sha256-${digest}`,
    cspHash: `sha256-${digest}`
  };
}

async function writeGzip(filePath) {
  const content = await fs.readFile(filePath);
  const compressed = await gzipAsync(content, { level: 9 });
  await fs.writeFile(`${filePath}.gz`, compressed);
}

async function writeBrotli(filePath) {
  const content = await fs.readFile(filePath);
  const compressed = await brotliAsync(content, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 11
    }
  });
  await fs.writeFile(`${filePath}.br`, compressed);
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
