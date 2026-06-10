import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { I18nManager, Platform } from "react-native";

import { Lang, TranslationKey, roleLabel, t as translate } from "@/constants/translations";

const LANGS: Lang[] = ["ar", "en", "ur", "hi", "bn"];
const LANG_LABELS: Record<Lang, string> = {
  ar: "العربية",
  en: "English",
  ur: "اردو",
  hi: "हिंदी",
  bn: "বাংলা",
};

interface LanguageContextType {
  lang: Lang;
  toggleLang: () => void;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
  rl: (role: string) => string;
  isRTL: boolean;
  langLabel: string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
const STORAGE_KEY = "@wh_language_v2";

function isRTLForLang(lang: Lang) {
  return lang === "ar" || lang === "ur";
}

function applyWebDirection(lang: Lang, isRTL: boolean) {
  if (Platform.OS !== "web") return;
  const doc = (globalThis as any).document;
  if (!doc?.documentElement) return;
  doc.documentElement.lang = lang;
  doc.documentElement.dir = isRTL ? "rtl" : "ltr";
  doc.body?.setAttribute("dir", isRTL ? "rtl" : "ltr");
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  const isRTL = isRTLForLang(lang);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored && LANGS.includes(stored as Lang)) setLangState(stored as Lang);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(isRTL);
    applyWebDirection(lang, isRTL);
  }, [lang, isRTL]);

  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const idx = LANGS.indexOf(prev);
      const next = LANGS[(idx + 1) % LANGS.length];
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
      return next;
    });
  }, []);

  const setLang = useCallback((next: Lang) => {
    if (!LANGS.includes(next)) return;
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const t = useCallback((key: TranslationKey) => translate(key, lang), [lang]);
  const rl = useCallback((role: string) => roleLabel(role, lang), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, setLang, t, rl, isRTL, langLabel: LANG_LABELS[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}
