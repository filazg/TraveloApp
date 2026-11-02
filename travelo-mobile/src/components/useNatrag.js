import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

// Android strelica natrag za prozor koji nije <Modal> (crta se preko ekrana):
// dok je prozor prikazan, strelica poziva `naNatrag` umjesto koraka natrag u
// aplikaciji. Handler se registrira jednom, pri prikazu prozora, pa ima
// prednost pred globalnim u AppNavigatoru; `naNatrag` se čita iz refa.
export default function useNatrag(naNatrag) {
    const ref = useRef(naNatrag);
    ref.current = naNatrag;
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            ref.current?.();
            return true;
        });
        return () => sub.remove();
    }, []);
}
