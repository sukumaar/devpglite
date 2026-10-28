import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import lucode from 'lucode-starlight';

export default defineConfig({
  trailingSlash: 'never',
  integrations: [starlight({
    title: 'devpglite',
    customCss: ['./src/styles/cards.css'],
    plugins: [lucode({ footerText: '', navLinks: [
      { label: 'Get started', link: '/#start' },
      { label: 'Settings', link: '/#settings' },
      { label: 'Limits', link: '/#limits' },
      { label: 'Development', link: '/#development' },
    ] })],
    sidebar: [{ label: 'Documentation', link: '/' }],
  })],
});
