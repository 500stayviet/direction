"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { CustomerForm } from "@/components/CustomerForm";
import { touchRecentCustomer, upsertCustomer } from "@/lib/storage";
import type { Customer } from "@/lib/types";

export default function NewCustomerPage() {
  const router = useRouter();

  const handleSubmit = async (customer: Customer) => {
    try {
      await upsertCustomer(customer);
      await touchRecentCustomer(customer.id);
      router.push(`/customers/${customer.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "고객 저장에 실패했습니다.");
    }
  };

  return (
    <main>
      <PageHeader
        title="고객 등록"
        backHref="/customers"
        subtitle="고객 DB에 바로 등록"
      />
      <CustomerForm onSubmit={handleSubmit} submitLabel="고객등록하기" />
    </main>
  );
}
