import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { I18nManager } from "react-native";

import { Lang, TranslationKey, roleLabel, t as translate } from "@/constants/translations";

const LANGS: Lang[] = ["ar", "en", "ur", "hi"];
const LANG_LABELS: Record<Lang, string> = { ar: "ع", en: "EN", ur: "اردو", hi: "हि" };

interface LanguageContextType {
  lang: Lang;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
  rl: (role: string) => string;
  isRTL: boolean;
  langLabel: string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "@wh_language_v2";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("ar");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && LANGS.includes(stored as Lang)) setLang(stored as Lang);
    });
  }, []);

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const idx = LANGS.indexOf(prev);
      const next = LANGS[(idx + 1) % LANGS.length];
      AsyncStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translate(key, lang),
    [lang]
  );

  const rl = useCallback(
    (role: string) => roleLabel(role, lang),
    [lang]
  );

  const isRTL = lang === "ar" || lang === "ur";

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t, rl, isRTL, langLabel: LANG_LABELS[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}
