import 'react-native-get-random-values'; // crypto.getRandomValues polyfill (required by uuid)
import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { store } from './src/store/store';
import AppNavigator from './src/navigation/AppNavigator';
import { reportDeviceVersion } from './src/api/client';

export default function App() {
    // Heartbeat: pri pokretanju javi TID + verziju poslužitelju (ako je uparen;
    // inače no-op). Fire-and-forget, s malom odgodom da se app slegne.
    useEffect(() => {
        const t = setTimeout(() => { reportDeviceVersion(); }, 4000);
        return () => clearTimeout(t);
    }, []);

    return (
        <Provider store={store}>
            <AppNavigator />
        </Provider>
    );
}
