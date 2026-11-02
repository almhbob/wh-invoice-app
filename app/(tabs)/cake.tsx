import React from "react";

import { DepartmentBoard } from "@/components/DepartmentBoard";

export default function CakeScreen() {
  return <DepartmentBoard department="cake" titleKey="deptCake" subtitleKey="cakeSubtitle" deniedKey="accessDeniedCake" />;
}
