import { MarketingNav } from "@/components/marketing/marketing-nav";
import { HeroSection } from "@/components/marketing/hero-section";
import { ProblemSection } from "@/components/marketing/problem-section";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { FeaturesSection } from "@/components/marketing/features-section";
import { ProductShowcaseSection } from "@/components/marketing/product-showcase-section";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />
      <main className="flex-1">
        <HeroSection />
        <ProblemSection />
        <HowItWorksSection />
        <FeaturesSection />
        <ProductShowcaseSection />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <MarketingFooter />
    </div>
  );
}
