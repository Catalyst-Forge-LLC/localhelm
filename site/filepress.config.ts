import { defineFilepressConfig } from 'getfilepress';

export default defineFilepressConfig({
	title: 'LocalHelm',
	description: 'Control panel for local development.',
	url: 'https://localhelm.dev',
	author: 'Catalyst Forge, LLC',
	tagline: 'Control panel for local development',
	lede: 'One board for fleet, sites, and ports, including tools that never publish.',
	logo: '/logo.png',
	ogImage: '/logo.png',
	homePage: 'home',
	nav: [
		{ label: 'Home', href: '/' },
		{ label: 'Docs', href: '/docs' },
		{ label: 'Notes', href: '/writing' },
		{ label: 'Install', href: '/install' },
		{ label: 'npm', href: 'https://www.npmjs.com/package/localhelm' },
	],
	footerLinks: [
		{ label: 'Docs', href: '/docs' },
		{ label: 'Notes', href: '/writing' },
		{ label: 'Install', href: '/install' },
		{ label: 'npm', href: 'https://www.npmjs.com/package/localhelm' },
		{ label: 'LocalSlip', href: 'https://localslip.dev' },
		{
			label: 'AppFacts',
			href: 'https://appfacts.dev/v#af1.eNpFkcFqwzAQRH_FzFmJ2x51agkUSkMvKb2UEjby1lYiS0JaJzEh_15kp-Qqzey8nb3gCP2o4KlnaLhgyHXseijIGMvTav1WSQgOCllIhgwNMmKPDAVnDftcZC-RTMeLp-XDLDQH6Asc-Xagtgg-x8gbk2wUKKTBi50SP0LDy32Gwm-ink8hHaCxObITfreiKsnnaeLorG_LHLLuZH1TrTYbKOwG65rtBKjxZYVxVWg4ZujvCzw0nvM0bJ_rgy3ZERon3lUN5W4XKDXVPfmqZs8cWpSlhTxhV3xmM4gNvvoNqSq9mND35Jt8993gTM43_z_4v-JYEOevCX3u9vpz26SUFskcqOVtT55aTtCIPvZlr8QxZCshjdDoRGLWdd1a6Ybd0oS-XpGQG7MsXkNqebFer-r7Ra9_Do2lOw',
		},
	],
	topics: [{ label: 'Notes', tag: 'notes' }],
	paths: [{ url: '/docs', dir: 'docs/dist' }],
});
