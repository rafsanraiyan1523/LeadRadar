import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQS = [
  {
    question: "What is LeadRadar?",
    answer:
      "LeadRadar is a lead-intelligence platform for agencies and freelancers who sell digital services. It finds local businesses, audits their digital presence, scores how much they'd benefit from your help, and manages outreach through a built-in CRM.",
  },
  {
    question: "How does lead discovery work?",
    answer:
      "You search a business type and a location, and LeadRadar returns real local businesses matching it. In demo mode this comes from a deterministic mock provider so you can try the whole product with zero setup; connect a Google Places API key and the same search returns live results.",
  },
  {
    question: "What information is analyzed?",
    answer:
      "Only what's publicly observable: the business's own website (SEO, mobile-friendliness, conversion elements, technical setup), and its Google Business Profile where one exists. LeadRadar never fabricates revenue, employee counts, or any figure it can't verify.",
  },
  {
    question: "Does it automatically contact businesses?",
    answer:
      "No. LeadRadar never sends a message on its own. It can generate a draft — for one lead or in bulk for a whole campaign — but every send is a manual action you take yourself, on the channel you choose.",
  },
  {
    question: "Can I use it without API keys?",
    answer:
      "Yes. Every external dependency — lead discovery and AI generation both — ships with a fully working mock/local default, so the entire product works at zero cost before you connect anything real.",
  },
  {
    question: "How is opportunity score calculated?",
    answer:
      "From two things: how legitimate and established the business looks (a verified Google profile, rating, review volume) and how weak its digital presence is (website, SEO, mobile, conversion, technical scores). An established business with a poor website scores high — there's real room to help.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="border-t border-border px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>

        <Accordion type="single" collapsible className="mt-12">
          {FAQS.map((faq) => (
            <AccordionItem key={faq.question} value={faq.question}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
