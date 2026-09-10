import React from 'react';
import { useStaticQuery, graphql } from 'gatsby';
import defaultSocialImage from '../../assets/images/recognition-banner.png';

// Intrinsic dimensions of `defaultSocialImage`. Update alongside the image so
// that crawlers can lay the card out before the image itself is fetched.
const DEFAULT_SOCIAL_IMAGE_WIDTH = 3629;
const DEFAULT_SOCIAL_IMAGE_HEIGHT = 1599;

/**
 * Renders the document's SEO metadata, including Open Graph and Twitter Card
 * tags so that links to the site unfurl with a rich preview on social media,
 * Slack, Discord and other community channels.
 *
 * Intended to be used from a page's `Head` export:
 *
 *   export const Head = () => <Seo pathname="/" />;
 */
const Seo = ({ title, description, image, pathname, children }) => {
  const { site } = useStaticQuery(graphql`
    query SeoMetadata {
      site {
        siteMetadata {
          title
          description
          siteUrl
          social {
            twitter
          }
        }
      }
    }
  `);

  const metadata = site.siteMetadata;
  const siteUrl = metadata.siteUrl.replace(/\/$/, '');
  // Gatsby serves pages with a trailing slash, so keep the canonical and
  // `og:url` values in step with the URL that is actually shared.
  const path = (pathname || '/').replace(/\/?$/, '/');

  const seo = {
    title: title || metadata.title,
    description: description || metadata.description,
    url: `${siteUrl}${path}`,
    image: `${siteUrl}${image || defaultSocialImage}`,
    twitter: metadata.social?.twitter,
  };

  return (
    <>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <link rel="canonical" href={seo.url} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={metadata.title} />
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:url" content={seo.url} />
      <meta property="og:image" content={seo.image} />
      <meta property="og:image:alt" content={seo.title} />
      {!image && (
        <meta
          property="og:image:width"
          content={DEFAULT_SOCIAL_IMAGE_WIDTH}
        />
      )}
      {!image && (
        <meta
          property="og:image:height"
          content={DEFAULT_SOCIAL_IMAGE_HEIGHT}
        />
      )}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={seo.image} />
      <meta name="twitter:image:alt" content={seo.title} />
      {seo.twitter && <meta name="twitter:site" content={seo.twitter} />}
      {seo.twitter && <meta name="twitter:creator" content={seo.twitter} />}

      {children}
    </>
  );
};

export default Seo;
