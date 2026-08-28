import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PartnerLogos, { PARTNERS } from './PartnerLogos';

describe('PartnerLogos', () => {
  it('names both partners', () => {
    render(<PartnerLogos />);
    expect(screen.getByText('UZ COSMOS')).toBeInTheDocument();
    expect(screen.getByText('Oxford International School')).toBeInTheDocument();
  });

  it('uses an image where a file is set and a monogram where it is not', () => {
    render(<PartnerLogos />);
    const withFile = PARTNERS.filter((p) => p.src);
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(withFile.length);
    for (const partner of withFile) {
      expect(screen.getByAltText(partner.name)).toHaveAttribute('src', partner.src);
    }
    // The monogram is decorative; the name beside it is the accessible text.
    const withoutFile = PARTNERS.filter((p) => !p.src);
    for (const partner of withoutFile) {
      expect(screen.queryByAltText(partner.name)).not.toBeInTheDocument();
    }
  });
});
