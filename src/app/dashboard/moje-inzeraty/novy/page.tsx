import { PropertyForm } from "@/components/admin/property-form";

export default function BrokerNewPropertyPage() {
  return (
    <PropertyForm
      mode="create"
      brokerMode
      redirectTo="/dashboard/moje-inzeraty"
    />
  );
}
