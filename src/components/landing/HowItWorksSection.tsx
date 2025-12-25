export function HowItWorksSection() {
  const steps = [
    {
      number: 1,
      title: "Upload Your Materials",
      description: "Share your résumé, job description, and company URL"
    },
    {
      number: 2,
      title: "Get Intelligence Report",
      description: "Receive comprehensive company research, role analysis, and strategic guidance"
    },
    {
      number: 3,
      title: "Study Your Briefing",
      description: "Review company intel, 20+ likely questions, personalized sample answers, and red flag guidance"
    },
    {
      number: 4,
      title: "Walk in with more preparation than any other candidate",
      description: "Show up knowing the company, the role, and exactly how to position yourself"
    }
  ];

  return (
    <section id="how-it-works" className="py-20 bg-background">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left Column - Description */}
          <div>
            <p className="text-sm text-primary font-semibold tracking-wider uppercase mb-2">
              See it in action
            </p>
            <h2 className="text-4xl font-bold text-foreground leading-tight mb-4">
              Here's what you'll walk in with
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Upload your résumé, job description, and company URL. Get a comprehensive intelligence report with everything you need to own the interview.
            </p>

            <div className="flex flex-col gap-6">
              {steps.map((step) => (
                <div key={step.number} className="flex items-start gap-4">
                  <div className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    {step.number}
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">{step.title}</h4>
                    <p className="text-muted-foreground text-sm">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Demo Card */}
          <div className="bg-card border-2 border-border rounded-xl p-6 shadow-soft">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-foreground mb-1">What $12 gets you</h3>
              <p className="text-sm text-muted-foreground">Real report from a real VP of Recruiting opportunity</p>
            </div>

            <div className="space-y-4 text-sm">
              <div className="bg-muted rounded-lg p-4">
                <p className="font-semibold text-primary mb-2">📋 QUICK INTERVIEW PREP PACKET</p>
                
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-foreground">1. Company Quick Facts</p>
                    <p className="text-muted-foreground text-xs">
                      Files.com is a $35M+ cloud storage and file sharing business with only 70 employees, demonstrating exceptional efficiency and productivity per employee...
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-foreground">2. Role Alignment Summary</p>
                    <p className="text-muted-foreground text-xs">
                      Your extensive experience leading transformational talent acquisition initiatives at scale makes you an ideal fit for Files.com's VP of Recruiting role...
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-foreground">3. Most Likely Interview Questions</p>
                    <p className="text-muted-foreground text-xs">
                      • "How would you approach building a recruiting function that treats talent acquisition as a competitive advantage?"<br/>
                      • "What's your strategy for scaling quality hiring while maintaining a lean, high-output team culture?"
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-foreground">4. Sample Answers</p>
                    <p className="text-muted-foreground text-xs">
                      "At Cox Enterprises, I transformed talent acquisition from a transactional function into a strategic competitive advantage..."
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-foreground">5. Questions to Ask the Interviewer</p>
                    <p className="text-muted-foreground text-xs">
                      • "What specific metrics or outcomes would indicate success in this role after the first 6 and 12 months?"
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold text-foreground">6. Red Flags to Address</p>
                    <p className="text-muted-foreground text-xs">
                      Brief gap between 2015-2019 appears to be consulting period, but be prepared to explain the value...
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground text-center mt-4 italic">
              This is a real report generated for a real VP of Recruiting opportunity. Every report is this comprehensive.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
