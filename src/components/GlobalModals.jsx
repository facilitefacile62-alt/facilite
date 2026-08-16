"use client";

import dynamic from "next/dynamic";

const FeatureDisabledModal = dynamic(() => import("@/components/FeatureDisabledModal"), { ssr: false });

export default function GlobalModals() {
  return (
    <>
      <FeatureDisabledModal />
    </>
  );
}
