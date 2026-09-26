import {
  LayoutDashboard,
  GraduationCap,
  Award,
  BookOpen,
  Users,
  BarChart3,
  BadgeCheck,
  FolderOpen,
  ScrollText,
  Settings,
  CreditCard,
  ClipboardCheck,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/lib/domain';
import type { Dictionary } from '@/i18n/dictionary';

export type NavItem = {
  href: string;
  key: keyof Dictionary['nav'];
  icon: LucideIcon;
  roles: Role[];
  section: 'learn' | 'manage' | 'admin';
  /** Shown to staff only when they are themselves enrolled in something. */
  learnerOnly?: boolean;
};

const staff: Role[] = ['Admin', 'Instructor'];
const everyone: Role[] = ['Admin', 'Instructor', 'Learner'];

export const navItems: NavItem[] = [
  { href: '', key: 'overview', icon: LayoutDashboard, roles: everyone, section: 'learn' },
  { href: '/learn', key: 'learning', icon: GraduationCap, roles: staff, section: 'learn', learnerOnly: true },
  { href: '/my-certificates', key: 'myCertificates', icon: Award, roles: everyone, section: 'learn', learnerOnly: true },
  { href: '/courses', key: 'courses', icon: BookOpen, roles: staff, section: 'manage' },
  { href: '/review', key: 'review', icon: ClipboardCheck, roles: staff, section: 'manage' },
  { href: '/reports', key: 'reports', icon: BarChart3, roles: staff, section: 'manage' },
  { href: '/certificates', key: 'certificates', icon: BadgeCheck, roles: staff, section: 'manage' },
  { href: '/files', key: 'files', icon: FolderOpen, roles: staff, section: 'manage' },
  { href: '/people', key: 'people', icon: Users, roles: ['Admin'], section: 'admin' },
  { href: '/audit', key: 'audit', icon: ScrollText, roles: ['Admin'], section: 'admin' },
  { href: '/settings', key: 'settings', icon: Settings, roles: ['Admin'], section: 'admin' },
  { href: '/billing', key: 'billing', icon: CreditCard, roles: ['Admin'], section: 'admin' },
];

export const navSections = ['learn', 'manage', 'admin'] as const;

export function visibleNav(role: Role, learning = 0) {
  return navItems.filter((item) => item.roles.includes(role) && (!item.learnerOnly || role === 'Learner' || learning > 0));
}

/** The default landing route for a role, used when a page is not permitted. */
export function homeFor(role: Role) {
  return visibleNav(role)[0]?.href ?? '';
}
