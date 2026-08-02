"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PropertyBrief } from "@/components/PropertyBrief";
import { RouteSummaryCard } from "@/components/RouteSummaryCard";
import { NaviAppModal } from "@/components/NaviAppModal";
import { PhoneLink } from "@/components/PhoneLink";
import { StickyActionBar } from "@/components/StickyActionBar";
import { useNaviLaunch } from "@/hooks/useNaviLaunch";
import {
  clearNaviPreference,
  getCustomerById,
  getNaviPreference,
  getScheduleById,
} from "@/lib/storage";
import type { Customer, Schedule } from "@/lib/types";
import { NAVI_APPS } from "@/lib/navi";

export default function FieldLeadPage() {
  const params = useParams<{ scheduleId: string }>();
  const router = useRouter();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [step, setStep] = useState(0);
  const [prefLabel, setPrefLabel] = useState<string | null>(null);
  const { launch, pendingAddress, modalOpen, closeModal } = useNaviLaunch();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const found = await getScheduleById(params.scheduleId);
      if (cancelled) return;
      if (!found || found.properties.length === 0) {
        router.replace("/navi");
        return;
      }
      setSchedule(found);
      if (found.customerId) {
        setCustomer((await getCustomerById(found.customerId)) ?? null);
      } else {
        setCustomer(null);
      }
      const pref = await getNaviPreference();
      if (cancelled) return;
      if (pref?.remember && pref.app) {
        setPrefLabel(NAVI_APPS.find((a) => a.id === pref.app)?.label ?? null);
      } else {
        setPrefLabel(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.scheduleId, router]);

  const property = schedule?.properties[step];
  const nextProperty = schedule?.properties[step + 1];
  const leg = useMemo(() => {
    if (!schedule) return null;
    return schedule.routeSummary.find((r) => r.fromIndex === step) ?? null;
  }, [schedule, step]);

  if (!schedule || !property) {
    return (
      <main className="py-20 text-center text-gray-500">불러오는 중...</main>
    );
  }

  const goNextWithNavi = () => {
    if (!nextProperty) return;
    launch(nextProperty.address);
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openCurrentNavi = () => {
    launch(property.address);
  };

  return (
    <main>
      <PageHeader
        title={`${step + 1}번 매물`}
        backHref="/navi"
        subtitle={`${customer?.name || schedule.guestName || "손님"} · ${step + 1}/${schedule.properties.length}`}
        right={
          prefLabel ? (
            <button
              type="button"
              onClick={() => {
                void clearNaviPreference().then(() => {
                  setPrefLabel(null);
                  alert("내비 앱 선택이 초기화되었습니다.");
                });
              }}
              className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm active:scale-95 transition-all duration-150"
            >
              {prefLabel}
            </button>
          ) : null
        }
      />

      <div className="mb-3 flex gap-1.5">
        {schedule.properties.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setStep(i)}
            className={[
              "h-1.5 flex-1 rounded-full transition-all duration-150",
              i === step ? "bg-[#3182F6]" : i < step ? "bg-blue-200" : "bg-gray-200",
            ].join(" ")}
            aria-label={`${i + 1}번 매물`}
          />
        ))}
      </div>

      {(customer || schedule.guestName) && (
        <Card className="mb-3 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">현장 손님</p>
              <p className="font-bold">
                {customer?.name || schedule.guestName}
              </p>
            </div>
            {customer ? (
              <PhoneLink phone={customer.phone} />
            ) : (
              <span className="text-xs font-semibold text-gray-400">고객없음</span>
            )}
          </div>
        </Card>
      )}

      <div className="space-y-3">
        <PropertyBrief index={step} property={property} />

        <Button variant="outline" fullWidth onClick={openCurrentNavi}>
          📍 현재 매물 네비 열기
        </Button>

        {leg && <RouteSummaryCard summary={leg} />}
      </div>

      <StickyActionBar aboveTab={false}>
        {nextProperty ? (
          <Button fullWidth size="lg" onClick={goNextWithNavi}>
            {step + 2}번 매물 네비 시작하기
          </Button>
        ) : (
          <Button
            fullWidth
            size="lg"
            variant="secondary"
            onClick={() => router.push("/")}
          >
            현장 리드 완료
          </Button>
        )}
      </StickyActionBar>

      <NaviAppModal
        open={modalOpen}
        address={pendingAddress ?? ""}
        onClose={closeModal}
        onOpened={(app) => {
          setPrefLabel(NAVI_APPS.find((a) => a.id === app)?.label ?? null);
        }}
      />
    </main>
  );
}
