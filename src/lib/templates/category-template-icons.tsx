import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Coffee,
  Dumbbell,
  GraduationCap,
  Home,
  ShoppingBag,
  Sparkles,
  User,
} from "lucide-react";

import type { TemplateCategory } from "@/lib/templates/builtin-templates";

const MAP: Record<TemplateCategory, { Icon: LucideIcon; label: string }> = {
  horeca: { Icon: Coffee, label: "HoReCa" },
  beauty: { Icon: Sparkles, label: "Красота" },
  b2b: { Icon: Building2, label: "B2B" },
  personal: { Icon: User, label: "Личный бренд" },
  retail: { Icon: ShoppingBag, label: "Розница" },
  fitness: { Icon: Dumbbell, label: "Спорт" },
  education: { Icon: GraduationCap, label: "Образование" },
  realestate: { Icon: Home, label: "Недвижимость" },
};

export function getTemplateCategoryIcon(category: TemplateCategory): { Icon: LucideIcon; label: string } {
  return MAP[category] ?? MAP.b2b;
}
