const fs = require("fs");
const path = require("path");
const https = require("https");

const FONT_URL =
  "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf";
const DEST = path.join(__dirname, "..", "assets", "fonts", "NotoSansKR-Regular.otf");

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirect = response.headers.location;
          if (!redirect) {
            reject(new Error("Font redirect without location"));
            return;
          }
          download(redirect, dest).then(resolve).catch(reject);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Font download failed: HTTP ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      })
      .on("error", reject);
  });
}

async function main() {
  if (fs.existsSync(DEST)) return;
  fs.mkdirSync(path.dirname(DEST), { recursive: true });
  await download(FONT_URL, DEST);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
