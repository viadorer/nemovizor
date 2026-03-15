"use client";

import { BrokerForm } from "@/components/admin/broker-form";

export default function AdminNewBrokerPage() {
  return (
    <div className="dashboard-page">
      <BrokerForm mode="create" />
    </div>
  );
}
