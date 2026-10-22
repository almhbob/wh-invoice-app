import React from "react";

import { DepartmentBoard } from "@/components/DepartmentBoard";

export default function PackagingScreen() {
  return <DepartmentBoard department="packaging" titleKey="deptPackaging" subtitleKey="packagingSubtitle" deniedKey="accessDeniedPackaging" />;
}
