"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { CustomerForm } from "@/components/CustomerForm";
import { SaveCompleteModal } from "@/components/SaveCompleteModal";
import { touchRecentCustomer, upsertCustomer } from "@/lib/storage";
import type { Customer } from "@/lib/types";

export default function NewCustomerPage() {
  const router = useRouter();
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const handleSubmit = async (customer: Customer) => {
    try {
      await upsertCustomer(customer);
      await touchRecentCustomer(customer.id);
      setSavedId(customer.id);
      setSavedOpen(true);
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
      <SaveCompleteModal
        open={savedOpen}
        message="등록이 완료되었습니다"
        onClose={() => {
          setSavedOpen(false);
          if (savedId) router.push(`/customers/${savedId}`);
        }}
      />
    </main>
  );
}
