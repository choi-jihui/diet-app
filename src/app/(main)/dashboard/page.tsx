import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { ProfileMenu } from "@/components/profile/ProfileMenu";

export default function DashboardPage() {
  return (
    <>
      <PageHeader showBrand title="오늘의 한 끼" action={<ProfileMenu />} />
      <DashboardContent />
    </>
  );
}
