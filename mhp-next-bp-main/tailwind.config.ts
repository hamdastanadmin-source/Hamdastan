import type { Config } from 'tailwindcss';
import sharedConfig from '@parto-system-design/ui/tailwind.config';

const config: Config = {
  ...sharedConfig,
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@parto-system-design/ui/**/*.{js,ts,jsx,tsx}',
  ],
};

export default config;
