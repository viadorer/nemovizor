"use client";

import { useParams } from "next/navigation";
import { AgencyForm } from "@/components/admin/agency-form";

export default function AdminEditAgencyPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div className="dashboard-page">
      <AgencyForm mode="edit" agencyId={id} />
    </div>
  );
}
