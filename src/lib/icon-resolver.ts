import {
  BookOpen,
  Brain,
  Beaker,
  Lightbulb,
  GraduationCap,
  Code,
  PenTool,
  Rocket,
  Globe,
  Briefcase,
  Palette,
  Zap,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  BookOpen,
  Brain,
  Beaker,
  Lightbulb,
  GraduationCap,
  Code,
  PenTool,
  Rocket,
  Globe,
  Briefcase,
  Palette,
  Zap,
};

export const resolveIcon = (name: string): LucideIcon => {
  return iconMap[name] ?? BookOpen;
};
