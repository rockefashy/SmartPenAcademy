import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load .env so SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL are available
// during the build-time testimonials pre-fetch.
const _require = createRequire(import.meta.url);
try {
  const dotenv = _require('dotenv');
  dotenv.config({ path: path.resolve(rootDir, '.env') });
} catch {
  // dotenv not available — rely on environment already having the vars set (e.g. Render CI)
}

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

  // ------------------------------------------------------------------
  // Fetch Published testimonials from the database at build time so
  // that the /testimonials page is pre-rendered with real content for
  // Google Search Console to index.  We call the local API if available
  // or fall back gracefully with an empty array so the build never fails.
  // ------------------------------------------------------------------
  let publishedTestimonials = [];
  try {
    const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
    // Use service role key for build-time fetch — this runs server-side during `npm run build`
    // so it is safe. Service role key bypasses RLS to guarantee we can read published testimonials
    // regardless of Supabase RLS policy configuration.
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';
    const response = await fetch(
      `${supabaseUrl}/rest/v1/testimonials?status=in.(Approved,Featured)&order=created_at.desc`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (response.ok) {
      const rows = await response.json();
      publishedTestimonials = rows.map((row) => ({
        id: row.id,
        studentName: row.student_name || '',
        parentName: row.parent_name || '',
        grade: row.grade ? String(row.grade).replace(/\bGrade\s+Grade\b/gi, 'Grade ') : undefined,
        rating: row.rating !== undefined && row.rating !== null ? Number(row.rating) : 0,
        title: (row.title && row.title !== 'Transformation Review') ? row.title : (row.before_after_tag || undefined),
        review: row.review || '',
        beforeAfterTag: row.before_after_tag || undefined,
        image: row.image || undefined,
        mediaConsent: Boolean(row.media_consent),
        status: row.status || 'Approved',
        createdAt: row.created_at || '',
      }));
      // Featured first, then Approved — each group newest-first
      const statusPriority = { Featured: 0, Approved: 1 };
      publishedTestimonials.sort((a, b) => {
        const pa = statusPriority[a.status] ?? 99;
        const pb = statusPriority[b.status] ?? 99;
        if (pa !== pb) return pa - pb;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      console.log(`[prerender] Fetched ${publishedTestimonials.length} public testimonials for /testimonials page.`);
    } else {
      console.warn(`[prerender] Could not fetch testimonials (HTTP ${response.status}) — /testimonials will render with empty state.`);
    }
  } catch (err) {
    console.warn(`[prerender] Supabase testimonials fetch failed: ${err.message} — /testimonials will render with empty state. Start Supabase before building for full pre-rendering.`);
  }
  
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

    // 5. For the /testimonials route, inject pre-fetched testimonial data so that
    //    Googlebot sees real review content in the initial HTML without waiting for JS.
    if (route === '/testimonials' && publishedTestimonials.length > 0) {
      const initialDataScript = `<script>window.__INITIAL_TESTIMONIALS__=${JSON.stringify(publishedTestimonials)};</script>`;
      pageHtml = pageHtml.replace('</body>', `${initialDataScript}\n</body>`);
    }

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

