"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { DitheredButton } from "@/components/DitheredButton.dynamic";

export function DitheredConnectButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none" as const,
                userSelect: "none" as const,
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <DitheredButton
                    onClick={openConnectModal}
                    variant="gold"
                    size="lg"
                  >
                    Connect Wallet
                  </DitheredButton>
                );
              }

              if (chain.unsupported) {
                return (
                  <DitheredButton
                    onClick={openChainModal}
                    variant="no"
                    size="md"
                  >
                    Wrong Network
                  </DitheredButton>
                );
              }

              return (
                <DitheredButton
                  onClick={openAccountModal}
                  variant="gold"
                  size="md"
                >
                  {account.displayName}
                  {account.displayBalance
                    ? ` (${account.displayBalance})`
                    : ""}
                </DitheredButton>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
