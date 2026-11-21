import {
  BarChart3, Bell, BookOpen, Building2, Calculator, Columns3, Compass, FileText, GraduationCap, Handshake, Home,
  IdCard, Inbox, KanbanSquare, LayoutGrid, ListChecks, Megaphone, MessageSquare, Newspaper, Route, Scale, School,
  ShieldCheck, Sparkles, Tag, Trophy, User, Users, Search, MoreHorizontal, type LucideIcon,
} from 'lucide-react';
import type { IconName } from '@/lib/domain/navigation';

const MAP: Record<IconName, LucideIcon> = {
  home: Home, showcase: LayoutGrid, trophy: Trophy, campus: School, book: BookOpen, calc: Calculator, spark: Sparkles,
  path: Route, id: IdCard, inbox: Inbox, megaphone: Megaphone, handshake: Handshake, family: Users, pipeline: KanbanSquare,
  list: ListChecks, building: Building2, shield: ShieldCheck, users: Users, chat: MessageSquare, news: Newspaper,
  grad: GraduationCap, bell: Bell, tag: Tag, chart: BarChart3, compare: Columns3, doc: FileText, scale: Scale, user: User,
  compass: Compass, search: Search, more: MoreHorizontal,
};

export function NavIcon({ name, className = 'h-[18px] w-[18px]' }: { name: IconName; className?: string }) {
  const C = MAP[name] ?? Compass;
  return <C className={className} aria-hidden strokeWidth={1.8} />;
}
