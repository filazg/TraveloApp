// TraveloApp brand paleta — single source of truth za sve boje u mobile UI-u.
// Brand par: osnovna plava #175BD0, sekundarna #96D1F2 (autoritativno).
// Ne hardkodiraj boje u ekranima — uvijek importaj iz `theme/colors`.

export const colors = {
    // ===== Brand =====
    primary: '#175BD0',         // osnovna plava — primarni CTA, naslovi, ikone
    primaryDark: '#0F4BA8',     // pressed / active state (~ -8% lightness)
    primaryAlpha: 'rgba(23, 91, 208, 0.12)', // tinted highlight (selected row, focused tab)

    secondary: '#96D1F2',       // sekundarna — accent, badges, hover, highlight
    secondaryDark: '#6DB4DC',   // pressed secondary
    secondaryAlpha: 'rgba(150, 209, 242, 0.25)',

    // ===== Neutrali (warm cream skala — usklađeno s web-sales) =====
    bg: '#F5F2EB',              // app pozadina
    surface: '#FFFFFF',         // card / sheet / modal pozadina
    surfaceAlt: '#FAF8F3',      // alternativna card pozadina (sub-cards)
    border: '#E5E0D6',          // separatori, borders
    borderStrong: '#C9C2B0',    // istaknuti borderi (focused input)

    // ===== Tekst =====
    textPrimary: '#383E42',     // glavni tekst (na light bg)
    textSecondary: '#5C656B',   // sekundarni / meta tekst
    textMuted: '#8A938F',       // pomoćni / placeholders / disabled
    textOnPrimary: '#FFFFFF',   // tekst na primary plavoj
    textOnSecondary: '#0F4BA8', // tekst na #96D1F2 — koristi tamniju plavu

    // ===== Funkcionalni statusi (nisu brand) =====
    success: '#16A34A',
    successLight: '#DCFCE7',
    warning: '#D97706',
    warningLight: '#FEF3C7',
    error: '#DC2626',
    errorLight: '#FEE2E2',
};

// Common shadow stilovi (RN — koristi `elevation` na Androidu, `shadow*` na iOS-u).
export const shadows = {
    card: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    elevated: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 6,
    },
};
