import { PageHeader } from "@/components/layout/PageHeader";
import { OnboardingForm } from "@/components/forms/OnboardingForm";
import { SUPPORTIVE_COPY } from "@/constants/copy";

export default function OnboardingPage() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-gakk-cream">
      <PageHeader
        showBrand
        backHref="/"
        title="시작하기"
        subtitle={SUPPORTIVE_COPY.onboardingWelcome}
      />
      <OnboardingForm />
    </div>
  );
}
