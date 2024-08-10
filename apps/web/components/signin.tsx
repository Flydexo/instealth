"use client";

import { gasManagerConfig } from "@/lib/config";
import { EURC } from "@/lib/utils";
import { useAuthenticate, useSigner, useSignerStatus, useSmartAccountClient, useUser } from "@alchemy/aa-alchemy/react";
import { Copy, User } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { formatUnits } from "viem";
import { useBalance } from 'wagmi'

const SignupLoginComponent = () => {
  const [email, setEmail] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const { authenticate } = useAuthenticate();
  const { status } = useSignerStatus();
  const user = useUser();
  const { client } = useSmartAccountClient({ type: 'LightAccount', gasManagerConfig });
  const balance = useBalance({ address: client?.account.address, token: EURC });

  return (
    <>
      {status !== "CONNECTED" ? (
        <button
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md"
          onClick={() => setModalOpen(true)}
        >
          Sign In
        </button>
      ) : (
        <div className="flex items-center space-x-2">
          {balance.data && <span>{Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', currencyDisplay: 'symbol' }).format(Number(formatUnits(balance.data.value, balance.data?.decimals)))}</span>}
          <Copy className="h-6 w-6" onClick={() => navigator.clipboard.writeText(client?.account.address!)} />
          <User className="h-6 w-6" />
          <span>{user?.email}</span>
        </div>
      )}

      {modalOpen && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg">
            <h2 className="text-xl mb-4">Sign In</h2>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="border p-2 mb-4 w-full"
            />
            <button
              onClick={() => {
                authenticate({ type: "email", email })
                setModalOpen(false);
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md"
            >
              Submit
            </button>
          </div>
        </div>,
        document.body
      )}
    </>

  );
};

export default SignupLoginComponent;