import React from "react";

import { DepartmentBoard } from "@/components/DepartmentBoard";

export default function HalwaScreen() {
  return <DepartmentBoard department="halwa" titleKey="deptHalwa" subtitleKey="halwaSubtitle" deniedKey="accessDeniedHalwa" />;
}
