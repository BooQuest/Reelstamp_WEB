export type TemplateAccessType = 'FREE' | 'PAID';

export type TemplateAccessSource = {
  accessType?: string | null;
  tags?: string[] | null;
};

export type TemplateAccessUser = {
  guest?: boolean | null;
  provider?: string | null;
} | null | undefined;

export type TemplateAccessSubscription = {
  subscription?: {
    active?: boolean | null;
  } | null;
  subscriptionPlan?: {
    plan?: string | null;
  } | null;
} | null | undefined;

const FREE_TEMPLATE_TAG = '후킹';

export const TEMPLATE_LOGIN_REQUIRED_MESSAGE = '로그인 시 이용 가능한 기능입니다.';
export const TEMPLATE_PAYMENT_PATH = '/pricing';
export const TEMPLATE_LOGIN_REQUIRED_ERROR_CODE = 'TEMPLATE_LOGIN_REQUIRED';
export const PAID_TEMPLATE_REQUIRED_ERROR_CODE = 'PAID_TEMPLATE_REQUIRED';

export const resolveTemplateAccessType = (
  template: TemplateAccessSource | null | undefined
): TemplateAccessType => {
  const normalizedAccessType = template?.accessType?.trim().toUpperCase();
  if (normalizedAccessType === 'FREE' || normalizedAccessType === 'PAID') {
    return normalizedAccessType;
  }

  const tags = Array.isArray(template?.tags) ? template.tags : [];
  const isFree = tags.some((tag) => tag?.trim() === FREE_TEMPLATE_TAG);
  return isFree ? 'FREE' : 'PAID';
};

export const isPaidTemplate = (template: TemplateAccessSource | null | undefined) =>
  resolveTemplateAccessType(template) === 'PAID';

export const isGuestTemplateUser = (user: TemplateAccessUser) =>
  Boolean(user?.guest || user?.provider === 'GUEST');

export const hasActivePaidSubscription = (
  subscription: TemplateAccessSubscription
) => {
  const planCode = subscription?.subscriptionPlan?.plan?.trim().toLowerCase();
  return Boolean(subscription?.subscription?.active && planCode && planCode !== 'free');
};

export const canUseTemplate = ({
  template,
  isAuthenticated,
  user,
  subscription,
}: {
  template: TemplateAccessSource | null | undefined;
  isAuthenticated: boolean;
  user: TemplateAccessUser;
  subscription: TemplateAccessSubscription;
}) => {
  if (!isPaidTemplate(template)) {
    return true;
  }

  return Boolean(
    isAuthenticated &&
      user &&
      !isGuestTemplateUser(user) &&
      hasActivePaidSubscription(subscription)
  );
};

export const buildTemplateLoginHref = () =>
  `/login?returnUrl=${encodeURIComponent(TEMPLATE_PAYMENT_PATH)}`;
