import { redirect } from "next/navigation"

export default function MarketOpportunitiesRedirectPage() {
  redirect("/jita-opportunities?tab=market")
}

