"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { CustomerForm } from "@/components/CustomerForm";
import { touchRecentCustomer, upsertCustomer } from "@/lib/storage";
import type { Customer } from "@/lib/types";

export default function NewCustomerPage() {
  const router = useRouter();

  const handleSubmit = async (customer: Customer) => {
    await upsertCustomer(customer);
    await touchRecentCustomer(customer.id);
    router.push(`/customers/${customer.id}`);
  };

  return (
    <main>
      <PageHeader
        title="손님 추가"
        backHref="/customers"
        subtitle="고객 DB에 바로 등록"
      />
      <CustomerForm onSubmit={handleSubmit} submitLabel="손님 저장하기" />
    </main>
  );
}
