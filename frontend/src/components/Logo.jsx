import React from "react";

/**
 * PrakritiDx seal — dark glassy monogram: forest-green glass sphere,
 * engraved gold "P" with superscript "Dx", concentric gold dial rings.
 */
export default function Logo({ size = 40, className = "" }) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="PrakritiDx"
    >
      <defs>
        <radialGradient id="pdxSphere" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#3E5C40" />
          <stop offset="45%" stopColor="#1F3320" />
          <stop offset="80%" stopColor="#101D11" />
          <stop offset="100%" stopColor="#0A140B" />
        </radialGradient>
        <radialGradient id="pdxSheen" cx="32%" cy="24%" r="30%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pdxGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F3D385" />
          <stop offset="50%" stopColor="#D9A441" />
          <stop offset="100%" stopColor="#B8842A" />
        </linearGradient>
        <filter id="pdxGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="100" cy="100" r="96" fill="url(#pdxSphere)" stroke="url(#pdxGold)" strokeWidth="1.5" />

      <circle cx="100" cy="100" r="82" fill="none" stroke="url(#pdxGold)" strokeWidth="0.75" opacity="0.55" />
      <circle cx="100" cy="100" r="70" fill="none" stroke="url(#pdxGold)" strokeWidth="0.5" opacity="0.4" />

      <g stroke="url(#pdxGold)" strokeWidth="1" opacity="0.6">
      <line x1="192.00" y1="100.00" x2="188.00" y2="100.00" />
      <line x1="190.60" y1="115.98" x2="186.66" y2="115.28" />
      <line x1="186.45" y1="131.47" x2="182.69" y2="130.10" />
      <line x1="179.67" y1="146.00" x2="176.21" y2="144.00" />
      <line x1="170.48" y1="159.14" x2="167.41" y2="156.57" />
      <line x1="159.14" y1="170.48" x2="156.57" y2="167.41" />
      <line x1="146.00" y1="179.67" x2="144.00" y2="176.21" />
      <line x1="131.47" y1="186.45" x2="130.10" y2="182.69" />
      <line x1="115.98" y1="190.60" x2="115.28" y2="186.66" />
      <line x1="100.00" y1="192.00" x2="100.00" y2="188.00" />
      <line x1="84.02" y1="190.60" x2="84.72" y2="186.66" />
      <line x1="68.53" y1="186.45" x2="69.90" y2="182.69" />
      <line x1="54.00" y1="179.67" x2="56.00" y2="176.21" />
      <line x1="40.86" y1="170.48" x2="43.43" y2="167.41" />
      <line x1="29.52" y1="159.14" x2="32.59" y2="156.57" />
      <line x1="20.33" y1="146.00" x2="23.79" y2="144.00" />
      <line x1="13.55" y1="131.47" x2="17.31" y2="130.10" />
      <line x1="9.40" y1="115.98" x2="13.34" y2="115.28" />
      <line x1="8.00" y1="100.00" x2="12.00" y2="100.00" />
      <line x1="9.40" y1="84.02" x2="13.34" y2="84.72" />
      <line x1="13.55" y1="68.53" x2="17.31" y2="69.90" />
      <line x1="20.33" y1="54.00" x2="23.79" y2="56.00" />
      <line x1="29.52" y1="40.86" x2="32.59" y2="43.43" />
      <line x1="40.86" y1="29.52" x2="43.43" y2="32.59" />
      <line x1="54.00" y1="20.33" x2="56.00" y2="23.79" />
      <line x1="68.53" y1="13.55" x2="69.90" y2="17.31" />
      <line x1="84.02" y1="9.40" x2="84.72" y2="13.34" />
      <line x1="100.00" y1="8.00" x2="100.00" y2="12.00" />
      <line x1="115.98" y1="9.40" x2="115.28" y2="13.34" />
      <line x1="131.47" y1="13.55" x2="130.10" y2="17.31" />
      <line x1="146.00" y1="20.33" x2="144.00" y2="23.79" />
      <line x1="159.14" y1="29.52" x2="156.57" y2="32.59" />
      <line x1="170.48" y1="40.86" x2="167.41" y2="43.43" />
      <line x1="179.67" y1="54.00" x2="176.21" y2="56.00" />
      <line x1="186.45" y1="68.53" x2="182.69" y2="69.90" />
      <line x1="190.60" y1="84.02" x2="186.66" y2="84.72" />
      </g>

      <g filter="url(#pdxGlow)">
        <text x="100" y="128" fontFamily="Georgia, 'Times New Roman', serif" fontSize="92"
              textAnchor="middle" fill="url(#pdxGold)" fontWeight="600">P</text>
        <text x="140" y="80" fontFamily="Georgia, 'Times New Roman', serif" fontSize="26"
              textAnchor="middle" fill="url(#pdxGold)" fontWeight="600">Dx</text>
      </g>

      <circle cx="100" cy="100" r="96" fill="url(#pdxSheen)" />
    </svg>
  );
}
