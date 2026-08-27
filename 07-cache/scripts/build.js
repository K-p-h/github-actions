const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");
fs.mkdirSync(distDir, { recursive: true });

const source = path.join(__dirname, "..", "src", "calculator.js");
const target = path.join(distDir, "calculator.js");
fs.copyFileSync(source, target);

console.log("Build complete: dist/calculator.js created");