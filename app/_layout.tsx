import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TenantAccessGate } from "@/components/TenantAccessGate";
import { CompanyProvider } from "@/context/CompanyContext";
import { EmployeeProvider } from "@/context/EmployeeContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { OffersProvider } from "@/context/OffersContext";
import { OrdersProvider } from "@/context/OrdersContext";
import { ProductsProvider } from "@/context/ProductsContext";
import { TraysProvider } from "@/context/TraysInventoryContext";
import { PriceChangeProvider } from "@/context/PriceChangeContext";
import { FeaturesProvider } from "@/context/FeaturesContext";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient();
const FONT_LOAD_FAILSAFE_MS = 2500;

function RootLayoutNav() {
  return (
    <TenantAccessGate>
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </TenantAccessGate>
  );
}

export default function RootLayout() {
  const [forceRender, setForceRender] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    const timer = setTimeout(() => setForceRender(true), FONT_LOAD_FAILSAFE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError || forceRender) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError, forceRender]);

  if (!fontsLoaded && !fontError && !forceRender) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <CompanyProvider>
              <EmployeeProvider>
                <ProductsProvider>
                  <OrdersProvider>
                    <OffersProvider>
                      <TraysProvider>
                        <PriceChangeProvider>
                          <FeaturesProvider>
                            <GestureHandlerRootView style={{ flex: 1 }}>
                              <KeyboardProvider>
                                <RootLayoutNav />
                              </KeyboardProvider>
                            </GestureHandlerRootView>
                          </FeaturesProvider>
                        </PriceChangeProvider>
                      </TraysProvider>
                    </OffersProvider>
                  </OrdersProvider>
                </ProductsProvider>
              </EmployeeProvider>
            </CompanyProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
