const faqs = [
  {
    question: "Is this actually better than practicing with someone I know?",
    answer: "Practicing with people who care about you is great — but they're rarely trained hiring leaders. Talendro Interview Coach is built on what real hiring managers listen for and how they evaluate your answers."
  },
  {
    question: "Will a $12 session really help?",
    answer: "Yes. Quick Prep gives you a comprehensive intelligence report with company research, likely questions, personalized sample answers, and strategic guidance — everything you need to walk in more prepared than other candidates."
  },
  {
    question: "What if I'm terrible at interviews?",
    answer: "Then you're in the right place. Quick Prep gives you the foundation with sample answers and talking points. Our mock interview options provide live practice to build your confidence through repetition."
  },
  {
    question: "What industries does this work for?",
    answer: "Talendro is built to support a wide range of roles and industries. Because we anchor everything in your résumé and job description, your prep materials stay relevant to your world."
  },
  {
    question: "What if I need help with salary negotiation?",
    answer: "Our coaching helps you frame your value and anticipate compensation conversations, but we're not a negotiation service. That said—candidates who interview well have more leverage when the offer comes."
  }
];

export function FAQSection() {
  return (
    <section className="py-20 bg-background">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-heading font-bold text-primary mb-4">
            Questions
          </h2>
          <p className="text-xl text-tal-slate font-sans mb-2">
            Questions from job seekers like you
          </p>
          <p className="text-tal-gray font-sans">
            If you're stressed, busy, or feeling behind — you're exactly who we built this for.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-tal-soft rounded-xl p-6 border border-border">
              <h4 className="font-heading font-semibold text-tal-navy mb-2">{faq.question}</h4>
              <p className="text-tal-gray font-sans text-sm leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
