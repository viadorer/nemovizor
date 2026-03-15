"use client";

import { useParams } from "next/navigation";
import { BrokerForm } from "@/components/admin/broker-form";

export default function AdminEditBrokerPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div className="dashboard-page">
      <BrokerForm mode="edit" brokerId={id} />
    </div>
  );
}
