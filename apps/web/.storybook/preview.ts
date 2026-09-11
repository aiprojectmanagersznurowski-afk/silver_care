import type { Preview } from '@storybook/react';
import '../src/app/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'silver-care-light',
      values: [
        { name: 'silver-care-light', value: '#FBFAF8' },
        { name: 'silver-care-dark', value: '#171614' },
      ],
    },
  },
};

export default preview;
