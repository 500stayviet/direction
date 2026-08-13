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

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace("/customers");
  };

  return (
    <main>
      <PageHeader
        title="고객 등록"
        onBack={goBack}
        subtitle="방문 일정과 같은 고객 정보로 등록해요"
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
