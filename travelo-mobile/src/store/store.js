import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import syncReducer from './slices/syncSlice';
import voyageReducer from './slices/voyageSlice';
import navReducer from './slices/navSlice';
import salesReducer from './slices/salesSlice';
import validationReducer from './slices/validationSlice';
import shiftsReducer from './slices/shiftsSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        sync: syncReducer,
        voyage: voyageReducer,
        nav: navReducer,
        sales: salesReducer,
        validation: validationReducer,
        shifts: shiftsReducer,
    },
    // Sync state može imati velike liste (transport_data); serializability check
    // na svaki dispatch blokira JS thread 250-400ms i ruši RN bridge pod scan
    // opterećenjem (Sunmi V2s firmware šalje 3-4 broadcasta u 50ms).
    middleware: (getDefault) => getDefault({
        serializableCheck: false,
        immutableCheck: false,
    }),
});
