import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Change this one line to re-brand the package. Keep it reverse-DNS.
  appId: 'com.velocitynine.agentv9',
  appName: 'Agent V9: Velocity City',
  webDir: 'dist',
  android: {
    // The game is 100% offline — never let the WebView fall back to cleartext HTTP.
    allowMixedContent: false,
  },
};

export default config;
