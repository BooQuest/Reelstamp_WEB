import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TemplateAccessBadge from './TemplateAccessBadge';

describe('TemplateAccessBadge', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('shows the paid template badge outside beta', () => {
    vi.stubEnv('NEXT_PUBLIC_REELSTAMP_BETA_ENABLED', 'false');

    render(<TemplateAccessBadge accessType="PAID" />);

    expect(screen.getByLabelText('유료 템플릿')).toBeInTheDocument();
  });

  it('hides the paid template badge during beta', () => {
    vi.stubEnv('NEXT_PUBLIC_REELSTAMP_BETA_ENABLED', 'true');

    render(<TemplateAccessBadge accessType="PAID" />);

    expect(screen.queryByLabelText('유료 템플릿')).not.toBeInTheDocument();
  });

  it('does not show a badge for free templates', () => {
    vi.stubEnv('NEXT_PUBLIC_REELSTAMP_BETA_ENABLED', 'false');

    render(<TemplateAccessBadge accessType="FREE" />);

    expect(screen.queryByLabelText('유료 템플릿')).not.toBeInTheDocument();
  });
});
