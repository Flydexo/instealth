"use client";

import { config } from "@/lib/config";
import { wagmiConfig } from "@/lib/utils";
import { AlchemyAccountProvider, AlchemyAccountsProviderProps } from "@alchemy/aa-alchemy/react";
import { QueryClient } from "@tanstack/react-query";
import { PropsWithChildren } from "react";
import { WagmiProvider } from "wagmi";

const queryClient = new QueryClient();

export const Providers = ({
    initialState,
    children,
}: PropsWithChildren<{
    initialState?: AlchemyAccountsProviderProps["initialState"];
}>) => {
    return (
        <AlchemyAccountProvider
            config={config}
            queryClient={queryClient}
            initialState={initialState}
        >
            <WagmiProvider
                config={wagmiConfig}
            >
                {children}
            </WagmiProvider>
        </AlchemyAccountProvider>
    );
};