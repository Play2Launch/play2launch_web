// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CommunityLinks } from './CommunityLinks';

it('links to the official group, channel and X account safely', () => {
  const view = render(<CommunityLinks />);
  for (const [name, url] of [
    ['Join TG Group', 'https://t.me/play2launch_G'],
    ['Join TG Channel', 'https://t.me/play2launch_C'],
    ['Follow our X', 'https://x.com/play2launch'],
  ]) {
    const link = screen.getByRole('link', { name });
    expect(link.getAttribute('href')).toBe(url);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  }
  view.unmount();
});
