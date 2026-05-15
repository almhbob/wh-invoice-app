import AsyncStorage from "@react-native-async-storage/async-storage";
import { addDoc, collection } from "firebase/firestore";

import { db } from "@/lib/firebase";

export type SubscriptionPlanKey = "starter" | "business" | "enterprise";
export type SubscriptionRequestStatus = "draft" | "submitted" | "contacting" | "approved" | "rejected";

export interface SubscriptionActivationRequest {
  id: string;
  companyId: string;
  companyName: string;
  selectedPlan: SubscriptionPlanKey;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  notes?: string;
  status: SubscriptionRequestStatus;
  source: "trial_company" | "admin_panel";
  createdAt: string;
}

const LOCAL_KEY_PREFIX = "@fawtara_subscription_requests_v1";

function localKey(companyId: string) {
  return `${LOCAL_KEY_PREFIX}_${companyId}`;
}

export const SUBSCRIPTION_PLAN_OPTIONS: Array<{ key: SubscriptionPlanKey; titleAr: string; priceAr: string; descriptionAr: string }> = [
  { key: "starter", titleAr: "الباقة الأساسية", priceAr: "تجربة / بداية", descriptionAr: "مناسبة لفرع واحد وتجربة النظام." },
  { key: "business", titleAr: "باقة الأعمال", priceAr: "الأكثر مناسبة", descriptionAr: "مناسبة لشركات الكيك والشوكولاتة بعدة موظفين وفروع." },
  { key: "enterprise", titleAr: "باقة الشركات", priceAr: "حسب الاتفاق", descriptionAr: "للشركات متعددة الفروع مع صلاحيات وتقارير موسعة." },
];

export async function saveSubscriptionActivationRequest(input: Omit<SubscriptionActivationRequest, "id" | "status" | "createdAt">) {
  const request: SubscriptionActivationRequest = {
    ...input,
    id: `subreq-${input.companyId}-${Date.now()}`,
    status: "submitted",
    createdAt: new Date().toISOString(),
  };

  const key = localKey(input.companyId);
  const raw = await AsyncStorage.getItem(key);
  const existing: SubscriptionActivationRequest[] = raw ? JSON.parse(raw) : [];
  await AsyncStorage.setItem(key, JSON.stringify([request, ...existing]));

  try {
    await addDoc(collection(db, "subscriptionActivationRequests"), request);
  } catch (error) {
    console.warn("Subscription activation request saved locally only", error);
  }

  return request;
}

export async function loadLocalSubscriptionActivationRequests(companyId: string) {
  const raw = await AsyncStorage.getItem(localKey(companyId));
  return raw ? (JSON.parse(raw) as SubscriptionActivationRequest[]) : [];
}
