"use client";

import { useParams } from "next/navigation";
import { PropertyForm } from "@/components/admin/property-form";

export default function BrokerEditPropertyPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <PropertyForm
      mode="edit"
      propertyId={id}
      brokerMode
      redirectTo="/dashboard/moje-inzeraty"
    />
  );
}
