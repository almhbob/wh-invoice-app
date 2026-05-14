import React from "react";
import { Image, StyleSheet, View } from "react-native";

import { RESPONSIVE } from "@/constants/responsive";

export function FawtaraPlatformLogo() {
  return (
    <View
      style={[
        styles.logoBox,
        {
          width: RESPONSIVE.headerLogoBox,
          height: RESPONSIVE.headerLogoBox,
          borderRadius: Math.max(10, RESPONSIVE.headerLogoBox / 4),
        },
      ]}
    >
      <Image
        source={require("@/assets/images/fawtara-logo-original.png")}
        style={[
          styles.logoImage,
          {
            width: RESPONSIVE.headerLogoImage,
            height: RESPONSIVE.headerLogoImage,
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  logoBox: {
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(199,154,53,0.65)",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    backgroundColor: "transparent",
  },
});
