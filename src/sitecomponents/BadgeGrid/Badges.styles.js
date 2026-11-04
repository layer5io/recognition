import styled from "styled-components";
export const BadgesWrapper = styled.div`
  .badge-section-heading {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 3rem 0 1.5rem;
    scroll-margin-top: 6rem;
    flex-wrap: wrap;

    h2 {
      margin: 0;
      font-size: 2rem;
      color: ${({ theme }) => theme.text};
    }

    .heading-anchor {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.25rem;
      border: none;
      background: transparent;
      color: ${({ theme }) => theme.text};
      border-radius: 0.375rem;
      opacity: 0;
      cursor: pointer;
      transition: opacity 0.2s ease, color 0.2s ease, background 0.2s ease;
    }

    &:hover .heading-anchor,
    &:focus-within .heading-anchor {
      opacity: 1;
    }

    .heading-anchor:hover {
      color: ${({ theme }) => theme.primary || '#00b39f'};
      background-color: rgba(0, 179, 159, 0.08);
    }

    .heading-anchor:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
      opacity: 1;
    }

    .copy-feedback {
      font-size: 0.875rem;
      color: ${({ theme }) => theme.primary || '#00b39f'};
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    .copy-feedback.visible {
      opacity: 1;
      transform: translateY(0);
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  }

  div.badge-grid {
    display: flex;
    flex-wrap: wrap;
    flex-direction: row;
    justify-content: center;
    gap: 1rem;
    > .badge-card {
      position: relative;
      flex-grow: 1;
      width: 260px;
      max-width: 20%;
      height: 440px;
      margin: 1rem;
      overflow: hidden;
      border-radius: 12px;
      border: 1px solid rgba(128, 128, 128, 0.3);
      background: ${({ theme }) => theme.body || 'transparent'};
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      transition: box-shadow 0.3s ease, transform 0.3s ease;
      outline: none;

      &:focus {
        outline: 2px solid currentColor;
      }

      .badge-image {
        position: absolute;
        top: 1rem;
        left: 0;
        right: 0;
        display: flex;
        justify-content: center;
        transition: transform 0.4s ease, opacity 0.4s ease;
        img {
          max-width: 100%;
          width: 230px;
          height: 330px;
          object-fit: contain;
        }
      }
      .badge-info {
        position: absolute;
        left: 0;
        right: 0;
        top: 78%;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        transition: top 0.4s ease;
      }
      .badge-info > * {
        padding: 0 1rem;
      }
      .badge-title {
        font-weight: 600;
        font-size: 1.3125rem;
        margin-bottom: 0.3125rem;
        color: ${({ theme }) => theme.text};
      }
      .badge-label {
        font-family: 'Fira Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
        color: #888;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.75em;
        letter-spacing: 0.5px;
        margin-top: 4px;
        font-weight: 600;
      }
      .badge-description {
        margin: 0.75rem 0 0;
        font-size: 0.95rem;
        line-height: 1.45;
        color: ${({ theme }) => theme.text};
        opacity: 0;
        transform: translateY(40px);
        transition: opacity 0.4s ease, transform 0.4s ease;
        pointer-events: none;
        max-height: 20rem;
        overflow-x: hidden;
        overflow-y: auto;
        text-align: left;
      }

      &:hover,
      &:focus-within,
      &:focus {
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
        transform: translateY(-2px);
        .badge-image {
          transform: translateY(-120%);
          opacity: 0;
        }
        .badge-info {
          top: 1.25rem;
        }
        .badge-description {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }
      }
    }
  }  
  @media (max-width: 1250px) {
    div.badge-grid > .badge-card {
      max-width: 25%;
    }
  }
  @media (max-width: 1060px) {
    div.badge-grid > .badge-card {
      max-width: 45%;
    }
  }
  @media (max-width: 670px) {
    div.badge-grid > .badge-card {
      max-width: 95%;
    }
  }

  @media (max-width: 768px) {
    .badge-section-heading {
      gap: 0.5rem;

      .heading-anchor {
        opacity: 1;
      }

      .copy-feedback {
        width: 100%;
      }
    }
  }
`;

const Badges = styled.section`
  padding: 3.1rem 0 3.1rem 0;
  background: #222;

  .container{
      display: flex;
      margin: auto;
      width: 60%;
  }

  .footer-links {
    width: 100%;
    margin: 1rem;
    padding: 0;
  
    li {
      list-style: none;
      margin: 0.75rem 0.75rem 0.75rem 0.125rem;
  
      a {
        &:hover {
          text-decoration: none;
          color: white;
        }
        img {
          margin-right: 10px;
          transition: fill 0.2s ease;
          vertical-align: middle;
          position: relative;
          top: -2px;
          width: 22px;
          height: 22px;
          filter: invert(0.75) grayscale(1);
        }

        &:hover {
          img {
            filter: invert(0);
          }
        }
      }
    }
  }

  .socials {
    flex: 0 0 15%;
  }

  @media screen and (max-width: 1400px) {
    .community, .getting-started, .resources, .socials {
      flex: 0 0 22%;
    }
  }

  @media screen and (max-width: 992px) {
    .container {
      flex-wrap: wrap;
      width: 75%;
    }
    .community, .getting-started, .resources, .socials {
      flex: 0 0 30%;
      margin: 1rem 1rem 1rem 5rem;
    }
  }

  @media screen and (max-width: 650px) {
    .container {
      flex-wrap: wrap;
      width: 90%;
    }
    .community, .getting-started, .resources, .socials {
      flex: 0 0 30%;
      margin: 1rem 1rem 1rem 4rem;
    }
  }

  @media screen and (max-width: 450px) {
    .container {
      flex-wrap: wrap;
      width: 90%;
    }
    .community, .getting-started, .resources, .socials {
      flex: 0 0 100%;
      margin: 1rem 0;
      text-align: center;
    }
  }

  .copyright {
    font-size: 0.9rem;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid #3C494F;
    display: flex;
    justify-content:space-evenly;
    text-align:center;
    @media (max-width:1000px) {
      flex-direction: column;
      text-align: center;
      .text{
        text-align: center;
        padding-top: 10px;
        padding-bottom: 10px;
      }
    }
  }
  
  .meshery-footer {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: auto;

    img {
      width: 120px;
      height: 30px;
    }
  }
  
  &, a {
    color: #999;
  }

  a {
    text-decoration: none;

    &:hover {
      color: #fff;
    }
  }

  .section-title{
    font-size: 1.25rem;
    margin-bottom: 1rem;
    color: rgba(255, 255, 255, 0.8);

    .title-link {
        transition: 0.2s all;
        color: rgba(255, 255, 255, 0.75);
        &:hover {
            color: #fff;
        }
    }
  }

  .section-categories {
    padding: 0;
    list-style: none;
    margin: 0;
    font-size: 0.9rem;

    .category-link {
      color: rgba(255, 255, 255, 0.5);
      transition: 0.2s all;
    }
  }
`;

export {Badges};
export default BadgesWrapper;
