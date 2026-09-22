import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';

export interface PageMetadata {
  title: string;
  description: string;
  canonical: string;
  schemaOrg: object;
}

const SITE_URL = 'https://smartpenacademy.com';

export const PUBLIC_ROUTES_METADATA: Record<string, PageMetadata> = {
  '/': {
    title: 'SmartPen Academy | Handwriting Coaching & Academic Excellence Bangalore',
    description: 'SmartPen Academy founded by Mrs. Deepthy Rock. Transforming handwriting into academic excellence for ages 4 to 18 with 7-step progressive coaching in Electronic City Bangalore.',
    canonical: `${SITE_URL}/`,
    schemaOrg: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'EducationalOrganization',
          '@id': `${SITE_URL}/#organization`,
          name: 'SmartPen Academy',
          url: SITE_URL,
          logo: `${SITE_URL}/app_images/finallogo.png`,
          image: `${SITE_URL}/app_images/finallogo.png`,
          description: 'Premier handwriting coaching academy founded by Mrs. Deepthy Rock. Transforming handwriting into academic excellence for students aged 4 to 18.',
          telephone: '+918861751000',
          email: 'deepthysrock@gmail.com',
          address: {
            '@type': 'PostalAddress',
            streetAddress: 'Ajmera Infinity, Electronic City Phase 1',
            addressLocality: 'Bangalore',
            addressRegion: 'Karnataka',
            postalCode: '560100',
            addressCountry: 'IN'
          },
          geo: {
            '@type': 'GeoCoordinates',
            latitude: 12.8452,
            longitude: 77.6602
          },
          founder: {
            '@type': 'Person',
            name: 'Mrs. Deepthy Rock',
            jobTitle: 'Founder & Master Handwriting Coach'
          },
          foundingDate: '2018'
        }
      ]
    }
  },
  '/about': {
    title: 'About Mrs. Deepthy Rock & SmartPen Academy | Bangalore Handwriting Coach',
    description: 'Meet Mrs. Deepthy Rock, founder of SmartPen Academy Bangalore. Discover our 10+ year proven kinetic handwriting methodology, certified coaching, and academic mission.',
    canonical: `${SITE_URL}/about`,
    schemaOrg: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'About Us', item: `${SITE_URL}/about` }
          ]
        },
        {
          '@type': 'AboutPage',
          '@id': `${SITE_URL}/about#webpage`,
          url: `${SITE_URL}/about`,
          name: 'About SmartPen Academy & Mrs. Deepthy Rock',
          description: 'The story, pedagogical research, and proven handwriting transformation methodology behind SmartPen Academy.',
          mainEntity: {
            '@type': 'Person',
            name: 'Mrs. Deepthy Rock',
            jobTitle: 'Founder & Master Handwriting Coach',
            worksFor: {
              '@type': 'EducationalOrganization',
              name: 'SmartPen Academy',
              url: SITE_URL
            }
          }
        }
      ]
    }
  },
  '/syllabus': {
    title: 'Handwriting Syllabus & Curriculum (Print & Cursive) | SmartPen Academy',
    description: 'Explore SmartPen Academy\'s 7-step progressive handwriting training syllabus covering pencil grip, letter mechanics, cursive joining, and exam speed writing.',
    canonical: `${SITE_URL}/syllabus`,
    schemaOrg: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Curriculum & Syllabus', item: `${SITE_URL}/syllabus` }
          ]
        },
        {
          '@type': 'Course',
          '@id': `${SITE_URL}/syllabus#course`,
          name: '7-Step Progressive Handwriting Improvement Programme',
          description: 'Structured handwriting curriculum covering foundational ergonomics, pencil grip, print and cursive letter mechanics, baseline alignment, and speed writing mastery.',
          provider: {
            '@type': 'EducationalOrganization',
            name: 'SmartPen Academy',
            url: SITE_URL
          },
          educationalLevel: 'Beginner to Advanced (Ages 4 to 18)',
          courseMode: 'Blended (Online & In-Person Bangalore)',
          hasCourseInstance: {
            '@type': 'CourseInstance',
            courseMode: 'Blended',
            courseWorkload: 'PT10H'
          }
        }
      ]
    }
  },
  '/workshops': {
    title: 'Specialized Handwriting & Board Exam Speed Workshops | SmartPen Academy',
    description: 'Accelerated handwriting workshops for school students in Bangalore: Super-Speed Exam Writing Intensive, Little Scribblers Grip Camp, and Cursive Calligraphy.',
    canonical: `${SITE_URL}/workshops`,
    schemaOrg: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Specialized Workshops', item: `${SITE_URL}/workshops` }
          ]
        },
        {
          '@type': 'EducationEvent',
          '@id': `${SITE_URL}/workshops#event`,
          name: 'Specialized Handwriting & Exam Speed Workshops',
          description: 'Intensive weekend and holiday handwriting masterclasses focusing on exam speed writing, neatness, and pencil grip correction.',
          organizer: {
            '@type': 'EducationalOrganization',
            name: 'SmartPen Academy',
            url: SITE_URL
          },
          eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
          eventStatus: 'https://schema.org/EventScheduled'
        }
      ]
    }
  },
  '/testimonials': {
    title: 'Student Handwriting Transformation Stories & Reviews | SmartPen Academy',
    description: 'Read verified testimonials from parents and students who transformed their handwriting, exam neatness, and academic confidence with SmartPen Academy.',
    canonical: `${SITE_URL}/testimonials`,
    schemaOrg: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Parent Testimonials', item: `${SITE_URL}/testimonials` }
          ]
        },
        {
          '@type': 'EducationalOrganization',
          '@id': `${SITE_URL}/testimonials#organization`,
          name: 'SmartPen Academy Student Transformations',
          url: `${SITE_URL}/testimonials`,
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.9',
            reviewCount: '150',
            bestRating: '5',
            worstRating: '1'
          }
        }
      ]
    }
  },
  '/free-demo': {
    title: 'Book a Free Handwriting Demo Class & Diagnostic Assessment | SmartPen Academy',
    description: 'Schedule a free 1-on-1 diagnostic handwriting assessment and demo session with Mrs. Deepthy Rock. Pinpoint grip, slant, and exam speed bottlenecks.',
    canonical: `${SITE_URL}/free-demo`,
    schemaOrg: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Book Free Demo', item: `${SITE_URL}/free-demo` }
          ]
        },
        {
          '@type': 'ContactPage',
          '@id': `${SITE_URL}/free-demo#contact`,
          name: 'Book a Free Handwriting Diagnostic Demo Class',
          url: `${SITE_URL}/free-demo`,
          description: 'Free handwriting assessment and demo class booking at SmartPen Academy Bangalore.',
          mainEntity: {
            '@type': 'EducationalOrganization',
            name: 'SmartPen Academy',
            telephone: '+918861751000'
          }
        }
      ]
    }
  }
};

export function render(url: string): {
  html: string;
  metadata: PageMetadata;
} {
  const normalizedPath = url.split('?')[0].split('#')[0] || '/';
  const cleanPath = normalizedPath.endsWith('/') && normalizedPath.length > 1
    ? normalizedPath.slice(0, -1)
    : normalizedPath;

  const metadata = PUBLIC_ROUTES_METADATA[cleanPath] || PUBLIC_ROUTES_METADATA['/'];

  let initialView = 'landing';
  if (cleanPath === '/about') {
    initialView = 'about';
  } else if (cleanPath === '/syllabus') {
    initialView = 'syllabus';
  } else if (cleanPath === '/workshops') {
    initialView = 'workshops';
  } else if (cleanPath === '/testimonials') {
    initialView = 'testimonials';
  } else if (cleanPath === '/free-demo') {
    initialView = 'free-demo';
  }

  const html = renderToString(<App initialView={initialView} />);

  return {
    html,
    metadata
  };
}
