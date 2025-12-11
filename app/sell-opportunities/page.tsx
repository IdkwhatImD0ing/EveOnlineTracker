import { redirect } from "next/navigation"

export default function SellOpportunitiesRedirectPage() {
  redirect("/jita-opportunities?tab=sell")
}

