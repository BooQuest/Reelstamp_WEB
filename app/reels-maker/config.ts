import type { ComponentType } from 'react';
import { SHOW_COMPLETED_REELS_MENU } from '@/app/lib/constants/navigation';
import {
  Bookmark,
  CheckCircle,
  FolderOpen,
  LayoutTemplate,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

export type CaptureMenuItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
  isDisabled?: boolean;
};

export const SHOW_DISABLED_CAPTURE_MENU_ITEMS = false;
export const isCaptureMenuItemVisible = (item: { isDisabled?: boolean }) =>
  !item.isDisabled || SHOW_DISABLED_CAPTURE_MENU_ITEMS;

export const CAPTURE_MENU_ITEMS: CaptureMenuItem[] = [
  {
    href: '/templates',
    label: '오늘의 릴스 트렌드',
    icon: Sparkles,
  },
  {
    href: '/all-templates',
    label: '릴스 템플릿',
    icon: LayoutTemplate,
  },
  {
    href: '/trending-reels',
    label: '(구)오늘의 릴스 트렌드',
    icon: TrendingUp,
    requiresAuth: true,
    isDisabled: true,
  },
  {
    href: '/my-projects',
    label: '내 프로젝트',
    icon: FolderOpen,
    requiresAuth: true,
  },
  ...(SHOW_COMPLETED_REELS_MENU ? [{
    href: '/completed-reels',
    label: '제작 완료된 릴스',
    icon: CheckCircle,
    requiresAuth: true,
  }] : []),
  {
    href: '/saved-reels',
    label: '저장된 릴스',
    icon: Bookmark,
    requiresAuth: true,
  },
];
