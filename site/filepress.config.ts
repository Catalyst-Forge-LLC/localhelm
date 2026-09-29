import { defineFilepressConfig } from 'getfilepress';

export default defineFilepressConfig({
	title: 'LocalHelm',
	description: 'See which local projects need attention in one place.',
	url: 'https://localhelm.dev',
	author: 'Catalyst Forge, LLC',
	tagline: 'Smooth sailing with local dev.',
	lede: 'Git · npm · dependents',
	logo: '/logo.png',
	ogImage: '/logo.png',
	homePage: 'home',
	nav: [
		{ label: 'Home', href: '/' },
		{ label: 'Docs', href: '/docs' },
		{ label: 'Notes', href: '/writing' },
		{ label: 'Install', href: '/install' },
		{ label: 'npm', href: 'https://www.npmjs.com/package/localhelm' },
		{ label: 'GitHub', href: 'https://github.com/Catalyst-Forge-LLC/localhelm', icon: 'github' },
	],
	footerLinks: [
		{ label: 'See the rest of the Catalyst Forge shelf.', href: 'https://catalystforge.com/tools/' },
		{ label: 'Docs', href: '/docs' },
		{ label: 'Notes', href: '/writing' },
		{ label: 'Install', href: '/install' },
		{ label: 'npm', href: 'https://www.npmjs.com/package/localhelm' },
		{ label: 'LocalSlip', href: 'https://localslip.dev' },
		{
			label: 'AppFacts',
			href: 'https://appfacts.dev/v#af1.eNpNkc1u2zAQhF-F2DNttT3ylEJA0bRCLy5yCYpgTa0lxiSXIFdyBMPvHlDKT6_LmdnZj1eYwXzVEDEQGOjYov9JPoAGWVIdtd29EmYPGoqgTAUMoBU3E2jwzlIsVfY9oR1p923_ZRPaM5greIzDhEMV_F0SHWx2SbQ6zOSFtPqFM24z0JCnKG5t8Yd72j8X0HDKGOjC-QwGNtNvJ-uCxbs41Fh0_uJir9rDoZZmfnt4cHVDiinATUNPqYB5vEIEA3dljXouzXlNS2DgQkf1sU2dOKsey3hkzD3c9OaT8vKmrmzKWlzRC9lJHMfV1Hb3n3KX0rLdUT0uCuWN3ApUXFKWQ-JIUcqH685Zju60NFvJd7PlqMpShALc_mk4Ts73lXBCe8aBngJGHCiDgfeTRw6UNvajSCqmaXz93pF82Pc0V-SUuDjhvPwnGpyM03FvOTQtCvqlyO4H54F2Xdd-RsDtFSDzwbY',
		},
	],
	topics: [{ label: 'Notes', tag: 'notes' }],
	paths: [{ url: '/docs', dir: 'docs/dist' }],
});
