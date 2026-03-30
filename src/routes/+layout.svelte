<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';

	let { children } = $props();

	const appName = 'Label Maker - Niimbot B1';
	const defaultDescription =
		'Design and print clean black-and-white labels for Niimbot B1 directly from your browser with Web Bluetooth.';
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="application-name" content={appName} />
	<meta name="description" content={defaultDescription} />
	<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content={appName} />
	<meta property="og:title" content={appName} />
	<meta property="og:description" content={defaultDescription} />
	<meta property="og:url" content={page.url.href} />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={appName} />
	<meta name="twitter:description" content={defaultDescription} />
	<link rel="canonical" href={page.url.href} />
</svelte:head>

{@render children()}
