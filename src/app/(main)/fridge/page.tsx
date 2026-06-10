import { redirect } from "next/navigation";

export default function FridgePage() {
  redirect("/diet?tab=fridge");
}
