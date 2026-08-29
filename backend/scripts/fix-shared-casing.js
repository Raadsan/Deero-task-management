import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.join(__dirname, "../../frontend");

function replaceInDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next") {
        replaceInDir(fullPath);
      }
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      let content = fs.readFileSync(fullPath, "utf-8");
      if (content.includes("@/components/shared/")) {
        content = content.replace(/@\/components\/shared\//g, "@/components/Shared/");
        fs.writeFileSync(fullPath, content, "utf-8");
        console.log("Updated:", fullPath);
      }
    }
  }
}

replaceInDir(frontendDir);
console.log("All imports updated to canonical @/components/Shared/!");
