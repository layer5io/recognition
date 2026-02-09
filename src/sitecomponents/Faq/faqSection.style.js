import styled from "styled-components";

const FaqSectionWrapper = styled.section`
  margin: 1.75rem auto 2.5rem auto;
  position: relative;
  overflow: hidden;

  .category_name {
    margin: 2rem 0 0.5rem;
    font-style: italic;
    text-transform: capitalize;
  }

  /* Accordion wrapper */
  .MuiAccordion-root {
    margin-bottom: 2px;
    background: ${(props) => props.theme.body};
    color: ${(props) => props.theme.text};
    // border-radius: 8px;
    overflow: hidden;
    

    &::before {
      display: none;
    }
    &.Mui-expanded {
      margin: 0;   /* removes the empty top space */
    }
    &.Mui-expanded::before {
      display: none;
    }
  }

  /* Accordion header */
  .MuiAccordionSummary-root {
    background: #00b39f;
    padding: 0rem 1rem;

    h5 {
      font-weight: 700;
      font-size: 18px;
      position: relative;
      margin: 0;
      color: #ffffff;
    }
    &.Mui-expanded {
      background: black;
      border: 1px solid #00b39f;
    }
  }

  /* Expand icon */
  .MuiAccordionSummary-expandIconWrapper {
    color: #ffffff;
  }

  /* Accordion body */
  .MuiAccordionDetails-root {
    background: ${(props) => props.theme.body};
    color: ${(props) => props.theme.text};

    p {
      font-size: 16px;
      font-weight: 300;
      text-align: initial;
      color: inherit; /* FIX: prevents invisible text */
    }

    ul {
      padding-left: 1.2rem;
    }

    li {
      color: inherit;
    }
      
  }

  div.faqbutton {
    text-align: center;

    button.faqbutton {
      margin-bottom: 1.25rem;
    }
  }

  .section-title {
    text-align: center;

    h1 {
      margin-bottom: 3.75rem;
      font-size: 40px;
      line-height: 3.125rem;
    }

    .search {
      margin-bottom: 3.125rem;

      input {
        font-size: 20px;
        width: 80%;
        padding: 1rem;
        border: 1px solid #ffffff;
        background-color: #f0f0f0;
        border-radius: 1.25rem;
      }
    }
  }

  .askus_section {
    text-align: left;

    h2 {
      margin-bottom: 1rem;
    }

    p {
      margin-bottom: 2rem;
    }

    button {
      margin-bottom: 0.5rem;
    }
  }

  @media only screen and (max-width: 568px) {
    .section-title {
      text-align: center;
    }
  }

  @media only screen and (max-width: 480px) {
    .MuiAccordionSummary-root h5 {
      font-size: 13px;
      line-height: 21px;
      padding-right: 1.6rem;
    }
  }
`;

export default FaqSectionWrapper;
