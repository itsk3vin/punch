const sharedConfig = require("@repo/tailwind-config");
const nativewindPreset = require("nativewind/preset");

/** @type {import("tailwindcss").Config} */
module.exports = {
  presets: [nativewindPreset, sharedConfig],
  content: ["./App.tsx", "./src/**/*.{ts,tsx}"],
};
