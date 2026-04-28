const auth0Domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN;

module.exports = {
  expo: {
    name: "Punch",
    slug: "punch-mobile",
    version: "0.0.1",
    orientation: "portrait",
    scheme: "punch",
    userInterfaceStyle: "automatic",
    splash: {
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.kevin.punch",
    },
    android: {
      package: "com.kevin.punch",
    },
    web: {
      bundler: "metro",
    },
    plugins: [
      [
        "react-native-auth0",
        {
          domain: auth0Domain,
          customScheme: "punch",
        },
      ],
    ],
  },
};
