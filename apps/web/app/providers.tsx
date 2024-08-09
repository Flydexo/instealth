"use client";

import { config } from "@/lib/config";
import { AlchemyAccountProvider, AlchemyAccountsProviderProps } from "@alchemy/aa-alchemy/react";
import { QueryClient } from "@tanstack/react-query";
import { PropsWithChildren } from "react";

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
            {children}
        </AlchemyAccountProvider>
    );
};