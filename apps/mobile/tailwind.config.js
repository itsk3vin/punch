const sharedConfig = require("@repo/tailwind-config");

/** @type {import("tailwindcss").Config} */
module.exports = {
  presets: [sharedConfig],
  content: ["./App.tsx", "./src/**/*.{ts,tsx}"],
};
