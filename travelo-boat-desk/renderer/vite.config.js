import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from "node:fs";
import path from "node:path";

const rootPkgPath = path.resolve(__dirname, "..", "package.json");
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf-8"));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version),
  },
})
