/// <reference path="./src/env.d.ts" />

import "./src/global.css";

import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  Text,
  View,
} from "react-native";
import { Auth0Provider, useAuth0 } from "react-native-auth0";

const auth0Domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN;
const auth0ClientId = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID;
const auth0Audience = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE;
const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
const customScheme = "punch";

export default function App() {
  if (!auth0Domain || !auth0ClientId || !auth0Audience) {
    return (
      <SafeAreaView className="flex-1 bg-slate-950">
        <View className="flex-1 justify-center px-6">
          <View className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <Text className="text-2xl font-bold text-white">
              Auth0 is not configured
            </Text>
            <Text className="mt-4 text-base leading-7 text-slate-300">
              Set EXPO_PUBLIC_AUTH0_DOMAIN, EXPO_PUBLIC_AUTH0_CLIENT_ID, and
              EXPO_PUBLIC_AUTH0_AUDIENCE in apps/mobile/.env.
            </Text>
          </View>
        </View>
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  return (
    <Auth0Provider domain={auth0Domain} clientId={auth0ClientId}>
      <HomeScreen />
    </Auth0Provider>
  );
}

function HomeScreen() {
  const { authorize, clearSession, error, getCredentials, isLoading, user } =
    useAuth0();
  const [apiMessage, setApiMessage] = useState<string>();
  const [apiError, setApiError] = useState<string>();
  const [isCallingApi, setIsCallingApi] = useState(false);

  async function login() {
    await authorize(
      {
        audience: auth0Audience,
        scope: "openid profile email",
      },
      { customScheme },
    );
  }

  async function logout() {
    await clearSession({}, { customScheme });
    setApiMessage(undefined);
    setApiError(undefined);
  }

  async function callProtectedApi() {
    setIsCallingApi(true);
    setApiError(undefined);

    try {
      const credentials = await getCredentials();
      const response = await fetch(`${apiBaseUrl}/api/v1/private`, {
        headers: {
          Authorization: `Bearer ${credentials?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = (await response.json()) as {
        message?: string;
        subject?: string;
      };
      setApiMessage(`${data.message} Subject: ${data.subject ?? "unknown"}`);
    } catch (caughtError) {
      setApiError(
        caughtError instanceof Error ? caughtError.message : "API call failed",
      );
    } finally {
      setIsCallingApi(false);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-950">
        <ActivityIndicator />
        <StatusBar style="light" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <View className="flex-1 justify-center px-6">
        <View className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <Text className="text-sm font-semibold uppercase tracking-widest text-blue-400">
            Expo + Auth0
          </Text>
          <Text className="mt-3 text-4xl font-bold text-white">
            Punch Mobile
          </Text>
          <Text className="mt-4 text-base leading-7 text-slate-300">
            {user
              ? `Signed in as ${user.email ?? user.name ?? "your Auth0 user"}.`
              : "Sign in with Auth0 to call the protected Go API."}
          </Text>

          {user ? (
            <>
              <Pressable
                className="mt-6 rounded-2xl bg-blue-500 px-4 py-3"
                onPress={callProtectedApi}
                disabled={isCallingApi}
              >
                <Text className="text-center font-semibold text-white">
                  {isCallingApi ? "Calling API..." : "Call protected API"}
                </Text>
              </Pressable>
              <Pressable
                className="mt-3 rounded-2xl border border-slate-700 px-4 py-3"
                onPress={logout}
              >
                <Text className="text-center font-semibold text-slate-200">
                  Log out
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              className="mt-6 rounded-2xl bg-blue-500 px-4 py-3"
              onPress={login}
            >
              <Text className="text-center font-semibold text-white">
                Log in with Auth0
              </Text>
            </Pressable>
          )}

          {apiMessage ? (
            <Text className="mt-4 rounded-2xl bg-slate-800 p-4 text-slate-200">
              {apiMessage}
            </Text>
          ) : null}
          {apiError || error ? (
            <Text className="mt-4 rounded-2xl bg-red-950 p-4 text-red-100">
              {apiError ?? error?.message}
            </Text>
          ) : null}
        </View>
      </View>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}
