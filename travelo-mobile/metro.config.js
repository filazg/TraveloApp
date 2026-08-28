const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */

// Gradle izlazi se ne prate. Metro ondje nema što tražiti, a njegov watcher na
// Windowsu zna puknuti na putanjama koje gradle ostavi pod
// `app/build/outputs/.../baselineProfiles` — proces tada umre i uređaj usred
// rada dobije crveni ekran, iako s aplikacijom nije ništa.
const androidBuild = path.resolve(__dirname, 'android', 'app', 'build');
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const config = {
    resolver: {
        blockList: [new RegExp(`^${escapeRegExp(androidBuild)}[\\\\/].*`)],
    },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
