// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'United Desktop Association',
			favicon: '/public/favicon.png',
			logo: {
				src: './src/assets/houston.webp',
			},
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/UniDesktop' }],
			sidebar: [
				{
					label: 'Guides',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Example Guide', slug: 'guides/example' },
					],
				},
				{
					label: 'Reference',
					items: [{ autogenerate: { directory: 'reference' } }],
				},
			],
			defaultLocale: 'zh-cn',
			locales: {
				en: {
					label: 'English',
					lang: 'en-US',
				},
				'zh-cn': {
					label: '简体中文',
					lang: 'zh-CN',
				},
		},
		}),
	],
});
