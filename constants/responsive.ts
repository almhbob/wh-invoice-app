import { Dimensions, Platform } from "react-native";

const { width, height } = Dimensions.get("window");

export const SCREEN = {
  width,
  height,
  isWeb: Platform.OS === "web",
  isSmallPhone: width < 360,
  isPhone: width < 768,
  isTablet: width >= 768 && width < 1024,
  isDesktop: width >= 1024,
};

export const RESPONSIVE = {
  pagePadding: width < 360 ? 10 : width < 768 ? 12 : 20,
  cardRadius: width < 360 ? 12 : 16,
  inputHeight: width < 360 ? 42 : 48,
  bottomClearance: Platform.OS === "web" ? 180 : 120,
  maxContentWidth: 1180,
  minTouchTarget: 44,
  headerLogoBox: width < 360 ? 38 : 46,
  headerLogoImage: width < 360 ? 32 : 40,
  headerTitleSize: width < 360 ? 13 : 16,
  headerSubSize: width < 360 ? 8 : 9,
  tabBarHeight: width < 360 ? 58 : 64,
  tabFontSize: width < 360 ? 9 : 10,
};

export function responsiveColumns() {
  if (SCREEN.isDesktop) return 3;
  if (SCREEN.isTablet) return 2;
  return 1;
}
