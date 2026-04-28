import "./src/global.css";

import { StatusBar } from "expo-status-bar";
import { SafeAreaView, Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <View className="flex-1 justify-center px-6">
        <View className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <Text className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Expo + NativeWind
          </Text>
          <Text className="mt-3 text-4xl font-bold text-white">
            Punch Mobile
          </Text>
          <Text className="mt-4 text-base leading-7 text-slate-300">
            This app is scaffolded inside the pnpm workspace and consumes the
            shared Tailwind and TypeScript config packages.
          </Text>
          <View className="mt-6 rounded-2xl bg-blue-500 px-4 py-3">
            <Text className="text-center font-semibold text-white">
              Ready for screens
            </Text>
          </View>
        </View>
      </View>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}
