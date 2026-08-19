"use client";

import dynamic from "next/dynamic";

const FeatureDisabledModal = dynamic(() => import("@/components/FeatureDisabledModal"), { ssr: false });
const ScrollToTop = dynamic(() => import("@/components/ScrollToTop"), { ssr: false });

export default function GlobalModals() {
  return (
    <>
      <FeatureDisabledModal />
      <ScrollToTop />
    </>
  );
}
