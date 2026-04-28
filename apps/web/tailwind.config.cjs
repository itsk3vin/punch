const sharedConfig = require("@repo/tailwind-config");

/** @type {import("tailwindcss").Config} */
module.exports = {
  presets: [sharedConfig],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
};
