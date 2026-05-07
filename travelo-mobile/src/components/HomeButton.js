import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useDispatch } from 'react-redux';
import { resetSection } from '../store/slices/navSlice';
import { clearLine, clearVoyage } from '../store/slices/voyageSlice';
import { colors } from '../theme/colors';

// Univerzalni "kućica" gumb gore desno na svim sekcijskim ekranima.
// Vraća na MainMenuScreen tako što čisti nav.section + voyage.selected + voyage.selectedLine.
export default function HomeButton({ tint, style }) {
    const dispatch = useDispatch();
    const onPress = () => {
        dispatch(clearVoyage());
        dispatch(clearLine());
        dispatch(resetSection());
    };
    return (
        <TouchableOpacity style={[styles.btn, style]} onPress={onPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.icon, tint ? { color: tint } : null]}>⌂</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    btn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: colors.secondary,
        borderRadius: 8,
        minWidth: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        color: colors.textOnSecondary,
        fontSize: 22,
        fontWeight: '800',
        lineHeight: 24,
    },
});
