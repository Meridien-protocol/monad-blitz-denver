"use client";

import { useState, useEffect } from "react";
import { useFaucetDrip } from "@/hooks/useFaucetDrip";
import { Toast } from "@/components/Toast";

export function FaucetDrip() {
  const { status, txHash, error } = useFaucetDrip();
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (status === "success" || status === "error") {
      setShowToast(true);
    }
  }, [status]);

  if (!showToast) return null;

  if (status === "success") {
    return (
      <Toast
        message={`Sent 1 MON to your wallet. Tx: ${txHash?.slice(0, 10)}...`}
        type="success"
        duration={6000}
        onDismiss={() => setShowToast(false)}
      />
    );
  }

  if (status === "error") {
    return (
      <Toast
        message={error || "Faucet error"}
        type="error"
        duration={5000}
        onDismiss={() => setShowToast(false)}
      />
    );
  }

  return null;
}
