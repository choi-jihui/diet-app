import { PageHeader } from "@/components/layout/PageHeader";
import { DietContent, type DietTab } from "@/components/diet/DietContent";

function resolveTab(value: string | string[] | undefined): DietTab {
  return value === "plan" ? "plan" : "fridge";
}

export default async function DietPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab } = await searchParams;

  return (
    <>
      <PageHeader title="식단" />
      <DietContent initialTab={resolveTab(tab)} />
    </>
  );
}
