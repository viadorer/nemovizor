"use client";

import { AgencyForm } from "@/components/admin/agency-form";

export default function AdminNewAgencyPage() {
  return (
    <div className="dashboard-page">
      <AgencyForm mode="create" />
    </div>
  );
}
