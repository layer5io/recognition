import React, {useState} from "react";
import data from "../../assets/data/faq";
import FaqSectionWrapper from "./faqSection.style";
import Button from "../../reusecore/Button";

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionSummary, AccordionDetails } from "@sistent/sistent";

const Faq = (props) => {
  const [expanded, setExpanded] = useState(false);
  
  let faq_keys = [];
  let faqs_data = [];
  if (props.category === undefined)
      faqs_data = data.faqs;
  else {
    props.category.forEach(item => {
      if (item === "all")
          faqs_data = data.faqs;
      else {
          data.faqs.forEach(faq => {
              if (faq.category.toString() === item) {
                  faqs_data.push(faq);
              }
          });
      }
    });
  }
  const handleChange = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : false);
  };

  let faqs = faqs_data.reduce((faq, ind) => {
    faq[ind.category] = [...faq[ind.category] || [], ind];
    return faq;
  }, {});

  faq_keys = Object.keys(faqs);

  return (
    <FaqSectionWrapper>
        {faq_keys.map((key) => (
          <>
            {faqs[key].map((faq, index) => {
              const panelId = `panel${index}`;
              return (
              <Accordion 
                key={panelId}
                expanded={expanded === panelId}
                onChange={handleChange(panelId)}
              >
                <AccordionSummary 
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls={`${panelId}bh-content`}
                  id={`${panelId}bh-header`}
                >
                  <h5>{faq.question}</h5>
                </AccordionSummary>
                <AccordionDetails className="accordion-details">
                    {faq.answer.length >= 1 ? (
                      <ul>
                        {faq.answer.map((ans, id) => (
                          <li key={id}>
                            <p>{ans}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <br />
                    )}

                    <div className="faqbutton">
                      {faq.link && (
                        <Button
                          primary
                          className="faqbutton"
                          url={faq.link}
                          title={faq.linktext}
                          external={false}
                        />
                      )}
                    </div>
                </AccordionDetails>
              </Accordion>
            )})}
          </>
        ))}

    </FaqSectionWrapper>
  )
}

export default Faq;