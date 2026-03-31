import type { Configuration } from 'electron-builder';

const config: Configuration = {
  appId: 'com.termimate.app',
  productName: 'Termimate',
  directories: {
    buildResources: 'resources',
    output: 'dist',
  },
  files: ['out/**/*', 'package.json'],
  linux: {
    target: ['deb', 'AppImage', 'rpm'],
    category: 'Development',
  },
  win: {
    target: ['nsis'],
  },
  mac: {
    target: ['dmg'],
  },
};

export default config;
