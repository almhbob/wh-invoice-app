import React from "react";

import { DepartmentBoard } from "@/components/DepartmentBoard";

export default function ChocolateScreen() {
  return <DepartmentBoard department="chocolate" titleKey="deptChocolate" subtitleKey="chocolateSubtitle" deniedKey="accessDeniedChocolate" />;
}
