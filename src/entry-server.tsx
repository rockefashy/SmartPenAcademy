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
    title: 'SmartPen Academy | Handwriting Coaching & Academic Excellence',
    description: 'SmartPen Academy founded by Mrs. Deepthy Rock. Transforming handwriting into academic excellence for ages 4 to 18 with 7-step progressive coaching.',
    canonical: `${SITE_URL}/`,
    schemaOrg: {
      '@context': 'https://schema.org',
      '@type': 'EducationalOrganization',
      name: 'SmartPen Academy',
      url: SITE_URL,
      logo: `${SITE_URL}/app_images/finallogo.png`,
      description: 'Handwriting coaching and academic excellence academy founded by Mrs. Deepthy Rock.',
      founder: {
        '@type': 'Person',
        name: 'Mrs. Deepthy Rock',
        jobTitle: 'Founder & Master Handwriting Coach'
      },
      foundingDate: '2018',
      sameAs: [
        'https://smartpenacademy.com'
      ],
      offers: {
        '@type': 'Offer',
        category: 'Handwriting Coaching & Improvement'
      }
    }
  },
  '/about': {
    title: 'About Us & Founder | SmartPen Academy',
    description: 'Meet Mrs. Deepthy Rock, founder of SmartPen Academy. Discover our proven handwriting transformation methodology, certified coaching, and academic mission.',
    canonical: `${SITE_URL}/about`,
    schemaOrg: {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: 'About SmartPen Academy',
      url: `${SITE_URL}/about`,
      description: 'The story, philosophy, and proven handwriting transformation methodology behind SmartPen Academy.',
      mainEntity: {
        '@type': 'Person',
        name: 'Mrs. Deepthy Rock',
        jobTitle: 'Founder & Master Handwriting Coach',
        worksFor: {
          '@type': 'EducationalOrganization',
          name: 'SmartPen Academy'
        }
      }
    }
  },
  '/syllabus': {
    title: 'Handwriting Syllabus & Curriculum (Print & Cursive) | SmartPen Academy',
    description: 'Explore SmartPen Academy\'s 7-step progressive handwriting training syllabus covering pencil grip, letter mechanics, cursive joining, and speed writing.',
    canonical: `${SITE_URL}/syllabus`,
    schemaOrg: {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: '7-Step Progressive Handwriting Improvement Programme',
      description: 'Structured handwriting curriculum covering foundational ergonomics, pencil grip, print and cursive letter mechanics, and speed writing mastery.',
      provider: {
        '@type': 'EducationalOrganization',
        name: 'SmartPen Academy',
        sameAs: SITE_URL
      },
      educationalLevel: 'Beginner to Advanced (Ages 4 to 18)',
      courseMode: 'Blended (Online & In-Person)'
    }
  },
  '/workshops': {
    title: 'Specialized Handwriting Workshops | SmartPen Academy',
    description: 'Accelerated handwriting workshops for school students: Board Exam Speed Writing, Calligraphy Distinction, and Young Writers Foundation.',
    canonical: `${SITE_URL}/workshops`,
    schemaOrg: {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'Specialized Handwriting & Exam Speed Workshops',
      description: 'Intensive weekend and holiday handwriting masterclasses focusing on exam speed writing, neatness, and pencil grip correction.',
      organizer: {
        '@type': 'EducationalOrganization',
        name: 'SmartPen Academy',
        url: SITE_URL
      },
      eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode'
    }
  },
  '/testimonials': {
    title: 'Student Handwriting Transformation Stories & Reviews | SmartPen Academy',
    description: 'Read verified testimonials from parents and students who transformed their handwriting, exam neatness, and academic confidence with SmartPen Academy.',
    canonical: `${SITE_URL}/testimonials`,
    schemaOrg: {
      '@context': 'https://schema.org',
      '@type': 'EducationalOrganization',
      name: 'SmartPen Academy Student Transformations',
      url: `${SITE_URL}/testimonials`,
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        reviewCount: '150',
        bestRating: '5'
      }
    }
  },
  '/free-demo': {
    title: 'Book a Free Handwriting Demo Class | SmartPen Academy',
    description: 'Schedule a free 1-on-1 diagnostic handwriting assessment and demo session with SmartPen Academy expert coaches. Limited slots available.',
    canonical: `${SITE_URL}/free-demo`,
    schemaOrg: {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      name: 'Book a Free Handwriting Demo Class',
      url: `${SITE_URL}/free-demo`,
      description: 'Free handwriting assessment and demo class booking at SmartPen Academy.',
      mainEntity: {
        '@type': 'EducationalOrganization',
        name: 'SmartPen Academy'
      }
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
