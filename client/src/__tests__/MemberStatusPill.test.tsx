import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import MemberStatusPill from '../components/MemberStatusPill.js';

describe('MemberStatusPill', () => {
  it('applies the active energy palette', () => {
    render(<MemberStatusPill pill={{ key: 'active', label: 'Active', icon: 'bolt' }} />);

    const pill = screen.getByText('Active').parentElement;
    expect(pill).not.toBeNull();
    expect(pill).toHaveClass('bg-energy-100/55');
    expect(pill).toHaveClass('text-energy-500');
  });

  it('uses the special consistent surface for consistent family pills', () => {
    render(<MemberStatusPill pill={{ key: 'consistent-days', label: '14 Days', icon: 'calendar_month' }} />);

    const surface = screen.getByText('14 Days').closest('.member-status-pill-consistent-surface');
    expect(surface).not.toBeNull();
    expect(surface?.parentElement).toHaveClass('member-status-pill-consistent-frame');
  });

  it('keeps warning and neutral pills on their dedicated palettes', () => {
    const { rerender } = render(<MemberStatusPill pill={{ key: 'renewal', label: 'Renewal', icon: 'notification_important', tone: 'warning' }} />);

    let pill = screen.getByText('Renewal').parentElement;
    expect(pill).not.toBeNull();
    expect(pill).toHaveClass('bg-orange-500/10');
    expect(pill).toHaveClass('text-orange-700');

    rerender(<MemberStatusPill pill={{ key: 'no-plan', label: 'No Plan', icon: 'credit_card_off', tone: 'neutral' }} />);
    pill = screen.getByText('No Plan').parentElement;
    expect(pill).not.toBeNull();
    expect(pill).toHaveClass('bg-black/[0.04]');
    expect(pill).toHaveClass('text-black/70');
  });
});
