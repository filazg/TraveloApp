import React from 'react';
import { Text } from 'react-native';
import { colors } from '../theme/colors';

// Naziv aplikacije: "Travelo" u brand plavoj, "APP" u boji teksta.
// Isti znak koristi se na svim projektima — vidi boat-desk
// (renderer/src/components/common/BrandMark.jsx) i splash u njegovom main.cjs.
//
// `onPrimary` je za mjesta gdje znak stoji NA plavoj podlozi (npr. zaglavlje
// glavnog izbornika): ondje bi "Travelo" bio plavo na plavom. Tada "Travelo"
// ide u bijelo, a "APP" u sekundarnu svijetloplavu — dvobojnost ostaje, a oboje
// je čitljivo. Sekundarna se u tom zaglavlju već koristi za podnaslov.
export default function BrandMark({ style, onPrimary = false }) {
    const brandColor = onPrimary ? colors.textOnPrimary : colors.primary;
    const textColor = onPrimary ? colors.secondary : colors.textPrimary;
    return (
        <Text style={[{ fontWeight: '800', letterSpacing: 0.5 }, style]}>
            <Text style={{ color: brandColor }}>Travelo</Text>
            <Text style={{ color: textColor }}>APP</Text>
        </Text>
    );
}
