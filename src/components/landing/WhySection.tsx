export function WhySection() {
  const comparisons = [
    { feature: "Price per session", traditional: "$150 – $500+", talendro: "$12 – $49" },
    { feature: "Scheduling", traditional: "By appointment only", talendro: "On-demand, 24/7" },
    { feature: "Personalization", traditional: "Depends on the coach", talendro: "Tailored to your résumé & job description" },
    { feature: "Practice volume", traditional: "Limited by your budget", talendro: "Multiple sessions, repeatable practice" },
    { feature: "Feedback speed", traditional: "After the session", talendro: "Instant, for every session" }
  ];

  return (
    <section id="why" className="py-20 bg-background">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-heading font-bold text-primary mb-4">
            Built for real job seekers
          </h2>
          <p className="text-xl text-tal-slate font-sans mb-4">
            Why this beats a $300/hour interview coach
          </p>
          <p className="text-tal-gray font-sans max-w-2xl mx-auto">
            Built by a recruiting executive who's sat across the table from thousands of candidates—and watched great people lose offers they deserved because they weren't ready for the conversation.
          </p>
        </div>

        <div className="max-w-4xl mx-auto overflow-x-auto">
          <table className="w-full bg-card rounded-xl overflow-hidden shadow-soft">
            <thead>
              <tr className="bg-tal-soft">
                <th className="text-left p-4 font-heading font-semibold text-tal-navy">Feature</th>
                <th className="text-left p-4 font-heading font-semibold text-tal-navy">Traditional Coaching</th>
                <th className="text-left p-4 font-heading font-semibold text-tal-navy">Talendro<span className="text-secondary">™</span> Interview Coach</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((row, idx) => (
                <tr key={idx} className="border-b border-border last:border-0">
                  <td className="p-4 font-sans font-semibold text-tal-slate">{row.feature}</td>
                  <td className="p-4 font-sans text-tal-gray">{row.traditional}</td>
                  <td className="p-4 font-sans text-primary font-semibold">{row.talendro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
