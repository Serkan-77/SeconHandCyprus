"use client";

import { Switch } from "@/components/ui/Switch";
import { togglePackage } from "@/lib/actions/admin";

export function PackageToggle({ id, active, name }: { id: number; active: boolean; name: string }) {
  return <Switch label={`${name} etkin`} defaultChecked={active} onChange={(checked) => togglePackage(id, checked)} />;
}
