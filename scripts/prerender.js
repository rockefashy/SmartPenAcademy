import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

async function prerender() {
  console.log('[prerender] Starting static HTML generation for public pages...');
  
  const templatePath = path.resolve(rootDir, 'dist/index.html');
  if (!fs.existsSync(templatePath)) {
    throw new Error('dist/index.html not found. Run client build first.');
  }
  const rawTemplate = fs.readFileSync(templatePath, 'utf8');

  const ssrPath = path.resolve(rootDir, 'dist-ssr/entry-server.js');
  if (!fs.existsSync(ssrPath)) {
    throw new Error('dist-ssr/entry-server.js not found. Run SSR build first.');
  }

  const { render, PUBLIC_ROUTES_METADATA } = await import(`file://${ssrPath}`);
  
  const routes = Object.keys(PUBLIC_ROUTES_METADATA);

  for (const route of routes) {
    const { html, metadata } = render(route);
    
    // 1. Inject rendered HTML inside root
    let pageHtml = rawTemplate.replace(
      '<div id="root"></div>',
      `<div id="root">${html}</div>`
    );

    // 2. Update Title
    pageHtml = pageHtml.replace(
      /<title>.*?<\/title>/i,
      `<title>${metadata.title}</title>`
    );

    // 3. Update or inject meta description
    if (pageHtml.includes('<meta name="description"')) {
      pageHtml = pageHtml.replace(
        /<meta name="description"[^>]*>/i,
        `<meta name="description" content="${metadata.description}" />`
      );
    } else {
      pageHtml = pageHtml.replace(
        '</head>',
        `  <meta name="description" content="${metadata.description}" />\n  </head>`
      );
    }

    // 4. Inject Canonical, Open Graph, Twitter cards, and Schema.org
    const seoTags = `
    <!-- Canonical & SEO Social Meta -->
    <link rel="canonical" href="${metadata.canonical}" />
    <meta property="og:title" content="${metadata.title}" />
    <meta property="og:description" content="${metadata.description}" />
    <meta property="og:url" content="${metadata.canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="https://smartpenacademy.com/app_images/finallogo.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${metadata.title}" />
    <meta name="twitter:description" content="${metadata.description}" />
    <meta name="twitter:image" content="https://smartpenacademy.com/app_images/finallogo.png" />
    <script type="application/ld+json">
${JSON.stringify(metadata.schemaOrg, null, 2)}
    </script>`;

    pageHtml = pageHtml.replace('</head>', `${seoTags}\n  </head>`);

    // Determine output file location
    let outFilePath;
    if (route === '/') {
      outFilePath = path.resolve(rootDir, 'dist/index.html');
    } else {
      const subDir = path.resolve(rootDir, 'dist', route.replace(/^\//, ''));
      if (!fs.existsSync(subDir)) {
        fs.mkdirSync(subDir, { recursive: true });
      }
      outFilePath = path.resolve(subDir, 'index.html');
    }

    fs.writeFileSync(outFilePath, pageHtml, 'utf8');
    console.log(`[prerender] Rendered static route: ${route} -> ${path.relative(rootDir, outFilePath)} (${pageHtml.length} bytes)`);
  }

  // 5. Generate sitemap.xml
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://smartpenacademy.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://smartpenacademy.com/about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://smartpenacademy.com/syllabus</loc>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://smartpenacademy.com/workshops</loc>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://smartpenacademy.com/testimonials</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://smartpenacademy.com/free-demo</loc>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
`;
  fs.writeFileSync(path.resolve(rootDir, 'dist/sitemap.xml'), sitemapXml, 'utf8');
  console.log('[prerender] Generated dist/sitemap.xml');

  // 6. Generate robots.txt
  const robotsTxt = `User-agent: *
Allow: /
Allow: /about
Allow: /syllabus
Allow: /workshops
Allow: /testimonials
Allow: /free-demo
Disallow: /api/
Disallow: /admin
Disallow: /parentPortal
Disallow: /studentDetail

Sitemap: https://smartpenacademy.com/sitemap.xml
`;
  fs.writeFileSync(path.resolve(rootDir, 'dist/robots.txt'), robotsTxt, 'utf8');
  console.log('[prerender] Generated dist/robots.txt');

  console.log('[prerender] Static pre-rendering completed successfully.');

  // Clean up temporary dist-ssr directory
  const ssrDir = path.resolve(rootDir, 'dist-ssr');
  if (fs.existsSync(ssrDir)) {
    fs.rmSync(ssrDir, { recursive: true, force: true });
    console.log('[prerender] Cleaned up temporary dist-ssr directory.');
  }
}

prerender().catch((err) => {
  console.error('[prerender] Error during pre-rendering:', err);
  process.exit(1);
});

