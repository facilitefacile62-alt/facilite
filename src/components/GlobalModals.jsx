"use client";

import dynamic from "next/dynamic";

const AIAssistantModal = dynamic(() => import("@/components/AIAssistantModal"), { ssr: false });
const FeatureDisabledModal = dynamic(() => import("@/components/FeatureDisabledModal"), { ssr: false });

export default function GlobalModals() {
  return (
    <>
      <AIAssistantModal />
      <FeatureDisabledModal />
    </>
  );
}
