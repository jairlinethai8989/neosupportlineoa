/**
 * Utility to generate unique, beautiful, and dark-mode friendly progressive gradients
 * and HSL colors for each hospital based on their name.
 */
export interface HospitalColorStyles {
  accent: string;
  bg: string;
  text: string;
  border: string;
  gradient: string;
}

export function getHospitalColorStyles(hospitalName?: string | null): HospitalColorStyles {
  if (!hospitalName || hospitalName.trim() === '') {
    return {
      accent: 'var(--primary)',
      bg: 'rgba(54, 153, 255, 0.08)',
      text: 'var(--text-main)',
      border: 'var(--border)',
      gradient: 'linear-gradient(135deg, var(--primary) 0%, oklch(65% 0.18 200) 100%)',
    };
  }

  const name = hospitalName.trim();
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Distribute hue evenly across 0-360 degrees
  const hue = Math.abs(hash) % 360;
  
  // Saturation: 85% for vibrant neon colors that pop on dark background
  // Lightness: 60% for crisp readability and optimal contrast on dark backgrounds
  const baseColor = `hsl(${hue}, 85%, 60%)`;
  const bgColor = `hsla(${hue}, 85%, 60%, 0.08)`;
  const textColor = `hsl(${hue}, 90%, 75%)`;
  const borderColor = `hsla(${hue}, 85%, 60%, 0.2)`;
  
  // 45 degrees progressive shift for standard modern gradients
  const nextHue = (hue + 45) % 360;
  const gradient = `linear-gradient(135deg, hsl(${hue}, 85%, 60%) 0%, hsl(${nextHue}, 85%, 60%) 100%)`;

  return {
    accent: baseColor,
    bg: bgColor,
    text: textColor,
    border: borderColor,
    gradient,
  };
}
