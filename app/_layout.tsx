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
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { EmployeeProvider } from "@/context/EmployeeContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { OffersProvider } from "@/context/OffersContext";
import { OrdersProvider } from "@/context/OrdersContext";
import { ProductsProvider } from "@/context/ProductsContext";
import { TraysProvider } from "@/context/TraysInventoryContext";
import { PriceChangeProvider } from "@/context/PriceChangeContext";
import { FeaturesProvider } from "@/context/FeaturesContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <EmployeeProvider>
              <ProductsProvider>
                <OrdersProvider>
                  <OffersProvider>
                    <TraysProvider>
                      <PriceChangeProvider>
                        <FeaturesProvider>
                          <GestureHandlerRootView>
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
          </LanguageProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
