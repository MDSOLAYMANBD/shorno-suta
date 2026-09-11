/**
 * Decorative vertical border shown in the empty gutters on wide desktop
 * screens (mobile/tablet have no spare space for it). Uses the same Bengali
 * textile vocabulary as the footer (কলকা paisley + leaf sprigs) so the page
 * body and the footer read as one continuous, branded page rather than two
 * unrelated blocks. Purely decorative — no interaction, no layout impact.
 */
export default function BrandSideBorder() {
  return (
    <>
      <div className="hidden xl:block absolute inset-y-0 left-0 w-24 2xl:w-28 pointer-events-none z-0">
        <svg aria-hidden="true" className="w-full h-full text-primary/[0.16]" preserveAspectRatio="none">
          <defs>
            <pattern id="side-vine-left" width="100" height="240" patternUnits="userSpaceOnUse">
              <line x1="50" y1="0" x2="50" y2="240" stroke="currentColor" strokeWidth="1" strokeDasharray="1 6" />
              <g transform="translate(50,60) rotate(-12)">
                <path
                  d="M10 -32 C 27 -24, 28 -2, 13 9 C 2 17, 2 25, 13 30 C 0 32, -11 22, -12 8 C -13 -7, 1 -11, 7 -7 C 11 -4, 10 3, 3 3"
                  fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
                />
                <circle cx="14" cy="-26" r="1.6" fill="currentColor" stroke="none" />
              </g>
              <g transform="translate(50,150) rotate(18)">
                <path d="M0 0 C 9 -11, 9 -24, 0 -33 C -9 -24, -9 -11, 0 0 Z" fill="currentColor" opacity="0.55" />
                <path d="M0 0 C 9 11, 9 24, 0 33 C -9 24, -9 11, 0 0 Z" fill="currentColor" opacity="0.4" />
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#side-vine-left)" />
        </svg>
      </div>

      <div className="hidden xl:block absolute inset-y-0 right-0 w-24 2xl:w-28 pointer-events-none z-0">
        <svg aria-hidden="true" className="w-full h-full text-primary/[0.16]" preserveAspectRatio="none">
          <defs>
            <pattern id="side-vine-right" width="100" height="240" patternUnits="userSpaceOnUse">
              <line x1="50" y1="0" x2="50" y2="240" stroke="currentColor" strokeWidth="1" strokeDasharray="1 6" />
              <g transform="translate(50,90) rotate(12) scale(-1,1)">
                <path
                  d="M10 -32 C 27 -24, 28 -2, 13 9 C 2 17, 2 25, 13 30 C 0 32, -11 22, -12 8 C -13 -7, 1 -11, 7 -7 C 11 -4, 10 3, 3 3"
                  fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"
                />
                <circle cx="14" cy="-26" r="1.6" fill="currentColor" stroke="none" />
              </g>
              <g transform="translate(50,190) rotate(-18)">
                <path d="M0 0 C 9 -11, 9 -24, 0 -33 C -9 -24, -9 -11, 0 0 Z" fill="currentColor" opacity="0.55" />
                <path d="M0 0 C 9 11, 9 24, 0 33 C -9 24, -9 11, 0 0 Z" fill="currentColor" opacity="0.4" />
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#side-vine-right)" />
        </svg>
      </div>
    </>
  );
}
