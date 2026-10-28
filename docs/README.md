# devpglite documentation

This directory contains the devpglite documentation site, built with Astro,
Starlight, and the Lucode theme. The landing page and full documentation share
one page. Header links jump to sections further down.

## Run locally

Use the project's Node.js 24+ environment and npm. From this directory:

```sh
npm install
npm run dev -- --background
```

Astro prints the local URL when it starts. To manage the background server:

```sh
npm run astro -- dev status
npm run astro -- dev logs
npm run astro -- dev stop
```

The site has its own `package.json` and lockfile. Running `npm start` from the
repository root starts the database; it does not start this site.

## Where to make changes

| File | What it controls |
| --- | --- |
| `src/content/docs/index.mdx` | All page content, the hero, cards, and documentation sections |
| `astro.config.mjs` | Site title, header links, theme options, and custom styles |
| `src/content.config.ts` | Loading documentation pages and validating their frontmatter |
| `src/styles/cards.css` | One card per row and the gap between cards |
| `public/favicon.svg` | The database icon shown in browser tabs |

Edit `index.mdx` for most content changes. Its frontmatter controls the hero;
Markdown and components below it make up the rest of the page. `ContainerSection`
provides the theme's content width and spacing, while `CardGrid` groups the cards.

Keep the documentation on one page. If you rename a heading, update any links
that use its anchor, including the header links in `astro.config.mjs`. For example,
`## Settings` is linked as `/#settings`.

## Writing and styling

Write for someone trying to get a local database running: explain what to do,
show the command, and say what to expect. Keep the wording plain and specific.
Check command names, defaults, and behavior against `../src/` and
`../package.json` when updating examples. Keep warnings about data deletion and
connection limits close to the instructions they affect.

Use Lucode's components and settings where possible. Small CSS overrides belong
in `src/styles/` and are loaded through Starlight's `customCss` setting. The current
card override keeps a single column at every screen size with a `0.75rem` gap.

The theme's default footer credit is disabled with `footerText: ''`. Keep sample
pages, placeholder links, and theme promotional copy out of the site.

## Build and check

From this directory:

```sh
npm run build
npm run preview
```

The static site is written to `dist/`. Preview it to check the layout on desktop
and mobile, section links, search, and light and dark modes. A successful build
checks that the content compiles; it doesn't confirm that the page looks right.

No deployment URL is configured yet, so sitemap generation is skipped. Set
Astro's `site` option once the hosting address is known. If the site will live
under a subpath, configure `base` and update the root-relative links before
publishing.
