"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { DetailHeaderButton } from "@/components/DetailHeaderButton";
import { CustomerForm } from "@/components/CustomerForm";
import { BlankFormModal } from "@/components/BlankFormModal";
import { SaveCompleteModal } from "@/components/SaveCompleteModal";
import { getCurrentUser, peekCurrentUser } from "@/lib/auth";
import { touchRecentCustomer, upsertCustomer } from "@/lib/storage";
import type { Customer, User } from "@/lib/types";

export default function NewCustomerPage() {
  const router = useRouter();
  const [savedOpen, setSavedOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [agent, setAgent] = useState<User | null>(() => peekCurrentUser());

  useEffect(() => {
    let cancelled = false;
    void getCurrentUser().then((u) => {
      if (!cancelled) setAgent(u);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (customer: Customer) => {
    try {
      await upsertCustomer(customer);
      await touchRecentCustomer(customer.id);
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
        right={
          <DetailHeaderButton tone="form" onClick={() => setFormOpen(true)}>
            고객등록 양식
          </DetailHeaderButton>
        }
      />
      <CustomerForm onSubmit={handleSubmit} submitLabel="고객등록하기" />
      <BlankFormModal
        open={formOpen}
        kind="customer"
        agent={agent}
        onClose={() => setFormOpen(false)}
      />
      <SaveCompleteModal
        open={savedOpen}
        message="등록이 완료되었습니다"
        onClose={() => {
          setSavedOpen(false);
          router.replace("/customers");
        }}
      />
    </main>
  );
}
